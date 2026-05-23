import { parseVeiculosContratoJsonb, type VeiculoContratoItem } from './clienteContratoCadastro'
import { moedaParaCampo, parseNumeroCampo, type ResumoFinanceiroDesvinculado } from './faturamentoDesvinculacao'
import { encontrarVeiculoContrato } from './faturamentoPrecoContrato'

export const CHAVE_VEICULO_MANUAL = '__manual__'

function parseValorVeiculo(v: VeiculoContratoItem): number {
  if (v.sem_custo) return 0
  const t = String(v.valor ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

export function listarVeiculosContratoFaturamento(veiculosContratoRaw: unknown): VeiculoContratoItem[] {
  return parseVeiculosContratoJsonb(veiculosContratoRaw).filter((v) => v.tipo_veiculo.trim())
}

export function rotuloOpcaoVeiculoContrato(v: VeiculoContratoItem): string {
  const nome = v.tipo_veiculo.trim()
  if (v.sem_custo) return `${nome} — sem custo`
  const val = parseValorVeiculo(v)
  if (val > 0) {
    return `${nome} — ${val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
  }
  return `${nome} — R$ 0,00`
}

export function chaveVeiculoContratoIndice(index: number): string {
  return String(index)
}

export function aplicarVeiculoContratoAoResumoMtr(
  resumo: ResumoFinanceiroDesvinculado,
  veiculo: VeiculoContratoItem
): ResumoFinanceiroDesvinculado {
  const valor = parseValorVeiculo(veiculo)
  return {
    ...resumo,
    mtr: {
      ...resumo.mtr,
      caminhao_rotulo: veiculo.tipo_veiculo.trim(),
      caminhao_valor: moedaParaCampo(valor),
    },
  }
}

/** Chave do select: índice na lista ou manual quando não casa com o contrato. */
export function chaveVeiculoSelecionadoNoResumo(
  veiculos: VeiculoContratoItem[],
  resumo: ResumoFinanceiroDesvinculado
): string {
  if (veiculos.length === 0) return CHAVE_VEICULO_MANUAL
  const rot = resumo.mtr.caminhao_rotulo.trim().toLowerCase()
  const val = parseNumeroCampo(resumo.mtr.caminhao_valor)
  if (!rot && val <= 0) return CHAVE_VEICULO_MANUAL

  const idx = veiculos.findIndex((v) => {
    const vr = v.tipo_veiculo.trim().toLowerCase()
    const vv = parseValorVeiculo(v)
    if (vr !== rot) return false
    return Math.abs(vv - val) < 0.02
  })
  if (idx >= 0) return chaveVeiculoContratoIndice(idx)
  return CHAVE_VEICULO_MANUAL
}

/** Sugestão automática (mesma função do cálculo — só para pré-seleção na UI). */
export function sugerirVeiculoContratoParaHints(
  veiculosContratoRaw: unknown,
  hints: {
    tipoCaminhaoProgramacao?: string | null
    acondicionamentoMtr?: string | null
    descricaoVeiculoLegado?: string | null
  }
): VeiculoContratoItem | null {
  const itens = listarVeiculosContratoFaturamento(veiculosContratoRaw)
  const hintsList = [
    hints.tipoCaminhaoProgramacao,
    hints.acondicionamentoMtr,
    hints.descricaoVeiculoLegado,
  ].filter((h): h is string => typeof h === 'string' && h.trim().length > 0)

  return encontrarVeiculoContrato(itens, hintsList)
}
