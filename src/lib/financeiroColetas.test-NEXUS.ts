import { describe, expect, it } from 'vitest'
import {
  coletaVisivelListaFinanceiro,
  etapaVisivelListaFinanceiro,
} from './financeiroColetas-NEXUS'

describe('etapaVisivelListaFinanceiro', () => {
  it('inclui só FINALIZADO', () => {
    expect(etapaVisivelListaFinanceiro('FINALIZADO')).toBe(true)
    expect(etapaVisivelListaFinanceiro('FATURADO')).toBe(false)
    expect(etapaVisivelListaFinanceiro('ENVIADO_FINANCEIRO')).toBe(false)
  })
})

describe('coletaVisivelListaFinanceiro', () => {
  it('inclui seeds de teste pelas observações', () => {
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'MTR_PREENCHIDA',
        etapa_operacional: 'MTR_PREENCHIDA',
        coleta_observacoes: '[FLUXO-20] seed',
      })
    ).toBe(true)
  })

  it('inclui quando esteira FINALIZADO', () => {
    expect(
      coletaVisivelListaFinanceiro({
        fluxo_status: 'FATURADO',
        etapa_operacional: 'FATURADO',
        faturamento_esteira_status: 'FINALIZADO',
      })
    ).toBe(true)
  })
})
