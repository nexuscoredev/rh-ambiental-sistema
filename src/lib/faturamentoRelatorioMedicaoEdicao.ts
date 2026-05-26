import type { LinhaRelatorioMedicao } from './faturamentoRelatorioMedicao'

export type RascunhoEdicaoBulkMedicao = {
  quantViagens: string
  valorFrete: string
  pesoKg: string
  valorTaxa: string
  total: string
}

export const rascunhoEdicaoBulkMedicaoVazio = (): RascunhoEdicaoBulkMedicao => ({
  quantViagens: '',
  valorFrete: '',
  pesoKg: '',
  valorTaxa: '',
  total: '',
})

function parseNumeroCampo(raw: string): number | null {
  const t = raw.trim().replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Total da linha após edição manual (frete + peso × taxa). */
export function recalcularTotalLinhaMedicao(l: LinhaRelatorioMedicao): LinhaRelatorioMedicao {
  const total = Math.round((l.valorFrete + l.pesoKg * l.valorTaxa) * 100) / 100
  return { ...l, total }
}

/** Aplica campos preenchidos no rascunho a todas as linhas do relatório. */
export function aplicarRascunhoBulkLinhasMedicao(
  linhas: LinhaRelatorioMedicao[],
  draft: RascunhoEdicaoBulkMedicao
): LinhaRelatorioMedicao[] {
  const qv = parseNumeroCampo(draft.quantViagens)
  const vf = parseNumeroCampo(draft.valorFrete)
  const pk = parseNumeroCampo(draft.pesoKg)
  const vt = parseNumeroCampo(draft.valorTaxa)
  const totFixo = parseNumeroCampo(draft.total)

  return linhas.map((linha) => {
    let next: LinhaRelatorioMedicao = { ...linha }
    if (qv != null) next.quantViagens = Math.max(0, Math.round(qv))
    if (vf != null) next.valorFrete = vf
    if (pk != null) next.pesoKg = pk
    if (vt != null) next.valorTaxa = vt
    if (totFixo != null) {
      next.total = totFixo
      return next
    }
    return recalcularTotalLinhaMedicao(next)
  })
}
