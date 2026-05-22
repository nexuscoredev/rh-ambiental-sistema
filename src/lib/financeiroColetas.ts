import { normalizarEtapaColeta, type EtapaFluxo } from './fluxoEtapas'

/**
 * Etapas de fluxo que entram na lista de cobrança (Financeiro).
 * Só `FINALIZADO` — após NF / esteira finalizada (não `FATURADO` nem `ENVIADO_FINANCEIRO` sozinhos).
 */
export function etapaVisivelListaFinanceiro(etapa: EtapaFluxo): boolean {
  return etapa === 'FINALIZADO'
}

/**
 * Mesmo critério da UI: linha entra na lista após esteira Finalizado, NF registada na conta,
 * etapa FINALIZADO no fluxo, ou seeds de teste (observações).
 */
export function coletaVisivelListaFinanceiro(row: {
  fluxo_status?: string | null
  etapa_operacional?: string | null
  liberado_financeiro?: boolean | null
  faturamento_esteira_status?: string | null
  conta_receber_nf_enviada_em?: string | null
  /** Vista `vw_faturamento_resumo`; em `coletas` cru usa-se `observacoes`. */
  coleta_observacoes?: string | null
  observacoes?: string | null
}): boolean {
  const obs = (row.coleta_observacoes ?? row.observacoes ?? '').toUpperCase()
  if (obs.includes('HIST-200') || obs.includes('SIM-50') || obs.includes('FLUXO-20')) return true

  const esteira = (row.faturamento_esteira_status ?? '').trim().toUpperCase()
  if (esteira === 'FINALIZADO') return true

  if (row.conta_receber_nf_enviada_em) return true

  return etapaVisivelListaFinanceiro(
    normalizarEtapaColeta({
      fluxo_status: row.fluxo_status,
      etapa_operacional: row.etapa_operacional,
    })
  )
}

/**
 * Filtro PostgREST para `.or(...)`: esteira finalizada, etapa FINALIZADO ou seeds de teste.
 */
export const COLETAS_OR_FINANCEIRO_QUERY = [
  'faturamento_esteira_status.eq.FINALIZADO',
  'fluxo_status.eq.FINALIZADO',
  'etapa_operacional.eq.FINALIZADO',
  'coleta_observacoes.ilike.%HIST-200%',
  'coleta_observacoes.ilike.%SIM-50%',
  'coleta_observacoes.ilike.%FLUXO-20%',
].join(',')

/**
 * Teto de páginas ao carregar `vw_faturamento_resumo` no Financeiro (filtro `.or` já restringe no servidor).
 * Evita varrer o escopo «completo» (20×1000 linhas).
 */
export const FINANCEIRO_VW_RESUMO_MAX_PAGES = 8

/** Vencimento já passou e pagamento não está «Pago» (Dashboard / Financeiro). */
export function isVencidoFinanceiro(
  dataVencimento: string | null | undefined,
  statusPagamento: string | null | undefined
): boolean {
  const d = (dataVencimento ?? '').trim()
  if (!d) return false
  const st = (statusPagamento ?? '').trim()
  if (st === 'Pago' || st === 'Cancelado') return false
  const vencimento = new Date(`${d}T23:59:59`)
  return vencimento < new Date()
}

/** Campos mínimos de `contas_receber` para KPIs do dashboard (prioridade sobre `coletas`). */
export type ContaReceberResumoColeta = {
  data_vencimento?: string | null
  status_pagamento?: string | null
  valor?: number | string | null
  valor_pago?: number | string | null
}

/** Saldo em aberto: conta a receber (valor − pago) ou valor da coleta. */
export function saldoAbertoFinanceiro(
  valorColeta: number | string | null | undefined,
  conta?: ContaReceberResumoColeta | null
): number {
  if (conta) {
    const v = Number(conta.valor)
    const p = Number(conta.valor_pago ?? 0)
    if (Number.isFinite(v) && v > 0) {
      const pago = Number.isFinite(p) ? Math.max(0, p) : 0
      return Math.max(0, v - pago)
    }
  }
  const vc = Number(valorColeta ?? 0)
  return Number.isFinite(vc) && vc > 0 ? vc : 0
}

/** Dados de cobrança alinhados ao Financeiro (conta a receber sobrepõe a coleta). */
export function dadosCobrancaColeta(
  coleta: {
    data_vencimento?: string | null
    status_pagamento?: string | null
    valor_coleta?: number | string | null
  },
  conta?: ContaReceberResumoColeta | null
): {
  dataVencimento: string | null
  statusPagamento: string | null
  saldoAberto: number
} {
  const dataVencimento =
    (conta?.data_vencimento ?? coleta.data_vencimento ?? '').trim() || null
  const statusPagamento =
    (conta?.status_pagamento ?? coleta.status_pagamento ?? '').trim() || null
  return {
    dataVencimento,
    statusPagamento,
    saldoAberto: saldoAbertoFinanceiro(coleta.valor_coleta, conta),
  }
}
