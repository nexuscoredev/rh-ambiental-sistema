import { normalizarEtapaColeta, type EtapaFluxo } from './fluxoEtapas'

/**
 * Etapas de fluxo que entram na lista de cobrança (Financeiro).
 * `ENVIADO_FINANCEIRO` e `FINALIZADO`; não `FATURADO` (ainda na mala direta / NF pendente).
 */
export function etapaVisivelListaFinanceiro(etapa: EtapaFluxo): boolean {
  return etapa === 'FINALIZADO' || etapa === 'ENVIADO_FINANCEIRO'
}

/**
 * Linha entra na lista após envio ao financeiro: liberado, esteira liberada/finalizada,
 * NF na conta, etapa ENVIADO_FINANCEIRO/FINALIZADO, ou seeds de teste (observações).
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

  if (row.liberado_financeiro === true) return true

  const esteira = (row.faturamento_esteira_status ?? '').trim().toUpperCase()
  if (esteira === 'FINALIZADO' || esteira === 'LIBERADO_FINANCEIRO') return true

  if (row.conta_receber_nf_enviada_em) return true

  return etapaVisivelListaFinanceiro(
    normalizarEtapaColeta({
      fluxo_status: row.fluxo_status,
      etapa_operacional: row.etapa_operacional,
    })
  )
}

/**
 * Filtro PostgREST para `.or(...)`: coletas enviadas/liberadas para o Financeiro ou seeds de teste.
 */
export const COLETAS_OR_FINANCEIRO_QUERY = [
  'faturamento_esteira_status.eq.FINALIZADO',
  'faturamento_esteira_status.eq.LIBERADO_FINANCEIRO',
  'liberado_financeiro.eq.true',
  'fluxo_status.eq.FINALIZADO',
  'fluxo_status.eq.ENVIADO_FINANCEIRO',
  'etapa_operacional.eq.FINALIZADO',
  'etapa_operacional.eq.ENVIADO_FINANCEIRO',
  'coleta_observacoes.ilike.%HIST-200%',
  'coleta_observacoes.ilike.%SIM-50%',
  'coleta_observacoes.ilike.%FLUXO-20%',
].join(',')

export const FINANCEIRO_VW_RESUMO_MAX_PAGES = 8

/** Vencimento já passou e pagamento não está «Pago» (Dashboard / Financeiro). */
export function isVencidoFinanceiro(
  dataVencimento: string | null | undefined,
  statusPagamento: string | null | undefined
): boolean {
  const d = (dataVencimento ?? '').trim()
  if (!d) return false
  if ((statusPagamento ?? '').trim() === 'Pago') return false
  const vencimento = new Date(`${d}T23:59:59`)
  return vencimento < new Date()
}
