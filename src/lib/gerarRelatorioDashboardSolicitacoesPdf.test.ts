import { describe, expect, it } from 'vitest'
import { rotuloPeriodoDashboardSolicitacoes } from './gerarRelatorioDashboardSolicitacoesPdf'

describe('gerarRelatorioDashboardSolicitacoesPdf', () => {
  it('rotula períodos do dashboard', () => {
    expect(rotuloPeriodoDashboardSolicitacoes('mes')).toBe('Mês')
    expect(rotuloPeriodoDashboardSolicitacoes('ano')).toBe('Ano')
  })
})
