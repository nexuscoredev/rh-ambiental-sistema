import { supabase } from './supabase'

export type SolicitarResetSenhaLoginInput = {
  email: string
  nome?: string
  observacao?: string
}

export async function solicitarResetSenhaLogin({
  email,
  nome,
  observacao,
}: SolicitarResetSenhaLoginInput): Promise<void> {
  const { error } = await supabase.rpc('rg_solicitar_reset_senha_login', {
    p_email: email.trim(),
    p_nome: nome?.trim() || null,
    p_observacao: observacao?.trim() || null,
  })

  if (error) {
    const msg = error.message || ''
    if (/could not find|schema cache|PGRST202|42883/i.test(msg)) {
      throw new Error(
        'Função de reset ainda não está activa no servidor. Peça ao desenvolvedor para aplicar a migração login_reset_senha_chat.'
      )
    }
    throw new Error(msg || 'Não foi possível enviar o pedido.')
  }
}
