import type { LinhaRelatorioMedicao } from './faturamentoRelatorioMedicao'

export type RascunhoEdicaoLinhaMedicao = {
  quantViagens: string
  valorFrete: string
  pesoKg: string
  valorTaxa: string
  total: string
}

/** @deprecated alias — rascunho por linha ou em massa usa o mesmo shape. */
export type RascunhoEdicaoBulkMedicao = RascunhoEdicaoLinhaMedicao

export const rascunhoEdicaoLinhaMedicaoVazio = (): RascunhoEdicaoLinhaMedicao => ({
  quantViagens: '',
  valorFrete: '',
  pesoKg: '',
  valorTaxa: '',
  total: '',
})

export const rascunhoEdicaoBulkMedicaoVazio = rascunhoEdicaoLinhaMedicaoVazio

function numParaCampoMoeda(v: number): string {
  if (!Number.isFinite(v) || v === 0) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function numParaCampoPeso(v: number): string {
  if (!Number.isFinite(v) || v === 0) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function parseNumeroCampoMedicao(raw: string): number | null {
  const t = raw.trim().replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function linhaParaRascunhoEdicao(l: LinhaRelatorioMedicao): RascunhoEdicaoLinhaMedicao {
  return {
    quantViagens: String(l.quantViagens ?? 1),
    valorFrete: numParaCampoMoeda(l.valorFrete),
    pesoKg: numParaCampoPeso(l.pesoKg),
    valorTaxa: numParaCampoMoeda(l.valorTaxa),
    total: numParaCampoMoeda(l.total),
  }
}

export function linhasParaRascunhosEdicao(
  linhas: LinhaRelatorioMedicao[]
): Record<string, RascunhoEdicaoLinhaMedicao> {
  const out: Record<string, RascunhoEdicaoLinhaMedicao> = {}
  for (const l of linhas) {
    out[l.coleta_id] = linhaParaRascunhoEdicao(l)
  }
  return out
}

/** Total da linha após edição manual (frete + peso × taxa). */
export function recalcularTotalLinhaMedicao(l: LinhaRelatorioMedicao): LinhaRelatorioMedicao {
  const total = Math.round((l.valorFrete + l.pesoKg * l.valorTaxa) * 100) / 100
  return { ...l, total }
}

/** Aplica rascunho de uma linha (campos vazios mantêm valor anterior). */
export function aplicarRascunhoLinhaMedicao(
  linha: LinhaRelatorioMedicao,
  draft: RascunhoEdicaoLinhaMedicao
): LinhaRelatorioMedicao {
  const qv = parseNumeroCampoMedicao(draft.quantViagens)
  const vf = parseNumeroCampoMedicao(draft.valorFrete)
  const pk = parseNumeroCampoMedicao(draft.pesoKg)
  const vt = parseNumeroCampoMedicao(draft.valorTaxa)
  const totFixo = parseNumeroCampoMedicao(draft.total)

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
}

/** Aplica rascunhos linha a linha ao relatório. */
export function aplicarRascunhosLinhasMedicao(
  linhas: LinhaRelatorioMedicao[],
  rascunhos: Record<string, RascunhoEdicaoLinhaMedicao>
): LinhaRelatorioMedicao[] {
  return linhas.map((linha) => {
    const draft = rascunhos[linha.coleta_id]
    if (!draft) return linha
    return aplicarRascunhoLinhaMedicao(linha, draft)
  })
}

/** Aplica campos preenchidos no rascunho a todas as linhas (atalho em massa). */
export function aplicarRascunhoBulkLinhasMedicao(
  linhas: LinhaRelatorioMedicao[],
  draft: RascunhoEdicaoLinhaMedicao
): LinhaRelatorioMedicao[] {
  return linhas.map((linha) => aplicarRascunhoLinhaMedicao(linha, draft))
}

/** Pré-visualização dos totais enquanto edita (sem gravar). */
export function mesclarLinhasComRascunhosMedicao(
  linhas: LinhaRelatorioMedicao[],
  rascunhos: Record<string, RascunhoEdicaoLinhaMedicao>
): LinhaRelatorioMedicao[] {
  return aplicarRascunhosLinhasMedicao(linhas, rascunhos)
}
