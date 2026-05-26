import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizeIlikePattern } from './sanitizeIlike'

/** Colunas para cards da lista (inclui `detalhes` para visualizar/editar sem round-trip extra). */
export const MTR_LISTA_SELECT_COLUNAS =
  'id, numero, programacao_id, cliente, gerador, endereco, cidade, tipo_residuo, quantidade, unidade, destinador, transportador, detalhes, data_emissao, observacoes, status, created_at, criado_por_nome, criado_por_user_id, cancelada_em, cancelamento_justificativa, cancelamento_cobrar_frete'

export const MTR_LISTA_TAMANHO_PAGINA = 10
export const MTR_LISTA_BUSCA_MIN_CHARS = 2

export const COLETAS_LISTA_SELECT_COLUNAS =
  'id, numero, cliente, etapa_operacional, fluxo_status, status_processo, mtr_id, programacao_id, motorista, motorista_nome, placa, tipo_residuo'

export function filtroOrBuscaMtrLista(termo: string): string | null {
  const t = termo.trim()
  if (t.length < MTR_LISTA_BUSCA_MIN_CHARS) return null
  const s = sanitizeIlikePattern(t)
  return `numero.ilike.%${s}%,cliente.ilike.%${s}%,gerador.ilike.%${s}%`
}

export type PaginaListaMtrResult<T> = {
  rows: T[]
  total: number
  temMais: boolean
  error: { message?: string } | null
}

export type OpcaoUsuarioLancadorMtr = {
  id: string
  nome: string
}

/** Uma página da lista (ordem: mais recentes primeiro). */
export async function fetchPaginaListaMtr<T>(
  client: SupabaseClient,
  opts: { busca?: string; lancadorUserId?: string; offset: number; limit?: number }
): Promise<PaginaListaMtrResult<T>> {
  const limit = opts.limit ?? MTR_LISTA_TAMANHO_PAGINA
  const offset = Math.max(0, opts.offset)
  const filtroBusca = filtroOrBuscaMtrLista(opts.busca ?? '')
  const lancadorId = (opts.lancadorUserId ?? '').trim()

  let q = client
    .from('mtrs')
    .select(MTR_LISTA_SELECT_COLUNAS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (lancadorId) {
    q = q.eq('criado_por_user_id', lancadorId)
  }

  if (filtroBusca) {
    q = q.or(filtroBusca)
  }

  const { data, error, count } = await q
  const rows = (data ?? []) as T[]
  const total = count ?? rows.length
  const temMais = offset + rows.length < total

  return { rows, total, temMais, error }
}

export async function fetchColetasPorMtrIds<T>(
  client: SupabaseClient,
  mtrIds: string[]
): Promise<{ rows: T[]; error: { message?: string } | null }> {
  const ids = [...new Set(mtrIds.map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) return { rows: [], error: null }

  const { data, error } = await client
    .from('coletas')
    .select(COLETAS_LISTA_SELECT_COLUNAS)
    .in('mtr_id', ids)

  return { rows: (data ?? []) as T[], error }
}

/** Utilizadores que já lançaram MTR (para o filtro da lista). */
export async function fetchOpcoesUsuariosLancadoresMtr(
  client: SupabaseClient
): Promise<{ opcoes: OpcaoUsuarioLancadorMtr[]; error: { message?: string } | null }> {
  const { data, error } = await client
    .from('mtrs')
    .select('criado_por_user_id, criado_por_nome')
    .not('criado_por_user_id', 'is', null)
    .order('criado_por_nome', { ascending: true })
    .limit(2000)

  if (error) return { opcoes: [], error }

  const porId = new Map<string, string>()
  for (const row of data ?? []) {
    const id = String((row as { criado_por_user_id?: string | null }).criado_por_user_id ?? '').trim()
    if (!id) continue
    const nomeSalvo = String((row as { criado_por_nome?: string | null }).criado_por_nome ?? '').trim()
    if (!porId.has(id) || (nomeSalvo && !porId.get(id))) {
      porId.set(id, nomeSalvo || porId.get(id) || id.slice(0, 8))
    }
  }

  const idsSemNome = [...porId.entries()].filter(([, nome]) => !nome || nome.length <= 8).map(([id]) => id)
  if (idsSemNome.length > 0) {
    const { data: usuarios } = await client.from('usuarios').select('id, nome, email').in('id', idsSemNome)
    for (const u of usuarios ?? []) {
      const id = String(u.id ?? '').trim()
      if (!id || !porId.has(id)) continue
      const nome = String(u.nome ?? '').trim() || String(u.email ?? '').trim()
      if (nome) porId.set(id, nome)
    }
  }

  const opcoes = [...porId.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return { opcoes, error: null }
}

export async function fetchMtrListaPorId<T>(
  client: SupabaseClient,
  mtrId: string
): Promise<T | null> {
  const id = mtrId.trim()
  if (!id) return null
  const { data, error } = await client
    .from('mtrs')
    .select(MTR_LISTA_SELECT_COLUNAS)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as T
}
