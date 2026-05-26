import { supabase } from './supabase'
import { chatEnviarTexto } from './chat'
import type { ChatMensagem } from '../types/chat'
import type { PostgrestError } from '@supabase/supabase-js'

export const CHAT_PEDIDO_AJUSTE_PREFIX = '[Solicitação de ajuste no sistema]'
/** Fallback quando o corpo do pedido não puder ser interpretado. */
export const CHAT_RESPOSTA_AJUSTE_RESOLVIDO =
  'Ajustamos conforme a sua solicitação, pode testar por gentileza?'

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

function rpcIndisponivel(err: PostgrestError | null): boolean {
  if (!err) return false
  const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase()
  if (err.code === 'PGRST202' || err.code === '42883') return true
  if (msg.includes('404') || msg.includes('not found') || msg.includes('could not find')) return true
  return false
}

function mensagemErroPedidoAjuste(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as PostgrestError).message ?? '').trim()
    const d = String((err as PostgrestError).details ?? '').trim()
    const joined = [m, d].filter(Boolean).join(' — ')
    if (joined) return joined
  }
  return 'Não foi possível marcar como resolvido.'
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
}

/** Pedidos de ajuste recebidos ainda não marcados como resolvidos (fila do desenvolvedor). */
export async function chatListarPedidosAjustePendentes(meuId: string): Promise<PedidoAjusteFilaItem[]> {
  const uid = meuId.trim()
  if (!uid) return []

  const resolvidos = await supabase.from('chat_pedido_ajuste_resolvido').select('mensagem_id')
  const resolvidoSet = new Set<string>()
  if (resolvidos.error) {
    if (!/does not exist|relation|42P01/i.test(resolvidos.error.message)) {
      throw new Error(mensagemErroPedidoAjuste(resolvidos.error))
    }
  } else {
    for (const row of resolvidos.data ?? []) {
      resolvidoSet.add(String(row.mensagem_id))
    }
  }

  const { data, error } = await supabase
    .from('chat_mensagens')
    .select('id, conversa_id, remetente_id, conteudo, created_at')
    .like('conteudo', `${CHAT_PEDIDO_AJUSTE_PREFIX}%`)
    .neq('remetente_id', uid)
    .order('created_at', { ascending: true })

  if (error) throw new Error(mensagemErroPedidoAjuste(error))

  const itens: PedidoAjusteFilaItem[] = []
  for (const row of data ?? []) {
    const mensagemId = String(row.id)
    if (resolvidoSet.has(mensagemId)) continue
    const conteudo = String(row.conteudo ?? '')
    itens.push({
      mensagemId,
      conversaId: String(row.conversa_id),
      remetenteId: String(row.remetente_id),
      conteudo,
      createdAt: String(row.created_at),
      parseado: parsePedidoAjusteConteudo(conteudo),
    })
  }
  return itens
}

export async function chatListarPedidosAjusteResolvidos(
  conversaId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('chat_pedido_ajuste_resolvido')
    .select('mensagem_id')
    .eq('conversa_id', conversaId)

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return new Set()
    throw new Error(mensagemErroPedidoAjuste(error))
  }

  return new Set((data ?? []).map((r) => String(r.mensagem_id)))
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

  const ja = await chatListarPedidosAjusteResolvidos(conversaId)
  if (ja.has(mensagemPedidoId)) {
    throw new Error('Este pedido já foi marcado como resolvido.')
  }

  const resposta = await chatEnviarTexto(
    conversaId,
    uid,
    montarRespostaPedidoAjusteResolvido(conteudoPedido)
  )

  const { error: insErr } = await supabase.from('chat_pedido_ajuste_resolvido').insert({
    mensagem_id: mensagemPedidoId,
    conversa_id: conversaId,
    resolvido_por: uid,
    resposta_mensagem_id: resposta.id,
  })

  if (insErr) {
    if (/does not exist|relation|42P01/i.test(insErr.message)) {
      throw new Error(
        'A tabela de pedidos resolvidos ainda não existe no Supabase. Execute: npm run db:apply:chat-pedido-ajuste-resolvido'
      )
    }
    if (/row-level security|42501|policy/i.test(insErr.message)) {
      throw new Error(
        'Sem permissão no servidor para registar a resolução. Aplique a migração chat_pedido_ajuste_resolvido (fix RPC) no Supabase.'
      )
    }
    throw new Error(mensagemErroPedidoAjuste(insErr))
  }

  return resposta
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

export async function chatMarcarPedidoAjusteResolvido(
  conversaId: string,
  mensagemPedidoId: string,
  meuId: string
): Promise<ChatMensagem> {
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
        'Funcionalidade ainda não activa no Supabase. Execute npm run db:apply:chat-pedido-ajuste-fix (ou a migração 20260527120000 no SQL Editor).'
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
