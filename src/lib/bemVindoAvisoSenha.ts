import {
  confirmarSenhaPessoalConfigurada,
  senhaPessoalJaConfirmada,
} from './senhaPessoalConfirmacao'

const STORAGE_PREFIX = 'rg_bem_vindo_aviso_senha_oculto:'

export function avisoSenhaEstaOcultoLocal(userId: string): boolean {
  if (!userId) return false
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${userId}`) === '1'
  } catch {
    return false
  }
}

export function ocultarAvisoSenhaBemVindoLocal(userId: string): void {
  if (!userId) return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, '1')
  } catch {
    /* ignore quota */
  }
}

/** Verifica no servidor (e cache local como fallback). */
export async function avisoSenhaDeveFicarOculto(userId: string): Promise<boolean> {
  try {
    if (await senhaPessoalJaConfirmada()) return true
  } catch {
    /* migração pendente — usa local */
  }
  return avisoSenhaEstaOcultoLocal(userId)
}

/** Regista «Já configurei» no servidor e no navegador. */
export async function registrarSenhaPessoalConfigurada(userId: string): Promise<void> {
  try {
    await confirmarSenhaPessoalConfigurada()
  } catch {
    /* segue com cache local se RPC indisponível */
  }
  ocultarAvisoSenhaBemVindoLocal(userId)
}
