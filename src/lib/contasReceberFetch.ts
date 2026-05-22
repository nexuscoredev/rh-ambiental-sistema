import type { SupabaseClient } from '@supabase/supabase-js'
import { CONTAS_RECEBER_FINANCEIRO_IDS_MAX_LINHAS, REST_PAGE_SIZE } from './supabaseCargaLimites'

const DEFAULT_CHUNK = 250

/**
 * Várias chamadas `.in(referencia_coleta_id, …)` em lotes — evita URL/payload gigante e timeouts.
 */
export async function fetchContasReceberByColetaIds<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  coletaIds: string[],
  select: string,
  chunkSize = DEFAULT_CHUNK
): Promise<Map<string, T>> {
  const map = new Map<string, T>()
  const uniq = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const slice = uniq.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('contas_receber')
      .select(select)
      .in('referencia_coleta_id', slice)
    if (error) throw new Error(error.message)
    for (const r of (data || []) as unknown as T[]) {
      const ref = (r as { referencia_coleta_id?: string | null }).referencia_coleta_id
      if (ref) map.set(String(ref), r)
    }
  }
  return map
}

/** IDs de coletas com título em `contas_receber` (lista Financeiro — complemento à view). */
export async function fetchColetaIdsComContaReceber(
  supabase: SupabaseClient,
  opts?: { dataEmissaoDesde?: string | null; maxLinhas?: number }
): Promise<string[]> {
  const max = opts?.maxLinhas ?? CONTAS_RECEBER_FINANCEIRO_IDS_MAX_LINHAS
  const PAGE = REST_PAGE_SIZE
  const ids = new Set<string>()
  const desde = (opts?.dataEmissaoDesde ?? '').trim().slice(0, 10)

  for (let page = 0; page < Math.ceil(max / PAGE); page++) {
    const from = page * PAGE
    const to = from + PAGE - 1
    let qb = supabase
      .from('contas_receber')
      .select('referencia_coleta_id')
      .not('referencia_coleta_id', 'is', null)
    if (desde) qb = qb.gte('data_emissao', desde)
    const { data, error } = await qb.range(from, to)
    if (error) throw new Error(error.message)
    const chunk = (data || []) as { referencia_coleta_id?: string | null }[]
    if (chunk.length === 0) break
    for (const r of chunk) {
      const id = (r.referencia_coleta_id ?? '').trim()
      if (id) ids.add(id)
    }
    if (chunk.length < PAGE) break
  }
  return [...ids]
}
