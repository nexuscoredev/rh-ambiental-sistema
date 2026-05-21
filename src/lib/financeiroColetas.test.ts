import { describe, expect, it } from 'vitest'
import {
  coletaVisivelListaFinanceiro,
  dadosCobrancaColeta,
  etapaVisivelListaFinanceiro,
  isVencidoFinanceiro,
  saldoAbertoFinanceiro,
} from './financeiroColetas'

describe('etapaVisivelListaFinanceiro', () => {
  it('inclui só FINALIZADO', () => {
    expect(etapaVisivelListaFinanceiro('FINALIZADO')).toBe(true)
    expect(etapaVisivelListaFinanceiro('FATURADO')).toBe(false)
    expect(etapaVisivelListaFinanceiro('ENVIADO_FINANCEIRO')).toBe(false)
  })

  it('exclui etapas anteriores ao financeiro', () => {
    expect(etapaVisivelListaFinanceiro('MTR_PREENCHIDA')).toBe(false)
    expect(etapaVisivelListaFinanceiro('TICKET_GERADO')).toBe(false)
  })
})

describe('coletaVisivelListaFinanceiro', () => {
  it('inclui seeds de teste pelas observações (coleta_observacoes ou observacoes)', () => {
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'MTR_PREENCHIDA',
        etapa_operacional: 'MTR_PREENCHIDA',
        coleta_observacoes: '[FLUXO-20] seed',
      })
    ).toBe(true)
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'MTR_PREENCHIDA',
        etapa_operacional: 'MTR_PREENCHIDA',
        observacoes: '[SIM-50] teste',
      })
    ).toBe(true)
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'PROGRAMACAO_CRIADA',
        etapa_operacional: 'PROGRAMACAO_CRIADA',
        observacoes: 'Prefixo HIST-200 no texto',
      })
    ).toBe(true)
  })

  it('inclui quando esteira FINALIZADO ou NF na conta', () => {
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'FATURADO',
        etapa_operacional: 'FATURADO',
        faturamento_esteira_status: 'FINALIZADO',
      })
    ).toBe(true)
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'FATURADO',
        etapa_operacional: 'FATURADO',
        conta_receber_nf_enviada_em: '2026-05-18T10:00:00Z',
      })
    ).toBe(true)
  })

  it('exclui FATURADO / ENVIADO_FINANCEIRO sem finalizar esteira', () => {
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'FATURADO',
        etapa_operacional: 'FATURADO',
        liberado_financeiro: false,
      })
    ).toBe(false)
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'ENVIADO_FINANCEIRO',
        etapa_operacional: 'ENVIADO_FINANCEIRO',
        liberado_financeiro: true,
        faturamento_esteira_status: 'LIBERADO_FINANCEIRO',
      })
    ).toBe(false)
  })
})

describe('isVencidoFinanceiro', () => {
  it('retorna false quando pago ou sem data', () => {
    expect(isVencidoFinanceiro('2020-01-01', 'Pago')).toBe(false)
    expect(isVencidoFinanceiro('', 'Pendente')).toBe(false)
    expect(isVencidoFinanceiro('2020-01-01', 'Cancelado')).toBe(false)
  })
})

describe('saldoAbertoFinanceiro', () => {
  it('usa valor_pago da conta a receber', () => {
    expect(
      saldoAbertoFinanceiro(100, { valor: 500, valor_pago: 200, status_pagamento: 'Parcial' })
    ).toBe(300)
  })
})

describe('dadosCobrancaColeta', () => {
  it('prioriza vencimento da conta a receber', () => {
    const d = dadosCobrancaColeta(
      { data_vencimento: '2026-06-01', status_pagamento: 'Pendente', valor_coleta: 100 },
      { data_vencimento: '2026-01-15', status_pagamento: 'Pendente', valor: 250, valor_pago: 0 }
    )
    expect(d.dataVencimento).toBe('2026-01-15')
    expect(d.saldoAberto).toBe(250)
  })
})
