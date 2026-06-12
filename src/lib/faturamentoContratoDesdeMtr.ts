import type { ResiduoContratoItem } from './clienteContratoCadastro'
import { parseEquipamentosContratoJsonb, parseVeiculosContratoJsonb } from './clienteContratoCadastro'
import type { calcularPrecoContratoColetaMtr } from './faturamentoPrecoContrato'
import {
  listaResiduosFromDetalhesMtr,
  residuoDetalhesVazio,
  type MtrResiduoDetalhesCampos,
} from './mtrClienteContratoAutofill'
import {
  escolherTipoResiduoContratoMtr,
  residuoContratoPorRotulo,
} from './mtrResiduoContratoOpcoes'

export type ContratoClienteFallback = {
  residuos_contrato: unknown
  veiculos_contrato: unknown
  equipamentos_contrato: unknown
  mao_obra_contrato?: unknown
  tipo_residuo_legado: string | null
  descricao_veiculo_legado: string | null
  equipamentos_texto_legado: string | null
}

export type MtrSnapshotContrato = {
  detalhes: unknown
  tipo_residuo?: string | null
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function parseResiduosCatalogo(raw: unknown): ResiduoContratoItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is ResiduoContratoItem => x != null && typeof x === 'object')
}

function parseDetalhesMtr(raw: unknown): {
  contrato_veiculos?: unknown
  contrato_equipamentos?: unknown
  contrato_mao_obra?: unknown
  residuos_contrato_catalogo?: ResiduoContratoItem[]
  residuo?: MtrResiduoDetalhesCampos
  residuos_lista?: MtrResiduoDetalhesCampos[]
} | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const residuo =
    o.residuo && typeof o.residuo === 'object' && !Array.isArray(o.residuo)
      ? (o.residuo as MtrResiduoDetalhesCampos)
      : undefined
  const residuos_lista = Array.isArray(o.residuos_lista)
    ? (o.residuos_lista as MtrResiduoDetalhesCampos[])
    : undefined
  const catalogo = parseResiduosCatalogo(o.residuos_contrato_catalogo)
  return {
    contrato_veiculos: o.contrato_veiculos,
    contrato_equipamentos: o.contrato_equipamentos,
    contrato_mao_obra: o.contrato_mao_obra,
    residuos_contrato_catalogo: catalogo.length > 0 ? catalogo : undefined,
    residuo,
    residuos_lista,
  }
}

function veiculosMtrComConteudo(raw: unknown) {
  return parseVeiculosContratoJsonb(raw).filter((v) => v.tipo_veiculo.trim().length > 0)
}

function equipamentosMtrComConteudo(raw: unknown) {
  return parseEquipamentosContratoJsonb(raw).filter((e) => e.descricao.trim().length > 0)
}

function maoObraMtrComConteudo(raw: unknown) {
  return parseEquipamentosContratoJsonb(raw, null).filter((e) => e.descricao.trim().length > 0)
}

/** MTR gravada com seleção explícita de contrato (veículo, equipamento, mão de obra ou resíduo). */
export function mtrTemSelecaoContrato(detalhesRaw: unknown): boolean {
  const det = parseDetalhesMtr(detalhesRaw)
  if (!det) return false
  const veiculos = veiculosMtrComConteudo(det.contrato_veiculos)
  const equipamentos = equipamentosMtrComConteudo(det.contrato_equipamentos)
  const maoObra = maoObraMtrComConteudo(det.contrato_mao_obra)
  if (veiculos.length > 0 || equipamentos.length > 0 || maoObra.length > 0) return true
  const residuo = det.residuo ?? residuoDetalhesVazio()
  const lista = listaResiduosFromDetalhesMtr({
    residuo,
    residuos_lista: det.residuos_lista,
  })
  return lista.some((l) => l.caracterizacao.trim().length > 0)
}

function catalogoResiduosContrato(
  det: ReturnType<typeof parseDetalhesMtr>,
  contratoCliente: ContratoClienteFallback | null
): ResiduoContratoItem[] {
  const doMtr = det?.residuos_contrato_catalogo ?? []
  if (doMtr.length > 0) return doMtr
  return parseResiduosCatalogo(contratoCliente?.residuos_contrato ?? null)
}

function residuosContratoFiltradosPelaMtr(
  catalog: ResiduoContratoItem[],
  det: ReturnType<typeof parseDetalhesMtr>,
  mtrTipoResiduo: string | null
): ResiduoContratoItem[] {
  if (catalog.length === 0) return []

  const residuo = det?.residuo ?? residuoDetalhesVazio()
  const listaMtr = listaResiduosFromDetalhesMtr({
    residuo,
    residuos_lista: det?.residuos_lista,
  })

  const out: ResiduoContratoItem[] = []
  const vistos = new Set<string>()

  for (const linha of listaMtr) {
    const car = linha.caracterizacao.trim()
    if (!car) continue
    let item = residuoContratoPorRotulo(catalog, car)
    if (!item) {
      const alvo = norm(car)
      item =
        catalog.find((r) => norm(r.tipo_residuo ?? '') === alvo) ??
        catalog.find(
          (r) =>
            norm(r.tipo_residuo ?? '').includes(alvo) || alvo.includes(norm(r.tipo_residuo ?? ''))
        ) ??
        null
    }
    if (item) {
      const key = norm(item.tipo_residuo ?? '')
      if (!vistos.has(key)) {
        vistos.add(key)
        out.push(item)
      }
    }
  }

  if (out.length > 0) return out

  const tipoTopo = (mtrTipoResiduo ?? '').trim()
  if (tipoTopo) {
    const direto = residuoContratoPorRotulo(catalog, tipoTopo)
    if (direto) return [direto]
    const rotulo = escolherTipoResiduoContratoMtr(catalog, {
      valorAtual: tipoTopo,
      preferencia: tipoTopo,
    })
    const escolhido = residuoContratoPorRotulo(catalog, rotulo)
    if (escolhido) return [escolhido]
  }

  return catalog
}

function maoObraContratoFiltradaPelaMtr(
  catalog: ReturnType<typeof parseEquipamentosContratoJsonb>,
  det: ReturnType<typeof parseDetalhesMtr>
): ReturnType<typeof parseEquipamentosContratoJsonb> {
  const selecionados = maoObraMtrComConteudo(det?.contrato_mao_obra)
  if (selecionados.length === 0) return catalog
  const out: ReturnType<typeof parseEquipamentosContratoJsonb> = []
  for (const sel of selecionados) {
    const alvo = norm(sel.descricao)
    const item =
      catalog.find((c) => norm(c.descricao) === alvo) ??
      catalog.find((c) => norm(c.descricao).includes(alvo) || alvo.includes(norm(c.descricao)))
    if (item) out.push(item)
  }
  return out.length > 0 ? out : selecionados
}

/**
 * Monta entrada para `calcularPrecoContratoColetaMtr` priorizando o que foi selecionado na MTR
 * (veículo, equipamento, mão de obra e resíduo), não o cadastro inteiro do cliente.
 */
export function montarInputPrecoContratoColeta(args: {
  contratoCliente: ContratoClienteFallback | null
  mtr?: MtrSnapshotContrato | null
  tipoCaminhaoProgramacao?: string | null
  tipoResiduoColetaFallback?: string | null
  pesoLiquidoKg: number | null | undefined
  quantidadeFaturada?: number | null
}): Parameters<typeof calcularPrecoContratoColetaMtr>[0] | null {
  const { contratoCliente, mtr, tipoCaminhaoProgramacao, tipoResiduoColetaFallback } = args
  if (!contratoCliente && !mtr?.detalhes) return null

  const det = parseDetalhesMtr(mtr?.detalhes)
  const temSelecaoMtr = mtr?.detalhes != null && mtrTemSelecaoContrato(mtr.detalhes)

  const veiculosMtr = veiculosMtrComConteudo(det?.contrato_veiculos)
  const equipamentosMtr = equipamentosMtrComConteudo(det?.contrato_equipamentos)

  const veiculosContratoRaw = temSelecaoMtr
    ? veiculosMtr
    : (contratoCliente?.veiculos_contrato ?? veiculosMtr)
  const equipamentosContratoRaw = temSelecaoMtr
    ? equipamentosMtr
    : (contratoCliente?.equipamentos_contrato ?? equipamentosMtr)
  const catalogMaoObra = parseEquipamentosContratoJsonb(contratoCliente?.mao_obra_contrato, null)
  const maoObraContratoRaw = temSelecaoMtr
    ? maoObraContratoFiltradaPelaMtr(catalogMaoObra, det)
    : (contratoCliente?.mao_obra_contrato ?? catalogMaoObra)

  const catalog = catalogoResiduosContrato(det, contratoCliente)
  const mtrTipoResiduo =
    (mtr?.tipo_residuo ?? '').trim() ||
    (det?.residuo?.caracterizacao ?? '').trim() ||
    null

  const residuosContratoRaw = temSelecaoMtr
    ? residuosContratoFiltradosPelaMtr(catalog, det, mtrTipoResiduo)
    : (contratoCliente?.residuos_contrato ?? catalog)

  const tipoResiduoColeta =
    mtrTipoResiduo ||
    (tipoResiduoColetaFallback ?? '').trim() ||
    null

  const tipoCaminhaoMtr = temSelecaoMtr
    ? veiculosMtr[0]?.tipo_veiculo?.trim() || tipoCaminhaoProgramacao?.trim() || null
    : tipoCaminhaoProgramacao?.trim() || veiculosMtr[0]?.tipo_veiculo?.trim() || null

  const acondicionamentoMtr =
    (det?.residuo?.acondicionamento ?? '').trim() ||
    equipamentosMtr[0]?.descricao?.trim() ||
    null

  return {
    veiculosContratoRaw,
    equipamentosContratoRaw,
    maoObraContratoRaw,
    residuosContratoRaw,
    legadoTipoResiduo: contratoCliente?.tipo_residuo_legado ?? null,
    descricaoVeiculoLegado: contratoCliente?.descricao_veiculo_legado ?? null,
    equipamentosTextoLegado: contratoCliente?.equipamentos_texto_legado ?? null,
    tipoCaminhaoMtr,
    acondicionamentoMtr,
    tipoResiduoColeta,
    pesoLiquidoKg: args.pesoLiquidoKg,
    quantidadeFaturada: args.quantidadeFaturada,
  }
}

/** Veículos para dropdown no resumo MTR: só os selecionados na MTR quando houver. */
export function veiculosContratoRawParaResumo(
  contratoCliente: ContratoClienteFallback | null,
  mtr?: MtrSnapshotContrato | null
): unknown {
  const det = parseDetalhesMtr(mtr?.detalhes)
  if (mtr?.detalhes && mtrTemSelecaoContrato(mtr.detalhes)) {
    const veiculos = veiculosMtrComConteudo(det?.contrato_veiculos)
    if (veiculos.length > 0) return veiculos
  }
  return contratoCliente?.veiculos_contrato ?? null
}
