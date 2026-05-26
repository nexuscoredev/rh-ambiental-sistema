import { describe, expect, it } from 'vitest'
import { coletaPodeEnviarParaFilaAjusteFaturamento } from './mtrGerenciadorFilaFaturamento'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

function row(partial: Partial<FaturamentoResumoViewRow>): FaturamentoResumoViewRow {
  return {
    coleta_id: 'c1',
    cliente_id: 'cli1',
    ...partial,
  } as FaturamentoResumoViewRow
}

describe('coletaPodeEnviarParaFilaAjusteFaturamento', () => {
  it('bloqueia sem coleta', () => {
    expect(coletaPodeEnviarParaFilaAjusteFaturamento(null).pode).toBe(false)
  })

  it('permite ticket impresso aguardando aprovação (passo 1)', () => {
    const r = row({
      ticket_impresso_em: '2026-01-01T00:00:00Z',
      faturamento_ticket_aprovado_em: null,
      status_conferencia: 'PRONTO_PARA_FATURAR',
      pendencias_resumo: 'Aguardando aprovação do ticket',
    })
    expect(coletaPodeEnviarParaFilaAjusteFaturamento(r).pode).toBe(true)
  })

  it('bloqueia já em ajuste de valores', () => {
    const r = row({
      faturamento_ticket_aprovado_em: '2026-01-01T00:00:00Z',
      faturamento_esteira_status: 'AJUSTE_VALORES_MEDICAO',
    })
    expect(coletaPodeEnviarParaFilaAjusteFaturamento(r).pode).toBe(false)
  })

  it('bloqueia já em medição pendente', () => {
    const r = row({
      faturamento_ticket_aprovado_em: '2026-01-01T00:00:00Z',
      faturamento_esteira_status: 'MEDICAO_PENDENTE',
    })
    expect(coletaPodeEnviarParaFilaAjusteFaturamento(r).pode).toBe(false)
  })
})
