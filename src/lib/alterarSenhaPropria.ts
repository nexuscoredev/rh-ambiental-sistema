import type { SupabaseClient } from '@supabase/supabase-js'

export const SENHA_MINIMA_CARACTERES = 6

export type AlterarSenhaPropriaInput = {
  senhaAtual: string
  senhaNova: string
  confirmacao: string
}

export type ValidacaoAlterarSenha =
  | { ok: true }
  | { ok: false; mensagem: string }

export function validarAlterarSenhaPropria(input: AlterarSenhaPropriaInput): ValidacaoAlterarSenha {
  const senhaAtual = input.senhaAtual.trim()
  const senhaNova = input.senhaNova.trim()
  const confirmacao = input.confirmacao.trim()

  if (!senhaAtual) {
    return { ok: false, mensagem: 'Informe a senha atual.' }
  }
  if (!senhaNova) {
    return { ok: false, mensagem: 'Informe a nova senha.' }
  }
  if (senhaNova.length < SENHA_MINIMA_CARACTERES) {
    return {
      ok: false,
      mensagem: `A nova senha precisa ter pelo menos ${SENHA_MINIMA_CARACTERES} caracteres.`,
    }
  }
  if (senhaNova !== confirmacao) {
    return { ok: false, mensagem: 'A confirmação não coincide com a nova senha.' }
  }
  if (senhaAtual === senhaNova) {
    return { ok: false, mensagem: 'A nova senha deve ser diferente da senha atual.' }
  }

  return { ok: true }
}

function mensagemErroAuth(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Senha atual incorreta.'
  }
  if (m.includes('same password') || m.includes('should be different')) {
    return 'A nova senha deve ser diferente da senha atual.'
  }
  if (m.includes('weak password') || m.includes('password')) {
    return 'Não foi possível definir esta senha. Use pelo menos 6 caracteres.'
  }
  return message || 'Não foi possível alterar a senha.'
}

/**
 * Altera a senha do utilizador autenticado (reautentica com a senha atual).
 * Não usa Edge Function nem service role — só a sessão do próprio utilizador.
 */
export async function alterarSenhaPropria(
  supabase: SupabaseClient,
  input: AlterarSenhaPropriaInput
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const validacao = validarAlterarSenhaPropria(input)
  if (!validacao.ok) return validacao

  const senhaAtual = input.senhaAtual.trim()
  const senhaNova = input.senhaNova.trim()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) {
    return { ok: false, mensagem: 'Sessão inválida. Entre novamente no sistema.' }
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senhaAtual,
  })

  if (reauthError) {
    return { ok: false, mensagem: mensagemErroAuth(reauthError.message) }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: senhaNova })

  if (updateError) {
    return { ok: false, mensagem: mensagemErroAuth(updateError.message) }
  }

  return { ok: true }
}
