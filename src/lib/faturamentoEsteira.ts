import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import {
  coletaAguardandoImpressaoTicketFaturamento,
  coletaHistoricoFaturamentoEmitido,
  coletaNaFilaAprovacaoTicketFaturamento,
} from './faturamentoOperacionalFila'

/** Etapas da esteira pós-conferência do ticket. */
export const FATURAMENTO_ESTEIRA_STATUS = [
  'MEDICAO_PENDENTE',
  'MEDICAO_EMAIL_PENDENTE',
  'MEDICAO_AGUARDANDO_CLIENTE',
  'LIBERADO_FATURAMENTO',
  'LIBERADO_FINANCEIRO',
  'FINALIZADO',
] as const

export type FaturamentoEsteiraStatus = (typeof FATURAMENTO_ESTEIRA_STATUS)[number]

export const ROTULO_ESTEIRA: Record<FaturamentoEsteiraStatus, string> = {
  MEDICAO_PENDENTE: 'Relatório de medição',
  MEDICAO_EMAIL_PENDENTE: 'Envio do relatório (e-mail)',
  MEDICAO_AGUARDANDO_CLIENTE: 'Aprovação do cliente',
  LIBERADO_FATURAMENTO: 'Liberado faturamento',
  LIBERADO_FINANCEIRO: 'Liberado financeiro',
  FINALIZADO: 'Finalizado',
}

export const ORDEM_ESTEIRA_UI: FaturamentoEsteiraStatus[] = [
  'MEDICAO_PENDENTE',
  'MEDICAO_EMAIL_PENDENTE',
  'MEDICAO_AGUARDANDO_CLIENTE',
  'LIBERADO_FATURAMENTO',
  'LIBERADO_FINANCEIRO',
  'FINALIZADO',
]

function erroColunasEsteiraAusentes(error: { message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    msg.includes('faturamento_esteira_status') ||
    msg.includes('medicao_') ||
    msg.includes('schema cache') ||
    (msg.includes('column') && msg.includes('coletas'))
  )
}

export const MENSAGEM_MIGRACAO_ESTEIRA =
  'A esteira de medição ainda não está ativa neste Supabase. Execute supabase/migrations/20260601120000_faturamento_esteira_medicoes.sql no SQL Editor.'

export function normalizarEsteiraStatus(
  raw: string | null | undefined
): FaturamentoEsteiraStatus | null {
  const s = (raw ?? '').trim().toUpperCase()
  if (!s) return null
  return (FATURAMENTO_ESTEIRA_STATUS as readonly string[]).includes(s)
    ? (s as FaturamentoEsteiraStatus)
    : null
}

/** Inferência quando a coluna ainda não existe ou está vazia. */
export function inferirEsteiraStatus(row: FaturamentoResumoViewRow): FaturamentoEsteiraStatus | null {
  const expl = normalizarEsteiraStatus(row.faturamento_esteira_status)
  if (expl) return expl

  if (row.conta_receber_nf_enviada_em) return 'FINALIZADO'
  if (row.faturamento_registro_status === 'emitido' || coletaHistoricoFaturamentoEmitido(row)) {
    return 'LIBERADO_FINANCEIRO'
  }
  if (row.medicao_cliente_aprovado_em) return 'LIBERADO_FATURAMENTO'
  if (row.medicao_email_enviado_em) return 'MEDICAO_AGUARDANDO_CLIENTE'
  if (row.medicao_relatorio_gerado_em) return 'MEDICAO_EMAIL_PENDENTE'
  if (row.faturamento_ticket_aprovado_em) return 'MEDICAO_PENDENTE'
  return null
}

export function esteiraDaLinha(row: FaturamentoResumoViewRow): FaturamentoEsteiraStatus | null {
  return inferirEsteiraStatus(row)
}

export function rotuloEsteiraLinha(row: FaturamentoResumoViewRow): string {
  const e = esteiraDaLinha(row)
  return e ? ROTULO_ESTEIRA[e] : '—'
}

/** Ticket aprovado e ainda na fase de medição (antes de liberar faturamento). */
export function coletaNaEsteiraMedicao(row: FaturamentoResumoViewRow): boolean {
  if (!row.faturamento_ticket_aprovado_em) return false
  if (coletaHistoricoFaturamentoEmitido(row)) return false
  const e = esteiraDaLinha(row)
  return (
    e === 'MEDICAO_PENDENTE' ||
    e === 'MEDICAO_EMAIL_PENDENTE' ||
    e === 'MEDICAO_AGUARDANDO_CLIENTE'
  )
}

export function coletaNaFilaRelatorioMedicao(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'MEDICAO_PENDENTE'
}

export function coletaNaFilaMedicaoEmail(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'MEDICAO_EMAIL_PENDENTE'
}

export function coletaNaFilaMedicaoAprovacaoCliente(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'MEDICAO_AGUARDANDO_CLIENTE'
}

export function coletaLiberadaParaFaturarEsteira(row: FaturamentoResumoViewRow): boolean {
  const e = esteiraDaLinha(row)
  if (e === 'LIBERADO_FATURAMENTO') return true
  /** Legado: migração da esteira ainda não aplicada — mantém fluxo anterior (aprovação → faturar). */
  if (
    !row.faturamento_esteira_status?.trim() &&
    !row.medicao_relatorio_gerado_em &&
    !row.medicao_email_enviado_em &&
    !row.medicao_cliente_aprovado_em &&
    row.faturamento_ticket_aprovado_em
  ) {
    return true
  }
  return false
}

export function coletaLiberadaFinanceiroEsteira(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'LIBERADO_FINANCEIRO'
}

export function coletaFinalizadaEsteira(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'FINALIZADO'
}

/** Pós-faturamento: emitido, NF ainda não registada como enviada. */
export function coletaAguardandoEnvioNfCliente(row: FaturamentoResumoViewRow): boolean {
  if (!coletaHistoricoFaturamentoEmitido(row)) return false
  if (coletaFinalizadaEsteira(row)) return false
  return !row.conta_receber_nf_enviada_em
}

export type GrupoMedicaoCliente = {
  cliente_id: string
  cliente_nome: string
  cliente_email_nf: string | null
  linhas: FaturamentoResumoViewRow[]
}

export function agruparPorClienteMedicao(
  linhas: FaturamentoResumoViewRow[],
  filtro?: (row: FaturamentoResumoViewRow) => boolean
): GrupoMedicaoCliente[] {
  const map = new Map<string, GrupoMedicaoCliente>()
  for (const row of linhas) {
    if (filtro && !filtro(row)) continue
    const cid = row.cliente_id?.trim()
    if (!cid) continue
    let g = map.get(cid)
    if (!g) {
      g = {
        cliente_id: cid,
        cliente_nome: row.cliente_nome || row.cliente_razao_social || '—',
        cliente_email_nf: row.cliente_email_nf ?? null,
        linhas: [],
      }
      map.set(cid, g)
    }
    g.linhas.push(row)
  }
  return [...map.values()].sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR'))
}

async function atualizarEsteiraColeta(
  coletaId: string,
  patch: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('coletas').update(patch).eq('id', coletaId.trim())
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Não foi possível atualizar a esteira.' }
  }
  return { ok: true }
}

export async function marcarRelatorioMedicaoGerado(
  coletaIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('coletas')
    .update({
      medicao_relatorio_gerado_em: agora,
      faturamento_esteira_status: 'MEDICAO_EMAIL_PENDENTE',
    })
    .in('id', ids)
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Erro ao registar relatório de medição.' }
  }
  return { ok: true }
}

export async function confirmarEmailMedicaoEnviado(
  coletaIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('coletas')
    .update({
      medicao_email_enviado_em: agora,
      medicao_email_enviado_por_user_id: user?.id ?? null,
      faturamento_esteira_status: 'MEDICAO_AGUARDANDO_CLIENTE',
    })
    .in('id', ids)
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Erro ao registar envio do e-mail.' }
  }
  return { ok: true }
}

export async function aprovarMedicaoCliente(
  coletaIds: string[],
  observacao?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('coletas')
    .update({
      medicao_cliente_aprovado_em: agora,
      medicao_cliente_aprovado_por_user_id: user?.id ?? null,
      medicao_cliente_aprovacao_obs: (observacao ?? '').trim() || null,
      faturamento_esteira_status: 'LIBERADO_FATURAMENTO',
    })
    .in('id', ids)
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Erro ao registar aprovação do cliente.' }
  }
  return { ok: true }
}

export async function marcarEsteiraPosFaturamentoEmitido(
  coletaId: string
): Promise<void> {
  await atualizarEsteiraColeta(coletaId, { faturamento_esteira_status: 'LIBERADO_FINANCEIRO' })
}

export async function marcarRelatorioFaturamentoClienteGerado(
  coletaId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  return atualizarEsteiraColeta(coletaId, {
    faturamento_relatorio_cliente_em: new Date().toISOString(),
  })
}

export async function marcarEsteiraFinalizadaPorNf(
  coletaId: string
): Promise<void> {
  await atualizarEsteiraColeta(coletaId, { faturamento_esteira_status: 'FINALIZADO' })
}

/** Ao aprovar ticket: entra na esteira de medição (não na fila de faturar). */
export async function marcarEsteiraAposAprovacaoTicket(
  coletaId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  return atualizarEsteiraColeta(coletaId, { faturamento_esteira_status: 'MEDICAO_PENDENTE' })
}

export function resumoEsteiraPasso1(row: FaturamentoResumoViewRow): boolean {
  return (
    coletaNaFilaAprovacaoTicketFaturamento(row) ||
    coletaAguardandoImpressaoTicketFaturamento(row)
  )
}
