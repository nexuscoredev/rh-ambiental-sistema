import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

const PAGE_SIZE = 1000

/** PostgREST costuma limitar a 1000 linhas por pedido; várias páginas evitam “perder” a fila de faturamento. */
const MAX_PAGES_COMPLETO = 20
const MAX_PAGES_OPERACIONAL = 8
const MAX_PAGES_HISTORICO = 12

/** Janela padrão (dias) quando `VITE_FATURAMENTO_RESUMO_DESDE_DIAS` não está definida. */
export const FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO = 180

export type FaturamentoResumoEscopo =
  /** Filas ativas (ticket, conferência, a faturar) — exclui registo emitido. */
  | 'operacional'
  /** Coletas já emitidas ao Financeiro (consulta / relatórios). */
  | 'historico'
  /** Sem filtro de escopo (evitar em produção; uso legado / debug). */
  | 'completo'

export type FetchVwFaturamentoResumoPaginatedOpts = {
  /** Filtro PostgREST `.or(...)` — ex.: lista financeira (`COLETAS_OR_FINANCEIRO_QUERY`). */
  orFilter?: string
  escopo?: FaturamentoResumoEscopo
  /** Sobrescreve o teto de páginas do escopo (ex.: contagem rápida). */
  maxPages?: number
}

/**
 * Dias de histórico em `vw_faturamento_resumo`.
 * - Env ausente → {@link FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO}
 * - `0` ou vazio explícito → sem corte (histórico completo paginado)
 */
export function faturamentoResumoDesdeDias(): number | null {
  const raw = import.meta.env.VITE_FATURAMENTO_RESUMO_DESDE_DIAS
  const trimmed = raw == null ? '' : String(raw).trim()
  if (trimmed === '0') return null
  if (!trimmed) return FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO
  return Math.floor(n)
}

export function faturamentoResumoCreatedAtMinIso(): string | null {
  const dias = faturamentoResumoDesdeDias()
  if (dias == null) return null
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - dias)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Filtro PostgREST `.or(...)` conforme o escopo da carga. */
export function escopoOrFilterPostgrest(escopo: FaturamentoResumoEscopo): string | undefined {
  switch (escopo) {
    case 'operacional':
      return 'faturamento_registro_status.is.null,faturamento_registro_status.neq.emitido'
    case 'historico':
      return 'faturamento_registro_status.eq.emitido,liberado_financeiro.eq.true'
    case 'completo':
      return undefined
    default:
      return undefined
  }
}

function maxPagesParaEscopo(escopo: FaturamentoResumoEscopo, override?: number): number {
  if (override != null && override > 0) return override
  switch (escopo) {
    case 'operacional':
      return MAX_PAGES_OPERACIONAL
    case 'historico':
      return MAX_PAGES_HISTORICO
    default:
      return MAX_PAGES_COMPLETO
  }
}

/** Erro PostgREST típico quando a view ainda não foi criada no projeto Supabase. */
export function isVwFaturamentoResumoMissingError(err: PostgrestError | { message?: string; code?: string }): boolean {
  const code = 'code' in err ? String(err.code ?? '') : ''
  const msg = String(err.message ?? '')
  if (code === 'PGRST205') return true
  if (!/vw_faturamento_resumo/i.test(msg)) return false
  return /schema cache|could not find|does not exist|relation /i.test(msg)
}

function mensagemCorrecaoViewFaturamento(): string {
  return (
    '\n\n▸ Como corrigir: no Supabase, abra SQL Editor, cole e execute o ficheiro do repositório:\n' +
    '   supabase/sql_editor_vw_faturamento_resumo.sql\n\n' +
    '   Em desenvolvimento (com DATABASE_URL ou SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL no .env):\n' +
    '   npm run db:apply:faturamento-view\n\n' +
    '   Depois use «Tentar de novo» ou atualize a página.'
  )
}

const SEL_VW_FATURAMENTO_BASE =
  'coleta_id, numero, numero_coleta, cliente_id, cliente_nome, cliente_razao_social, cliente_margem_lucro_percentual, data_agendada, data_programacao, data_execucao, programacao_id, programacao_numero, programacao_observacoes, mtr_id, mtr_numero, mtr_observacoes, ticket_comprovante, peso_tara, peso_bruto, peso_liquido, motorista, placa, valor_coleta, status_pagamento, data_vencimento, referencia_nf, numero_nf_coleta, faturamento_referencia_nf, faturamento_registro_status, faturamento_registro_valor, confirmacao_recebimento, fluxo_status, etapa_operacional, status_processo, liberado_financeiro, coleta_observacoes, tipo_residuo, cidade, created_at, ultima_aprovacao_decisao, ultima_aprovacao_obs, ultima_aprovacao_em, conferencia_documentos_ok, conferencia_operacional_obs, conferencia_em, status_conferencia, pendencias_resumo, faturamento_sla_vencido, status_faturamento, conta_receber_nf_enviada_em, conta_receber_nf_envio_obs, conta_receber_valor_pago, conta_receber_valor_travado'

const SEL_VW_FATURAMENTO_TICKET_APROVACAO =
  ', ticket_impresso_em, faturamento_ticket_aprovado_em, faturamento_ticket_aprovacao_obs'

const SEL_VW_FATURAMENTO_ESTEIRA =
  ', faturamento_esteira_status, medicao_relatorio_gerado_em, medicao_email_enviado_em, medicao_cliente_aprovado_em, medicao_cliente_aprovacao_obs, faturamento_relatorio_cliente_em, cliente_email_nf, mtr_status'

/** Colunas da migração 20260601120000 expostas em vw_faturamento_resumo (evitar falso positivo com erro genérico da view). */
export function isEsteiraColumnMissingError(err: { message?: string }): boolean {
  const msg = String(err.message ?? '').toLowerCase()
  return (
    msg.includes('faturamento_esteira_status') ||
    msg.includes('faturamento_relatorio_cliente') ||
    msg.includes('medicao_relatorio') ||
    msg.includes('medicao_email') ||
    msg.includes('medicao_cliente') ||
    msg.includes('cliente_email_nf') ||
    msg.includes('mtr_status')
  )
}

function isTicketAprovacaoColumnMissingError(err: { message?: string }): boolean {
  const msg = String(err.message ?? '').toLowerCase()
  return (
    msg.includes('ticket_impresso_em') ||
    msg.includes('faturamento_ticket_aprovado') ||
    (msg.includes('column') && msg.includes('vw_faturamento_resumo'))
  )
}

export type FetchVwFaturamentoResumoResult = {
  data: FaturamentoResumoViewRow[]
  error: Error | null
  /** View com colunas de impressão/aprovação do ticket (migração 20260518130000). */
  ticketAprovacaoAtivo: boolean
  /** View com colunas da esteira de medição (migração 20260601120000). */
  esteiraMedicaoAtiva: boolean
}

function ordenarLinhas(rows: FaturamentoResumoViewRow[]): FaturamentoResumoViewRow[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime()
    const tb = new Date(b.created_at).getTime()
    if (tb !== ta) return tb - ta
    return a.coleta_id < b.coleta_id ? 1 : a.coleta_id > b.coleta_id ? -1 : 0
  })
}

/**
 * Carrega linhas da view `vw_faturamento_resumo` com paginação.
 * Use `escopo: 'operacional'` nas filas e `historico` na consulta de emitidas.
 */
export async function fetchVwFaturamentoResumoPaginated(
  supabase: SupabaseClient,
  opts?: FetchVwFaturamentoResumoPaginatedOpts
): Promise<FetchVwFaturamentoResumoResult> {
  const escopo = opts?.escopo ?? 'completo'
  const createdMin = faturamentoResumoCreatedAtMinIso()
  const escopoOr = escopoOrFilterPostgrest(escopo)
  const orFilter = (opts?.orFilter ?? '').trim()
  const maxPages = maxPagesParaEscopo(escopo, opts?.maxPages)
  const byId = new Map<string, FaturamentoResumoViewRow>()
  let exitDueToMaxPages = false
  let sel = `${SEL_VW_FATURAMENTO_BASE}${SEL_VW_FATURAMENTO_TICKET_APROVACAO}${SEL_VW_FATURAMENTO_ESTEIRA}`
  let ticketAprovacaoAtivo = true
  let esteiraMedicaoAtiva = true

  for (let page = 0; page < maxPages; page++) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let qb = supabase.from('vw_faturamento_resumo').select(sel)
    if (createdMin) qb = qb.gte('created_at', createdMin)
    if (escopoOr) qb = qb.or(escopoOr)
    if (orFilter) qb = qb.or(orFilter)
    const { data, error } = await qb
      .order('created_at', { ascending: false })
      .order('coleta_id', { ascending: false })
      .range(from, to)

    if (error) {
      if (page === 0 && esteiraMedicaoAtiva && isEsteiraColumnMissingError(error)) {
        esteiraMedicaoAtiva = false
        sel = `${SEL_VW_FATURAMENTO_BASE}${ticketAprovacaoAtivo ? SEL_VW_FATURAMENTO_TICKET_APROVACAO : ''}`
        page = -1
        byId.clear()
        continue
      }
      if (page === 0 && ticketAprovacaoAtivo && isTicketAprovacaoColumnMissingError(error)) {
        ticketAprovacaoAtivo = false
        sel = `${SEL_VW_FATURAMENTO_BASE}${esteiraMedicaoAtiva ? SEL_VW_FATURAMENTO_ESTEIRA : ''}`
        page = -1
        byId.clear()
        continue
      }
      const base = error.message || 'Erro ao ler vw_faturamento_resumo.'
      const msg = isVwFaturamentoResumoMissingError(error) ? base + mensagemCorrecaoViewFaturamento() : base
      return { data: [], error: new Error(msg), ticketAprovacaoAtivo: false, esteiraMedicaoAtiva: false }
    }

    const chunk = ((data ?? []) as unknown as FaturamentoResumoViewRow[]) || []
    if (chunk.length === 0) break

    for (const row of chunk) {
      byId.set(row.coleta_id, row)
    }

    if (chunk.length < PAGE_SIZE) break
    if (page === maxPages - 1) exitDueToMaxPages = true
  }

  if (exitDueToMaxPages) {
    console.warn(
      `[faturamentoResumoFetch] Escopo «${escopo}»: limite de ${maxPages} páginas × ${PAGE_SIZE} linhas; a lista pode estar truncada. ` +
        `Ajuste VITE_FATURAMENTO_RESUMO_DESDE_DIAS (atual ~${faturamentoResumoDesdeDias() ?? 'sem corte'} dias) se necessário.`
    )
  }

  return { data: ordenarLinhas([...byId.values()]), error: null, ticketAprovacaoAtivo, esteiraMedicaoAtiva }
}

/** Contagem aproximada de emitidas (cartões) sem trazer todas as linhas. */
export async function fetchContagemHistoricoFaturamentoEmitido(
  supabase: SupabaseClient
): Promise<{ count: number; error: Error | null }> {
  const createdMin = faturamentoResumoCreatedAtMinIso()
  const escopoOr = escopoOrFilterPostgrest('historico')
  let qb = supabase.from('vw_faturamento_resumo').select('coleta_id', { count: 'exact', head: true })
  if (createdMin) qb = qb.gte('created_at', createdMin)
  if (escopoOr) qb = qb.or(escopoOr)
  const { count, error } = await qb
  if (error) return { count: 0, error: new Error(error.message) }
  return { count: count ?? 0, error: null }
}

/** Uma ou poucas coletas (ex.: contexto na URL) fora do lote operacional. */
export async function fetchVwFaturamentoResumoPorColetaIds(
  supabase: SupabaseClient,
  coletaIds: string[]
): Promise<FetchVwFaturamentoResumoResult> {
  const uniq = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (uniq.length === 0) {
    return { data: [], error: null, ticketAprovacaoAtivo: true, esteiraMedicaoAtiva: true }
  }

  const createdMin = faturamentoResumoCreatedAtMinIso()
  let sel = `${SEL_VW_FATURAMENTO_BASE}${SEL_VW_FATURAMENTO_TICKET_APROVACAO}${SEL_VW_FATURAMENTO_ESTEIRA}`
  let ticketAprovacaoAtivo = true
  let esteiraMedicaoAtiva = true

  let qb = supabase.from('vw_faturamento_resumo').select(sel).in('coleta_id', uniq)
  if (createdMin) qb = qb.gte('created_at', createdMin)

  let { data, error } = await qb

  if (error && esteiraMedicaoAtiva && isEsteiraColumnMissingError(error)) {
    esteiraMedicaoAtiva = false
    sel = `${SEL_VW_FATURAMENTO_BASE}${ticketAprovacaoAtivo ? SEL_VW_FATURAMENTO_TICKET_APROVACAO : ''}`
    let qb2 = supabase.from('vw_faturamento_resumo').select(sel).in('coleta_id', uniq)
    if (createdMin) qb2 = qb2.gte('created_at', createdMin)
    const retry = await qb2
    data = retry.data
    error = retry.error
  }

  if (error && ticketAprovacaoAtivo && isTicketAprovacaoColumnMissingError(error)) {
    ticketAprovacaoAtivo = false
    sel = `${SEL_VW_FATURAMENTO_BASE}${esteiraMedicaoAtiva ? SEL_VW_FATURAMENTO_ESTEIRA : ''}`
    let qb2 = supabase.from('vw_faturamento_resumo').select(sel).in('coleta_id', uniq)
    if (createdMin) qb2 = qb2.gte('created_at', createdMin)
    const retry = await qb2
    data = retry.data
    error = retry.error
  }

  if (error) {
    const base = error.message || 'Erro ao ler vw_faturamento_resumo.'
    const msg = isVwFaturamentoResumoMissingError(error) ? base + mensagemCorrecaoViewFaturamento() : base
    return { data: [], error: new Error(msg), ticketAprovacaoAtivo: false, esteiraMedicaoAtiva: false }
  }

  return {
    data: ordenarLinhas((data ?? []) as unknown as FaturamentoResumoViewRow[]),
    error: null,
    ticketAprovacaoAtivo,
    esteiraMedicaoAtiva,
  }
}

const MAX_LINHAS_POR_MTR_LOOKUP = 100

/**
 * Coletas de uma MTR para consulta de etapa (sem corte `VITE_FATURAMENTO_RESUMO_DESDE_DIAS`).
 */
export async function fetchVwFaturamentoResumoPorMtrId(
  supabase: SupabaseClient,
  mtrId: string
): Promise<FetchVwFaturamentoResumoResult> {
  const mid = mtrId.trim()
  if (!mid) {
    return { data: [], error: null, ticketAprovacaoAtivo: true, esteiraMedicaoAtiva: true }
  }

  let sel = `${SEL_VW_FATURAMENTO_BASE}${SEL_VW_FATURAMENTO_TICKET_APROVACAO}${SEL_VW_FATURAMENTO_ESTEIRA}`
  let ticketAprovacaoAtivo = true
  let esteiraMedicaoAtiva = true

  let qb = supabase
    .from('vw_faturamento_resumo')
    .select(sel)
    .eq('mtr_id', mid)
    .order('created_at', { ascending: false })
    .limit(MAX_LINHAS_POR_MTR_LOOKUP)

  let { data, error } = await qb

  if (error && esteiraMedicaoAtiva && isEsteiraColumnMissingError(error)) {
    esteiraMedicaoAtiva = false
    sel = `${SEL_VW_FATURAMENTO_BASE}${ticketAprovacaoAtivo ? SEL_VW_FATURAMENTO_TICKET_APROVACAO : ''}`
    const retry = await supabase
      .from('vw_faturamento_resumo')
      .select(sel)
      .eq('mtr_id', mid)
      .order('created_at', { ascending: false })
      .limit(MAX_LINHAS_POR_MTR_LOOKUP)
    data = retry.data
    error = retry.error
  }

  if (error && ticketAprovacaoAtivo && isTicketAprovacaoColumnMissingError(error)) {
    ticketAprovacaoAtivo = false
    sel = `${SEL_VW_FATURAMENTO_BASE}${esteiraMedicaoAtiva ? SEL_VW_FATURAMENTO_ESTEIRA : ''}`
    const retry = await supabase
      .from('vw_faturamento_resumo')
      .select(sel)
      .eq('mtr_id', mid)
      .order('created_at', { ascending: false })
      .limit(MAX_LINHAS_POR_MTR_LOOKUP)
    data = retry.data
    error = retry.error
  }

  if (error) {
    const base = error.message || 'Erro ao ler vw_faturamento_resumo.'
    const msg = isVwFaturamentoResumoMissingError(error) ? base + mensagemCorrecaoViewFaturamento() : base
    return { data: [], error: new Error(msg), ticketAprovacaoAtivo: false, esteiraMedicaoAtiva: false }
  }

  return {
    data: ordenarLinhas((data ?? []) as unknown as FaturamentoResumoViewRow[]),
    error: null,
    ticketAprovacaoAtivo,
    esteiraMedicaoAtiva,
  }
}
