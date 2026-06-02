import { supabase } from './supabase'
import { chatEnviarTexto } from './chat'
import type { ChatMensagem } from '../types/chat'
import type { PostgrestError } from '@supabase/supabase-js'

export const CHAT_PEDIDO_AJUSTE_PREFIX = '[Solicitação de ajuste no sistema]'
/** Fallback quando o corpo do pedido não puder ser interpretado. */
export const CHAT_RESPOSTA_AJUSTE_RESOLVIDO =
  'Ajustamos conforme a sua solicitação, pode testar por gentileza?'

export type PedidoAjusteStatus = 'aguardando_solicitante' | 'reaberto' | 'aprovado'

export type PedidoAjusteEscalacaoThaisStatus = 'aguardando' | 'aprovado'

export type PedidoAjusteEscalacaoThaisRow = {
  mensagem_id: string
  conversa_id: string
  dev_id: string
  status: PedidoAjusteEscalacaoThaisStatus
  enviado_em?: string | null
  aprovado_em?: string | null
  aprovado_por?: string | null
}

export type PedidoAjusteParseado = {
  descricao: string
  pagina?: string
  solicitante?: string
}

/** Extrai campos do corpo enviado por `chatEnviarPedidoAjusteSistema`. */
export function parsePedidoAjusteConteudo(conteudo: string): PedidoAjusteParseado | null {
  const raw = (conteudo ?? '').trimStart()
  if (!raw.startsWith(CHAT_PEDIDO_AJUSTE_PREFIX)) return null

  const lines = raw.slice(CHAT_PEDIDO_AJUSTE_PREFIX.length).replace(/^\s*\n/, '').split('\n')

  let solicitante: string | undefined
  const last = lines[lines.length - 1]?.trim() ?? ''
  if (/^—\s*/.test(last)) {
    solicitante = last.replace(/^—\s*/, '').trim() || undefined
    lines.pop()
  }

  let pagina: string | undefined
  const penult = lines[lines.length - 1]?.trim() ?? ''
  if (/^Página:\s*/i.test(penult)) {
    const val = penult.replace(/^Página:\s*/i, '').trim()
    pagina = val && val !== '—' ? val : undefined
    lines.pop()
  }

  const descricao = lines.join('\n').trim()
  if (!descricao) return null
  return { descricao, pagina, solicitante }
}

/** Mensagem automática ao marcar pedido como resolvido (cita a solicitação). */
export function montarRespostaPedidoAjusteResolvido(conteudoPedido: string): string {
  const pedido = parsePedidoAjusteConteudo(conteudoPedido)
  if (!pedido) return CHAT_RESPOSTA_AJUSTE_RESOLVIDO

  const linhas = [
    'Ajustamos conforme a solicitação indicada abaixo, pode testar por gentileza?',
    '',
    `Referente a: ${pedido.descricao}`,
  ]
  if (pedido.pagina) linhas.push(`Página: ${pedido.pagina}`)
  if (pedido.solicitante) linhas.push(`Solicitado por: ${pedido.solicitante}`)
  return linhas.join('\n')
}

export function etiquetaEventoPedidoAjusteHistorico(
  evento: PedidoAjusteHistoricoItem['evento']
): string {
  switch (evento) {
    case 'resolvido_dev':
      return 'Desenvolvedor enviou ajuste'
    case 'aprovado_solicitante':
      return 'Solicitante aprovou'
    case 'negado_solicitante':
      return 'Solicitante reabriu o pedido'
    case 'enviado_fila_thais':
      return 'Enviado para aprovação da Thais'
    case 'aprovado_fila_thais':
      return 'Thais aprovou — devolver à fila do desenvolvedor'
    default:
      return evento
  }
}

function rpcIndisponivel(err: PostgrestError | null): boolean {
  if (!err) return false
  const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase()
  if (err.code === 'PGRST202' || err.code === '42883') return true
  if (msg.includes('404') || msg.includes('not found') || msg.includes('could not find')) return true
  return false
}

function colunaInexistente(err: PostgrestError | null): boolean {
  if (!err) return false
  const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase()
  return msg.includes('column') && msg.includes('does not exist')
}

function mensagemErroPedidoAjuste(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as PostgrestError).message ?? '').trim()
    const d = String((err as PostgrestError).details ?? '').trim()
    const joined = [m, d].filter(Boolean).join(' — ')
    if (joined) return joined
  }
  return 'Não foi possível concluir a operação no pedido de ajuste.'
}

function mensagemPrimeiraLinhaRpc(data: unknown): ChatMensagem {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    throw new Error('Resposta inválida do servidor ao marcar pedido como resolvido.')
  }
  return row as ChatMensagem
}

export function chatMensagemEhPedidoAjuste(m: Pick<ChatMensagem, 'conteudo'>): boolean {
  return (m.conteudo ?? '').trimStart().startsWith(CHAT_PEDIDO_AJUSTE_PREFIX)
}

export type PedidoAjusteFilaItem = {
  mensagemId: string
  conversaId: string
  remetenteId: string
  conteudo: string
  createdAt: string
  parseado: PedidoAjusteParseado | null
  /** Novo pedido, reaberto pelo solicitante ou devolvido após aprovação da Thais. */
  situacao: 'novo' | 'reaberto' | 'aprovado_thais'
  justificativaSolicitante?: string
  ciclo: number
  /** Preenchido quando o pedido voltou da fila da Thais para o dev que escalou. */
  escaladoPorDevId?: string
}

export type PedidoAjusteAguardandoFeedback = {
  mensagemPedidoId: string
  respostaMensagemId: string
  conversaId: string
  ciclo: number
}

export type PedidoAjusteHistoricoItem = {
  id: string
  mensagemPedidoId: string
  conversaId: string
  evento: 'resolvido_dev' | 'aprovado_solicitante' | 'negado_solicitante' | 'enviado_fila_thais' | 'aprovado_fila_thais'
  actorId: string
  texto: string | null
  ciclo: number
  createdAt: string
  /** Quem abriu o pedido (mensagem original). */
  solicitanteId?: string
  /** Data/hora em que o pedido foi enviado. */
  pedidoCreatedAt?: string
  parseado?: PedidoAjusteParseado | null
}

export type SolicitacaoAjusteRelatorioLinha = {
  mensagemId: string
  solicitante: string
  dataPedido: string
  horaPedido: string
  pagina: string
  descricao: string
  situacao: string
  ciclo: number
  ultimaAtualizacao: string | null
  pedidoCreatedAtIso: string
}

export type FiltroSituacaoRelatorioSolicitacoes =
  | 'todas'
  | 'novo'
  | 'negado'
  | 'aguardando'
  | 'aprovado'

type UsuarioNomeLookup = Map<string, { nome?: string | null; email?: string | null }>

export function nomeSolicitantePedidoAjuste(
  remetenteId: string | undefined,
  parseado: PedidoAjusteParseado | null | undefined,
  usuariosPorId: UsuarioNomeLookup
): string {
  if (remetenteId) {
    const meta = usuariosPorId.get(remetenteId)
    const n = (meta?.nome || meta?.email || '').trim()
    if (n) return n
  }
  return parseado?.solicitante?.trim() || 'Utilizador'
}

export function rotuloSituacaoPedidoAjuste(status: PedidoAjusteStatus | null | undefined): string {
  if (!status) return 'Novo (na fila)'
  switch (status) {
    case 'reaberto':
      return 'Negado — reaberto'
    case 'aguardando_solicitante':
      return 'Aguardando confirmação'
    case 'aprovado':
      return 'Aprovado'
    default:
      return status
  }
}

function formatarDataPedidoRelatorio(iso: string): { data: string; hora: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { data: '—', hora: '—' }
  return {
    data: d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function situacaoCoincideFiltro(
  status: PedidoAjusteStatus | null | undefined,
  filtro: FiltroSituacaoRelatorioSolicitacoes
): boolean {
  if (filtro === 'todas') return true
  if (filtro === 'novo') return !status
  if (filtro === 'negado') return status === 'reaberto'
  if (filtro === 'aguardando') return status === 'aguardando_solicitante'
  if (filtro === 'aprovado') return status === 'aprovado'
  return true
}

type ResolvidoRow = {
  mensagem_id: string
  conversa_id: string
  status?: string | null
  justificativa_solicitante?: string | null
  ciclo?: number | null
}

function pedidoEstaNaFilaDev(
  row: ResolvidoRow | undefined,
  escalacao: PedidoAjusteEscalacaoThaisRow | undefined,
  meuId: string
): boolean {
  if (escalacao?.status === 'aguardando') return false
  if (escalacao?.status === 'aprovado') {
    if (escalacao.dev_id.trim().toLowerCase() !== meuId.trim().toLowerCase()) return false
    if (!row) return true
    return row.status === 'reaberto'
  }
  if (!row) return true
  return row.status === 'reaberto'
}

/** Pode marcar resolvido na fila do dev (sem escalação ou após aprovação da Thais). */
export function pedidoPodeSerMarcadoResolvidoPeloDev(
  escalacao: PedidoAjusteEscalacaoThaisRow | undefined,
  meuId: string
): boolean {
  if (escalacao?.status === 'aguardando') return false
  if (escalacao?.status === 'aprovado') {
    return escalacao.dev_id.trim().toLowerCase() === meuId.trim().toLowerCase()
  }
  return true
}

/** Pode enviar manualmente para a fila da Thais (ainda não está aguardando/aprovado na fila dela). */
export function pedidoPodeEnviarFilaThais(
  escalacao: PedidoAjusteEscalacaoThaisRow | undefined
): boolean {
  if (!escalacao) return true
  return escalacao.status !== 'aguardando' && escalacao.status !== 'aprovado'
}

/** Usado nos testes e na listagem da fila do desenvolvedor. */
export function pedidoVisivelNaFilaDesenvolvedor(
  reg: ResolvidoRow | undefined,
  escalacao: PedidoAjusteEscalacaoThaisRow | undefined,
  meuId: string
): boolean {
  return pedidoEstaNaFilaDev(reg, escalacao, meuId)
}

async function carregarEscalacoesThaisPorMensagens(
  mensagemIds: string[]
): Promise<Map<string, PedidoAjusteEscalacaoThaisRow>> {
  const map = new Map<string, PedidoAjusteEscalacaoThaisRow>()
  if (mensagemIds.length === 0) return map

  const { data, error } = await supabase
    .from('chat_pedido_ajuste_aprovacao_thais')
    .select('mensagem_id, conversa_id, dev_id, status, enviado_em, aprovado_em, aprovado_por')
    .in('mensagem_id', mensagemIds)

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return map
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  for (const row of data ?? []) {
    map.set(String(row.mensagem_id), {
      mensagem_id: String(row.mensagem_id),
      conversa_id: String(row.conversa_id),
      dev_id: String(row.dev_id),
      status: row.status as PedidoAjusteEscalacaoThaisStatus,
      enviado_em: row.enviado_em != null ? String(row.enviado_em) : null,
      aprovado_em: row.aprovado_em != null ? String(row.aprovado_em) : null,
      aprovado_por: row.aprovado_por != null ? String(row.aprovado_por) : null,
    })
  }
  return map
}

function montarItemFilaPedido(
  row: {
    id: string
    conversa_id: string
    remetente_id: string
    conteudo: string
    created_at: string
  },
  reg: ResolvidoRow | undefined,
  escalacao: PedidoAjusteEscalacaoThaisRow | undefined
): PedidoAjusteFilaItem {
  const conteudo = String(row.conteudo ?? '')
  const reaberto = reg?.status === 'reaberto'
  const aprovadoThais = escalacao?.status === 'aprovado'
  return {
    mensagemId: String(row.id),
    conversaId: String(row.conversa_id),
    remetenteId: String(row.remetente_id),
    conteudo,
    createdAt: String(row.created_at),
    parseado: parsePedidoAjusteConteudo(conteudo),
    situacao: reaberto ? 'reaberto' : aprovadoThais ? 'aprovado_thais' : 'novo',
    justificativaSolicitante: reaberto
      ? String(reg?.justificativa_solicitante ?? '').trim() || undefined
      : undefined,
    ciclo: Number(reg?.ciclo ?? 1) || 1,
    escaladoPorDevId: escalacao?.dev_id,
  }
}

/** Pedidos na fila do desenvolvedor (novos ou reabertos pelo solicitante). */
export async function chatListarPedidosAjustePendentes(meuId: string): Promise<PedidoAjusteFilaItem[]> {
  const uid = meuId.trim()
  if (!uid) return []

  const resolvidos = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('mensagem_id, status, justificativa_solicitante, ciclo')

  const resolvidoPorMensagem = new Map<string, ResolvidoRow>()
  if (resolvidos.error) {
    if (!/does not exist|relation|42P01/i.test(resolvidos.error.message)) {
      throw new Error(mensagemErroPedidoAjuste(resolvidos.error))
    }
  } else {
    for (const row of resolvidos.data ?? []) {
      resolvidoPorMensagem.set(String(row.mensagem_id), row as ResolvidoRow)
    }
  }

  const { data, error } = await supabase
    .from('chat_mensagens')
    .select('id, conversa_id, remetente_id, conteudo, created_at')
    .like('conteudo', `${CHAT_PEDIDO_AJUSTE_PREFIX}%`)
    .neq('remetente_id', uid)
    .order('created_at', { ascending: true })

  if (error) throw new Error(mensagemErroPedidoAjuste(error))

  const mensagemIds = (data ?? []).map((row) => String(row.id))
  const escalacaoPorMensagem = await carregarEscalacoesThaisPorMensagens(mensagemIds)

  const itens: PedidoAjusteFilaItem[] = []
  for (const row of data ?? []) {
    const mensagemId = String(row.id)
    const reg = resolvidoPorMensagem.get(mensagemId)
    const escalacao = escalacaoPorMensagem.get(mensagemId)
    if (!pedidoEstaNaFilaDev(reg, escalacao, uid)) continue

    itens.push(montarItemFilaPedido(row, reg, escalacao))
  }
  return itens
}

/** Pedidos à espera de aprovação da Thais. */
export async function chatListarPedidosAjusteFilaThais(): Promise<PedidoAjusteFilaItem[]> {
  const { data: escalacoes, error: escErr } = await supabase
    .from('chat_pedido_ajuste_aprovacao_thais')
    .select('mensagem_id, conversa_id, dev_id, status, enviado_em')
    .eq('status', 'aguardando')
    .order('enviado_em', { ascending: true })

  if (escErr) {
    if (/does not exist|relation|42P01/i.test(escErr.message)) return []
    throw new Error(mensagemErroPedidoAjuste(escErr))
  }

  const ids = (escalacoes ?? []).map((e) => String(e.mensagem_id)).filter(Boolean)
  if (ids.length === 0) return []

  const { data: msgs, error: msgErr } = await supabase
    .from('chat_mensagens')
    .select('id, conversa_id, remetente_id, conteudo, created_at')
    .in('id', ids)

  if (msgErr) throw new Error(mensagemErroPedidoAjuste(msgErr))

  const msgPorId = new Map((msgs ?? []).map((m) => [String(m.id), m]))
  const itens: PedidoAjusteFilaItem[] = []

  for (const esc of escalacoes ?? []) {
    const msg = msgPorId.get(String(esc.mensagem_id))
    if (!msg) continue
    itens.push(
      montarItemFilaPedido(
        msg as {
          id: string
          conversa_id: string
          remetente_id: string
          conteudo: string
          created_at: string
        },
        undefined,
        {
          mensagem_id: String(esc.mensagem_id),
          conversa_id: String(esc.conversa_id),
          dev_id: String(esc.dev_id),
          status: 'aguardando',
          enviado_em: esc.enviado_em != null ? String(esc.enviado_em) : null,
        }
      )
    )
  }
  return itens
}

export async function chatEnviarPedidoAjusteFilaThais(
  conversaId: string,
  mensagemPedidoId: string
): Promise<void> {
  const rpc = await supabase.rpc('chat_enviar_pedido_fila_thais', {
    p_conversa_id: conversaId,
    p_mensagem_pedido_id: mensagemPedidoId,
  })

  if (!rpc.error) return

  if (!rpcIndisponivel(rpc.error)) {
    const msg = mensagemErroPedidoAjuste(rpc.error)
    if (/does not exist|relation|42P01/i.test(msg)) {
      throw new Error(
        'Funcionalidade ainda não activa no Supabase. Execute a migração 20260702120000_chat_pedido_ajuste_aprovacao_thais.'
      )
    }
    throw new Error(msg)
  }

  await chatEnviarPedidoAjusteFilaThaisLegado(conversaId, mensagemPedidoId)
}

async function chatEnviarPedidoAjusteFilaThaisLegado(
  conversaId: string,
  mensagemPedidoId: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) throw new Error('Sessão inválida.')

  await carregarConteudoPedidoAjuste(conversaId, mensagemPedidoId)

  const { data: existente } = await supabase
    .from('chat_pedido_ajuste_aprovacao_thais')
    .select('mensagem_id, status')
    .eq('mensagem_id', mensagemPedidoId)
    .maybeSingle()

  if (existente?.status === 'aguardando') {
    throw new Error('Este pedido já está na fila da Thais.')
  }
  if (existente?.status === 'aprovado') {
    throw new Error('Este pedido já foi aprovado pela Thais.')
  }

  const { error } = await supabase.from('chat_pedido_ajuste_aprovacao_thais').insert({
    mensagem_id: mensagemPedidoId,
    conversa_id: conversaId,
    dev_id: uid,
    status: 'aguardando',
  })
  if (error) throw new Error(mensagemErroPedidoAjuste(error))
}

export async function chatAprovarPedidoAjusteFilaThais(mensagemPedidoId: string): Promise<void> {
  const rpc = await supabase.rpc('chat_aprovar_pedido_fila_thais', {
    p_mensagem_pedido_id: mensagemPedidoId,
  })

  if (!rpc.error) return

  if (!rpcIndisponivel(rpc.error)) {
    throw new Error(mensagemErroPedidoAjuste(rpc.error))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) throw new Error('Sessão inválida.')

  const { data: row, error: findErr } = await supabase
    .from('chat_pedido_ajuste_aprovacao_thais')
    .select('mensagem_id, status')
    .eq('mensagem_id', mensagemPedidoId)
    .maybeSingle()

  if (findErr) throw new Error(mensagemErroPedidoAjuste(findErr))
  if (!row || row.status !== 'aguardando') {
    throw new Error('Pedido não encontrado na fila de aprovação.')
  }

  const { error } = await supabase
    .from('chat_pedido_ajuste_aprovacao_thais')
    .update({
      status: 'aprovado',
      aprovado_em: new Date().toISOString(),
      aprovado_por: uid,
    })
    .eq('mensagem_id', mensagemPedidoId)

  if (error) throw new Error(mensagemErroPedidoAjuste(error))
}

/** Pedidos desta conversa à espera de aprovação/negativa do solicitante. */
export async function chatListarPedidosAguardandoFeedbackSolicitante(
  conversaId: string,
  meuId: string
): Promise<PedidoAjusteAguardandoFeedback[]> {
  const cid = conversaId.trim()
  const uid = meuId.trim()
  if (!cid || !uid) return []

  const { data: pedidos, error: pedErr } = await supabase
    .from('chat_mensagens')
    .select('id')
    .eq('conversa_id', cid)
    .eq('remetente_id', uid)
    .like('conteudo', `${CHAT_PEDIDO_AJUSTE_PREFIX}%`)

  if (pedErr) throw new Error(mensagemErroPedidoAjuste(pedErr))
  const ids = (pedidos ?? []).map((p) => String(p.id))
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('mensagem_id, resposta_mensagem_id, conversa_id, status, ciclo')
    .eq('conversa_id', cid)
    .in('mensagem_id', ids)

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return []
    if (colunaInexistente(error)) return []
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  const out: PedidoAjusteAguardandoFeedback[] = []
  for (const row of data ?? []) {
    const status = (row.status ?? 'aguardando_solicitante') as PedidoAjusteStatus
    if (status !== 'aguardando_solicitante') continue
    const respostaId = row.resposta_mensagem_id ? String(row.resposta_mensagem_id) : ''
    if (!respostaId) continue
    out.push({
      mensagemPedidoId: String(row.mensagem_id),
      respostaMensagemId: respostaId,
      conversaId: String(row.conversa_id),
      ciclo: Number(row.ciclo ?? 1) || 1,
    })
  }
  return out
}

/** Histórico recente de decisões (desenvolvedor). */
export async function chatListarHistoricoPedidosAjuste(limite = 40): Promise<PedidoAjusteHistoricoItem[]> {
  const { data, error } = await supabase
    .from('chat_pedido_ajuste_historico')
    .select('id, mensagem_pedido_id, conversa_id, evento, actor_id, texto, ciclo, created_at')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return []
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  const itens = (data ?? []).map((row) => ({
    id: String(row.id),
    mensagemPedidoId: String(row.mensagem_pedido_id),
    conversaId: String(row.conversa_id),
    evento: row.evento as PedidoAjusteHistoricoItem['evento'],
    actorId: String(row.actor_id),
    texto: row.texto != null ? String(row.texto) : null,
    ciclo: Number(row.ciclo ?? 1) || 1,
    createdAt: String(row.created_at),
  }))

  const pedidoIds = [...new Set(itens.map((i) => i.mensagemPedidoId))]
  if (pedidoIds.length === 0) return itens

  const { data: msgs, error: msgErr } = await supabase
    .from('chat_mensagens')
    .select('id, remetente_id, conteudo, created_at')
    .in('id', pedidoIds)

  if (msgErr) {
    console.warn('[chat] histórico pedidos: não foi possível carregar mensagens originais', msgErr.message)
    return itens
  }

  const msgPorId = new Map(
    (msgs ?? []).map((m) => [
      String(m.id),
      {
        remetenteId: String(m.remetente_id),
        conteudo: String(m.conteudo ?? ''),
        createdAt: String(m.created_at),
      },
    ])
  )

  return itens.map((item) => {
    const msg = msgPorId.get(item.mensagemPedidoId)
    if (!msg) return item
    return {
      ...item,
      solicitanteId: msg.remetenteId,
      pedidoCreatedAt: msg.createdAt,
      parseado: parsePedidoAjusteConteudo(msg.conteudo),
    }
  })
}

/** Lista solicitações para relatório (PDF/CSV) — visão do desenvolvedor. */
export async function chatListarSolicitacoesAjusteParaRelatorio(
  opts: {
    dataDe?: string
    dataAte?: string
    situacao?: FiltroSituacaoRelatorioSolicitacoes
    limite?: number
  },
  usuariosPorId: UsuarioNomeLookup
): Promise<SolicitacaoAjusteRelatorioLinha[]> {
  const limite = opts.limite ?? 500
  const situacaoFiltro = opts.situacao ?? 'todas'

  let query = supabase
    .from('chat_mensagens')
    .select('id, remetente_id, conteudo, created_at')
    .like('conteudo', `${CHAT_PEDIDO_AJUSTE_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(limite)

  if (opts.dataDe?.trim()) {
    query = query.gte('created_at', `${opts.dataDe.trim()}T00:00:00`)
  }
  if (opts.dataAte?.trim()) {
    query = query.lte('created_at', `${opts.dataAte.trim()}T23:59:59.999`)
  }

  const { data, error } = await query
  if (error) throw new Error(mensagemErroPedidoAjuste(error))

  const mensagens = data ?? []
  const ids = mensagens.map((m) => String(m.id))
  const resolvidoPorMensagem = new Map<
    string,
    { status?: string | null; ciclo?: number | null; decidido_em?: string | null; resolvido_em?: string | null }
  >()

  if (ids.length > 0) {
    const { data: resolvidos, error: resErr } = await supabase
      .from('chat_pedido_ajuste_resolvido')
      .select('mensagem_id, status, ciclo, decidido_em, resolvido_em')
      .in('mensagem_id', ids)

    if (resErr && !/does not exist|relation|42P01/i.test(resErr.message)) {
      throw new Error(mensagemErroPedidoAjuste(resErr))
    }

    for (const row of resolvidos ?? []) {
      resolvidoPorMensagem.set(String(row.mensagem_id), row)
    }
  }

  const linhas: SolicitacaoAjusteRelatorioLinha[] = []

  for (const row of mensagens) {
    const mensagemId = String(row.id)
    const reg = resolvidoPorMensagem.get(mensagemId)
    const status = (reg?.status ?? null) as PedidoAjusteStatus | null

    if (!situacaoCoincideFiltro(status, situacaoFiltro)) continue

    const conteudo = String(row.conteudo ?? '')
    const parseado = parsePedidoAjusteConteudo(conteudo)
    const remetenteId = String(row.remetente_id)
    const createdAt = String(row.created_at)
    const { data: dataPedido, hora: horaPedido } = formatarDataPedidoRelatorio(createdAt)

    const ultimaAtualizacao =
      (reg?.decidido_em ? String(reg.decidido_em) : null) ||
      (reg?.resolvido_em ? String(reg.resolvido_em) : null) ||
      createdAt

    linhas.push({
      mensagemId,
      solicitante: nomeSolicitantePedidoAjuste(remetenteId, parseado, usuariosPorId),
      dataPedido,
      horaPedido,
      pagina: parseado?.pagina ?? '',
      descricao: parseado?.descricao ?? conteudo.replace(/^\[Solicitação de ajuste no sistema\]\s*/i, '').trim(),
      situacao: rotuloSituacaoPedidoAjuste(status),
      ciclo: Number(reg?.ciclo ?? 1) || 1,
      ultimaAtualizacao,
      pedidoCreatedAtIso: createdAt,
    })
  }

  linhas.sort((a, b) => b.pedidoCreatedAtIso.localeCompare(a.pedidoCreatedAtIso))
  return linhas
}

export async function chatListarPedidosAjusteResolvidos(
  conversaId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('mensagem_id, status')
    .eq('conversa_id', conversaId)

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return new Set()
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  const fechados = new Set<string>()
  for (const row of data ?? []) {
    const status = (row.status ?? 'aguardando_solicitante') as PedidoAjusteStatus
    if (status === 'aprovado' || status === 'aguardando_solicitante') {
      fechados.add(String(row.mensagem_id))
    }
  }
  return fechados
}

async function marcarPedidoAjusteResolvidoLegado(
  conversaId: string,
  mensagemPedidoId: string,
  meuId: string,
  conteudoPedido: string
): Promise<ChatMensagem> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) throw new Error('Sessão inválida.')
  if (uid !== meuId) console.warn('[chat] marcar ajuste: JWT difere do estado da UI')

  const { data: existente } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('mensagem_id, status, ciclo')
    .eq('mensagem_id', mensagemPedidoId)
    .maybeSingle()

  const status = (existente?.status ?? null) as PedidoAjusteStatus | null
  if (existente && status && status !== 'reaberto') {
    throw new Error('Este pedido já foi tratado (aguarda o solicitante ou está encerrado).')
  }

  const resposta = await chatEnviarTexto(
    conversaId,
    uid,
    montarRespostaPedidoAjusteResolvido(conteudoPedido)
  )

  const ciclo = status === 'reaberto' ? Number(existente?.ciclo ?? 1) + 1 : 1
  const payload = {
    mensagem_id: mensagemPedidoId,
    conversa_id: conversaId,
    resolvido_por: uid,
    resposta_mensagem_id: resposta.id,
    status: 'aguardando_solicitante' as const,
    justificativa_solicitante: null,
    decidido_por: null,
    decidido_em: null,
    ciclo,
  }

  if (existente) {
    const { error: upErr } = await supabase
      .from('chat_pedido_ajuste_resolvido')
      .update(payload)
      .eq('mensagem_id', mensagemPedidoId)
    if (upErr) throw new Error(mensagemErroPedidoAjuste(upErr))
  } else {
    const { error: insErr } = await supabase.from('chat_pedido_ajuste_resolvido').insert(payload)
    if (insErr) throw new Error(mensagemErroPedidoAjuste(insErr))
  }

  return resposta
}

async function decidirPedidoAjusteLegado(
  mensagemPedidoId: string,
  aprovado: boolean,
  justificativa?: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) throw new Error('Sessão inválida.')

  const { data: msg, error: msgErr } = await supabase
    .from('chat_mensagens')
    .select('id, conversa_id, remetente_id, conteudo')
    .eq('id', mensagemPedidoId)
    .maybeSingle()

  if (msgErr) throw new Error(mensagemErroPedidoAjuste(msgErr))
  if (!msg) throw new Error('Pedido não encontrado.')
  if (String(msg.remetente_id) !== uid) {
    throw new Error('Apenas quem abriu o pedido pode aprovar ou negar o ajuste.')
  }

  const { data: reg, error: regErr } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('mensagem_id, status')
    .eq('mensagem_id', mensagemPedidoId)
    .maybeSingle()

  if (regErr) throw new Error(mensagemErroPedidoAjuste(regErr))
  if (!reg || reg.status !== 'aguardando_solicitante') {
    throw new Error('Não há ajuste pendente da sua confirmação para este pedido.')
  }

  if (aprovado) {
    const { error } = await supabase
      .from('chat_pedido_ajuste_resolvido')
      .update({
        status: 'aprovado',
        decidido_por: uid,
        decidido_em: new Date().toISOString(),
        justificativa_solicitante: null,
      })
      .eq('mensagem_id', mensagemPedidoId)
    if (error) throw new Error(mensagemErroPedidoAjuste(error))
    return
  }

  const just = (justificativa ?? '').trim()
  if (just.length < 3) {
    throw new Error('Indique a justificativa ao negar o ajuste.')
  }

  const { error } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .update({
      status: 'reaberto',
      decidido_por: uid,
      decidido_em: new Date().toISOString(),
      justificativa_solicitante: just,
    })
    .eq('mensagem_id', mensagemPedidoId)

  if (error) throw new Error(mensagemErroPedidoAjuste(error))
}

/** Envia resposta padrão e regista o pedido como resolvido (desenvolvedor / desenvolvedor master). */
async function carregarConteudoPedidoAjuste(
  conversaId: string,
  mensagemPedidoId: string
): Promise<string> {
  const { data: msg, error } = await supabase
    .from('chat_mensagens')
    .select('conversa_id, conteudo')
    .eq('id', mensagemPedidoId)
    .maybeSingle()

  if (error) throw new Error(mensagemErroPedidoAjuste(error))
  if (!msg) throw new Error('Mensagem não encontrada.')
  if (String(msg.conversa_id) !== conversaId) {
    throw new Error('Esta mensagem não pertence à conversa aberta.')
  }
  if (!chatMensagemEhPedidoAjuste(msg as Pick<ChatMensagem, 'conteudo'>)) {
    throw new Error('Esta mensagem não é um pedido de ajuste.')
  }
  return String(msg.conteudo ?? '')
}

async function validarEscalacaoThaisAntesResolver(
  mensagemPedidoId: string,
  meuId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('chat_pedido_ajuste_aprovacao_thais')
    .select('dev_id, status')
    .eq('mensagem_id', mensagemPedidoId)
    .maybeSingle()

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  if (!data) return

  if (data.status === 'aguardando') {
    throw new Error(
      'Este pedido está na fila da Thais. Aguarde a aprovação dela ou trate-o depois da aprovação.'
    )
  }

  if (
    data.status === 'aprovado' &&
    String(data.dev_id).trim().toLowerCase() !== meuId.trim().toLowerCase()
  ) {
    throw new Error('Este pedido foi aprovado para outro desenvolvedor tratar.')
  }
}

export async function chatMarcarPedidoAjusteResolvido(
  conversaId: string,
  mensagemPedidoId: string,
  meuId: string
): Promise<ChatMensagem> {
  await validarEscalacaoThaisAntesResolver(mensagemPedidoId, meuId)

  const conteudoPedido = await carregarConteudoPedidoAjuste(conversaId, mensagemPedidoId)
  const textoResposta = montarRespostaPedidoAjusteResolvido(conteudoPedido)

  const rpc = await supabase.rpc('chat_marcar_pedido_ajuste_resolvido', {
    p_conversa_id: conversaId,
    p_mensagem_pedido_id: mensagemPedidoId,
    p_resposta: textoResposta,
  })

  if (!rpc.error && rpc.data != null) {
    return mensagemPrimeiraLinhaRpc(rpc.data)
  }

  if (rpc.error && !rpcIndisponivel(rpc.error)) {
    const msg = mensagemErroPedidoAjuste(rpc.error)
    if (/does not exist|relation|42P01/i.test(msg)) {
      throw new Error(
        'Funcionalidade ainda não activa no Supabase. Execute npm run db:apply:chat-pedido-ajuste-feedback (ou a migração 20260601120000 no SQL Editor).'
      )
    }
    throw new Error(msg)
  }

  return marcarPedidoAjusteResolvidoLegado(
    conversaId,
    mensagemPedidoId,
    meuId,
    conteudoPedido
  )
}

export async function chatDecidirPedidoAjusteSolicitante(
  mensagemPedidoId: string,
  aprovado: boolean,
  justificativa?: string
): Promise<void> {
  const rpc = await supabase.rpc('chat_decidir_pedido_ajuste_solicitante', {
    p_mensagem_pedido_id: mensagemPedidoId,
    p_aprovado: aprovado,
    p_justificativa: justificativa ?? null,
  })

  if (!rpc.error) return

  if (!rpcIndisponivel(rpc.error)) {
    throw new Error(mensagemErroPedidoAjuste(rpc.error))
  }

  await decidirPedidoAjusteLegado(mensagemPedidoId, aprovado, justificativa)
}
