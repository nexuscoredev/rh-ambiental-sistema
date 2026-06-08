import { supabase } from './supabase'
import { mensagemErroSupabase } from './supabaseErrors'

export type SenhaReferenciaDevRow = {
  user_id: string
  senha_cadastrada: string
  atualizada_em: string
  fonte: string
}

export async function carregarMapaSenhasCadastradasDev(): Promise<
  Map<string, SenhaReferenciaDevRow>
> {
  const { data, error } = await supabase.rpc('rg_mapa_senhas_cadastradas_dev')

  if (error) {
    const msg = mensagemErroSupabase(error, 'Não foi possível carregar senhas cadastradas.')
    if (msg.toLowerCase().includes('acesso restrito')) {
      return new Map()
    }
    throw new Error(msg)
  }

  const mapa = new Map<string, SenhaReferenciaDevRow>()
  for (const row of (data ?? []) as SenhaReferenciaDevRow[]) {
    const id = String(row.user_id ?? '').trim()
    if (id) mapa.set(id, row)
  }
  return mapa
}

export async function limparSenhaReferenciaAposAlteracaoPropria(): Promise<void> {
  const { error } = await supabase.rpc('rg_limpar_senha_referencia_apos_alteracao_propria')
  if (error) {
    console.warn('[senhaReferenciaDev] limpar referência:', error.message)
  }
}
