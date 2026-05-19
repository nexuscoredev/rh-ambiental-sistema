import {
  parseResiduosContratoJsonb,
  type ResiduoContratoItem,
} from './clienteContratoCadastro'

export type PrecoBreakdownLinha = { chave: string; rotulo: string; valor: number }

export type PrecoContratoOrigem =
  | 'contrato_cliente_residuo'
  | 'contrato_cliente_residuo_minimo'
  | 'nenhuma'

export type ResultadoPrecoContrato = {
  total: number
  linhas: PrecoBreakdownLinha[]
  origem: PrecoContratoOrigem
  residuoContrato: ResiduoContratoItem | null
  unidadeMedida: string
  quantidadeFaturada: number
  valorUnitario: number
  faturamentoMinimo: number
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

export function calcularPrecoContratoCliente(input: {
  residuosContratoRaw: unknown
  legadoTipoResiduo?: string | null
  tipoResiduoColeta: string | null | undefined
  pesoLiquidoKg: number | null | undefined
  /** Quantidade na unidade do contrato (editável no modal; kg/ton derivam da pesagem se omitido). */
  quantidadeFaturada?: number | null
}): ResultadoPrecoContrato {
  const vazio: ResultadoPrecoContrato = {
    total: 0,
    linhas: [],
    origem: 'nenhuma',
    residuoContrato: null,
    unidadeMedida: 'kg',
    quantidadeFaturada: 0,
    valorUnitario: 0,
    faturamentoMinimo: 0,
  }

  const itens = parseResiduosContratoJsonb(input.residuosContratoRaw, {
    tipo_residuo: input.legadoTipoResiduo,
  })
  const residuo = encontrarResiduoContrato(itens, input.tipoResiduoColeta)
  if (!residuo) return vazio

  const valorUnitario = parseNumero(residuo.valor)
  if (valorUnitario <= 0) return { ...vazio, residuoContrato: residuo }

  const unidade = rotuloUnidadeMedida(residuo.unidade_medida || 'kg')
  const quantidade = quantidadeNaUnidadeContrato(
    input.pesoLiquidoKg,
    input.quantidadeFaturada,
    residuo.unidade_medida || 'kg'
  )
  if (quantidade <= 0) {
    return {
      ...vazio,
      residuoContrato: residuo,
      unidadeMedida: unidade,
      quantidadeFaturada: 0,
      valorUnitario,
      faturamentoMinimo: parseNumero(residuo.faturamento_minimo),
    }
  }

  const linhas: PrecoBreakdownLinha[] = []
  const subtotal = Math.round(quantidade * valorUnitario * 100) / 100
  linhas.push({
    chave: 'residuo',
    rotulo: `Resíduo (${quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade} × R$ ${valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
    valor: subtotal,
  })

  const minimo = parseNumero(residuo.faturamento_minimo)
  let total = subtotal
  let origem: PrecoContratoOrigem = 'contrato_cliente_residuo'
  if (minimo > 0 && total < minimo) {
    linhas.push({
      chave: 'minimo',
      rotulo: 'Faturamento mínimo (contrato)',
      valor: minimo - total,
    })
    total = minimo
    origem = 'contrato_cliente_residuo_minimo'
  }

  return {
    total,
    linhas,
    origem,
    residuoContrato: residuo,
    unidadeMedida: unidade,
    quantidadeFaturada: quantidade,
    valorUnitario,
    faturamentoMinimo: minimo,
  }
}

export function rotuloOrigemContrato(o: PrecoContratoOrigem): string {
  if (o === 'contrato_cliente_residuo') return 'Contrato do cliente (cadastro)'
  if (o === 'contrato_cliente_residuo_minimo') return 'Contrato do cliente (mínimo aplicado)'
  return '—'
}
