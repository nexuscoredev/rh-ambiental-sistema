import { supabase } from './supabase'
import { mensagemErroSupabase } from './supabaseErrors'

export type TipoEntidadeExclusao = 'programacao' | 'mtr'

export type SolicitacaoExclusaoOperacionalRow = {
  id: string
  tipo_entidade: TipoEntidadeExclusao
  entidade_id: string
  motivo: string
  status: 'aguardando' | 'aprovado' | 'rejeitado'
  excluir_serie_inteira: boolean
  programacao_serie_id: string | null
  solicitante_id: string
  solicitante_nome: string
  entidade_rotulo: string
  entidade_detalhe: string
  criado_em: string
}

function rpcIndisponivel(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = String(err.message ?? '').toLowerCase()
  if (code === '42883' || code === 'PGRST202') return true
  return msg.includes('could not find the function') || msg.includes('schema cache')
}

export function motivoExclusaoValido(motivo: string): boolean {
  return motivo.trim().length >= 3
}

export async function solicitarExclusaoOperacional(opts: {
  tipoEntidade: TipoEntidadeExclusao
  entidadeId: string
  motivo: string
  excluirSerieInteira?: boolean
  programacaoSerieId?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const motivo = opts.motivo.trim()
  if (!motivoExclusaoValido(motivo)) {
    return { ok: false, message: 'Informe o motivo da exclusão (mínimo 3 caracteres).' }
  }

  const { data, error } = await supabase.rpc('solicitar_exclusao_operacional', {
    p_tipo_entidade: opts.tipoEntidade,
    p_entidade_id: opts.entidadeId,
    p_motivo: motivo,
    p_excluir_serie_inteira: opts.excluirSerieInteira ?? false,
    p_programacao_serie_id: opts.programacaoSerieId ?? null,
  })

  if (error) {
    return {
      ok: false,
      message: mensagemErroSupabase(
        error,
        'Não foi possível enviar a solicitação de exclusão.'
      ),
    }
  }

  const id = String(data ?? '').trim()
  if (!id) {
    return { ok: false, message: 'Solicitação criada sem identificador.' }
  }

  return { ok: true, id }
}

export async function listarSolicitacoesExclusaoOperacional(
  status: 'aguardando' | 'aprovado' | 'rejeitado' = 'aguardando'
): Promise<SolicitacaoExclusaoOperacionalRow[]> {
  const { data, error } = await supabase.rpc('listar_solicitacoes_exclusao_operacional', {
    p_status: status,
  })

  if (error) {
    if (rpcIndisponivel(error)) return []
    throw new Error(
      mensagemErroSupabase(error, 'Não foi possível carregar a fila de exclusões.')
    )
  }

  return (data ?? []) as SolicitacaoExclusaoOperacionalRow[]
}

export async function aprovarSolicitacaoExclusaoOperacional(
  solicitacaoId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('aprovar_solicitacao_exclusao_operacional', {
    p_solicitacao_id: solicitacaoId,
  })

  if (error) {
    return {
      ok: false,
      message: mensagemErroSupabase(error, 'Não foi possível aprovar a exclusão.'),
    }
  }

  return { ok: true }
}

export async function rejeitarSolicitacaoExclusaoOperacional(
  solicitacaoId: string,
  motivoRejeicao?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('rejeitar_solicitacao_exclusao_operacional', {
    p_solicitacao_id: solicitacaoId,
    p_motivo_rejeicao: motivoRejeicao?.trim() || null,
  })

  if (error) {
    return {
      ok: false,
      message: mensagemErroSupabase(error, 'Não foi possível rejeitar a solicitação.'),
    }
  }

  return { ok: true }
}

export function rotuloTipoEntidadeExclusao(tipo: TipoEntidadeExclusao): string {
  return tipo === 'programacao' ? 'Programação' : 'MTR'
}
