import type { SupabaseClient } from '@supabase/supabase-js'
import {
  alinharValorPagoComStatusUi,
  derivarStatusPagamento,
} from '../lib/contasReceberUtils'
import { payloadFaturamentoEmitidoEnviaAoFinanceiro } from '../lib/coletaFluxoAtualizacao'
import {
  parseResumoFinanceiroJson,
  totalResumoFinanceiro,
} from '../lib/faturamentoDesvinculacao'
import { marcarEsteiraFinalizadaPorNf } from '../lib/faturamentoEsteira'

type RegistroFaturamentoValor = {
  id: string
  valor: unknown
  valor_adicionais?: unknown
  resumo_financeiro?: unknown
  observacoes?: string | null
  status?: string | null
}

function valorNumericoPositivo(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? v : 0
}

/** Mesma regra da emissão na esteira: coluna `valor`, senão total do `resumo_financeiro`. */
export function valorTotalDoRegistroFaturamento(reg: {
  valor: unknown
  valor_adicionais?: unknown
  resumo_financeiro?: unknown
}): number {
  const vColuna = valorNumericoPositivo(reg.valor)
  if (vColuna > 0) return vColuna
  const resumo = parseResumoFinanceiroJson(reg.resumo_financeiro)
  if (resumo) {
    const t = totalResumoFinanceiro(resumo)
    if (t > 0) return t
  }
  return 0
}

async function resolverValorCobrancaColeta(
  supabase: SupabaseClient,
  coletaId: string,
  coleta: {
    valor_coleta: unknown
    mtr_id?: string | null
  }
): Promise<{ valor: number; regFat: RegistroFaturamentoValor | null; jaEmitido: boolean }> {
  const { data: cr } = await supabase
    .from('contas_receber')
    .select('valor, faturamento_registro_id')
    .eq('referencia_coleta_id', coletaId)
    .maybeSingle()

  const valorConta = valorNumericoPositivo(cr?.valor)
  if (valorConta > 0) {
    return {
      valor: valorConta,
      regFat: cr?.faturamento_registro_id
        ? { id: cr.faturamento_registro_id as string, valor: valorConta }
        : null,
      jaEmitido: true,
    }
  }

  const { data: registros } = await supabase
    .from('faturamento_registros')
    .select('id, valor, valor_adicionais, resumo_financeiro, observacoes, status')
    .eq('coleta_id', coletaId)
    .in('status', ['emitido', 'pendente'])
    .order('updated_at', { ascending: false })
    .limit(5)

  let jaEmitido = false
  for (const reg of registros ?? []) {
    if (reg.status === 'emitido') jaEmitido = true
    const v = valorTotalDoRegistroFaturamento(reg)
    if (v > 0) {
      return { valor: v, regFat: reg as RegistroFaturamentoValor, jaEmitido }
    }
  }

  const valorColeta = valorNumericoPositivo(coleta.valor_coleta)
  if (valorColeta > 0) {
    const emitido = (registros ?? []).find((r) => r.status === 'emitido')
    return {
      valor: valorColeta,
      regFat: (emitido ?? registros?.[0] ?? null) as RegistroFaturamentoValor | null,
      jaEmitido: jaEmitido || !!emitido,
    }
  }

  const mtrId = (coleta.mtr_id ?? '').trim()
  if (mtrId) {
    const { data: coletasMtr } = await supabase.from('coletas').select('id').eq('mtr_id', mtrId)
    const idsIrmas = (coletasMtr ?? []).map((c) => c.id).filter((id) => id && id !== coletaId)
    if (idsIrmas.length > 0) {
      const { data: regsMtr } = await supabase
        .from('faturamento_registros')
        .select('id, valor, valor_adicionais, resumo_financeiro, observacoes, status')
        .in('coleta_id', idsIrmas)
        .eq('status', 'emitido')
        .order('updated_at', { ascending: false })
        .limit(10)

      for (const reg of regsMtr ?? []) {
        jaEmitido = true
        const v = valorTotalDoRegistroFaturamento(reg)
        if (v > 0) {
          return { valor: v, regFat: reg as RegistroFaturamentoValor, jaEmitido: true }
        }
      }
    }
  }

  const emitido = (registros ?? []).find((r) => r.status === 'emitido')
  return {
    valor: 0,
    regFat: (emitido ?? null) as RegistroFaturamentoValor | null,
    jaEmitido: jaEmitido || !!emitido,
  }
}

export type UpsertContaReceberInput = {
  cliente_id: string | null
  valor: number
  data_emissao: string
  data_vencimento: string | null
  referencia_coleta_id: string
  faturamento_registro_id?: string | null
  observacoes?: string | null
  origem: 'faturamento' | 'financeiro'
  /** Só financeiro: permite alterar `valor` com conta travada (administrador). */
  permitirAlterarValorTravado?: boolean
  /** Só financeiro: status de pagamento escolhido na UI (coleta). */
  status_pagamento_ui?: string | null | ''
  usuario_id_auditoria?: string | null
}

function ignoraErroSchema(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const msg = `${err.message}`.toLowerCase()
  return msg.includes('relation') || err.code === '42P01' || msg.includes('column')
}

function avisoIgnoraErroSchema(contexto: string, err: { message?: string; code?: string } | null): void {
  if (!err || !ignoraErroSchema(err)) return
  console.warn(
    `[financeiroReceber] ${contexto}: operação ignorada (possível migração/schema em falta)`,
    err.code ?? '',
    err.message ?? ''
  )
}

export async function registrarAuditoriaFinanceiro(
  supabase: SupabaseClient,
  input: {
    entidade: string
    entidade_id: string
    usuario_id: string | null
    acao: string
    detalhe?: Record<string, unknown> | null
  }
): Promise<void> {
  const { error } = await supabase.from('financeiro_auditoria').insert({
    entidade: input.entidade,
    entidade_id: input.entidade_id,
    usuario_id: input.usuario_id,
    acao: input.acao,
    detalhe: input.detalhe ?? null,
  })
  if (error) {
    if (ignoraErroSchema(error)) {
      avisoIgnoraErroSchema('registrarAuditoriaFinanceiro', error)
    } else {
      console.warn('Auditoria financeiro:', error.message)
    }
  }
}

/** Upsert por `referencia_coleta_id`. Respeita trava de valor (Fase 9). */
export async function upsertContaReceber(
  supabase: SupabaseClient,
  input: UpsertContaReceberInput
): Promise<{ error: Error | null }> {
  try {
    const { data: prev, error: errPrev } = await supabase
      .from('contas_receber')
      .select('id, status_pagamento, valor, valor_pago, valor_travado, faturamento_registro_id')
      .eq('referencia_coleta_id', input.referencia_coleta_id)
      .maybeSingle()

    if (errPrev && errPrev.code !== 'PGRST116') {
      if (ignoraErroSchema(errPrev)) {
        avisoIgnoraErroSchema('upsertContaReceber.select(prev)', errPrev)
      } else {
        return { error: new Error(errPrev.message) }
      }
    }

    const agora = new Date().toISOString()
    const valorNovo = Number(input.valor)

    const prevValor = prev ? Number(prev.valor) : 0
    const prevPago = prev ? Number(prev.valor_pago) || 0 : 0
    const travado = prev ? !!prev.valor_travado : false
    const permitir = input.permitirAlterarValorTravado === true

    if (input.origem === 'faturamento') {
      if (!Number.isFinite(valorNovo) || valorNovo <= 0) {
        return { error: new Error('Valor inválido para faturamento.') }
      }
      const valorPago = Math.min(prevPago, valorNovo)
      const st = derivarStatusPagamento(valorNovo, valorPago)
      const row = {
        cliente_id: input.cliente_id,
        valor: valorNovo,
        valor_pago: valorPago,
        valor_travado: true,
        data_emissao: input.data_emissao,
        data_vencimento: input.data_vencimento || null,
        status_pagamento: st,
        referencia_coleta_id: input.referencia_coleta_id,
        faturamento_registro_id: input.faturamento_registro_id ?? null,
        observacoes: input.observacoes ?? null,
        updated_at: agora,
      }
      const { error } = await supabase.from('contas_receber').upsert(row, {
        onConflict: 'referencia_coleta_id',
      })
      if (error) {
        if (ignoraErroSchema(error)) avisoIgnoraErroSchema('upsertContaReceber.upsert(faturamento)', error)
        else return { error: new Error(error.message) }
      }
      return { error: null }
    }

    if (!prev) {
      if (!Number.isFinite(valorNovo) || valorNovo <= 0) return { error: null }
      const { valorPago, status } = alinharValorPagoComStatusUi(
        valorNovo,
        0,
        input.status_pagamento_ui || ''
      )
      const row = {
        cliente_id: input.cliente_id,
        valor: valorNovo,
        valor_pago: valorPago,
        valor_travado: false,
        data_emissao: input.data_emissao,
        data_vencimento: input.data_vencimento || null,
        status_pagamento: status,
        referencia_coleta_id: input.referencia_coleta_id,
        observacoes: input.observacoes ?? null,
        updated_at: agora,
      }
      const { error } = await supabase.from('contas_receber').upsert(row, {
        onConflict: 'referencia_coleta_id',
      })
      if (error) {
        if (ignoraErroSchema(error)) avisoIgnoraErroSchema('upsertContaReceber.upsert(sem_prev)', error)
        else return { error: new Error(error.message) }
      }
      return { error: null }
    }

    const patchSemAlterarValor =
      (travado && !permitir) || (!travado && valorNovo <= 0)

    if (patchSemAlterarValor) {
      const { valorPago, status } = alinharValorPagoComStatusUi(
        prevValor,
        prevPago,
        input.status_pagamento_ui || ''
      )
      const { error } = await supabase
        .from('contas_receber')
        .update({
          cliente_id: input.cliente_id,
          data_vencimento: input.data_vencimento || null,
          observacoes: input.observacoes ?? null,
          valor_pago: valorPago,
          status_pagamento: status,
          updated_at: agora,
        })
        .eq('referencia_coleta_id', input.referencia_coleta_id)
      if (error) {
        if (ignoraErroSchema(error)) avisoIgnoraErroSchema('upsertContaReceber.update(patch_sem_valor)', error)
        else return { error: new Error(error.message) }
      }
      return { error: null }
    }

    if (!Number.isFinite(valorNovo) || valorNovo < 0) {
      return { error: new Error('Valor inválido.') }
    }

    if (travado && permitir && prevValor !== valorNovo) {
      void registrarAuditoriaFinanceiro(supabase, {
        entidade: 'contas_receber',
        entidade_id: prev.id,
        usuario_id: input.usuario_id_auditoria ?? null,
        acao: 'valor_alterado_travado',
        detalhe: { de: prevValor, para: valorNovo, coleta: input.referencia_coleta_id },
      })
    }

    const { valorPago, status } = alinharValorPagoComStatusUi(
      valorNovo,
      prevPago,
      input.status_pagamento_ui || ''
    )

    const frId =
      input.faturamento_registro_id !== undefined && input.faturamento_registro_id !== null
        ? input.faturamento_registro_id
        : (prev as { faturamento_registro_id?: string | null } | null)?.faturamento_registro_id ??
          null

    const row = {
      cliente_id: input.cliente_id,
      valor: valorNovo,
      valor_pago: valorPago,
      valor_travado: travado,
      data_emissao: input.data_emissao,
      data_vencimento: input.data_vencimento || null,
      status_pagamento: status,
      referencia_coleta_id: input.referencia_coleta_id,
      faturamento_registro_id: frId,
      observacoes: input.observacoes ?? null,
      updated_at: agora,
    }

    const { error } = await supabase.from('contas_receber').upsert(row, {
      onConflict: 'referencia_coleta_id',
    })
    if (error) {
      if (ignoraErroSchema(error)) avisoIgnoraErroSchema('upsertContaReceber.upsert(final)', error)
      else return { error: new Error(error.message) }
    }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export function sugerirDataVencimentoIso(dias = 7): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Cria/atualiza conta a receber e libera a coleta para o Financeiro.
 * Chamado ao registar envio de NF (status esteira Finalizado).
 */
export async function liberarColetaParaFinanceiroContasReceber(
  supabase: SupabaseClient,
  coletaId: string
): Promise<{ error: Error | null }> {
  try {
    const { data: coleta, error: errColeta } = await supabase
      .from('coletas')
      .select('id, cliente_id, valor_coleta, data_vencimento, liberado_financeiro, mtr_id')
      .eq('id', coletaId)
      .maybeSingle()

    if (errColeta) return { error: new Error(errColeta.message) }
    if (!coleta) return { error: new Error('Coleta não encontrada.') }

    const { valor, regFat, jaEmitido } = await resolverValorCobrancaColeta(supabase, coletaId, coleta)

    if (valor <= 0) {
      return {
        error: new Error(
          jaEmitido
            ? 'O faturamento está emitido, mas o valor total não foi encontrado no registo (coluna valor ou resumo financeiro). Reabra «Ajuste de valores», guarde os totais e volte a faturar, ou contacte o suporte.'
            : 'Valor do faturamento ausente. Emita o faturamento na esteira antes de confirmar o envio da NF.'
        ),
      }
    }

    const hojeIso = new Date().toISOString().slice(0, 10)
    const { error: crErr } = await upsertContaReceber(supabase, {
      cliente_id: (coleta.cliente_id as string | null) ?? null,
      valor,
      data_emissao: hojeIso,
      data_vencimento: (coleta.data_vencimento as string | null)?.trim() || null,
      referencia_coleta_id: coletaId,
      faturamento_registro_id: regFat?.id ?? undefined,
      observacoes: (regFat?.observacoes ?? '').trim() || null,
      origem: 'faturamento',
    })
    if (crErr) return { error: crErr }

    if (!coleta.liberado_financeiro) {
      const { error: updErr } = await supabase
        .from('coletas')
        .update(payloadFaturamentoEmitidoEnviaAoFinanceiro({ valorColeta: valor }))
        .eq('id', coletaId)
      if (updErr) return { error: new Error(updErr.message) }
    }

    await marcarEsteiraFinalizadaPorNf(coletaId)
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) }
  }
}

/** Marca envio de NF na conta a receber e libera a coleta para Contas a Receber. */
export async function registrarEnvioNfContaReceber(
  supabase: SupabaseClient,
  input: {
    referencia_coleta_id: string
    modo: string
    observacaoUsuario?: string | null
    nf_envio_log_id?: string | null
  }
): Promise<{ error: Error | null }> {
  try {
    const liberar = await liberarColetaParaFinanceiroContasReceber(
      supabase,
      input.referencia_coleta_id
    )
    if (liberar.error) return liberar

    const agora = new Date().toISOString()
    const partes = [
      input.observacaoUsuario?.trim() || null,
      `Envio NF (${String(input.modo || '').trim() || '—'})`,
      input.nf_envio_log_id ? `log ${input.nf_envio_log_id.slice(0, 8)}…` : null,
    ].filter(Boolean)
    const obs = partes.join(' · ').slice(0, 500)

    const { error } = await supabase
      .from('contas_receber')
      .update({
        nf_enviada_em: agora,
        nf_envio_observacao: obs || null,
        nf_envio_log_id: input.nf_envio_log_id ?? null,
        updated_at: agora,
      })
      .eq('referencia_coleta_id', input.referencia_coleta_id)

    if (error) {
      if (ignoraErroSchema(error)) {
        avisoIgnoraErroSchema('registrarEnvioNfContaReceber', error)
        return { error: null }
      }
      return { error: new Error(error.message) }
    }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) }
  }
}

const OBS_NF_BOLETO_PADRAO =
  'NF e boleto enviados ao cliente (confirmado na esteira de faturamento).'

/**
 * Etapa 7 da esteira: grava número da NF (e opcionalmente boleto/ref.), cria/atualiza Contas a Receber e finaliza.
 */
export async function registarNumeroNfBoletoEsteiraFaturamento(
  supabase: SupabaseClient,
  input: {
    referencia_coleta_id: string
    numero_nf: string
    numero_boleto?: string | null
    observacao?: string | null
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const coletaId = input.referencia_coleta_id.trim()
  const numeroNf = input.numero_nf.trim()
  if (!coletaId) return { ok: false, message: 'Coleta inválida.' }
  if (!numeroNf) return { ok: false, message: 'Informe o número da NF.' }

  const boleto = (input.numero_boleto ?? '').trim()
  const obsExtra = (input.observacao ?? '').trim()
  const obsEsteira = [
    `NF ${numeroNf}`,
    boleto ? `Boleto/ref. ${boleto}` : null,
    obsExtra || null,
  ]
    .filter(Boolean)
    .join(' · ')

  const { error: errColeta } = await supabase
    .from('coletas')
    .update({ numero_nf: numeroNf })
    .eq('id', coletaId)

  if (errColeta) {
    return { ok: false, message: errColeta.message || 'Não foi possível gravar o número da NF na coleta.' }
  }

  const { data: regEmitido } = await supabase
    .from('faturamento_registros')
    .select('id')
    .eq('coleta_id', coletaId)
    .eq('status', 'emitido')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (regEmitido?.id) {
    const { error: errReg } = await supabase
      .from('faturamento_registros')
      .update({
        referencia_nf: numeroNf,
        updated_at: new Date().toISOString(),
      })
      .eq('id', regEmitido.id)
    if (errReg && !ignoraErroSchema(errReg)) {
      console.warn('faturamento_registros.referencia_nf:', errReg.message)
    }
  }

  const lib = await liberarColetaParaFinanceiroContasReceber(supabase, coletaId)
  if (lib.error) {
    return { ok: false, message: lib.error.message }
  }

  const reg = await registrarEnvioNfContaReceber(supabase, {
    referencia_coleta_id: coletaId,
    modo: 'esteira_registo_nf',
    observacaoUsuario: obsEsteira || `NF ${numeroNf}`,
  })
  if (reg.error) {
    return { ok: false, message: reg.error.message }
  }

  return { ok: true }
}

/**
 * Confirma envio de NF e boleto ao cliente → esteira Finalizado e Contas a Receber.
 * Use após Envio de NF ou quando o envio foi feito fora do sistema.
 */
export async function confirmarNfBoletoEnviadosAoCliente(
  supabase: SupabaseClient,
  coletaIds: string[],
  observacao?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) {
    return { ok: false, message: 'Selecione ao menos uma coleta.' }
  }

  const obs = (observacao ?? '').trim() || OBS_NF_BOLETO_PADRAO

  for (const coletaId of ids) {
    const lib = await liberarColetaParaFinanceiroContasReceber(supabase, coletaId)
    if (lib.error) {
      return { ok: false, message: lib.error.message }
    }

    const reg = await registrarEnvioNfContaReceber(supabase, {
      referencia_coleta_id: coletaId,
      modo: 'esteira_confirmacao',
      observacaoUsuario: obs,
    })
    if (reg.error) {
      return { ok: false, message: reg.error.message }
    }
  }

  return { ok: true }
}

export async function registrarBaixaContaReceber(
  supabase: SupabaseClient,
  input: {
    referencia_coleta_id: string
    valor_baixa: number
    observacao?: string | null
    usuario_id: string | null
  }
): Promise<{ error: Error | null }> {
  try {
    const vb = Number(input.valor_baixa)
    if (!Number.isFinite(vb) || vb <= 0) return { error: new Error('Valor de baixa inválido.') }

    const { data: conta, error: e0 } = await supabase
      .from('contas_receber')
      .select('id, valor, valor_pago, status_pagamento')
      .eq('referencia_coleta_id', input.referencia_coleta_id)
      .maybeSingle()

    if (e0) {
      if (ignoraErroSchema(e0)) avisoIgnoraErroSchema('registrarBaixaContaReceber.select', e0)
      else return { error: new Error(e0.message) }
    }
    if (!conta) return { error: new Error('Conta a receber não encontrada para esta coleta.') }

    const vtot = Number(conta.valor) || 0
    const vp0 = Number(conta.valor_pago) || 0
    const saldo = Math.max(0, vtot - vp0)
    const add = Math.min(vb, saldo)
    if (add <= 0) return { error: new Error('Sem saldo para nova baixa.') }

    const { error: e1 } = await supabase.from('contas_receber_baixas').insert({
      conta_receber_id: conta.id,
      valor: add,
      observacao: input.observacao?.trim() || null,
      created_by: input.usuario_id,
    })
    if (e1) {
      if (ignoraErroSchema(e1)) avisoIgnoraErroSchema('registrarBaixaContaReceber.insert(baixa)', e1)
      else return { error: new Error(e1.message) }
    }

    const vp1 = vp0 + add
    const st = derivarStatusPagamento(vtot, vp1)

    const { error: e2 } = await supabase
      .from('contas_receber')
      .update({
        valor_pago: vp1,
        status_pagamento: st,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conta.id)

    if (e2) {
      if (ignoraErroSchema(e2)) avisoIgnoraErroSchema('registrarBaixaContaReceber.update(conta)', e2)
      else return { error: new Error(e2.message) }
    }

    void registrarAuditoriaFinanceiro(supabase, {
      entidade: 'contas_receber',
      entidade_id: conta.id,
      usuario_id: input.usuario_id,
      acao: 'baixa',
      detalhe: {
        referencia_coleta_id: input.referencia_coleta_id,
        valor: add,
        valor_pago_novo: vp1,
        status: st,
      },
    })

    const patchColeta: Record<string, unknown> = {
      status_pagamento: st,
    }
    if (st === 'Pago') {
      patchColeta.etapa_operacional = 'FINALIZADO'
      patchColeta.fluxo_status = 'FINALIZADO'
      patchColeta.status_processo = 'FINALIZADO'
      patchColeta.liberado_financeiro = true
    }

    await supabase.from('coletas').update(patchColeta).eq('id', input.referencia_coleta_id)

    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) }
  }
}
