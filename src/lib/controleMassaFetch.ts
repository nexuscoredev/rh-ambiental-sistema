import type { SupabaseClient } from '@supabase/supabase-js'
import {
  COLETAS_SELECT_CONTROLE_LISTA,
  COLETAS_SELECT_SEGUIMENTO,
} from './coletasSelectSeguimento'
import { intervaloMesVigenteProgramacoesMtr } from './mtrProgramacoesFetch'

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

const MTR_STATUS_EMITIDA = ['Emitido', 'Baixada'] as const
const COLETAS_MES_PAGE = 1000
const COLETAS_MES_MAX_PAGES = 12

type ColetaMtrMesRow = {
  id: string
  mtr_id: string
}

const FLUXO_COLETA_ENCERRADO = '("FINALIZADO","CANCELADA","FATURADO_CONCLUIDO")'

export type ContagemMtrSemTicketMesVigente = {
  /** Coletas do mês sem `mtr_id` — precisam de MTR antes de pesagem/ticket. */
  ticketsSemMtr: number
  /** Coletas com MTR emitida no mês, ainda sem ticket operacional. */
  ticketsPendentes: number
  mtrsComPendencia: number
  rotuloMesVigente: string
  error: Error | null
}

async function fetchColetasIdsMesVigente(
  supabase: SupabaseClient,
  inicio: string,
  fimExclusivo: string,
  modo: 'com_mtr' | 'sem_mtr'
): Promise<{ ids: string[]; rowsComMtr: ColetaMtrMesRow[]; error: Error | null }> {
  const porId = new Map<string, ColetaMtrMesRow>()

  const carregarPagina = async (
    runQuery: (
      from: number,
      to: number
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  ) => {
    for (let page = 0; page < COLETAS_MES_MAX_PAGES; page++) {
      const from = page * COLETAS_MES_PAGE
      const to = from + COLETAS_MES_PAGE - 1
      const { data, error } = await runQuery(from, to)
      if (error) return { error: new Error(error.message) }
      const chunk = (data ?? []) as Array<{
        id?: string
        mtr_id?: string | null
      }>
      for (const row of chunk) {
        const id = String(row.id ?? '').trim()
        if (!id) continue
        const mtr_id = String(row.mtr_id ?? '').trim()
        if (modo === 'com_mtr') {
          if (!mtr_id) continue
          porId.set(id, { id, mtr_id })
        } else {
          if (mtr_id) continue
          porId.set(id, { id, mtr_id: '' })
        }
      }
      if (chunk.length < COLETAS_MES_PAGE) break
      if (page === COLETAS_MES_MAX_PAGES - 1) {
        console.warn('[controleMassaFetch] Limite de páginas ao listar coletas do mês vigente.')
      }
    }
    return { error: null }
  }

  const aplicarFiltroAtivo = (q: ReturnType<SupabaseClient['from']>) =>
    modo === 'sem_mtr'
      ? q.is('mtr_id', null).not('fluxo_status', 'in', FLUXO_COLETA_ENCERRADO)
      : q.not('mtr_id', 'is', null)

  let err = (
    await carregarPagina(async (from, to) =>
      aplicarFiltroAtivo(
        supabase
          .from('coletas')
          .select('id, mtr_id')
          .gte('data_execucao', inicio)
          .lt('data_execucao', fimExclusivo)
      )
        .order('data_execucao', { ascending: false })
        .range(from, to)
    )
  ).error
  if (err) return { ids: [], rowsComMtr: [], error: err }

  err = (
    await carregarPagina(async (from, to) =>
      aplicarFiltroAtivo(
        supabase
          .from('coletas')
          .select('id, mtr_id')
          .is('data_execucao', null)
          .gte('data_agendada', inicio)
          .lt('data_agendada', fimExclusivo)
      )
        .order('data_agendada', { ascending: false })
        .range(from, to)
    )
  ).error
  if (err) return { ids: [], rowsComMtr: [], error: err }

  const rowsComMtr = [...porId.values()].filter((r) => r.mtr_id)
  return { ids: [...porId.keys()], rowsComMtr, error: null }
}

/** Indicadores do mês vigente para a esteira pesagem → MTR → ticket. */
export async function contarMtrSemTicketMesVigente(
  supabase: SupabaseClient
): Promise<ContagemMtrSemTicketMesVigente> {
  const { inicio, fimExclusivo, rotulo } = intervaloMesVigenteProgramacoesMtr()

  const [semMtrRes, comMtrRes] = await Promise.all([
    fetchColetasIdsMesVigente(supabase, inicio, fimExclusivo, 'sem_mtr'),
    fetchColetasIdsMesVigente(supabase, inicio, fimExclusivo, 'com_mtr'),
  ])

  if (semMtrRes.error) {
    return {
      ticketsSemMtr: 0,
      ticketsPendentes: 0,
      mtrsComPendencia: 0,
      rotuloMesVigente: rotulo,
      error: semMtrRes.error,
    }
  }
  if (comMtrRes.error) {
    return {
      ticketsSemMtr: semMtrRes.ids.length,
      ticketsPendentes: 0,
      mtrsComPendencia: 0,
      rotuloMesVigente: rotulo,
      error: comMtrRes.error,
    }
  }

  const ticketsSemMtr = semMtrRes.ids.length
  const coletas = comMtrRes.rowsComMtr
  if (coletas.length === 0) {
    return {
      ticketsSemMtr,
      ticketsPendentes: 0,
      mtrsComPendencia: 0,
      rotuloMesVigente: rotulo,
      error: null,
    }
  }

  const mtrIds = [...new Set(coletas.map((c) => c.mtr_id))]
  const mtrEmitida = new Set<string>()
  for (let i = 0; i < mtrIds.length; i += CHUNK_COLETAS) {
    const chunk = mtrIds.slice(i, i + CHUNK_COLETAS)
    const { data, error } = await supabase
      .from('mtrs')
      .select('id')
      .in('id', chunk)
      .in('status', [...MTR_STATUS_EMITIDA])
    if (error) {
      return {
        ticketsSemMtr,
        ticketsPendentes: 0,
        mtrsComPendencia: 0,
        rotuloMesVigente: rotulo,
        error: new Error(error.message),
      }
    }
    for (const row of data ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim()
      if (id) mtrEmitida.add(id)
    }
  }

  const coletasMtrEmitida = coletas.filter((c) => mtrEmitida.has(c.mtr_id))
  if (coletasMtrEmitida.length === 0) {
    return {
      ticketsSemMtr,
      ticketsPendentes: 0,
      mtrsComPendencia: 0,
      rotuloMesVigente: rotulo,
      error: null,
    }
  }

  const coletaIds = coletasMtrEmitida.map((c) => c.id)
  const comTicket = new Set<string>()
  for (let i = 0; i < coletaIds.length; i += CHUNK_TICKETS) {
    const chunk = coletaIds.slice(i, i + CHUNK_TICKETS)
    const { data, error } = await supabase
      .from('tickets_operacionais')
      .select('coleta_id')
      .in('coleta_id', chunk)
    if (error) {
      return {
        ticketsSemMtr,
        ticketsPendentes: 0,
        mtrsComPendencia: 0,
        rotuloMesVigente: rotulo,
        error: new Error(error.message),
      }
    }
    for (const row of data ?? []) {
      const cid = String((row as { coleta_id?: string }).coleta_id ?? '').trim()
      if (cid) comTicket.add(cid)
    }
  }

  const semTicket = coletasMtrEmitida.filter((c) => !comTicket.has(c.id))
  const mtrsComPendencia = new Set(semTicket.map((c) => c.mtr_id)).size

  return {
    ticketsSemMtr,
    ticketsPendentes: semTicket.length,
    mtrsComPendencia,
    rotuloMesVigente: rotulo,
    error: null,
  }
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
