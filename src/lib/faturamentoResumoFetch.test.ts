import { describe, expect, it } from 'vitest'
import {
  escopoOrFilterPostgrest,
  FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO,
  faturamentoResumoDesdeDias,
  formatarRotuloJanelaFaturamentoResumo,
  isEsteiraColumnMissingError,
} from './faturamentoResumoFetch'

describe('faturamentoResumoDesdeDias', () => {
  it('usa janela padrão quando env não está definida', () => {
    expect(faturamentoResumoDesdeDias()).toBe(FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO)
    expect(FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO).toBe(30)
  })
})

describe('formatarRotuloJanelaFaturamentoResumo', () => {
  it('formata intervalo com últimos N dias', () => {
    const texto = formatarRotuloJanelaFaturamentoResumo(30)
    expect(texto).toMatch(/^do dia \d{2}\/\d{2}\/\d{4} ao dia \d{2}\/\d{2}\/\d{4} \(últimos 30 dias\)$/)
  })

  it('indica histórico completo sem corte', () => {
    expect(formatarRotuloJanelaFaturamentoResumo(null)).toContain('histórico completo')
  })
})

describe('escopoOrFilterPostgrest', () => {
  it('operacional exclui emitidas', () => {
    const f = escopoOrFilterPostgrest('operacional')
    expect(f).toContain('faturamento_registro_status.is.null')
    expect(f).toContain('neq.emitido')
  })

  it('historico inclui emitidas e liberado financeiro', () => {
    const f = escopoOrFilterPostgrest('historico')
    expect(f).toContain('faturamento_registro_status.eq.emitido')
    expect(f).toContain('liberado_financeiro.eq.true')
  })

  it('completo não aplica filtro de escopo', () => {
    expect(escopoOrFilterPostgrest('completo')).toBeUndefined()
  })
})

describe('isEsteiraColumnMissingError', () => {
  it('reconhece colunas da esteira na mensagem PostgREST', () => {
    expect(
      isEsteiraColumnMissingError({
        message: 'column vw_faturamento_resumo.faturamento_esteira_status does not exist',
      })
    ).toBe(true)
  })

  it('não trata erro genérico de outra coluna da view como esteira', () => {
    expect(
      isEsteiraColumnMissingError({
        message: 'column vw_faturamento_resumo.ticket_impresso_em does not exist',
      })
    ).toBe(false)
  })
})
