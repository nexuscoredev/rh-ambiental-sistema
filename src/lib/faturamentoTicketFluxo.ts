import { marcarEsteiraAposAprovacaoTicket } from './faturamentoEsteira'
import { supabase } from './supabase'
import { sincronizarAposAlteracaoOperacionalColeta } from './faturamentoOperacionalSync'
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

/** Ticket gravado/gerado na Pesagem e ainda sem validação do Faturamento. */
export function coletaNaFilaAprovacaoTicketFaturamento(row: FaturamentoResumoViewRow): boolean {
  if (coletaJaFechadaParaFaturamento(row)) return false
  if (row.ticket_impresso_em && !row.faturamento_ticket_aprovado_em) return true
  if (!coletaDocumentacaoProntaNaVista(row)) return false
  const pend = (row.pendencias_resumo ?? '').toLowerCase()
  if (/aguardando aprova/.test(pend)) return true
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

  const pesoStr = String(pesoLiquido)
  if (comTexto.length === 1) {
    const alvo = comTexto[0]
    const idx = linhas.findIndex((l) => l === alvo)
    const atualizadas = linhas.map((l, i) =>
      i === idx ? { ...l, peso_liquido: pesoStr } : l
    )
    return serializarResiduosItensDb(atualizadas)
  }

  const idxPrincipal = linhas.findIndex((l) => l.texto.trim())
  const atualizadas = linhas.map((l, i) =>
    i === idxPrincipal ? { ...l, peso_liquido: pesoStr } : l
  )
  return serializarResiduosItensDb(atualizadas)
}

function normalizeRpcPesoPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null
  if (typeof data === 'string') {
    try {
      return normalizeRpcPesoPayload(JSON.parse(data) as unknown)
    } catch {
      return null
    }
  }
  if (Array.isArray(data) && data.length > 0) {
    return normalizeRpcPesoPayload(data[0])
  }
  if (typeof data === 'object') return data as Record<string, unknown>
  return null
}

function parseRpcPesoConferencia(data: unknown): { ok: true } | { ok: false; message: string } {
  const o = normalizeRpcPesoPayload(data)
  if (!o) {
    return { ok: false, message: 'Resposta inválida ao gravar o peso.' }
  }
  if (o.ok === true) return { ok: true }
  return { ok: false, message: String(o.message || 'Não foi possível atualizar o peso.') }
}

function rpcPesoConferenciaIndisponivel(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const msg = (err.message ?? '').toLowerCase()
  const code = err.code ?? ''
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist') ||
    msg.includes('atualizar_peso_liquido_conferencia_ticket') ||
    msg.includes('rg_is_operacional_time_t')
  )
}

export const MENSAGEM_SQL_PESO_CONFERENCIA =
  'A função de editar peso ainda não está no Supabase. Execute: npm run db:apply:peso-conferencia (ou o ficheiro supabase/sql_editor_peso_conferencia_ticket.sql no SQL Editor) e tente de novo.'

export function pesoGravadoConfere(
  row: { peso_liquido?: number | string | null } | null | undefined,
  peso: number
): boolean {
  const gravado = row?.peso_liquido != null ? Number(row.peso_liquido) : null
  return gravado != null && Math.abs(gravado - peso) <= 0.01
}

async function gravarPesoColetaDireto(
  id: string,
  peso: number,
  itens: ReturnType<typeof serializarResiduosItensDb> | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const patchColeta: { peso_liquido: number; residuos_itens?: ReturnType<typeof serializarResiduosItensDb> } =
    { peso_liquido: peso }
  if (itens) patchColeta.residuos_itens = itens

  let { data: coletaAtualizada, error: errColeta } = await supabase
    .from('coletas')
    .update(patchColeta)
    .eq('id', id)
    .select('peso_liquido')
    .maybeSingle()

  if (errColeta && itens && isErroColunaResiduosItens(errColeta)) {
    const retry = await supabase
      .from('coletas')
      .update({ peso_liquido: peso })
      .eq('id', id)
      .select('peso_liquido')
      .maybeSingle()
    coletaAtualizada = retry.data
    errColeta = retry.error
  }

  if (errColeta) {
    return { ok: false, message: errColeta.message || 'Não foi possível atualizar o peso na coleta.' }
  }

  if (!pesoGravadoConfere(coletaAtualizada, peso)) {
    return {
      ok: false,
      message: `Sem permissão para alterar o peso desta coleta (RLS ou RPC pendente no Supabase). ${MENSAGEM_SQL_PESO_CONFERENCIA}`,
    }
  }

  const patchMassa: { peso_liquido: number; residuos_itens?: ReturnType<typeof serializarResiduosItensDb> } =
    { peso_liquido: peso }
  if (itens) patchMassa.residuos_itens = itens

  let { error: errMassa } = await supabase.from('controle_massa').update(patchMassa).eq('coleta_id', id)

  if (errMassa && itens && isErroColunaResiduosItens(errMassa)) {
    const retry = await supabase.from('controle_massa').update({ peso_liquido: peso }).eq('coleta_id', id)
    errMassa = retry.error
  }

  if (errMassa) {
    console.warn('controle_massa.peso_liquido:', errMassa.message)
  }

  return { ok: true }
}

async function lerPesoLiquidoColeta(id: string): Promise<
  { ok: true; peso: number } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('coletas')
    .select('peso_liquido')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message || 'Não foi possível confirmar o peso gravado.' }
  }
  const peso = data?.peso_liquido != null ? Number(data.peso_liquido) : null
  if (peso == null || !Number.isFinite(peso)) {
    return { ok: false, message: 'O peso não foi gravado na coleta.' }
  }
  return { ok: true, peso }
}

async function gravarPesoViaRpcConferencia(
  id: string,
  peso: number,
  itens: ReturnType<typeof serializarResiduosItensDb> | null
): Promise<{ ok: true } | { ok: false; message: string; rpcIndisponivel?: boolean }> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('atualizar_peso_liquido_conferencia_ticket', {
    p_coleta_id: id,
    p_peso_liquido: peso,
    p_residuos_itens: itens ?? null,
  })

  if (rpcErr) {
    if (rpcPesoConferenciaIndisponivel(rpcErr)) {
      return { ok: false, message: rpcErr.message || 'RPC indisponível.', rpcIndisponivel: true }
    }
    return { ok: false, message: rpcErr.message || 'Não foi possível atualizar o peso.' }
  }

  const rpcRes = parseRpcPesoConferencia(rpcData)
  if (!rpcRes.ok) {
    return { ok: false, message: rpcRes.message }
  }

  const o = normalizeRpcPesoPayload(rpcData)
  const pesoRpc = o?.peso_liquido != null ? Number(o.peso_liquido) : null
  if (pesoRpc != null && pesoGravadoConfere({ peso_liquido: pesoRpc }, peso)) {
    return { ok: true }
  }

  const conf = await lerPesoLiquidoColeta(id)
  if (!conf.ok) return conf
  if (!pesoGravadoConfere({ peso_liquido: conf.peso }, peso)) {
    return {
      ok: false,
      message: `A RPC respondeu OK, mas o peso na coleta não confere. ${MENSAGEM_SQL_PESO_CONFERENCIA}`,
    }
  }

  return { ok: true }
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
    .select('id, residuos_itens, faturamento_ticket_aprovado_em')
    .eq('id', id)
    .maybeSingle()

  if (errLeitura) {
    if (erroColunasTicketAprovacaoAusentes(errLeitura)) {
      const retry = await supabase.from('coletas').select('id, residuos_itens').eq('id', id).maybeSingle()
      if (retry.error) {
        return { ok: false, message: retry.error.message || 'Não foi possível ler a coleta.' }
      }
      if (!retry.data?.id) return { ok: false, message: 'Coleta não encontrada.' }
      return gravarPesoConferenciaInterno(id, peso, retry.data.residuos_itens)
    }
    return { ok: false, message: errLeitura.message || 'Não foi possível ler a coleta.' }
  }
  if (!rowAtual?.id) {
    return { ok: false, message: 'Coleta não encontrada.' }
  }

  if (rowAtual.faturamento_ticket_aprovado_em) {
    return {
      ok: false,
      message:
        'Este ticket já foi aprovado. Use «Devolver à conferência» na fila «Faturar» para corrigir o peso.',
    }
  }

  return gravarPesoConferenciaInterno(id, peso, rowAtual.residuos_itens)
}

async function gravarPesoConferenciaInterno(
  id: string,
  peso: number,
  residuosItensRaw: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const itens = patchResiduosItensPesoLiquido(residuosItensRaw, peso)

  async function finalizarSeGravou(res: { ok: true } | { ok: false; message: string }) {
    if (!res.ok) return res
    const sync = await sincronizarAposAlteracaoOperacionalColeta(id)
    if (!sync.ok) {
      return {
        ok: false,
        message: `Peso gravado na coleta, mas falhou ao sincronizar MTR/ticket: ${sync.message}`,
      }
    }
    return res
  }

  const viaRpc = await gravarPesoViaRpcConferencia(id, peso, itens)
  if (viaRpc.ok) return finalizarSeGravou(viaRpc)

  if (!viaRpc.rpcIndisponivel) {
    return { ok: false, message: viaRpc.message }
  }

  const direto = await gravarPesoColetaDireto(id, peso, itens)
  if (direto.ok) return finalizarSeGravou(direto)

  return {
    ok: false,
    message: `${direto.message} ${MENSAGEM_SQL_PESO_CONFERENCIA}`,
  }
}
