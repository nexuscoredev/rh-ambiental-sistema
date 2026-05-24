import { sugerirDataVencimentoIso } from '../services/financeiroReceber'
import { supabase } from './supabase'
import type { ClinicaFilaFaturamentoRow } from './clinicasTypes'

export async function listarFilaFaturamentoClinicas(): Promise<
  { ok: true; linhas: ClinicaFilaFaturamentoRow[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('vw_clinicas_faturamento_fila')
    .select('*')
    .order('os_created_at', { ascending: false })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('Could not find')) {
      return {
        ok: false,
        message:
          'Fila de clínicas não disponível. Aplique a migration 20260625140000_clinicas_modulo.sql no Supabase.',
      }
    }
    return { ok: false, message: msg }
  }

  return { ok: true, linhas: (data || []) as ClinicaFilaFaturamentoRow[] }
}

export async function salvarValorFaturamentoClinica(
  ordemId: string,
  valor: number,
  observacoes?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('salvar_clinica_faturamento_valor', {
    p_ordem_id: ordemId,
    p_valor: valor,
    p_observacoes: observacoes ?? null,
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export type EmitirClinicaInput = {
  ordemId: string
  valor: number
  dataVencimento?: string
  referenciaNf?: string | null
}

export async function emitirFaturamentoClinicaOs(
  input: EmitirClinicaInput
): Promise<{ ok: true; ordemId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('emitir_faturamento_clinica_os', {
    p_ordem_id: input.ordemId,
    p_valor: input.valor,
    p_data_vencimento: input.dataVencimento || sugerirDataVencimentoIso(7),
    p_referencia_nf: input.referenciaNf?.trim() || null,
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true, ordemId: String(data) }
}

export function parseValorClinicaInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function formatarMoedaClinica(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function exigeReferenciaNfNaEmissao(row: ClinicaFilaFaturamentoRow): boolean {
  return row.emite_nota_snapshot === true
}
