import { supabase } from './supabase'
import { chatEnviarTexto } from './chat'
import type { ChatMensagem } from '../types/chat'
import type { PostgrestError } from '@supabase/supabase-js'

export const CHAT_PEDIDO_AJUSTE_PREFIX = '[Solicitação de ajuste no sistema]'
export const CHAT_PEDIDO_CADASTRO_PREFIX = '[Solicitação de cadastro no sistema]'

export type PedidoAjusteCategoria = 'ajuste' | 'cadastro'

export function prefixoSolicitacaoSistema(conteudo: string): string | null {
  const raw = (conteudo ?? '').trimStart()
  if (raw.startsWith(CHAT_PEDIDO_AJUSTE_PREFIX)) return CHAT_PEDIDO_AJUSTE_PREFIX
  if (raw.startsWith(CHAT_PEDIDO_CADASTRO_PREFIX)) return CHAT_PEDIDO_CADASTRO_PREFIX
  return null
}

/** Filtro PostgREST `.or()` para listar pedidos de ajuste e de cadastro. */
export function filtroOrConteudoPedidosSistema(): string {
  return `conteudo.like.${CHAT_PEDIDO_AJUSTE_PREFIX}%,conteudo.like.${CHAT_PEDIDO_CADASTRO_PREFIX}%`
}

/** Fallback quando o corpo do pedido não puder ser interpretado. */
export const CHAT_RESPOSTA_AJUSTE_RESOLVIDO =
  'Ajustamos conforme a sua solicitação, pode testar por gentileza?'

export type PedidoAjusteStatus =
  | 'aguardando_solicitante'
  | 'aguardando_detalhes'
  | 'reaberto'
  | 'aprovado'

export const CHAT_PEDIDO_DETALHES_PADRAO_DEV =
  'Precisamos de mais detalhes sobre o seu pedido para conseguir tratar o caso. Pode complementar com passos para reproduzir, exemplos ou o que esperava ver no sistema?'

/** RPC «Pedir mais detalhes» ainda não aplicada no Supabase de produção. */
export const MENSAGEM_SQL_PEDIR_DETALHES_PEDIDO_AJUSTE =
  'Funcionalidade ainda não activa no Supabase. No Dashboard → SQL Editor, execute o ficheiro supabase/sql_editor_chat_pedido_ajuste_pedir_detalhes.sql (Run) e recarregue a página. O comando npm run db:apply:chat-pedido-ajuste-pedir-detalhes só funciona se o PC conseguir ligar ao Postgres (erro ENOTFOUND = use o SQL Editor).'

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
  categoria: PedidoAjusteCategoria
  descricao: string
  pagina?: string
  solicitante?: string
  /** Preenchido em solicitações de cadastro. */
  cliente?: string
  itemCadastro?: string
}

function parseCorpoPedidoSistema(
  corpo: string,
  categoria: PedidoAjusteCategoria
): Omit<PedidoAjusteParseado, 'categoria'> | null {
  const lines = corpo.replace(/^\s*\n/, '').split('\n')

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

  let cliente: string | undefined
  let itemCadastro: string | undefined
  if (categoria === 'cadastro') {
    const idxCliente = lines.findIndex((l) => /^Cliente:\s*/i.test(l.trim()))
    if (idxCliente >= 0) {
      cliente = lines[idxCliente].replace(/^Cliente:\s*/i, '').trim() || undefined
      lines.splice(idxCliente, 1)
    }
    const idxItem = lines.findIndex((l) => /^Cadastrar:\s*/i.test(l.trim()))
    if (idxItem >= 0) {
      itemCadastro = lines[idxItem].replace(/^Cadastrar:\s*/i, '').trim() || undefined
      lines.splice(idxItem, 1)
    }
    while (lines[0]?.trim() === '') lines.shift()
  }

  const descricao = lines.join('\n').trim()
  if (!descricao) return null
  return { descricao, pagina, solicitante, cliente, itemCadastro }
}

/** Extrai campos do corpo enviado por `chatEnviarPedidoAjusteSistema` / cadastro. */
export function parsePedidoAjusteConteudo(conteudo: string): PedidoAjusteParseado | null {
  const prefixo = prefixoSolicitacaoSistema(conteudo)
  if (!prefixo) return null

  const categoria: PedidoAjusteCategoria =
    prefixo === CHAT_PEDIDO_CADASTRO_PREFIX ? 'cadastro' : 'ajuste'
  const raw = (conteudo ?? '').trimStart()
  const corpo = raw.slice(prefixo.length)
  const parsed = parseCorpoPedidoSistema(corpo, categoria)
  if (!parsed) return null
  return { categoria, ...parsed }
}

/** Monta o corpo completo de um pedido de ajuste (mesmo formato do envio). */
export function montarConteudoPedidoAjuste(opts: {
  descricao: string
  pagina?: string
  solicitante?: string
}): string {
  const linhas = [CHAT_PEDIDO_AJUSTE_PREFIX, '', opts.descricao.trim()]
  const pagina = opts.pagina?.trim()
  if (pagina && pagina !== '—') linhas.push('', `Página: ${pagina}`)
  const solicitante = opts.solicitante?.trim()
  if (solicitante) linhas.push(`— ${solicitante}`)
  return linhas.join('\n')
}

/** Monta solicitação de cadastro (dados em falta no sistema). */
export function montarConteudoPedidoCadastro(opts: {
  cliente: string
  itemCadastro: string
  detalhes: string
  pagina?: string
  solicitante?: string
}): string {
  const linhas = [
    CHAT_PEDIDO_CADASTRO_PREFIX,
    '',
    `Cliente: ${opts.cliente.trim()}`,
    `Cadastrar: ${opts.itemCadastro.trim()}`,
    '',
    opts.detalhes.trim(),
  ]
  const pagina = opts.pagina?.trim()
  if (pagina && pagina !== '—') linhas.push('', `Página: ${pagina}`)
  const solicitante = opts.solicitante?.trim()
  if (solicitante) linhas.push(`— ${solicitante}`)
  return linhas.join('\n')
}

/** Reconstrói o corpo após edição pelo solicitante. */
export function montarConteudoPedidoSistema(parseado: PedidoAjusteParseado): string {
  if (parseado.categoria === 'cadastro') {
    return montarConteudoPedidoCadastro({
      cliente: parseado.cliente ?? '—',
      itemCadastro: parseado.itemCadastro ?? '—',
      detalhes: parseado.descricao,
      pagina: parseado.pagina,
      solicitante: parseado.solicitante,
    })
  }
  return montarConteudoPedidoAjuste({
    descricao: parseado.descricao,
    pagina: parseado.pagina,
    solicitante: parseado.solicitante,
  })
}

export function rotuloBadgePedidoAjuste(parseado: PedidoAjusteParseado | null): string {
  if (parseado?.categoria === 'cadastro') return 'Pedido de cadastro'
  return 'Pedido de ajuste'
}

/** Solicitante pode editar enquanto o dev ainda não respondeu (ou pediu mais detalhes). */
export function pedidoAjusteSolicitantePodeEditar(
  status: PedidoAjusteStatus | null | undefined
): boolean {
  if (!status) return true
  return status === 'aguardando_detalhes'
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
    case 'detalhes_solicitados_dev':
      return 'Desenvolvedor pediu mais detalhes'
    case 'detalhes_respondidos_solicitante':
      return 'Solicitante enviou complemento'
    case 'editado_solicitante':
      return 'Solicitante editou o pedido'
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
  return prefixoSolicitacaoSistema(m.conteudo ?? '') != null
}

export type PedidoAjusteFilaItem = {
  mensagemId: string
  conversaId: string
  remetenteId: string
  conteudo: string
  createdAt: string
  parseado: PedidoAjusteParseado | null
  /** Novo, reaberto, pós-Thais ou aguardando complemento após «pedir mais detalhes». */
  situacao: 'novo' | 'reaberto' | 'aprovado_thais' | 'aguardando_detalhes'
  /** Quando reaberto: negativa após resolução ou complemento após pedido de detalhes. */
  tipoReabertura?: 'negativa' | 'complemento'
  justificativaSolicitante?: string
  /** Texto enviado ao solicitante ao pedir mais detalhes (status aguardando_detalhes). */
  perguntaDetalhes?: string
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

export type PedidoAjusteAguardandoDetalhes = {
  mensagemPedidoId: string
  perguntaMensagemId: string
  conversaId: string
  ciclo: number
}

export type PedidoAjusteHistoricoItem = {
  id: string
  mensagemPedidoId: string
  conversaId: string
  evento:
    | 'resolvido_dev'
    | 'aprovado_solicitante'
    | 'negado_solicitante'
    | 'enviado_fila_thais'
    | 'aprovado_fila_thais'
    | 'detalhes_solicitados_dev'
    | 'detalhes_respondidos_solicitante'
    | 'editado_solicitante'
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
    case 'aguardando_detalhes':
      return 'Aguardando complemento'
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
  if (filtro === 'aguardando') {
    return status === 'aguardando_solicitante' || status === 'aguardando_detalhes'
  }
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
  if (row.status === 'aguardando_detalhes' || row.status === 'aguardando_solicitante') return false
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

function tipoReaberturaDoEvento(evento: string | undefined): 'negativa' | 'complemento' | undefined {
  if (evento === 'detalhes_respondidos_solicitante') return 'complemento'
  if (evento === 'negado_solicitante') return 'negativa'
  return undefined
}

async function carregarUltimoEventoReaberturaPorMensagem(
  mensagemIds: string[]
): Promise<Map<string, 'negativa' | 'complemento'>> {
  const map = new Map<string, 'negativa' | 'complemento'>()
  if (mensagemIds.length === 0) return map

  const { data, error } = await supabase
    .from('chat_pedido_ajuste_historico')
    .select('mensagem_pedido_id, evento, created_at')
    .in('mensagem_pedido_id', mensagemIds)
    .in('evento', ['negado_solicitante', 'detalhes_respondidos_solicitante'])
    .order('created_at', { ascending: false })

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return map
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  for (const row of data ?? []) {
    const id = String(row.mensagem_pedido_id)
    if (map.has(id)) continue
    const tipo = tipoReaberturaDoEvento(String(row.evento))
    if (tipo) map.set(id, tipo)
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
  escalacao: PedidoAjusteEscalacaoThaisRow | undefined,
  tipoReabertura?: 'negativa' | 'complemento'
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
    tipoReabertura: reaberto ? tipoReabertura : undefined,
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
    .or(filtroOrConteudoPedidosSistema())
    .neq('remetente_id', uid)
    .order('created_at', { ascending: true })

  if (error) throw new Error(mensagemErroPedidoAjuste(error))

  const mensagemIds = (data ?? []).map((row) => String(row.id))
  const escalacaoPorMensagem = await carregarEscalacoesThaisPorMensagens(mensagemIds)

  const reabertoIds: string[] = []
  for (const row of data ?? []) {
    const mensagemId = String(row.id)
    const reg = resolvidoPorMensagem.get(mensagemId)
    const escalacao = escalacaoPorMensagem.get(mensagemId)
    if (!pedidoEstaNaFilaDev(reg, escalacao, uid)) continue
    if (reg?.status === 'reaberto') reabertoIds.push(mensagemId)
  }
  const tipoReaberturaPorMensagem = await carregarUltimoEventoReaberturaPorMensagem(reabertoIds)

  const itens: PedidoAjusteFilaItem[] = []
  for (const row of data ?? []) {
    const mensagemId = String(row.id)
    const reg = resolvidoPorMensagem.get(mensagemId)
    const escalacao = escalacaoPorMensagem.get(mensagemId)
    if (!pedidoEstaNaFilaDev(reg, escalacao, uid)) continue

    itens.push(
      montarItemFilaPedido(row, reg, escalacao, tipoReaberturaPorMensagem.get(mensagemId))
    )
  }
  return itens
}

/** Pedidos em que o desenvolvedor pediu complemento e aguarda resposta do solicitante. */
export async function chatListarPedidosAjusteAguardandoDetalhesDev(): Promise<PedidoAjusteFilaItem[]> {
  const { data: regs, error } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('mensagem_id, conversa_id, status, resposta_mensagem_id, justificativa_solicitante, ciclo')
    .eq('status', 'aguardando_detalhes')

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return []
    if (colunaInexistente(error)) return []
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  const rows = regs ?? []
  if (rows.length === 0) return []

  const mensagemIds = rows.map((r) => String(r.mensagem_id))
  const respostaIds = rows
    .map((r) => (r.resposta_mensagem_id ? String(r.resposta_mensagem_id) : ''))
    .filter(Boolean)

  const { data: msgs, error: msgErr } = await supabase
    .from('chat_mensagens')
    .select('id, conversa_id, remetente_id, conteudo, created_at')
    .in('id', mensagemIds)

  if (msgErr) throw new Error(mensagemErroPedidoAjuste(msgErr))

  const perguntaPorId = new Map<string, string>()
  if (respostaIds.length > 0) {
    const { data: respMsgs, error: respErr } = await supabase
      .from('chat_mensagens')
      .select('id, conteudo')
      .in('id', respostaIds)
    if (respErr) throw new Error(mensagemErroPedidoAjuste(respErr))
    for (const m of respMsgs ?? []) {
      const texto = String(m.conteudo ?? '').trim()
      if (texto) perguntaPorId.set(String(m.id), texto)
    }
  }

  const regPorMensagem = new Map<string, ResolvidoRow & { resposta_mensagem_id?: string | null }>()
  for (const row of rows) {
    regPorMensagem.set(String(row.mensagem_id), row as ResolvidoRow & { resposta_mensagem_id?: string | null })
  }

  const escalacaoPorMensagem = await carregarEscalacoesThaisPorMensagens(mensagemIds)

  const itens: PedidoAjusteFilaItem[] = []
  for (const row of msgs ?? []) {
    const mensagemId = String(row.id)
    const reg = regPorMensagem.get(mensagemId)
    if (!reg || reg.status !== 'aguardando_detalhes') continue
    const respostaId = reg.resposta_mensagem_id ? String(reg.resposta_mensagem_id) : ''
    const base = montarItemFilaPedido(row, reg, escalacaoPorMensagem.get(mensagemId))
    itens.push({
      ...base,
      situacao: 'aguardando_detalhes',
      perguntaDetalhes: respostaId ? perguntaPorId.get(respostaId) : undefined,
    })
  }

  itens.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return itens
}

type FilaThaisRpcRow = {
  mensagem_id: string
  conversa_id: string
  remetente_id: string
  conteudo: string
  created_at: string
  dev_id: string
  enviado_em: string | null
}

/** Pedidos à espera de aprovação da Thais. */
export async function chatListarPedidosAjusteFilaThais(): Promise<PedidoAjusteFilaItem[]> {
  const rpc = await supabase.rpc('chat_listar_pedidos_ajuste_fila_thais')
  if (!rpc.error && Array.isArray(rpc.data)) {
    return (rpc.data as FilaThaisRpcRow[]).map((row) =>
      montarItemFilaPedido(
        {
          id: String(row.mensagem_id),
          conversa_id: String(row.conversa_id),
          remetente_id: String(row.remetente_id),
          conteudo: String(row.conteudo ?? ''),
          created_at: String(row.created_at),
        },
        undefined,
        {
          mensagem_id: String(row.mensagem_id),
          conversa_id: String(row.conversa_id),
          dev_id: String(row.dev_id),
          status: 'aguardando',
          enviado_em: row.enviado_em != null ? String(row.enviado_em) : null,
        }
      )
    )
  }

  if (rpc.error && !rpcIndisponivel(rpc.error)) {
    const msg = mensagemErroPedidoAjuste(rpc.error)
    if (!/does not exist|relation|42P01|PGRST202/i.test(msg)) {
      throw new Error(msg)
    }
  }

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

  if (existente) {
    const { error } = await supabase
      .from('chat_pedido_ajuste_aprovacao_thais')
      .update({
        status: 'aguardando',
        dev_id: uid,
        enviado_em: new Date().toISOString(),
        aprovado_em: null,
        aprovado_por: null,
      })
      .eq('mensagem_id', mensagemPedidoId)
    if (error) throw new Error(mensagemErroPedidoAjuste(error))
    return
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
    .or(filtroOrConteudoPedidosSistema())

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

/** Pedidos em que o desenvolvedor pediu complemento (solicitante responde na conversa). */
export async function chatListarPedidosAguardandoDetalhesSolicitante(
  conversaId: string,
  meuId: string
): Promise<PedidoAjusteAguardandoDetalhes[]> {
  const cid = conversaId.trim()
  const uid = meuId.trim()
  if (!cid || !uid) return []

  const { data: pedidos, error: pedErr } = await supabase
    .from('chat_mensagens')
    .select('id')
    .eq('conversa_id', cid)
    .eq('remetente_id', uid)
    .or(filtroOrConteudoPedidosSistema())

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

  const out: PedidoAjusteAguardandoDetalhes[] = []
  for (const row of data ?? []) {
    if ((row.status ?? '') !== 'aguardando_detalhes') continue
    const perguntaId = row.resposta_mensagem_id ? String(row.resposta_mensagem_id) : ''
    if (!perguntaId) continue
    out.push({
      mensagemPedidoId: String(row.mensagem_id),
      perguntaMensagemId: perguntaId,
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
    .or(filtroOrConteudoPedidosSistema())
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
      descricao:
        parseado?.descricao ??
        conteudo.replace(/^\[(Solicitação de ajuste|Solicitação de cadastro) no sistema\]\s*/i, '').trim(),
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

  if (status === 'aguardando_detalhes') {
    throw new Error('Este pedido aguarda complemento do solicitante.')
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
  if (!reg || reg.status === 'aguardando_detalhes') {
    throw new Error('Responda primeiro ao pedido de mais detalhes do desenvolvimento.')
  }
  if (reg.status !== 'aguardando_solicitante') {
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

export async function chatPedirDetalhesPedidoAjuste(
  conversaId: string,
  mensagemPedidoId: string,
  meuId: string,
  mensagem?: string
): Promise<ChatMensagem> {
  await validarEscalacaoThaisAntesResolver(mensagemPedidoId, meuId)
  await carregarConteudoPedidoAjuste(conversaId, mensagemPedidoId)

  const texto = (mensagem ?? '').trim() || CHAT_PEDIDO_DETALHES_PADRAO_DEV

  const rpc = await supabase.rpc('chat_pedir_detalhes_pedido_ajuste', {
    p_conversa_id: conversaId,
    p_mensagem_pedido_id: mensagemPedidoId,
    p_mensagem: texto,
  })

  if (!rpc.error && rpc.data != null) {
    return mensagemPrimeiraLinhaRpc(rpc.data)
  }

  if (rpc.error && !rpcIndisponivel(rpc.error)) {
    const msg = mensagemErroPedidoAjuste(rpc.error)
    if (/does not exist|relation|42P01|42883/i.test(msg)) {
      throw new Error(MENSAGEM_SQL_PEDIR_DETALHES_PEDIDO_AJUSTE)
    }
    throw new Error(msg)
  }

  throw new Error(MENSAGEM_SQL_PEDIR_DETALHES_PEDIDO_AJUSTE)
}

export async function chatResponderDetalhesPedidoAjuste(
  mensagemPedidoId: string,
  complemento: string
): Promise<ChatMensagem> {
  const texto = complemento.trim()
  if (texto.length < 3) {
    throw new Error('Descreva o complemento com pelo menos 3 caracteres.')
  }

  const rpc = await supabase.rpc('chat_responder_detalhes_pedido_ajuste', {
    p_mensagem_pedido_id: mensagemPedidoId,
    p_complemento: texto,
  })

  if (!rpc.error && rpc.data != null) {
    return mensagemPrimeiraLinhaRpc(rpc.data)
  }

  if (rpc.error && !rpcIndisponivel(rpc.error)) {
    throw new Error(mensagemErroPedidoAjuste(rpc.error))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) throw new Error('Sessão inválida.')

  const { data: msg } = await supabase
    .from('chat_mensagens')
    .select('id, conversa_id, remetente_id')
    .eq('id', mensagemPedidoId)
    .maybeSingle()

  if (!msg) throw new Error('Pedido não encontrado.')
  if (String(msg.remetente_id) !== uid) {
    throw new Error('Apenas quem abriu o pedido pode enviar o complemento.')
  }

  const { data: reg } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('status, ciclo')
    .eq('mensagem_id', mensagemPedidoId)
    .maybeSingle()

  if (!reg || reg.status !== 'aguardando_detalhes') {
    throw new Error('Não há pedido de detalhes pendente para este caso.')
  }

  const resposta = await chatEnviarTexto(String(msg.conversa_id), uid, texto)

  const { error: upErr } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .update({
      status: 'reaberto',
      justificativa_solicitante: texto,
      decidido_por: uid,
      decidido_em: new Date().toISOString(),
    })
    .eq('mensagem_id', mensagemPedidoId)

  if (upErr) throw new Error(mensagemErroPedidoAjuste(upErr))
  return resposta
}

/** Status dos pedidos numa conversa (null = ainda sem tratamento). */
export async function chatMapStatusPedidosAjusteNaConversa(
  conversaId: string
): Promise<Map<string, PedidoAjusteStatus | null>> {
  const map = new Map<string, PedidoAjusteStatus | null>()
  const { data, error } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('mensagem_id, status')
    .eq('conversa_id', conversaId)

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return map
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  for (const row of data ?? []) {
    map.set(String(row.mensagem_id), (row.status ?? null) as PedidoAjusteStatus | null)
  }
  return map
}

export async function chatEditarPedidoAjusteSolicitante(
  mensagemPedidoId: string,
  descricao: string
): Promise<ChatMensagem> {
  const trimmed = descricao.trim()
  if (trimmed.length < 3) {
    throw new Error('Descreva a solicitação com pelo menos 3 caracteres.')
  }

  const rpc = await supabase.rpc('chat_editar_pedido_ajuste_solicitante', {
    p_mensagem_id: mensagemPedidoId,
    p_descricao: trimmed,
  })

  if (!rpc.error && rpc.data != null) {
    return mensagemPrimeiraLinhaRpc(rpc.data)
  }

  if (rpc.error && !rpcIndisponivel(rpc.error)) {
    throw new Error(mensagemErroPedidoAjuste(rpc.error))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) throw new Error('Sessão inválida.')

  const { data: msg } = await supabase
    .from('chat_mensagens')
    .select('id, conversa_id, remetente_id, conteudo')
    .eq('id', mensagemPedidoId)
    .maybeSingle()

  if (!msg) throw new Error('Pedido não encontrado.')
  if (String(msg.remetente_id) !== uid) {
    throw new Error('Apenas quem enviou a solicitação pode editá-la.')
  }

  const parseado = parsePedidoAjusteConteudo(String(msg.conteudo ?? ''))
  if (!parseado) throw new Error('Esta mensagem não é um pedido de ajuste.')

  const { data: reg } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('status')
    .eq('mensagem_id', mensagemPedidoId)
    .maybeSingle()

  const status = (reg?.status ?? null) as PedidoAjusteStatus | null
  if (!pedidoAjusteSolicitantePodeEditar(status)) {
    throw new Error('Este pedido já está em tratamento ou encerrado; não pode ser editado.')
  }

  const novoConteudo = montarConteudoPedidoSistema({
    ...parseado,
    descricao: trimmed,
  })

  const { data: atualizada, error: upErr } = await supabase
    .from('chat_mensagens')
    .update({ conteudo: novoConteudo })
    .eq('id', mensagemPedidoId)
    .select('*')
    .single()

  if (upErr || !atualizada) {
    throw new Error(
      mensagemErroPedidoAjuste(upErr) ||
        'Não foi possível editar a solicitação. Peça ao suporte para aplicar a migração de edição.'
    )
  }

  return atualizada as ChatMensagem
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
