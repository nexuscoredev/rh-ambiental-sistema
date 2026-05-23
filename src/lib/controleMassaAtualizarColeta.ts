import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { isErroColunaResiduosItens } from './residuosPesagem'

export type ColetaUpdateAposPesagem = {
  peso_tara: number | null
  peso_bruto: number | null
  peso_liquido: number | null
  tipo_residuo: string | null
  residuo_catalogo_id?: string | null
  residuos_itens?: unknown
  placa: string | null
  motorista: string | null
  motorista_nome?: string | null
  data_execucao?: string | null
  data_agendada?: string | null
  fluxo_status: string
  etapa_operacional: string
  status_processo?: string | null
  liberado_financeiro?: boolean
}

function mensagemErroColetaLegivel(err: PostgrestError | null | undefined): string {
  const msg = (err?.message ?? '').trim()
  if (!msg) return 'Não foi possível atualizar a coleta no fluxo.'
  if (msg.toLowerCase().includes('row-level security')) {
    return (
      'Sem permissão para atualizar a coleta no fluxo (política RLS). ' +
      'Peça ao administrador para executar no Supabase: ' +
      'supabase/sql_editor_coleta_apos_pesagem_controle_massa.sql'
    )
  }
  if (msg.includes('check constraint') || msg.includes('violates check')) {
    return `Dados da coleta rejeitados pela base: ${msg}`
  }
  return msg
}

function erroSemLinhasAtualizadas(): PostgrestError {
  return {
    name: 'PostgrestError',
    message: 'Nenhuma linha da coleta foi atualizada (permissão ou coleta inexistente).',
    details: '',
    hint: '',
    code: 'PGRST116',
  }
}

async function updateColetaDireto(
  supabase: SupabaseClient,
  coletaId: string,
  payload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: PostgrestError }> {
  const { data, error } = await supabase
    .from('coletas')
    .update(payload)
    .eq('id', coletaId)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error }
  if (!data?.id) return { ok: false, error: erroSemLinhasAtualizadas() }
  return { ok: true }
}

async function rpcAtualizarColetaAposPesagem(
  supabase: SupabaseClient,
  coletaId: string,
  dados: ColetaUpdateAposPesagem
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('atualizar_coleta_apos_pesagem_controle_massa', {
    p_coleta_id: coletaId,
    p_dados: dados,
  })

  if (error) {
    if (
      error.message?.includes('Could not find the function') ||
      error.code === 'PGRST202'
    ) {
      return { ok: false, message: '' }
    }
    return { ok: false, message: mensagemErroColetaLegivel(error) }
  }

  const row = data as { ok?: boolean; message?: string } | null
  if (row?.ok === true) return { ok: true }
  return {
    ok: false,
    message: (row?.message ?? '').trim() || 'RPC não atualizou a coleta.',
  }
}

/**
 * Atualiza a coleta após gravar pesagem: tenta UPDATE direto, variantes sem colunas opcionais e RPC SECURITY DEFINER.
 */
export async function atualizarColetaAposPesagemControleMassa(
  supabase: SupabaseClient,
  coletaId: string,
  input: ColetaUpdateAposPesagem
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'Coleta inválida.' }

  const statusProcesso = (input.status_processo ?? 'EM_CONFERENCIA').trim() || 'EM_CONFERENCIA'

  const base: Record<string, unknown> = {
    peso_tara: input.peso_tara,
    peso_bruto: input.peso_bruto,
    peso_liquido: input.peso_liquido,
    tipo_residuo: input.tipo_residuo,
    placa: input.placa,
    motorista: input.motorista,
    fluxo_status: input.fluxo_status,
    etapa_operacional: input.etapa_operacional,
    status_processo: statusProcesso,
    liberado_financeiro: input.liberado_financeiro ?? false,
  }

  if (input.residuo_catalogo_id != null && input.residuo_catalogo_id !== '') {
    base.residuo_catalogo_id = input.residuo_catalogo_id
  }
  if (input.motorista_nome != null) {
    base.motorista_nome = input.motorista_nome
  }
  if (input.data_execucao) {
    base.data_execucao = input.data_execucao
    base.data_agendada = input.data_agendada ?? input.data_execucao
  }
  if (input.residuos_itens !== undefined) {
    base.residuos_itens = input.residuos_itens
  }

  const tentativas: Record<string, unknown>[] = [base]

  const semItens = { ...base }
  delete semItens.residuos_itens
  tentativas.push(semItens)

  const semStatus = { ...semItens }
  delete semStatus.status_processo
  delete semStatus.liberado_financeiro
  tentativas.push(semStatus)

  const minimo: Record<string, unknown> = {
    peso_tara: input.peso_tara,
    peso_bruto: input.peso_bruto,
    peso_liquido: input.peso_liquido,
    tipo_residuo: input.tipo_residuo,
    placa: input.placa,
    motorista: input.motorista,
    fluxo_status: input.fluxo_status,
    etapa_operacional: input.etapa_operacional,
  }
  tentativas.push(minimo)

  let ultimoErro: PostgrestError | null = null

  for (const payload of tentativas) {
    const res = await updateColetaDireto(supabase, id, payload)
    if (res.ok) return { ok: true }
    ultimoErro = res.error
    if (!isErroColunaResiduosItens(res.error) && !res.error.message?.toLowerCase().includes('row-level')) {
      break
    }
  }

  const rpc = await rpcAtualizarColetaAposPesagem(supabase, id, {
    ...input,
    status_processo: statusProcesso,
    liberado_financeiro: input.liberado_financeiro ?? false,
  })
  if (rpc.ok) return { ok: true }
  if (rpc.message) return { ok: false, message: rpc.message }

  return { ok: false, message: mensagemErroColetaLegivel(ultimoErro) }
}
