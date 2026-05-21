import { marcarEsteiraAposAprovacaoTicket } from './faturamentoEsteira'
import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { indiceEtapaFluxo, normalizarEtapaColeta } from './fluxoEtapas'
import {
  isErroColunaResiduosItens,
  parseResiduosFromRow,
  serializarResiduosItensDb,
} from './residuosPesagem'

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

  const esteira = await marcarEsteiraAposAprovacaoTicket(id)
  if (!esteira.ok) {
    return esteira
  }

  return { ok: true }
}

/**
 * Encerramento definitivo do ticket na tela de faturamento (Operacional (Time T)):
 * persiste `resumo_financeiro` e garante aprovação na fila de conferência.
 */
export async function encerrarTicketDefinitivoFaturamento(
  coletaId: string,
  resumoJson: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'Coleta inválida.' }

  const agora = new Date().toISOString()
  const { data: existente } = await supabase
    .from('faturamento_registros')
    .select('id')
    .eq('coleta_id', id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = { resumo_financeiro: resumoJson, updated_at: agora }

  if (existente?.id) {
    const { error } = await supabase.from('faturamento_registros').update(payload).eq('id', existente.id)
    if (error && !erroColunasTicketAprovacaoAusentes(error)) {
      const msg = (error.message ?? '').toLowerCase()
      if (!msg.includes('resumo_financeiro')) {
        return { ok: false, message: error.message || 'Não foi possível gravar o encerramento.' }
      }
    }
  } else {
    const { error } = await supabase
      .from('faturamento_registros')
      .insert({ coleta_id: id, status: 'pendente', ...payload })
    if (error) {
      return { ok: false, message: error.message || 'Não foi possível criar o registro de encerramento.' }
    }
  }

  const { data: coleta } = await supabase
    .from('coletas')
    .select('faturamento_ticket_aprovado_em')
    .eq('id', id)
    .maybeSingle()

  if (!coleta?.faturamento_ticket_aprovado_em) {
    const apr = await aprovarTicketFaturamentoColeta(id, 'Encerramento definitivo do ticket (Operacional (Time T)).')
    if (!apr.ok) return apr
  }

  return { ok: true }
}

/** Coletas da mesma MTR com ticket impresso — devolução afeta o grupo inteiro (não só a líder). */
async function coletasIdsMesmaMtrParaDevolucaoConferencia(
  coletaId: string
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  const { data: coleta, error } = await supabase
    .from('coletas')
    .select('id, mtr_id')
    .eq('id', coletaId)
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message || 'Não foi possível localizar a coleta.' }
  }
  if (!coleta?.id) return { ok: false, message: 'Coleta não encontrada.' }

  const mid = (coleta.mtr_id ?? '').trim()
  if (!mid) return { ok: true, ids: [coletaId] }

  const { data: irmas, error: errIrmas } = await supabase
    .from('coletas')
    .select('id')
    .eq('mtr_id', mid)
    .not('ticket_impresso_em', 'is', null)

  if (errIrmas) {
    return { ok: false, message: errIrmas.message || 'Não foi possível localizar tickets da MTR.' }
  }

  const ids = [...new Set((irmas ?? []).map((r) => r.id).filter(Boolean))]
  return { ok: true, ids: ids.length > 0 ? ids : [coletaId] }
}

/**
 * Remove a aprovação do Faturamento e devolve o(s) ticket(s) à fila de conferência/aprovação
 * (mantém `ticket_impresso_em` para revalidação).
 * Na mesma MTR, todos os tickets impressos voltam juntos — a consolidação é só na fila de faturar.
 */
export async function devolverTicketParaFilaConferenciaColeta(
  coletaId: string,
  observacao?: string
): Promise<{ ok: true; coletasAfetadas: number } | { ok: false; message: string }> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'Coleta inválida.' }

  const grupo = await coletasIdsMesmaMtrParaDevolucaoConferencia(id)
  if (!grupo.ok) return grupo

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
    .in('id', grupo.ids)

  if (error) {
    if (erroColunasTicketAprovacaoAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_TICKET_APROVACAO }
    }
    return { ok: false, message: error.message || 'Não foi possível devolver o ticket à conferência.' }
  }

  return { ok: true, coletasAfetadas: grupo.ids.length }
}

function patchResiduosItensPesoLiquido(
  raw: unknown,
  pesoLiquido: number
): ReturnType<typeof serializarResiduosItensDb> | null {
  const linhas = parseResiduosFromRow({ residuos_itens: raw })
  const comTexto = linhas.filter((l) => l.texto.trim())
  if (comTexto.length === 0) return null

  const atualizadas = linhas.map((l, i) =>
    i === 0 ? { ...l, peso_liquido: String(pesoLiquido) } : l
  )
  return serializarResiduosItensDb(atualizadas)
}

/** Ajuste manual do peso líquido antes da aprovação do ticket (fila de conferência). */
export async function atualizarPesoLiquidoConferenciaTicket(
  coletaId: string,
  pesoLiquido: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'Coleta inválida.' }

  const peso = Number(pesoLiquido)
  if (!Number.isFinite(peso) || peso <= 0) {
    return { ok: false, message: 'Informe um peso líquido maior que zero (kg).' }
  }

  const { data: rowAtual, error: errLeitura } = await supabase
    .from('coletas')
    .select('id, residuos_itens')
    .eq('id', id)
    .maybeSingle()

  if (errLeitura) {
    return { ok: false, message: errLeitura.message || 'Não foi possível ler a coleta.' }
  }
  if (!rowAtual?.id) {
    return { ok: false, message: 'Coleta não encontrada.' }
  }

  const patchColeta: { peso_liquido: number; residuos_itens?: ReturnType<typeof serializarResiduosItensDb> } =
    { peso_liquido: peso }
  const itens = patchResiduosItensPesoLiquido(rowAtual.residuos_itens, peso)
  if (itens) patchColeta.residuos_itens = itens

  let { data: atualizada, error: errColeta } = await supabase
    .from('coletas')
    .update(patchColeta)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (errColeta && itens && isErroColunaResiduosItens(errColeta)) {
    const retry = await supabase
      .from('coletas')
      .update({ peso_liquido: peso })
      .eq('id', id)
      .select('id')
      .maybeSingle()
    atualizada = retry.data
    errColeta = retry.error
  }

  if (errColeta) {
    return { ok: false, message: errColeta.message || 'Não foi possível atualizar o peso na coleta.' }
  }
  if (!atualizada?.id) {
    return {
      ok: false,
      message:
        'Sem permissão para alterar o peso desta coleta (perfil ou política RLS). Peça ao administrador aplicar a migração de permissões ou use um perfil Faturamento.',
    }
  }

  const patchMassa: { peso_liquido: number; residuos_itens?: ReturnType<typeof serializarResiduosItensDb> } = {
    peso_liquido: peso,
  }
  if (itens) patchMassa.residuos_itens = itens

  let { error: errMassa } = await supabase
    .from('controle_massa')
    .update(patchMassa)
    .eq('coleta_id', id)

  if (errMassa && itens && isErroColunaResiduosItens(errMassa)) {
    const retry = await supabase.from('controle_massa').update({ peso_liquido: peso }).eq('coleta_id', id)
    errMassa = retry.error
  }

  if (errMassa) {
    console.warn('controle_massa.peso_liquido:', errMassa.message)
  }

  return { ok: true }
}
