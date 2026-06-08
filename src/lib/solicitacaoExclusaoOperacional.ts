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

export function rpcExclusaoOperacionalIndisponivel(
  err: { code?: string; message?: string } | null
): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = String(err.message ?? '').toLowerCase()
  if (code === '42883' || code === 'PGRST202') return true
  return msg.includes('could not find the function') || msg.includes('schema cache')
}

const MSG_FILA_NAO_IMPLANTADA =
  'A fila de exclusões ainda não está disponível no servidor. Avise o suporte técnico para aplicar a migração de solicitações de exclusão.'

export function motivoExclusaoValido(motivo: string): boolean {
  return motivo.trim().length >= 3
}

export type ExclusaoPendenteProgramacaoResumo = {
  entidadeIds: Set<string>
  seriesInteirasPendentes: Set<string>
}

export const EXCLUSAO_PENDENTE_RESUMO_VAZIO: ExclusaoPendenteProgramacaoResumo = {
  entidadeIds: new Set(),
  seriesInteirasPendentes: new Set(),
}

export function programacaoComExclusaoPendente(
  item: { id: string; programacaoSerieId?: string | null },
  resumo: ExclusaoPendenteProgramacaoResumo
): boolean {
  if (resumo.entidadeIds.has(item.id)) return true
  const sid = item.programacaoSerieId?.trim()
  return !!sid && resumo.seriesInteirasPendentes.has(sid)
}

export async function carregarExclusoesProgramacaoPendentes(): Promise<ExclusaoPendenteProgramacaoResumo> {
  const { data, error } = await supabase
    .from('solicitacoes_exclusao_operacional')
    .select('entidade_id, excluir_serie_inteira, programacao_serie_id')
    .eq('status', 'aguardando')
    .eq('tipo_entidade', 'programacao')

  if (error) {
    if (rpcExclusaoOperacionalIndisponivel(error)) {
      return { entidadeIds: new Set(), seriesInteirasPendentes: new Set() }
    }
    throw new Error(
      mensagemErroSupabase(error, 'Não foi possível carregar solicitações de exclusão pendentes.')
    )
  }

  const entidadeIds = new Set<string>()
  const seriesInteirasPendentes = new Set<string>()
  for (const row of data ?? []) {
    const entidadeId = String(row.entidade_id ?? '').trim()
    if (entidadeId) entidadeIds.add(entidadeId)
    if (row.excluir_serie_inteira && row.programacao_serie_id) {
      seriesInteirasPendentes.add(String(row.programacao_serie_id))
    }
  }
  return { entidadeIds, seriesInteirasPendentes }
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
    if (rpcExclusaoOperacionalIndisponivel(error)) {
      throw new Error(MSG_FILA_NAO_IMPLANTADA)
    }
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
