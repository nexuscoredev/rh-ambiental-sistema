/** Parse de peso em kg a partir de input do utilizador (vírgula ou ponto decimal). */
export function parsePesoLiquidoKgInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Zero no banco = ainda não pesado → campo vazio para preenchimento manual. */
export function pesoKgTemValorInformado(n: number | null | undefined): boolean {
  if (n == null || Number.isNaN(Number(n))) return false
  return Number(n) !== 0
}

/** Valor para `<input>` de peso (kg); não pré-preenche com 0. */
export function pesoKgParaCampoInput(n: number | null | undefined): string {
  if (!pesoKgTemValorInformado(n)) return ''
  return String(n)
}

export function pesoLiquidoParaInput(n: number | null | undefined): string {
  if (!pesoKgTemValorInformado(n)) return ''
  return String(n).replace('.', ',')
}

export function formatarPesoKg(n: number | null | undefined): string {
  if (!pesoKgTemValorInformado(n)) return '—'
  return `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`
}
