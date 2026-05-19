import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { mensagemErroSupabase } from './supabaseErrors'

export type ExcluirOperacionalResult = { ok: true } | { ok: false; message: string }

function rpcNaoDisponivel(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = String(err.message ?? '').toLowerCase()
  if (code === '42883' || code === 'PGRST202') return true
  return msg.includes('could not find the function') || msg.includes('schema cache')
}

/** Fallback quando a RPC ainda não foi aplicada no Supabase. */
async function excluirDependenciasColetaClient(
  client: SupabaseClient,
  coletaIds: string[]
): Promise<ExcluirOperacionalResult> {
  if (coletaIds.length === 0) return { ok: true }

  const inList = `(${coletaIds.join(',')})`

  const deletes = async (table: string, column: string) => {
    const { error } = await client.from(table).delete().in(column, coletaIds)
    if (error) throw error
  }

  try {
    await client.from('programacoes').update({ coleta_id: null }).in('coleta_id', coletaIds)
    await deletes('contas_receber', 'referencia_coleta_id')
    await deletes('faturamento_registros', 'coleta_id')
    await deletes('financeiro_documentos', 'coleta_id')
    await deletes('checklist_transporte', 'coleta_id')
    await deletes('conferencia_transporte', 'coleta_id')
    await deletes('tickets_operacionais', 'coleta_id')
    await deletes('conferencia_operacional', 'coleta_id')
    await deletes('aprovacoes_diretoria', 'coleta_id')
    await deletes('controle_massa', 'coleta_id')
    await client
      .from('comprovantes_descarte')
      .update({ coleta_id: null, controle_massa_id: null })
      .in('coleta_id', coletaIds)
    await deletes('coletas', 'id')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: mensagemErroSupabase(err, `Falha ao excluir dependências da coleta ${inList}`),
    }
  }
}

export async function listarColetaIdsPorMtr(
  client: SupabaseClient,
  mtrId: string
): Promise<string[]> {
  const { data, error } = await client.from('coletas').select('id').eq('mtr_id', mtrId)
  if (error) {
    console.error(error)
    return []
  }
  return (data ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean)
}

export async function excluirColetaPorId(
  coletaId: string,
  client: SupabaseClient = supabase
): Promise<ExcluirOperacionalResult> {
  const { error } = await client.rpc('excluir_coleta_por_id', { p_coleta_id: coletaId })
  if (!error) return { ok: true }
  if (!rpcNaoDisponivel(error)) {
    return { ok: false, message: mensagemErroSupabase(error, 'Não foi possível excluir a coleta.') }
  }
  return excluirDependenciasColetaClient(client, [coletaId])
}

export async function excluirMtrPorId(
  mtrId: string,
  client: SupabaseClient = supabase
): Promise<ExcluirOperacionalResult> {
  const { error } = await client.rpc('excluir_mtr_por_id', { p_mtr_id: mtrId })
  if (!error) return { ok: true }
  if (!rpcNaoDisponivel(error)) {
    return { ok: false, message: mensagemErroSupabase(error, 'Não foi possível excluir a MTR.') }
  }

  const coletaIds = await listarColetaIdsPorMtr(client, mtrId)
  const dep = await excluirDependenciasColetaClient(client, coletaIds)
  if (!dep.ok) return dep

  const { data: mtrRow } = await client.from('mtrs').select('programacao_id').eq('id', mtrId).maybeSingle()
  await client.from('comprovantes_descarte').update({ mtr_id: null }).eq('mtr_id', mtrId)
  const { error: delErr } = await client.from('mtrs').delete().eq('id', mtrId)
  if (delErr) {
    return { ok: false, message: mensagemErroSupabase(delErr, 'Não foi possível excluir a MTR.') }
  }

  const progId = (mtrRow as { programacao_id?: string | null } | null)?.programacao_id
  if (progId) {
    await client.from('programacoes').update({ status_programacao: 'PENDENTE' }).eq('id', progId)
  }

  return { ok: true }
}
