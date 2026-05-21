import type { SupabaseClient } from '@supabase/supabase-js'
import {
  COLETAS_SELECT_CONTROLE_LISTA,
  COLETAS_SELECT_SEGUIMENTO,
} from './coletasSelectSeguimento'

/** Alinhado à janela de `queryColetasListaFluxoControle` (120 dias). */
export const CONTROLE_MASSA_JANELA_DIAS_PADRAO = 120

const CHUNK_COLETAS = 120
const CHUNK_RPC_PESAGEM = 200
const CHUNK_TICKETS = 200
const CHUNK_PROG = 200
const LIMITE_COLETA_IDS_MASSA = 800

export type UltimaPesagemColeta = {
  data: string | null
  hora_entrada: string | null
  hora_saida: string | null
}

/**
 * Dias de histórico para `coleta_id` em controle_massa (complemento da lista principal).
 * Env `VITE_CONTROLE_MASSA_JANELA_DIAS` — `0` usa o padrão (120).
 */
export function controleMassaJanelaDias(): number {
  const raw = import.meta.env.VITE_CONTROLE_MASSA_JANELA_DIAS
  const trimmed = raw == null ? '' : String(raw).trim()
  if (trimmed === '0') return CONTROLE_MASSA_JANELA_DIAS_PADRAO
  if (!trimmed) return CONTROLE_MASSA_JANELA_DIAS_PADRAO
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return CONTROLE_MASSA_JANELA_DIAS_PADRAO
  return Math.floor(n)
}

export function dataCorteIsoControleMassa(): string {
  const d = new Date()
  d.setDate(d.getDate() - controleMassaJanelaDias())
  return d.toISOString()
}

/** Coleta_ids com registro de pesagem na janela operacional (evita varrer 1200 linhas sem filtro). */
export async function fetchColetaIdsComPesagemRecente(
  supabase: SupabaseClient
): Promise<string[]> {
  const desde = dataCorteIsoControleMassa()
  const { data, error } = await supabase
    .from('controle_massa')
    .select('coleta_id')
    .gte('created_at', desde)
    .not('coleta_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(LIMITE_COLETA_IDS_MASSA)

  if (error) {
    console.error('Erro ao listar coleta_id em controle_massa (janela):', error)
    return []
  }

  return [
    ...new Set(
      ((data as { coleta_id?: string | null }[]) || [])
        .map((r) => r.coleta_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
}

export async function buscarColetasPorIdsControleMassa(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Record<string, unknown>[]> {
  const uniq = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (uniq.length === 0) return []

  const out: Record<string, unknown>[] = []

  for (let i = 0; i < uniq.length; i += CHUNK_COLETAS) {
    const chunk = uniq.slice(i, i + CHUNK_COLETAS)
    let { data, error } = await supabase
      .from('coletas')
      .select(COLETAS_SELECT_CONTROLE_LISTA)
      .in('id', chunk)

    if (error) {
      const fallback = await supabase
        .from('coletas')
        .select(COLETAS_SELECT_SEGUIMENTO)
        .in('id', chunk)
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('Erro ao buscar coletas por id:', error)
      continue
    }

    for (const row of (data as Record<string, unknown>[]) || []) {
      out.push(row)
    }
  }

  return out
}

type RpcPesagemRow = {
  coletaId: string
  data: string | null
  hora_entrada: string | null
  hora_saida: string | null
}

async function fetchUltimaPesagemRpcChunk(
  supabase: SupabaseClient,
  chunk: string[]
): Promise<RpcPesagemRow[] | null> {
  if (chunk.length === 0) return []
  const { data, error } = await supabase.rpc('ultima_pesagem_por_coleta_ids', {
    p_ids: chunk,
  })
  if (error) return null
  return (
    (data as Array<{
      coleta_id?: string
      data?: string | null
      hora_entrada?: string | null
      hora_saida?: string | null
    }> | null) ?? []
  ).map((r) => ({
    coletaId: r.coleta_id != null ? String(r.coleta_id) : '',
    data: r.data != null ? String(r.data) : null,
    hora_entrada: r.hora_entrada != null ? String(r.hora_entrada) : null,
    hora_saida: r.hora_saida != null ? String(r.hora_saida) : null,
  }))
}

/** Fallback quando a RPC ainda não foi aplicada no Supabase remoto. */
async function fetchUltimaPesagemLegacyChunk(
  supabase: SupabaseClient,
  chunk: string[]
): Promise<Map<string, UltimaPesagemColeta>> {
  const ultima = new Map<string, UltimaPesagemColeta>()
  if (chunk.length === 0) return ultima

  const lim = Math.min(5000, chunk.length * 40)
  const prim = await supabase
    .from('controle_massa')
    .select('coleta_id, data, hora_entrada, hora_saida, created_at')
    .in('coleta_id', chunk)
    .order('created_at', { ascending: false })
    .limit(lim)

  let rows: Record<string, unknown>[] | null = null
  if (!prim.error && prim.data) {
    rows = prim.data as Record<string, unknown>[]
  } else {
    const alt = await supabase
      .from('controle_massa')
      .select('coleta_id, data, hora_entrada, hora_saida, id')
      .in('coleta_id', chunk)
      .order('id', { ascending: false })
      .limit(lim)
    if (!alt.error && alt.data) rows = alt.data as Record<string, unknown>[]
  }

  if (!rows) return ultima

  for (const r of rows) {
    const cid = r.coleta_id != null ? String(r.coleta_id) : ''
    if (!cid || ultima.has(cid)) continue
    ultima.set(cid, {
      data: r.data != null ? String(r.data) : null,
      hora_entrada: r.hora_entrada != null ? String(r.hora_entrada) : null,
      hora_saida: r.hora_saida != null ? String(r.hora_saida) : null,
    })
  }
  return ultima
}

export async function fetchUltimaPesagemPorColetaIds(
  supabase: SupabaseClient,
  coletaIds: string[]
): Promise<Map<string, UltimaPesagemColeta>> {
  const ultima = new Map<string, UltimaPesagemColeta>()
  const uniq = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (uniq.length === 0) return ultima

  let rpcDisponivel = true

  for (let i = 0; i < uniq.length; i += CHUNK_RPC_PESAGEM) {
    const chunk = uniq.slice(i, i + CHUNK_RPC_PESAGEM)
    if (rpcDisponivel) {
      const rows = await fetchUltimaPesagemRpcChunk(supabase, chunk)
      if (rows === null) {
        rpcDisponivel = false
        const leg = await fetchUltimaPesagemLegacyChunk(supabase, chunk)
        for (const [cid, v] of leg) ultima.set(cid, v)
        continue
      }
      for (const r of rows) {
        if (!r.coletaId) continue
        ultima.set(r.coletaId, {
          data: r.data,
          hora_entrada: r.hora_entrada,
          hora_saida: r.hora_saida,
        })
      }
    } else {
      const leg = await fetchUltimaPesagemLegacyChunk(supabase, chunk)
      for (const [cid, v] of leg) ultima.set(cid, v)
    }
  }

  return ultima
}

export async function fetchTicketOperacionalPorColetaIds(
  supabase: SupabaseClient,
  coletaIds: string[]
): Promise<{
  tipoPorColeta: Map<string, string>
  numeroPorColeta: Map<string, string>
}> {
  const tipoPorColeta = new Map<string, string>()
  const numeroPorColeta = new Map<string, string>()
  const uniq = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (uniq.length === 0) return { tipoPorColeta, numeroPorColeta }

  const visto = new Set<string>()
  for (let i = 0; i < uniq.length; i += CHUNK_TICKETS) {
    const chunk = uniq.slice(i, i + CHUNK_TICKETS)
    const { data, error } = await supabase
      .from('tickets_operacionais')
      .select('coleta_id, tipo_ticket, numero')
      .in('coleta_id', chunk)
    if (error) {
      console.error('Erro ao buscar ticket operacional por coleta:', error)
      continue
    }
    const rows =
      (data as
        | Array<{
            coleta_id?: string
            tipo_ticket?: string | null
            numero?: string | null
          }>
        | null) ?? []
    for (const row of rows) {
      const cid = row.coleta_id != null ? String(row.coleta_id) : ''
      if (!cid || visto.has(cid)) continue
      visto.add(cid)
      const tt = row.tipo_ticket != null ? String(row.tipo_ticket).trim() : ''
      const num = row.numero != null ? String(row.numero).trim() : ''
      if (tt) tipoPorColeta.set(cid, tt)
      numeroPorColeta.set(cid, num)
    }
  }
  return { tipoPorColeta, numeroPorColeta }
}

export async function fetchTipoCaminhaoPorProgramacaoIds(
  supabase: SupabaseClient,
  progIds: string[]
): Promise<Record<string, string>> {
  const tipoCam: Record<string, string> = {}
  const uniq = [...new Set(progIds.map((id) => id.trim()).filter(Boolean))]
  if (uniq.length === 0) return tipoCam

  const fatias: string[][] = []
  for (let pi = 0; pi < uniq.length; pi += CHUNK_PROG) {
    fatias.push(uniq.slice(pi, pi + CHUNK_PROG))
  }

  const progRespostas = await Promise.all(
    fatias.map((slice) =>
      supabase.from('programacoes').select('id, tipo_caminhao').in('id', slice)
    )
  )
  for (const { data: prows, error: pErr } of progRespostas) {
    if (!pErr && prows) {
      for (const p of prows as { id: string; tipo_caminhao?: string | null }[]) {
        tipoCam[p.id] = (p.tipo_caminhao ?? '').trim() || '—'
      }
    }
  }
  return tipoCam
}
