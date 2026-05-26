import { supabase } from './supabase'
import { chatEnviarTexto } from './chat'
import type { ChatMensagem } from '../types/chat'

export const CHAT_PEDIDO_AJUSTE_PREFIX = '[Solicitação de ajuste no sistema]'
export const CHAT_RESPOSTA_AJUSTE_RESOLVIDO =
  'Ajustamos conforme a sua solicitação, pode testar por gentileza?'

export function chatMensagemEhPedidoAjuste(m: Pick<ChatMensagem, 'conteudo'>): boolean {
  return (m.conteudo ?? '').trimStart().startsWith(CHAT_PEDIDO_AJUSTE_PREFIX)
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
    throw error
  }

  return new Set((data ?? []).map((r) => String(r.mensagem_id)))
}

/** Envia resposta padrão e regista o pedido como resolvido (só desenvolvedor). */
export async function chatMarcarPedidoAjusteResolvido(
  conversaId: string,
  mensagemPedidoId: string,
  meuId: string
): Promise<ChatMensagem> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) throw new Error('Sessão inválida.')
  if (uid !== meuId) console.warn('[chat] marcar ajuste: JWT difere do estado da UI')

  const { data: msg } = await supabase
    .from('chat_mensagens')
    .select('id, conversa_id, conteudo')
    .eq('id', mensagemPedidoId)
    .maybeSingle()

  if (!msg) throw new Error('Mensagem não encontrada.')
  if (String(msg.conversa_id) !== conversaId) {
    throw new Error('Esta mensagem não pertence à conversa aberta.')
  }
  if (!chatMensagemEhPedidoAjuste(msg as Pick<ChatMensagem, 'conteudo'>)) {
    throw new Error('Esta mensagem não é um pedido de ajuste.')
  }

  const ja = await chatListarPedidosAjusteResolvidos(conversaId)
  if (ja.has(mensagemPedidoId)) {
    throw new Error('Este pedido já foi marcado como resolvido.')
  }

  const resposta = await chatEnviarTexto(conversaId, uid, CHAT_RESPOSTA_AJUSTE_RESOLVIDO)

  const { error: insErr } = await supabase.from('chat_pedido_ajuste_resolvido').insert({
    mensagem_id: mensagemPedidoId,
    conversa_id: conversaId,
    resolvido_por: uid,
    resposta_mensagem_id: resposta.id,
  })

  if (insErr) {
    throw new Error(insErr.message || 'Não foi possível registar a resolução.')
  }

  return resposta
}
