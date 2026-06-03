import { supabase } from './supabase'

export type UsuarioSenhaPessoalLinha = {
  id: string
  nome: string | null
  email: string | null
  cargo: string | null
  confirmado_em?: string | null
}

export type StatsSenhaPessoalAcompanhamento = {
  confirmados: number
  pendentes: number
  total_elegiveis: number
  usuarios_confirmados: UsuarioSenhaPessoalLinha[]
  usuarios_pendentes: UsuarioSenhaPessoalLinha[]
}

function parseStats(raw: unknown): StatsSenhaPessoalAcompanhamento {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const arr = (v: unknown): UsuarioSenhaPessoalLinha[] =>
    Array.isArray(v) ? (v as UsuarioSenhaPessoalLinha[]) : []
  return {
    confirmados: Number(o.confirmados) || 0,
    pendentes: Number(o.pendentes) || 0,
    total_elegiveis: Number(o.total_elegiveis) || 0,
    usuarios_confirmados: arr(o.usuarios_confirmados),
    usuarios_pendentes: arr(o.usuarios_pendentes),
  }
}

export async function senhaPessoalJaConfirmada(): Promise<boolean> {
  const { data, error } = await supabase.rpc('rg_senha_pessoal_ja_confirmada')
  if (error) {
    if (/could not find|PGRST202|42883/i.test(error.message || '')) return false
    throw new Error(error.message)
  }
  return Boolean(data)
}

export async function confirmarSenhaPessoalConfigurada(): Promise<void> {
  const { error } = await supabase.rpc('rg_confirmar_senha_pessoal_configurada')
  if (error) throw new Error(error.message || 'Não foi possível registar a confirmação.')
}

export async function fetchStatsSenhaPessoalAcompanhamento(): Promise<StatsSenhaPessoalAcompanhamento> {
  const { data, error } = await supabase.rpc('rg_stats_senha_pessoal_acompanhamento')
  if (error) {
    if (/could not find|PGRST202|42883/i.test(error.message || '')) {
      throw new Error(
        'Função de acompanhamento ainda não está activa no servidor. Aplique a migração usuario_senha_pessoal_confirmacao.'
      )
    }
    throw new Error(error.message || 'Não foi possível carregar estatísticas.')
  }
  return parseStats(data)
}
