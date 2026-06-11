import {
  formatarEtapaParaUI,
  formatarFaseFluxoOficialParaUI,
  normalizarEtapaColeta,
} from './fluxoEtapas'

export type StatusPagamentoFinanceiro = 'Pendente' | 'Parcial' | 'Pago'

/** Parâmetros de URL para abrir programação / MTR / controle de massa no contexto da coleta. */
export function montarParamsFluxoColeta(
  row: Pick<FaturamentoResumoViewRow, 'coleta_id' | 'mtr_id' | 'programacao_id' | 'cliente_id'>
): URLSearchParams {
  const p = new URLSearchParams()
  p.set('coleta', row.coleta_id)
  if (row.mtr_id) p.set('mtr', row.mtr_id)
  if (row.programacao_id) p.set('programacao', row.programacao_id)
  if (row.cliente_id) p.set('cliente', row.cliente_id)
  return p
}

/** Linha de `vw_faturamento_resumo` (Supabase). */
export type FaturamentoResumoViewRow = {
  coleta_id: string
  numero: string
  numero_coleta: number | null
  cliente_id: string | null
  cliente_nome: string | null
  cliente_razao_social: string | null
  /** Margem de lucro alvo do cliente (%, da tabela clientes). */
  cliente_margem_lucro_percentual?: number | null
  data_agendada: string
  data_programacao: string | null
  data_execucao: string | null
  programacao_id: string | null
  programacao_numero: string | null
  programacao_observacoes: string | null
  mtr_id: string | null
  mtr_numero: string | null
  mtr_observacoes: string | null
  mtr_status?: string | null
  mtr_cancelamento_cobrar_frete?: boolean | null
  mtr_cancelamento_valor_frete?: number | null
  mtr_baixa_cenario_complexo?: boolean | null
  mtr_baixa_justificativa?: string | null
  ticket_comprovante: string | null
  peso_tara: number | null
  peso_bruto: number | null
  peso_liquido: number | null
  motorista: string | null
  placa: string | null
  valor_coleta: number | null
  status_pagamento: string | null
  data_vencimento: string | null
  referencia_nf: string | null
  numero_nf_coleta: string | null
  faturamento_referencia_nf: string | null
  faturamento_registro_status: string | null
  faturamento_registro_valor: number | null
  confirmacao_recebimento: boolean | null
  fluxo_status: string | null
  etapa_operacional: string | null
  status_processo: string | null
  liberado_financeiro: boolean | null
  coleta_observacoes: string | null
  tipo_residuo: string
  /** Itens estruturados da pesagem (`coletas.residuos_itens`), quando expostos na view. */
  residuos_itens?: unknown
  cidade: string
  created_at: string
  ticket_impresso_em?: string | null
  faturamento_ticket_aprovado_em?: string | null
  faturamento_ticket_aprovacao_obs?: string | null
  faturamento_esteira_status?: string | null
  medicao_relatorio_gerado_em?: string | null
  medicao_email_enviado_em?: string | null
  medicao_cliente_aprovado_em?: string | null
  medicao_cliente_aprovacao_obs?: string | null
  faturamento_relatorio_cliente_em?: string | null
  cliente_email_nf?: string | null
  ultima_aprovacao_decisao: string | null
  ultima_aprovacao_obs: string | null
  ultima_aprovacao_em: string | null
  conferencia_documentos_ok: boolean | null
  conferencia_operacional_obs: string | null
  conferencia_em: string | null
  status_conferencia: string | null
  pendencias_resumo: string | null
  /** SLA: coleta criada há >3 dias sem faturamento emitido / envio ao financeiro (view). */
  faturamento_sla_vencido?: boolean | null
  status_faturamento: string | null
  /** Preenchido quando existe linha em `contas_receber` (migração Fase 8). */
  conta_receber_nf_enviada_em?: string | null
  conta_receber_nf_envio_obs?: string | null
  conta_receber_valor_pago?: number | null
  conta_receber_valor_travado?: boolean | null
}

/**
 * Item da lista Financeiro — inclui snapshot operacional para conferência e detalhe.
 * Mantém compatibilidade com campos já usados em `Financeiro.tsx` (valor, NF, pagamento).
 */
export type FinanceiroListaItem = {
  id: string
  numero: string
  cliente: string
  dataAgendada: string
  tipoResiduo: string
  cidade: string
  /** Detalhe técnico (etapa canónica) para quem precisa do granular. */
  etapaOperacional: string
  /** Fase de negócio única em todo o sistema (Fase 1 — fluxo oficial). */
  faseFluxoOficial: string
  liberadoFinanceiro: boolean
  valorColeta: string
  statusPagamento: StatusPagamentoFinanceiro | ''
  dataVencimento: string
  pesoLiquido: string
  createdAt: string
  mtrId: string
  programacaoId: string
  clienteId: string
  numeroNf: string
  numeroBoleto: string
  confirmacaoRecebimento: boolean
  statusConferencia: 'PRONTO_PARA_FATURAR' | 'PENDENTE'
  pendenciasResumo: string
  observacoesColeta: string
  mtrNumero: string
  programacaoNumero: string
  programacaoObs: string
  mtrObs: string
  ticketComprovante: string
  pesoTara: string
  pesoBruto: string
  motoristaSnap: string
  placaSnap: string
  ultimaAprovacaoDecisao: string
  ultimaAprovacaoObs: string
  conferenciaDocsOk: boolean | null
  conferenciaObs: string
  faturamentoRegStatus: string | null
  referenciaConsolidada: string
  dataExecucao: string
  dataProgramacao: string
  clienteRazaoSocial: string
  /** ISO timestamptz do último envio de NF registado na conta a receber. */
  nfEnviadaEm: string
  nfEnvioObs: string
  valorPago: string
  valorTravado: boolean
  contaReceberId: string
}

/** Número da NF registado na coleta ou no faturamento (etapa Mala Direta). */
export function numeroNfDaLinhaResumo(
  row: Pick<FaturamentoResumoViewRow, 'numero_nf_coleta' | 'faturamento_referencia_nf' | 'referencia_nf'>
): string | null {
  const n = (
    row.numero_nf_coleta ??
    row.faturamento_referencia_nf ??
    row.referencia_nf ??
    ''
  )
    .trim()
  return n || null
}

/** Texto unificado NF + boleto (conta a receber / esteira de faturamento). */
export function montarTextoObsNfBoleto(
  numeroNf: string,
  numeroBoleto: string,
  sufixo?: string | null
): string {
  const parts = [
    numeroNf.trim() ? `NF ${numeroNf.trim()}` : null,
    numeroBoleto.trim() ? `Boleto/ref. ${numeroBoleto.trim()}` : null,
    (sufixo ?? '').trim() || null,
  ].filter(Boolean)
  return parts.join(' · ')
}

/** Boleto/referência gravado ao finalizar NF (texto em `conta_receber_nf_envio_obs`). */
export function boletoDaLinhaResumo(
  row: Pick<FaturamentoResumoViewRow, 'conta_receber_nf_envio_obs'>
): string | null {
  const obs = (row.conta_receber_nf_envio_obs ?? '').trim()
  if (!obs) return null
  const m = /Boleto\/ref\.\s*([^·]+)/i.exec(obs)
  if (m?.[1]) return m[1].trim()
  return null
}

export function boletoDeObsNfEnvio(obs: string | null | undefined): string | null {
  if (!obs?.trim()) return null
  const m = /Boleto\/ref\.\s*([^·]+)/i.exec(obs.trim())
  return m?.[1]?.trim() || null
}

export function mapFaturamentoViewRow(row: FaturamentoResumoViewRow): FinanceiroListaItem {
  const etapa = normalizarEtapaColeta({
    fluxo_status: row.fluxo_status,
    etapa_operacional: row.etapa_operacional,
  })
  const sp = row.status_pagamento
  const statusPagamento: StatusPagamentoFinanceiro | '' =
    sp === 'Pendente' || sp === 'Parcial' || sp === 'Pago' ? sp : ''

  const sc =
    row.status_conferencia === 'PRONTO_PARA_FATURAR' ? 'PRONTO_PARA_FATURAR' : 'PENDENTE'

  const ref = numeroNfDaLinhaResumo(row) ?? ''

  return {
    id: row.coleta_id,
    numero: row.numero,
    cliente: row.cliente_nome || '—',
    dataAgendada: row.data_agendada,
    tipoResiduo: row.tipo_residuo,
    cidade: row.cidade,
    etapaOperacional: formatarEtapaParaUI(etapa),
    faseFluxoOficial: formatarFaseFluxoOficialParaUI(etapa, {
      statusPagamento: row.status_pagamento,
    }),
    liberadoFinanceiro: row.liberado_financeiro ?? false,
    valorColeta: row.valor_coleta !== null ? String(row.valor_coleta) : '',
    statusPagamento,
    dataVencimento: row.data_vencimento || '',
    pesoLiquido: row.peso_liquido !== null ? String(row.peso_liquido) : '',
    createdAt: row.created_at,
    mtrId: row.mtr_id != null ? String(row.mtr_id) : '',
    programacaoId: row.programacao_id != null ? String(row.programacao_id) : '',
    clienteId: row.cliente_id != null ? String(row.cliente_id) : '',
    numeroNf: ref,
    numeroBoleto: boletoDaLinhaResumo(row) ?? '',
    confirmacaoRecebimento: row.confirmacao_recebimento === true,
    statusConferencia: sc,
    pendenciasResumo: (row.pendencias_resumo ?? '').trim(),
    observacoesColeta: row.coleta_observacoes ?? '',
    mtrNumero: row.mtr_numero ?? '',
    programacaoNumero: row.programacao_numero ?? '',
    programacaoObs: row.programacao_observacoes ?? '',
    mtrObs: row.mtr_observacoes ?? '',
    ticketComprovante: row.ticket_comprovante ?? '',
    pesoTara: row.peso_tara !== null ? String(row.peso_tara) : '',
    pesoBruto: row.peso_bruto !== null ? String(row.peso_bruto) : '',
    motoristaSnap: row.motorista ?? '',
    placaSnap: row.placa ?? '',
    ultimaAprovacaoDecisao: row.ultima_aprovacao_decisao ?? '',
    ultimaAprovacaoObs: row.ultima_aprovacao_obs ?? '',
    conferenciaDocsOk: row.conferencia_documentos_ok,
    conferenciaObs: row.conferencia_operacional_obs ?? '',
    faturamentoRegStatus: row.faturamento_registro_status,
    referenciaConsolidada: ref,
    dataExecucao: row.data_execucao ?? '',
    dataProgramacao: row.data_programacao ?? '',
    clienteRazaoSocial: row.cliente_razao_social ?? '',
    nfEnviadaEm: row.conta_receber_nf_enviada_em
      ? String(row.conta_receber_nf_enviada_em)
      : '',
    nfEnvioObs: (row.conta_receber_nf_envio_obs ?? '').trim(),
    valorPago:
      row.conta_receber_valor_pago != null && Number.isFinite(Number(row.conta_receber_valor_pago))
        ? String(row.conta_receber_valor_pago)
        : '0',
    valorTravado: row.conta_receber_valor_travado === true,
    contaReceberId: '',
  }
}

export function exportarCsvFinanceiro(
  linhas: FinanceiroListaItem[],
  nomeBase: string
): void {
  const cols = [
    'numero',
    'cliente',
    'data_agendada',
    'peso_liquido',
    'valor',
    'status_pagamento',
    'fase_fluxo_oficial',
    'status_conferencia',
    'referencia_nf',
    'numero_boleto',
    'pendencias',
  ] as const
  const esc = (s: string | number) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return `"${t}"`
  }
  const header = cols.join(';')
  const body = linhas
    .map((i) =>
      [
        esc(i.numero),
        esc(i.cliente),
        esc(i.dataAgendada),
        esc(i.pesoLiquido),
        esc(i.valorColeta),
        esc(i.statusPagamento),
        esc(i.faseFluxoOficial),
        esc(i.statusConferencia),
        esc(i.numeroNf),
        esc(i.numeroBoleto),
        esc(i.pendenciasResumo),
      ].join(';')
    )
    .join('\r\n')
  const bom = '\uFEFF'
  const blob = new Blob([bom + header + '\r\n' + body], {
    type: 'text/csv;charset=utf-8;',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${nomeBase}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
