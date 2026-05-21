import { describe, expect, it } from 'vitest'
import {
  coletaAguardandoConfirmacaoNfBoleto,
  coletaLiberadaParaFaturarEsteira,
  coletaNaFilaRelatorioMedicao,
  inferirEsteiraStatus,
} from './faturamentoEsteira'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

function row(partial: Partial<FaturamentoResumoViewRow>): FaturamentoResumoViewRow {
  return {
    coleta_id: 'c1',
    numero: '1',
    numero_coleta: 1,
    cliente_id: 'cli',
    cliente_nome: 'Cliente',
    data_agendada: '2026-05-01',
    data_programacao: null,
    data_execucao: null,
    programacao_id: null,
    programacao_numero: null,
    programacao_observacoes: null,
    mtr_id: 'm1',
    mtr_numero: 'MTR-1',
    mtr_observacoes: null,
    ticket_comprovante: 'T-1',
    peso_tara: 1000,
    peso_bruto: 7000,
    peso_liquido: 6000,
    motorista: 'João',
    placa: 'ABC-1234',
    valor_coleta: null,
    status_pagamento: null,
    data_vencimento: null,
    referencia_nf: null,
    numero_nf_coleta: null,
    faturamento_referencia_nf: null,
    faturamento_registro_status: null,
    faturamento_registro_valor: null,
    confirmacao_recebimento: null,
    fluxo_status: null,
    etapa_operacional: null,
    status_processo: null,
    liberado_financeiro: null,
    coleta_observacoes: null,
    tipo_residuo: 'Resíduo A',
    cidade: 'SP',
    created_at: '2026-05-01T00:00:00Z',
    ultima_aprovacao_decisao: null,
    ultima_aprovacao_obs: null,
    ultima_aprovacao_em: null,
    conferencia_documentos_ok: null,
    conferencia_operacional_obs: null,
    conferencia_em: null,
    status_conferencia: 'PRONTO_PARA_FATURAR',
    pendencias_resumo: null,
    status_faturamento: null,
    faturamento_ticket_aprovado_em: '2026-05-02T00:00:00Z',
    ...partial,
  } as FaturamentoResumoViewRow
}

describe('inferirEsteiraStatus', () => {
  it('ticket aprovado sem medição → AJUSTE_VALORES_MEDICAO', () => {
    expect(inferirEsteiraStatus(row({}))).toBe('AJUSTE_VALORES_MEDICAO')
  })

  it('valores revisados → MEDICAO_PENDENTE', () => {
    expect(
      inferirEsteiraStatus(row({ faturamento_esteira_status: 'MEDICAO_PENDENTE' }))
    ).toBe('MEDICAO_PENDENTE')
  })

  it('cliente aprovou → LIBERADO_FATURAMENTO', () => {
    expect(
      inferirEsteiraStatus(
        row({ faturamento_esteira_status: 'LIBERADO_FATURAMENTO' })
      )
    ).toBe('LIBERADO_FATURAMENTO')
  })
})

describe('coletaAguardandoConfirmacaoNfBoleto', () => {
  it('emitido com esteira liberado financeiro aguarda confirmação', () => {
    expect(
      coletaAguardandoConfirmacaoNfBoleto(
        row({
          faturamento_esteira_status: 'LIBERADO_FINANCEIRO',
          faturamento_registro_status: 'emitido',
        })
      )
    ).toBe(true)
  })

  it('finalizado não aguarda', () => {
    expect(
      coletaAguardandoConfirmacaoNfBoleto(
        row({ faturamento_esteira_status: 'FINALIZADO', faturamento_registro_status: 'emitido' })
      )
    ).toBe(false)
  })
})

describe('coletaNaFilaRelatorioMedicao', () => {
  it('identifica fila de relatório', () => {
    expect(coletaNaFilaRelatorioMedicao(row({ faturamento_esteira_status: 'MEDICAO_PENDENTE' }))).toBe(
      true
    )
  })
})

describe('coletaLiberadaParaFaturarEsteira', () => {
  it('libera só com status correto', () => {
    expect(coletaLiberadaParaFaturarEsteira(row({ faturamento_esteira_status: 'LIBERADO_FATURAMENTO' }))).toBe(
      true
    )
    expect(coletaLiberadaParaFaturarEsteira(row({ faturamento_esteira_status: 'MEDICAO_PENDENTE' }))).toBe(
      false
    )
  })
})
