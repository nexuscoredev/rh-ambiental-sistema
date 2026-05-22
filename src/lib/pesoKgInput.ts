/** Parse de peso em kg a partir de input do utilizador (vírgula ou ponto decimal). */
export function parsePesoLiquidoKgInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function pesoLiquidoParaInput(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return ''
  return String(n).replace('.', ',')
}

export function formatarPesoKg(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`
}
