import type { ResiduoContratoItem } from './clienteContratoCadastro'
import { moedaParaCampo, parseNumeroCampo } from './faturamentoDesvinculacao'

function normalizarResiduo(s: string): string {
  return s.trim().toLowerCase()
}

/** Valor unitário (R$/kg) do contrato do gerenciador, pelo nome do resíduo na linha. */
export function valorUnitarioResiduoContrato(
  residuo: string,
  contrato: ResiduoContratoItem[]
): number {
  const key = normalizarResiduo(residuo)
  if (!key) return 0
  const item = contrato.find((r) => normalizarResiduo(r.tipo_residuo) === key)
  if (!item) return 0
  return parseNumeroCampo(item.valor)
}

export function calcularValorTotalMtrLinha(pesoKg: string, valorUnitario: number): number {
  const peso = parseNumeroCampo(pesoKg)
  if (peso <= 0 || valorUnitario <= 0) return 0
  return Math.round(peso * valorUnitario * 100) / 100
}

export function formatarValorTotalGerenciador(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return ''
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Recalcula valor total; usa valor unitário manual se informado, senão o do contrato. */
export function aplicarValorTotalLinha(
  linha: { residuo: string; peso: string; valor_unitario: string; valor_total: string },
  contrato: ResiduoContratoItem[]
): { valor_total: string } {
  const manual = parseNumeroCampo(linha.valor_unitario)
  const unit =
    manual > 0 ? manual : valorUnitarioResiduoContrato(linha.residuo, contrato)
  const total = calcularValorTotalMtrLinha(linha.peso, unit)
  return { valor_total: formatarValorTotalGerenciador(total) }
}

export function pesoParaCampoGerenciador(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return ''
  return moedaParaCampo(v)
}

export function valorUnitarioParaCampo(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return ''
  return moedaParaCampo(v)
}
