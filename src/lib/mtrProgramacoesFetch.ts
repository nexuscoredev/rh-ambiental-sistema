import type { SupabaseClient } from '@supabase/supabase-js'

/** Colunas usadas na página MTR (nova / edição / calendário). */
export const MTR_PROGRAMACAO_SELECT =
  'id, numero, cliente_id, cliente, data_programada, tipo_caminhao, tipo_servico, observacoes, coleta_fixa, frequencia, periodicidade, status_programacao, created_at, criado_por_nome, criado_por_user_id'

/** Janela padrão do catálogo (meses) ao abrir o formulário «Nova MTR». */
export const MTR_PROGRAMACOES_MESES_PADRAO = 6

const PROG_PAGE = 1000
/** Teto de páginas no catálogo lazy (~4k linhas na janela). */
const MAX_PAGES_CATALOGO = 4

const CHUNK_IDS = 120

export type ProgramacaoMtrRow = {
  id: string
  numero?: string | null
  cliente_id?: string | null
  cliente?: string | null
  data_programada?: string | null
  tipo_caminhao?: string | null
  tipo_servico?: string | null
  observacoes?: string | null
  coleta_fixa?: boolean | null
  frequencia?: string | null
  periodicidade?: string | null
  status_programacao?: string | null
  created_at?: string | null
  criado_por_nome?: string | null
  criado_por_user_id?: string | null
}

/**
 * Meses de histórico no catálogo lazy.
 * Env `VITE_MTR_PROGRAMACOES_MESES` — use `0` para 12 meses (legado mais pesado).
 */
export function mtrProgramacoesMesesJanela(): number {
  const raw = import.meta.env.VITE_MTR_PROGRAMACOES_MESES
  const trimmed = raw == null ? '' : String(raw).trim()
  if (trimmed === '0') return 12
  if (!trimmed) return MTR_PROGRAMACOES_MESES_PADRAO
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return MTR_PROGRAMACOES_MESES_PADRAO
  return Math.floor(n)
}

export function dataLimiteIsoProgramacoesMtr(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - mtrProgramacoesMesesJanela())
  return d.toISOString().slice(0, 10)
}

/** Intervalo [início, fim) do mês calendário vigente (data local). */
export function intervaloMesVigenteProgramacoesMtr(ref = new Date()): {
  inicio: string
  fimExclusivo: string
  rotulo: string
} {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const inicio = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const proximoMes = new Date(y, m + 1, 1)
  const fimExclusivo = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}-01`
  const rotulo = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return { inicio, fimExclusivo, rotulo }
}

/** Programações não canceladas com `data_programada` no mês vigente. */
export async function fetchProgramacoesMtrMesVigente(
  supabase: SupabaseClient,
  ref = new Date()
): Promise<{ data: ProgramacaoMtrRow[]; error: Error | null; rotuloMes: string }> {
  const { inicio, fimExclusivo, rotulo } = intervaloMesVigenteProgramacoesMtr(ref)
  const acc: ProgramacaoMtrRow[] = []

  for (let page = 0; page < MAX_PAGES_CATALOGO; page++) {
    const from = page * PROG_PAGE
    const to = from + PROG_PAGE - 1
    const { data, error } = await supabase
      .from('programacoes')
      .select(MTR_PROGRAMACAO_SELECT)
      .neq('status_programacao', 'CANCELADA')
      .gte('data_programada', inicio)
      .lt('data_programada', fimExclusivo)
      .order('data_programada', { ascending: false })
      .range(from, to)

    if (error) return { data: acc, error: new Error(error.message), rotuloMes: rotulo }

    const chunk = (data || []) as ProgramacaoMtrRow[]
    acc.push(...chunk)
    if (chunk.length < PROG_PAGE) break
    if (page === MAX_PAGES_CATALOGO - 1) {
      console.warn(
        `[mtrProgramacoesFetch] Mês vigente: limite de ${MAX_PAGES_CATALOGO}×${PROG_PAGE} programações em ${rotulo}.`
      )
    }
  }

  return { data: acc, error: null, rotuloMes: rotulo }
}

/** Une listas por `id` (última entrada ganha). */
export function mergeProgramacoesMtrPorId(
  ...listas: ProgramacaoMtrRow[][]
): ProgramacaoMtrRow[] {
  const map = new Map<string, ProgramacaoMtrRow>()
  for (const lista of listas) {
    for (const row of lista) {
      if (row?.id) map.set(row.id, row)
    }
  }
  return [...map.values()]
}

export async function fetchProgramacoesMtrPorIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<{ data: ProgramacaoMtrRow[]; error: Error | null }> {
  const uniq = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (uniq.length === 0) return { data: [], error: null }

  const out: ProgramacaoMtrRow[] = []
  for (let i = 0; i < uniq.length; i += CHUNK_IDS) {
    const chunk = uniq.slice(i, i + CHUNK_IDS)
    const { data, error } = await supabase
      .from('programacoes')
      .select(MTR_PROGRAMACAO_SELECT)
      .in('id', chunk)
    if (error) return { data: out, error: new Error(error.message) }
    out.push(...((data || []) as ProgramacaoMtrRow[]))
  }
  return { data: out, error: null }
}

/**
 * Catálogo para calendário / nova MTR: últimos N meses, não canceladas, paginado com teto.
 */
export async function fetchProgramacoesMtrCatalogo(
  supabase: SupabaseClient
): Promise<{ data: ProgramacaoMtrRow[]; error: Error | null }> {
  const dataLimiteStr = dataLimiteIsoProgramacoesMtr()
  const acc: ProgramacaoMtrRow[] = []

  for (let page = 0; page < MAX_PAGES_CATALOGO; page++) {
    const from = page * PROG_PAGE
    const to = from + PROG_PAGE - 1
    const { data, error } = await supabase
      .from('programacoes')
      .select(MTR_PROGRAMACAO_SELECT)
      .neq('status_programacao', 'CANCELADA')
      .gte('data_programada', dataLimiteStr)
      .order('data_programada', { ascending: false })
      .range(from, to)

    if (error) return { data: acc, error: new Error(error.message) }

    const chunk = (data || []) as ProgramacaoMtrRow[]
    acc.push(...chunk)
    if (chunk.length < PROG_PAGE) break
    if (page === MAX_PAGES_CATALOGO - 1) {
      console.warn(
        `[mtrProgramacoesFetch] Catálogo: limite de ${MAX_PAGES_CATALOGO}×${PROG_PAGE} programações na janela de ${mtrProgramacoesMesesJanela()} meses.`
      )
    }
  }

  return { data: acc, error: null }
}

const MTR_STATUS_EMITIDA = ['Emitido', 'Baixada'] as const

export type ContagemProgramacoesSemMtrEmitida = {
  totalProgramacoes: number
  semMtrEmitida: number
  rotuloMesVigente: string
  error: Error | null
}

/** Programações do mês vigente sem MTR com status Emitido ou Baixada. */
export async function contarProgramacoesSemMtrEmitida(
  supabase: SupabaseClient
): Promise<ContagemProgramacoesSemMtrEmitida> {
  const { data: progs, error: errProg, rotuloMes } = await fetchProgramacoesMtrMesVigente(supabase)
  if (errProg) {
    return { totalProgramacoes: 0, semMtrEmitida: 0, rotuloMesVigente: rotuloMes, error: errProg }
  }
  const ids = progs.map((p) => p.id).filter(Boolean)
  if (ids.length === 0) {
    return { totalProgramacoes: 0, semMtrEmitida: 0, rotuloMesVigente: rotuloMes, error: null }
  }

  const comMtrEmitida = new Set<string>()
  for (let i = 0; i < ids.length; i += CHUNK_IDS) {
    const chunk = ids.slice(i, i + CHUNK_IDS)
    const { data, error } = await supabase
      .from('mtrs')
      .select('programacao_id')
      .in('programacao_id', chunk)
      .in('status', [...MTR_STATUS_EMITIDA])
    if (error) {
      return {
        totalProgramacoes: progs.length,
        semMtrEmitida: 0,
        rotuloMesVigente: rotuloMes,
        error: new Error(error.message),
      }
    }
    for (const row of data ?? []) {
      const pid = String((row as { programacao_id?: string | null }).programacao_id ?? '').trim()
      if (pid) comMtrEmitida.add(pid)
    }
  }

  const semMtrEmitida = progs.filter((p) => !comMtrEmitida.has(p.id)).length
  return {
    totalProgramacoes: progs.length,
    semMtrEmitida,
    rotuloMesVigente: rotuloMes,
    error: null,
  }
}

/** IDs de programação referenciadas por MTRs / coletas já carregadas + URL. */
export function coletarProgramacaoIdsVinculadasMtr(
  mtrs: { programacao_id?: string | null }[],
  coletas: { programacao_id?: string | null }[],
  extras: (string | null | undefined)[]
): string[] {
  const ids = new Set<string>()
  for (const m of mtrs) {
    const id = (m.programacao_id ?? '').trim()
    if (id) ids.add(id)
  }
  for (const c of coletas) {
    const id = (c.programacao_id ?? '').trim()
    if (id) ids.add(id)
  }
  for (const raw of extras) {
    const id = (raw ?? '').trim()
    if (id) ids.add(id)
  }
  return [...ids]
}
