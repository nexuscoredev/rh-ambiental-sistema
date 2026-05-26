import { supabase } from './supabase'
import { mensagemErroSupabase } from './supabaseErrors'

export type MtrStatusCiclo = 'Rascunho' | 'Emitido' | 'Cancelado' | 'Baixada'

export function isMtrStatusCancelado(status: string | null | undefined): boolean {
  return String(status ?? '')
    .trim()
    .toLowerCase() === 'cancelado'
}

export type MtrRateioLinha = {
  coleta_id?: string | null
  cliente_coleta_id?: string | null
  cliente_cobranca_id: string
  percentual?: number | null
  valor?: number | null
  observacao?: string | null
}

export type CancelarMtrParams = {
  mtrId: string
  justificativa: string
  cobrarFrete?: boolean
  valorFrete?: number | null
  clienteCobrancaId?: string | null
}

export type BaixarMtrParams = {
  mtrId: string
  justificativa: string
  cenarioComplexo?: boolean
  rateio?: MtrRateioLinha[]
}

export type TicketHistoricoRow = {
  id: string
  coleta_id: string
  mtr_id: string | null
  ticket_snapshot: Record<string, unknown>
  motivo: string
  arquivado_em: string
  reativado_em: string | null
}

export type MtrCobrancaRateioRow = {
  id: string
  mtr_id: string
  coleta_id: string | null
  cliente_coleta_id: string | null
  cliente_cobranca_id: string
  percentual: number | null
  valor: number | null
  observacao: string | null
}

export type MtrCicloResult = { ok: true } | { ok: false; message: string }

function rpcIndisponivel(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = String(err.message ?? '').toLowerCase()
  if (code === '42883' || code === 'PGRST202') return true
  return msg.includes('could not find the function') || msg.includes('schema cache')
}

export async function cancelarMtrPorId(params: CancelarMtrParams): Promise<MtrCicloResult> {
  const just = params.justificativa.trim()
  if (!just) {
    return { ok: false, message: 'Informe a justificativa do cancelamento.' }
  }
  if (params.cobrarFrete) {
    const v = Number(params.valorFrete)
    if (!Number.isFinite(v) || v <= 0) {
      return { ok: false, message: 'Informe o valor do frete/custo operacional.' }
    }
    if (!params.clienteCobrancaId) {
      return { ok: false, message: 'Selecione o cliente a cobrar o frete.' }
    }
  }

  const { error } = await supabase.rpc('cancelar_mtr_por_id', {
    p_mtr_id: params.mtrId,
    p_justificativa: just,
    p_cobrar_frete: !!params.cobrarFrete,
    p_valor_frete: params.cobrarFrete ? Number(params.valorFrete) : null,
    p_cliente_cobranca_id: params.clienteCobrancaId ?? null,
  })

  if (!error) return { ok: true }
  if (rpcIndisponivel(error)) {
    return {
      ok: false,
      message:
        'Função cancelar_mtr_por_id não disponível. Aplique a migração 20260527120000_mtr_ciclo_vida_faturamento.sql no Supabase.',
    }
  }
  return { ok: false, message: mensagemErroSupabase(error, 'Não foi possível cancelar a MTR.') }
}

export async function baixarMtrPorId(params: BaixarMtrParams): Promise<MtrCicloResult> {
  const just = params.justificativa.trim()
  if (!just) {
    return { ok: false, message: 'Justificativa/observação é obrigatória para concluir a baixa.' }
  }

  if (params.cenarioComplexo && (params.rateio?.length ?? 0) > 0) {
    const somaPct = params.rateio!.reduce((s, r) => s + (Number(r.percentual) || 0), 0)
    if (somaPct > 0 && Math.abs(somaPct - 100) > 0.05) {
      return { ok: false, message: 'A soma dos percentuais do rateio deve ser 100%.' }
    }
  }

  const rateioJson = (params.rateio ?? []).map((r) => ({
    coleta_id: r.coleta_id ?? null,
    cliente_coleta_id: r.cliente_coleta_id ?? null,
    cliente_cobranca_id: r.cliente_cobranca_id,
    percentual: r.percentual ?? null,
    valor: r.valor ?? null,
    observacao: r.observacao ?? null,
  }))

  const { error } = await supabase.rpc('baixar_mtr_por_id', {
    p_mtr_id: params.mtrId,
    p_justificativa: just,
    p_cenario_complexo: !!params.cenarioComplexo,
    p_rateio: rateioJson,
  })

  if (!error) return { ok: true }
  if (rpcIndisponivel(error)) {
    return {
      ok: false,
      message:
        'Função baixar_mtr_por_id não disponível. Aplique a migração 20260527120000_mtr_ciclo_vida_faturamento.sql no Supabase.',
    }
  }
  return { ok: false, message: mensagemErroSupabase(error, 'Não foi possível baixar a MTR.') }
}

export async function reativarTicketHistorico(historicoId: string): Promise<MtrCicloResult & { ticketId?: string }> {
  const { data, error } = await supabase.rpc('reativar_ticket_historico', {
    p_historico_id: historicoId,
  })

  if (!error) return { ok: true, ticketId: String(data ?? '') }
  if (rpcIndisponivel(error)) {
    return {
      ok: false,
      message:
        'Função reativar_ticket_historico não disponível. Aplique a migração SQL no Supabase.',
    }
  }
  return { ok: false, message: mensagemErroSupabase(error, 'Não foi possível reativar o ticket.') }
}

export async function listarTicketsHistoricoMtr(mtrId: string): Promise<TicketHistoricoRow[]> {
  const { data, error } = await supabase
    .from('tickets_operacionais_historico')
    .select('id, coleta_id, mtr_id, ticket_snapshot, motivo, arquivado_em, reativado_em')
    .eq('mtr_id', mtrId)
    .is('reativado_em', null)
    .order('arquivado_em', { ascending: false })

  if (error) {
    console.warn('listarTicketsHistoricoMtr', error)
    return []
  }
  return (data ?? []) as TicketHistoricoRow[]
}

export async function listarRateioMtr(mtrId: string): Promise<MtrCobrancaRateioRow[]> {
  const { data, error } = await supabase
    .from('mtr_cobranca_rateio')
    .select('id, mtr_id, coleta_id, cliente_coleta_id, cliente_cobranca_id, percentual, valor, observacao')
    .eq('mtr_id', mtrId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('listarRateioMtr', error)
    return []
  }
  return (data ?? []) as MtrCobrancaRateioRow[]
}

export async function salvarRateioMtr(mtrId: string, linhas: MtrRateioLinha[]): Promise<MtrCicloResult> {
  const { error: delErr } = await supabase.from('mtr_cobranca_rateio').delete().eq('mtr_id', mtrId)
  if (delErr) {
    return { ok: false, message: mensagemErroSupabase(delErr, 'Erro ao limpar rateio anterior.') }
  }
  if (linhas.length === 0) return { ok: true }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const rows = linhas.map((r) => ({
    mtr_id: mtrId,
    coleta_id: r.coleta_id ?? null,
    cliente_coleta_id: r.cliente_coleta_id ?? null,
    cliente_cobranca_id: r.cliente_cobranca_id,
    percentual: r.percentual ?? null,
    valor: r.valor ?? null,
    observacao: r.observacao?.trim() || null,
    created_by: user?.id ?? null,
  }))

  const { error } = await supabase.from('mtr_cobranca_rateio').insert(rows)
  if (error) {
    return { ok: false, message: mensagemErroSupabase(error, 'Erro ao gravar rateio.') }
  }
  return { ok: true }
}
