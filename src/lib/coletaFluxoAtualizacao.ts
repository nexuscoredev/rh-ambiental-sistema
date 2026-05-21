/**
 * Payloads canónicos para atualizar `public.coletas` ao mudar etapa do fluxo.
 * As telas devem preferir estas funções a objetos literais espalhados.
 */

/** Após emitir faturamento — aguarda NF e status Finalizado na esteira antes do Financeiro. */
export function payloadFaturamentoEmitidoAguardaFinalizacaoEsteira(opcoes?: {
  valorColeta?: number | null
}): {
  fluxo_status: 'FATURADO'
  etapa_operacional: 'FATURADO'
  liberado_financeiro: false
  status_processo: 'FATURAMENTO'
  valor_coleta?: number
} {
  const base = {
    fluxo_status: 'FATURADO' as const,
    etapa_operacional: 'FATURADO' as const,
    liberado_financeiro: false as const,
    status_processo: 'FATURAMENTO' as const,
  }
  const v = opcoes?.valorColeta
  if (v != null && Number.isFinite(Number(v))) {
    return { ...base, valor_coleta: Number(v) }
  }
  return base
}

/** Após NF enviada / esteira Finalizado — coleta entra em Contas a Receber (Financeiro). */
export function payloadFaturamentoEmitidoEnviaAoFinanceiro(opcoes?: {
  /** Valor da NF — replica em `coletas.valor_coleta` para a lista Financeiro. */
  valorColeta?: number | null
}): {
  fluxo_status: 'ENVIADO_FINANCEIRO'
  etapa_operacional: 'ENVIADO_FINANCEIRO'
  liberado_financeiro: true
  status_processo: 'FATURAMENTO'
  valor_coleta?: number
} {
  const base = {
    fluxo_status: 'ENVIADO_FINANCEIRO' as const,
    etapa_operacional: 'ENVIADO_FINANCEIRO' as const,
    liberado_financeiro: true as const,
    status_processo: 'FATURAMENTO' as const,
  }
  const v = opcoes?.valorColeta
  if (v != null && Number.isFinite(Number(v))) {
    return { ...base, valor_coleta: Number(v) }
  }
  return base
}
