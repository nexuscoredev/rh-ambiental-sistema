import { coletaVisivelListaFinanceiro } from './financeiroColetas'
import { normalizarEtapaColeta, type EtapaFluxo } from './fluxoEtapas'
import { coletaLiberadaParaFaturarEsteira, inferirEsteiraStatus } from './faturamentoEsteira'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

export type MotivoInelegivelFaturamento =
  | 'mtr_cancelada'
  | 'peso_liquido_invalido'
  | 'cliente_obrigatorio'
  | 'conferencia_pendente'
  | 'ticket_nao_impresso'
  | 'ticket_aguardando_aprovacao'
  | 'medicao_pendente'
  | 'ja_emitido'
  | 'ja_no_financeiro'

export type ResultadoElegibilidadeFaturamento = {
  ok: boolean
  etapa: EtapaFluxo
  motivos: MotivoInelegivelFaturamento[]
}

export function etapaDaLinhaFaturamento(row: Pick<FaturamentoResumoViewRow, 'fluxo_status' | 'etapa_operacional'>): EtapaFluxo {
  return normalizarEtapaColeta({
    fluxo_status: row.fluxo_status,
    etapa_operacional: row.etapa_operacional,
  })
}

export function coletaElegivelParaFaturar(row: FaturamentoResumoViewRow): ResultadoElegibilidadeFaturamento {
  const etapa = etapaDaLinhaFaturamento(row)
  const motivos: MotivoInelegivelFaturamento[] = []

  const mtrSt = (row.mtr_status ?? '').trim()
  if (mtrSt === 'Cancelado') motivos.push('mtr_cancelada')

  const scMtr = (row.status_conferencia ?? '').trim()
  if (scMtr === 'MTR_CANCELADA') motivos.push('mtr_cancelada')

  const p = row.peso_liquido
  if (!(p != null && Number(p) > 0)) motivos.push('peso_liquido_invalido')

  if (!row.cliente_id) motivos.push('cliente_obrigatorio')

  // Mesmo critério que `status_conferencia` em `vw_faturamento_resumo` (MTR, peso, ticket, aprovação;
  // valor pode ser definido só na emissão / regras de preço).
  const sc = (row.status_conferencia ?? '').trim()
  if (sc !== 'PRONTO_PARA_FATURAR') motivos.push('conferencia_pendente')

  if (sc === 'PRONTO_PARA_FATURAR') {
    const pend = (row.pendencias_resumo ?? '').toLowerCase()
    if (/ticket.n.o impresso|ticket nao impresso/.test(pend)) {
      motivos.push('ticket_nao_impresso')
    } else if (/aguardando aprova/.test(pend)) {
      motivos.push('ticket_aguardando_aprovacao')
    } else if (row.ticket_impresso_em && !row.faturamento_ticket_aprovado_em) {
      motivos.push('ticket_aguardando_aprovacao')
    }
  }

  if (row.faturamento_ticket_aprovado_em && !coletaLiberadaParaFaturarEsteira(row)) {
    const esteira = inferirEsteiraStatus(row)
    if (esteira && esteira !== 'LIBERADO_FATURAMENTO') {
      motivos.push('medicao_pendente')
    }
  }

  if (row.faturamento_registro_status === 'emitido') motivos.push('ja_emitido')

  if (coletaVisivelListaFinanceiro(row)) motivos.push('ja_no_financeiro')

  return { ok: motivos.length === 0, etapa, motivos }
}

export function rotuloMotivoInelegivel(m: MotivoInelegivelFaturamento): string {
  switch (m) {
    case 'mtr_cancelada':
      return 'MTR cancelada — use frete/custo operacional se aplicável ou reative ticket no histórico.'
    case 'peso_liquido_invalido':
      return 'Peso líquido ausente ou inválido.'
    case 'cliente_obrigatorio':
      return 'Cliente obrigatório.'
    case 'conferencia_pendente':
      return 'Requisitos de conferência pendentes (MTR, peso, ticket ou outro — veja pendências na lista).'
    case 'ticket_nao_impresso':
      return 'Salve a pesagem e o ticket no Controle de Massa (passo 4) antes de faturar.'
    case 'ticket_aguardando_aprovacao':
      return 'Aguardando validação do ticket pelo Faturamento (fila de aprovação).'
    case 'medicao_pendente':
      return 'Conclua medição, envio do relatório por e-mail e aprovação do cliente antes de faturar.'
    case 'ja_emitido':
      return 'Faturamento já emitido.'
    case 'ja_no_financeiro':
      return 'Coleta já finalizada (Contas a Receber / Financeiro).'
    default:
      return 'Não elegível para faturar.'
  }
}

