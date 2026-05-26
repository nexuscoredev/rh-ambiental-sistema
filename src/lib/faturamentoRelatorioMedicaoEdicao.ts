import type { LinhaRelatorioMedicao } from './faturamentoRelatorioMedicao'

export type RascunhoEdicaoLinhaMedicao = {
  quantViagens: string
  valorFrete: string
  pesoKg: string
  valorTaxa: string
  total: string
  /** Total digitado manualmente — não recalcula ao mudar frete/peso/taxa. */
  totalManual?: boolean
}

/** @deprecated alias — rascunho por linha ou em massa usa o mesmo shape. */
export type RascunhoEdicaoBulkMedicao = RascunhoEdicaoLinhaMedicao

export const rascunhoEdicaoLinhaMedicaoVazio = (): RascunhoEdicaoLinhaMedicao => ({
  quantViagens: '',
  valorFrete: '',
  pesoKg: '',
  valorTaxa: '',
  total: '',
  totalManual: false,
})

export const rascunhoEdicaoBulkMedicaoVazio = rascunhoEdicaoLinhaMedicaoVazio

export function numParaCampoMoedaMedicao(v: number): string {
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
    valorFrete: numParaCampoMoedaMedicao(l.valorFrete),
    pesoKg: numParaCampoPeso(l.pesoKg),
    valorTaxa: numParaCampoMoedaMedicao(l.valorTaxa),
    total: numParaCampoMoedaMedicao(l.total),
    totalManual: false,
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

/** Valor do resíduo (peso × taxa, respeitando mínimo em kg do contrato). */
export function recalcularValorResiduoLinhaMedicao(
  l: Pick<LinhaRelatorioMedicao, 'pesoKg' | 'valorTaxa' | 'faturamentoMinimoKg'>
): number {
  const peso = l.pesoKg
  const taxa = l.valorTaxa
  if (peso <= 0 || taxa <= 0) return 0
  const minKg = l.faturamentoMinimoKg ?? 0
  const qty = minKg > 0 && peso < minKg ? minKg : peso
  return Math.round(qty * taxa * 100) / 100
}

/** Total da linha após edição (frete + resíduo, com mínimo). */
export function recalcularTotalLinhaMedicao(l: LinhaRelatorioMedicao): LinhaRelatorioMedicao {
  const valorResiduo = recalcularValorResiduoLinhaMedicao(l)
  const total = Math.round((l.valorFrete + valorResiduo) * 100) / 100
  return { ...l, valorResiduo, total }
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
  const totFixo = draft.totalManual ? parseNumeroCampoMedicao(draft.total) : null

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

/** Atualiza rascunho e recalcula o total exibido (exceto se o total foi editado à mão). */
export function atualizarCampoRascunhoMedicao(
  linha: LinhaRelatorioMedicao,
  draft: RascunhoEdicaoLinhaMedicao,
  key: keyof RascunhoEdicaoLinhaMedicao,
  valor: string
): RascunhoEdicaoLinhaMedicao {
  const next: RascunhoEdicaoLinhaMedicao = {
    ...draft,
    [key]: valor,
    totalManual: key === 'total' ? true : false,
  }
  if (key === 'total') return next
  const aplicada = aplicarRascunhoLinhaMedicao(linha, next)
  return {
    ...next,
    total: numParaCampoMoedaMedicao(aplicada.total),
    totalManual: false,
  }
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

export function fingerprintLinhasMedicao(linhas: LinhaRelatorioMedicao[]): string {
  return linhas
    .map(
      (l) =>
        `${l.coleta_id}:${l.quantViagens}:${l.valorFrete}:${l.pesoKg}:${l.valorTaxa}:${l.total}`
    )
    .join('|')
}
