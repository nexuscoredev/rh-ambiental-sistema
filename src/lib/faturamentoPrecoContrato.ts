import {
  parseEquipamentosContratoJsonb,
  parseResiduosContratoJsonb,
  parseVeiculosContratoJsonb,
  type EquipamentoContratoItem,
  type ResiduoContratoItem,
  type VeiculoContratoItem,
} from './clienteContratoCadastro'

export type PrecoBreakdownLinha = { chave: string; rotulo: string; valor: number }

export type PrecoContratoOrigem =
  | 'contrato_cliente_mtr_consolidado'
  | 'contrato_cliente_residuo'
  | 'contrato_cliente_residuo_minimo'
  | 'nenhuma'

export type ResultadoPrecoContrato = {
  total: number
  linhas: PrecoBreakdownLinha[]
  origem: PrecoContratoOrigem
  residuoContrato: ResiduoContratoItem | null
  veiculoContrato: VeiculoContratoItem | null
  equipamentosContrato: EquipamentoContratoItem[]
  maoObraContrato: EquipamentoContratoItem[]
  unidadeMedida: string
  quantidadeFaturada: number
  valorUnitario: number
  faturamentoMinimoKg: number
  valorCaminhao: number
  valorEquipamentos: number
  valorMaoObra: number
  valorResiduo: number
}

function parseNumero(valor: string | number | null | undefined): number {
  if (valor == null || valor === '') return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const t = String(valor).trim().replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function normalizarTexto(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function extrairCodigoResiduo(s: string): string | null {
  const m = s.match(/rg-r-\d+/i)
  return m ? m[0].toLowerCase() : null
}

function textoCombina(alvo: string, candidato: string): boolean {
  const a = normalizarTexto(alvo)
  const c = normalizarTexto(candidato)
  if (!a || !c) return false
  return a === c || a.includes(c) || c.includes(a)
}

function hintsFromTexto(valor: string | null | undefined): string[] {
  const t = (valor ?? '').trim()
  if (!t) return []
  return t
    .split(/\||\n|;|,/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Casa o resíduo da coleta com uma linha do contrato do cliente. */
export function encontrarResiduoContrato(
  itens: ResiduoContratoItem[],
  tipoResiduoColeta: string | null | undefined
): ResiduoContratoItem | null {
  const alvo = (tipoResiduoColeta ?? '').trim()
  if (!alvo) return null
  const validos = itens.filter((r) => r.tipo_residuo.trim())
  if (validos.length === 0) return null

  const na = normalizarTexto(alvo)
  const codigoAlvo = extrairCodigoResiduo(alvo)

  const exact = validos.find((r) => normalizarTexto(r.tipo_residuo) === na)
  if (exact) return exact

  if (codigoAlvo) {
    const porCodigo = validos.find((r) => extrairCodigoResiduo(r.tipo_residuo) === codigoAlvo)
    if (porCodigo) return porCodigo
  }

  const parcial = validos.find((r) => {
    const nr = normalizarTexto(r.tipo_residuo)
    return nr.includes(na) || na.includes(nr)
  })
  return parcial ?? null
}

/** Caminhão do contrato casado com tipo da programação / MTR / cadastro. */
export function encontrarVeiculoContrato(
  itens: VeiculoContratoItem[],
  hints: string[]
): VeiculoContratoItem | null {
  const validos = itens.filter((v) => v.tipo_veiculo.trim())
  if (validos.length === 0) return null

  const hintsUnicos = [...new Set(hints.map((h) => h.trim()).filter(Boolean))]
  for (const h of hintsUnicos) {
    const m = validos.find((v) => textoCombina(h, v.tipo_veiculo))
    if (m) return m
  }

  const comCusto = validos.filter((v) => !v.sem_custo && parseNumero(v.valor) > 0)
  if (comCusto.length === 1) return comCusto[0]
  return null
}

/** Equipamentos com custo casados com acondicionamento / lista do contrato. */
export function encontrarEquipamentosFaturaveis(
  itens: EquipamentoContratoItem[],
  hints: string[]
): EquipamentoContratoItem[] {
  const faturaveis = itens.filter(
    (e) => e.descricao.trim() && e.com_custo && parseNumero(e.valor) > 0
  )
  if (faturaveis.length === 0) return []

  const hintsUnicos = [...new Set(hints.map((h) => h.trim()).filter(Boolean))]
  if (hintsUnicos.length === 0) {
    return faturaveis.length === 1 ? [faturaveis[0]] : []
  }

  const matched = faturaveis.filter((e) =>
    hintsUnicos.some((h) => textoCombina(h, e.descricao))
  )
  if (matched.length > 0) return matched
  return faturaveis.length === 1 ? [faturaveis[0]] : []
}

export function rotuloUnidadeMedida(unidade: string): string {
  const u = unidade.trim().toLowerCase()
  if (u === 'ton') return 'ton'
  if (u === 'm3' || u === 'm³') return 'm³'
  if (u === 'litros' || u === 'l') return 'litros'
  return 'kg'
}

/**
 * Converte peso líquido (kg na pesagem) para a unidade do contrato.
 * Para m³/litros assume que a quantidade faturada já foi informada na unidade correta.
 */
export function quantidadeNaUnidadeContrato(
  pesoLiquidoKg: number | null | undefined,
  quantidadeInformada: number | null | undefined,
  unidadeMedida: string
): number {
  const u = unidadeMedida.trim().toLowerCase()
  const qInformada =
    quantidadeInformada != null && Number.isFinite(quantidadeInformada) && quantidadeInformada >= 0
      ? quantidadeInformada
      : null

  if (u === 'm3' || u === 'm³' || u === 'litros' || u === 'l') {
    return qInformada ?? 0
  }

  const kg = pesoLiquidoKg != null && Number.isFinite(Number(pesoLiquidoKg)) ? Number(pesoLiquidoKg) : 0
  if (u === 'ton') return kg / 1000
  return qInformada ?? kg
}

function calcularLinhasResiduo(input: {
  residuosContratoRaw: unknown
  legadoTipoResiduo?: string | null
  tipoResiduoColeta: string | null | undefined
  pesoLiquidoKg: number | null | undefined
  quantidadeFaturada?: number | null
}): Pick<
  ResultadoPrecoContrato,
  | 'linhas'
  | 'origem'
  | 'residuoContrato'
  | 'unidadeMedida'
  | 'quantidadeFaturada'
  | 'valorUnitario'
  | 'faturamentoMinimoKg'
  | 'valorResiduo'
> {
  const baseVazio = {
    linhas: [] as PrecoBreakdownLinha[],
    origem: 'nenhuma' as PrecoContratoOrigem,
    residuoContrato: null as ResiduoContratoItem | null,
    unidadeMedida: 'kg',
    quantidadeFaturada: 0,
    valorUnitario: 0,
    faturamentoMinimoKg: 0,
    valorResiduo: 0,
  }

  const itens = parseResiduosContratoJsonb(input.residuosContratoRaw, {
    tipo_residuo: input.legadoTipoResiduo,
  })
  const residuo = encontrarResiduoContrato(itens, input.tipoResiduoColeta)
  if (!residuo) return baseVazio

  const valorUnitario = parseNumero(residuo.valor)
  if (valorUnitario <= 0) {
    return { ...baseVazio, residuoContrato: residuo, faturamentoMinimoKg: parseNumero(residuo.faturamento_minimo) }
  }

  const unidade = rotuloUnidadeMedida(residuo.unidade_medida || 'kg')
  const quantidade = quantidadeNaUnidadeContrato(
    input.pesoLiquidoKg,
    input.quantidadeFaturada,
    residuo.unidade_medida || 'kg'
  )
  if (quantidade <= 0) {
    return {
      ...baseVazio,
      residuoContrato: residuo,
      unidadeMedida: unidade,
      valorUnitario,
      faturamentoMinimoKg: parseNumero(residuo.faturamento_minimo),
    }
  }

  const minimoKg = parseNumero(residuo.faturamento_minimo)
  const minimoNaUnidade =
    minimoKg > 0
      ? quantidadeNaUnidadeContrato(minimoKg, null, residuo.unidade_medida || 'kg')
      : 0
  const quantidadeCobrada =
    minimoNaUnidade > 0 && quantidade < minimoNaUnidade ? minimoNaUnidade : quantidade

  const linhas: PrecoBreakdownLinha[] = []
  const subtotalPesagem = Math.round(quantidade * valorUnitario * 100) / 100
  linhas.push({
    chave: 'residuo',
    rotulo: `Resíduo (${quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade} × R$ ${valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
    valor: subtotalPesagem,
  })

  let valorResiduo = subtotalPesagem
  let origem: PrecoContratoOrigem = 'contrato_cliente_residuo'
  if (minimoNaUnidade > 0 && quantidade < minimoNaUnidade) {
    const totalComMinimo = Math.round(quantidadeCobrada * valorUnitario * 100) / 100
    linhas.push({
      chave: 'minimo',
      rotulo: `Faturamento mínimo (${minimoKg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg)`,
      valor: totalComMinimo - subtotalPesagem,
    })
    valorResiduo = totalComMinimo
    origem = 'contrato_cliente_residuo_minimo'
  }

  return {
    linhas,
    origem,
    residuoContrato: residuo,
    unidadeMedida: unidade,
    quantidadeFaturada: quantidadeCobrada,
    valorUnitario,
    faturamentoMinimoKg: minimoKg,
    valorResiduo,
  }
}

/** Soma Caminhão + Equipamento(s) + Resíduo conforme contrato e contexto da MTR. */
export function calcularPrecoContratoColetaMtr(input: {
  veiculosContratoRaw: unknown
  equipamentosContratoRaw: unknown
  maoObraContratoRaw?: unknown
  residuosContratoRaw: unknown
  legadoTipoResiduo?: string | null
  descricaoVeiculoLegado?: string | null
  equipamentosTextoLegado?: string | null
  tipoCaminhaoMtr?: string | null
  acondicionamentoMtr?: string | null
  tipoResiduoColeta: string | null | undefined
  pesoLiquidoKg: number | null | undefined
  quantidadeFaturada?: number | null
}): ResultadoPrecoContrato {
  const veiculos = parseVeiculosContratoJsonb(
    input.veiculosContratoRaw,
    input.descricaoVeiculoLegado
  )
  const equipamentos = parseEquipamentosContratoJsonb(
    input.equipamentosContratoRaw,
    input.equipamentosTextoLegado
  )
  const maoObraItens = parseEquipamentosContratoJsonb(input.maoObraContratoRaw, null)

  const hintsVeiculo = [
    ...hintsFromTexto(input.tipoCaminhaoMtr),
    ...hintsFromTexto(input.acondicionamentoMtr),
    ...hintsFromTexto(input.descricaoVeiculoLegado),
  ]
  const hintsEquipamento = [
    ...hintsFromTexto(input.acondicionamentoMtr),
    ...hintsFromTexto(input.equipamentosTextoLegado),
    ...equipamentos.map((e) => e.descricao),
  ]

  const veiculo = encontrarVeiculoContrato(veiculos, hintsVeiculo)
  const equipamentosFat = encontrarEquipamentosFaturaveis(equipamentos, hintsEquipamento)
  const maoObraFat = encontrarEquipamentosFaturaveis(maoObraItens, hintsEquipamento)

  const partResiduo = calcularLinhasResiduo({
    residuosContratoRaw: input.residuosContratoRaw,
    legadoTipoResiduo: input.legadoTipoResiduo,
    tipoResiduoColeta: input.tipoResiduoColeta,
    pesoLiquidoKg: input.pesoLiquidoKg,
    quantidadeFaturada: input.quantidadeFaturada,
  })

  const linhas: PrecoBreakdownLinha[] = []
  let valorCaminhao = 0
  let valorEquipamentos = 0
  let valorMaoObra = 0

  if (veiculo && !veiculo.sem_custo) {
    valorCaminhao = Math.round(parseNumero(veiculo.valor) * 100) / 100
    if (valorCaminhao > 0) {
      linhas.push({
        chave: 'caminhao',
        rotulo: `Caminhão (${veiculo.tipo_veiculo.trim()})`,
        valor: valorCaminhao,
      })
    }
  }

  for (const eq of equipamentosFat) {
    const v = Math.round(parseNumero(eq.valor) * 100) / 100
    if (v <= 0) continue
    valorEquipamentos += v
    linhas.push({
      chave: `equipamento-${normalizarTexto(eq.descricao).slice(0, 24) || 'item'}`,
      rotulo: `Equipamento (${eq.descricao.trim()})`,
      valor: v,
    })
  }
  valorEquipamentos = Math.round(valorEquipamentos * 100) / 100

  for (const mo of maoObraFat) {
    const v = Math.round(parseNumero(mo.valor) * 100) / 100
    if (v <= 0) continue
    valorMaoObra += v
    linhas.push({
      chave: `mao-obra-${normalizarTexto(mo.descricao).slice(0, 24) || 'item'}`,
      rotulo: `Mão de obra (${mo.descricao.trim()})`,
      valor: v,
    })
  }
  valorMaoObra = Math.round(valorMaoObra * 100) / 100

  linhas.push(...partResiduo.linhas)

  const total =
    Math.round((valorCaminhao + valorEquipamentos + valorMaoObra + partResiduo.valorResiduo) * 100) / 100

  let origem: PrecoContratoOrigem = 'nenhuma'
  if (total > 0) {
    if (valorCaminhao > 0 || valorEquipamentos > 0 || valorMaoObra > 0) {
      origem = 'contrato_cliente_mtr_consolidado'
    } else {
      origem = partResiduo.origem
    }
  }

  return {
    total,
    linhas,
    origem,
    residuoContrato: partResiduo.residuoContrato,
    veiculoContrato: veiculo,
    equipamentosContrato: equipamentosFat,
    maoObraContrato: maoObraFat,
    unidadeMedida: partResiduo.unidadeMedida,
    quantidadeFaturada: partResiduo.quantidadeFaturada,
    valorUnitario: partResiduo.valorUnitario,
    faturamentoMinimoKg: partResiduo.faturamentoMinimoKg,
    valorCaminhao,
    valorEquipamentos,
    valorMaoObra,
    valorResiduo: partResiduo.valorResiduo,
  }
}

/** @deprecated Use `calcularPrecoContratoColetaMtr` para soma MTR completa. Mantém só resíduo. */
export function calcularPrecoContratoCliente(input: {
  residuosContratoRaw: unknown
  legadoTipoResiduo?: string | null
  tipoResiduoColeta: string | null | undefined
  pesoLiquidoKg: number | null | undefined
  quantidadeFaturada?: number | null
}): ResultadoPrecoContrato {
  return calcularPrecoContratoColetaMtr({
    veiculosContratoRaw: [],
    equipamentosContratoRaw: [],
    residuosContratoRaw: input.residuosContratoRaw,
    legadoTipoResiduo: input.legadoTipoResiduo,
    tipoResiduoColeta: input.tipoResiduoColeta,
    pesoLiquidoKg: input.pesoLiquidoKg,
    quantidadeFaturada: input.quantidadeFaturada,
  })
}

export function rotuloOrigemContrato(o: PrecoContratoOrigem): string {
  if (o === 'contrato_cliente_mtr_consolidado') {
    return 'Contrato do cliente (Caminhão + Equipamento + Mão de obra + Resíduo)'
  }
  if (o === 'contrato_cliente_residuo') return 'Contrato do cliente (cadastro)'
  if (o === 'contrato_cliente_residuo_minimo') return 'Contrato do cliente (mínimo em kg aplicado)'
  return '—'
}

export function formatarMoedaBrl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
