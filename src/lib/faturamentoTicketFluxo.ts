import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { indiceEtapaFluxo, normalizarEtapaColeta } from './fluxoEtapas'

function coletaJaFechadaParaFaturamento(row: FaturamentoResumoViewRow): boolean {
  if (row.faturamento_registro_status === 'emitido') return true
  const etapa = normalizarEtapaColeta({
    fluxo_status: row.fluxo_status,
    etapa_operacional: row.etapa_operacional,
  })
  return indiceEtapaFluxo(etapa) >= indiceEtapaFluxo('ENVIADO_FINANCEIRO')
}

/** Documentação operacional mínima (MTR + peso + ticket) na vista. */
export function coletaDocumentacaoProntaNaVista(row: FaturamentoResumoViewRow): boolean {
  return row.status_conferencia === 'PRONTO_PARA_FATURAR'
}

/** Ticket impresso no Controle de Massa e ainda sem validação do Faturamento. */
export function coletaNaFilaAprovacaoTicketFaturamento(row: FaturamentoResumoViewRow): boolean {
  if (!coletaDocumentacaoProntaNaVista(row)) return false
  if (coletaJaFechadaParaFaturamento(row)) return false
  const pend = (row.pendencias_resumo ?? '').toLowerCase()
  if (/aguardando aprova/.test(pend)) return true
  if (row.ticket_impresso_em && !row.faturamento_ticket_aprovado_em) return true
  return false
}

/** MTR/peso/ticket ok na vista, mas falta imprimir o ticket no Controle de Massa. */
export function coletaAguardandoImpressaoTicketFaturamento(row: FaturamentoResumoViewRow): boolean {
  if (!coletaDocumentacaoProntaNaVista(row)) return false
  if (coletaJaFechadaParaFaturamento(row)) return false
  const pend = (row.pendencias_resumo ?? '').toLowerCase()
  return /ticket.n.o impresso|ticket nao impresso/.test(pend)
}

function erroColunasTicketAprovacaoAusentes(error: { message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    msg.includes('ticket_impresso_em') ||
    msg.includes('faturamento_ticket_aprovado') ||
    msg.includes('schema cache') ||
    (msg.includes('column') && msg.includes('coletas'))
  )
}

export const MENSAGEM_MIGRACAO_TICKET_APROVACAO =
  'A fila de conferência do ticket ainda não está ativa neste Supabase. No SQL Editor, execute supabase/migrations/20260518130000_coletas_ticket_aprovacao_faturamento.sql ou corra: npm run db:apply:ticket-aprovacao'

export type RegistrarTicketImpressoResult =
  | { ok: true; filaFaturamentoAtiva: true }
  | { ok: false; message: string }

/** Regista lançamento no Controle de Massa (salvar ou imprimir) e reinicia aprovação se reimpresso. */
export async function registrarTicketImpressoColeta(
  coletaId: string
): Promise<RegistrarTicketImpressoResult> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'Coleta não selecionada.' }

  const agora = new Date().toISOString()
  const { data, error } = await supabase
    .from('coletas')
    .update({
      ticket_impresso_em: agora,
      faturamento_ticket_aprovado_em: null,
      faturamento_ticket_aprovado_por_user_id: null,
      faturamento_ticket_aprovacao_obs: null,
    })
    .eq('id', id)
    .select('ticket_impresso_em')
    .maybeSingle()

  if (error) {
    if (erroColunasTicketAprovacaoAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_TICKET_APROVACAO }
    }
    return { ok: false, message: error.message || 'Não foi possível registar a impressão do ticket.' }
  }

  if (!data?.ticket_impresso_em) {
    return {
      ok: false,
      message:
        'A impressão não foi registada na coleta (nenhuma linha atualizada). Confirme que tem perfil de balanceiro/pesagem e que a migração do ticket está aplicada no Supabase.',
    }
  }

  return { ok: true, filaFaturamentoAtiva: true }
}

export async function aprovarTicketFaturamentoColeta(
  coletaId: string,
  observacao?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'Coleta inválida.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('coletas')
    .update({
      faturamento_ticket_aprovado_em: agora,
      faturamento_ticket_aprovado_por_user_id: user?.id ?? null,
      faturamento_ticket_aprovacao_obs: (observacao ?? '').trim() || null,
    })
    .eq('id', id)

  if (error) {
    if (erroColunasTicketAprovacaoAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_TICKET_APROVACAO }
    }
    return { ok: false, message: error.message || 'Não foi possível aprovar o ticket.' }
  }

  return { ok: true }
}

/**
 * Remove a aprovação do Faturamento e devolve o ticket à fila de conferência/aprovação
 * (mantém `ticket_impresso_em` para revalidação).
 */
export async function devolverTicketParaFilaConferenciaColeta(
  coletaId: string,
  observacao?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'Coleta inválida.' }

  const motivo = (observacao ?? '').trim()
  const obsGravar = motivo
    ? `Devolvido à conferência do ticket: ${motivo}`
    : 'Devolvido à conferência do ticket para nova validação.'

  const { error } = await supabase
    .from('coletas')
    .update({
      faturamento_ticket_aprovado_em: null,
      faturamento_ticket_aprovado_por_user_id: null,
      faturamento_ticket_aprovacao_obs: obsGravar,
    })
    .eq('id', id)

  if (error) {
    if (erroColunasTicketAprovacaoAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_TICKET_APROVACAO }
    }
    return { ok: false, message: error.message || 'Não foi possível devolver o ticket à conferência.' }
  }

  return { ok: true }
}
