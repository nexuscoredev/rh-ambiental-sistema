import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

/** Coluna opcional ausente no PostgREST (projeto remoto sem migração). */
export function faturamentoRegistrosErroColunaAusente(
  err: { code?: string; message?: string; details?: string } | null,
  coluna?: string
): boolean {
  if (!err) return false
  const t = `${err.message || ''} ${err.details || ''}`.toLowerCase()
  if (err.code === 'PGRST204') return true
  if (!t.includes('schema cache') && !t.includes('column')) return false
  if (!coluna) {
    return (
      t.includes('faturamento_registros') ||
      t.includes('observacoes') ||
      t.includes('valor_adicionais') ||
      t.includes('resumo_financeiro')
    )
  }
  const c = coluna.toLowerCase()
  return t.includes(c) || t.includes(`'${c}'`)
}

export function faturamentoRegistrosErroColunasOpcionais(err: PostgrestError | null): boolean {
  return faturamentoRegistrosErroColunaAusente(err)
}

export function faturamentoRegistrosErroResumoFinanceiro(
  err: { code?: string; message?: string; details?: string } | null
): boolean {
  return faturamentoRegistrosErroColunaAusente(err, 'resumo_financeiro')
}

export type PayloadsFaturamentoRegistro = {
  completo: Record<string, unknown>
  semObservacoes: Record<string, unknown>
  semAdicionais: Record<string, unknown>
  minimo: Record<string, unknown>
  soValor: Record<string, unknown>
}

export function montarPayloadsFaturamentoRegistro(input: {
  valor: number | null
  valorAdicionais?: number | null
  resumoFinanceiro?: Record<string, unknown> | null
  observacoes?: string | null
  status: string
  updatedAt: string
}): PayloadsFaturamentoRegistro {
  const base = { status: input.status, updated_at: input.updatedAt }
  const obs = (input.observacoes ?? '').trim() || null

  return {
    completo: {
      valor: input.valor,
      valor_adicionais: input.valorAdicionais ?? null,
      resumo_financeiro: input.resumoFinanceiro ?? null,
      observacoes: obs,
      ...base,
    },
    semObservacoes: {
      valor: input.valor,
      valor_adicionais: input.valorAdicionais ?? null,
      resumo_financeiro: input.resumoFinanceiro ?? null,
      ...base,
    },
    semAdicionais: {
      valor: input.valor,
      resumo_financeiro: input.resumoFinanceiro ?? null,
      ...base,
    },
    minimo: {
      valor: input.valor,
      resumo_financeiro: input.resumoFinanceiro ?? null,
      ...base,
    },
    soValor: {
      valor: input.valor,
      ...base,
    },
  }
}

const CADEIA_PAYLOAD: (keyof PayloadsFaturamentoRegistro)[] = [
  'completo',
  'semObservacoes',
  'semAdicionais',
  'minimo',
  'soValor',
]

export async function persistirFaturamentoRegistro(
  supabase: SupabaseClient,
  input: {
    coletaId: string
    registroId: string | null
    payloads: PayloadsFaturamentoRegistro
  }
): Promise<{ ok: true; id?: string } | { ok: false; message: string }> {
  let lastMessage = 'Falha ao gravar registro de faturamento.'

  for (const key of CADEIA_PAYLOAD) {
    const payload = input.payloads[key]
    const res = input.registroId
      ? await supabase.from('faturamento_registros').update(payload).eq('id', input.registroId)
      : await supabase
          .from('faturamento_registros')
          .insert({ coleta_id: input.coletaId, ...payload })
          .select('id')
          .single()

    if (!res.error) {
      const id =
        input.registroId ?? (res.data as { id?: string } | null | undefined)?.id ?? undefined
      return { ok: true, id }
    }

    lastMessage = res.error.message || lastMessage
    if (!faturamentoRegistrosErroColunaAusente(res.error)) {
      return { ok: false, message: lastMessage }
    }
  }

  return { ok: false, message: lastMessage }
}
