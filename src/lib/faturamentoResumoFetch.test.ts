import { describe, expect, it } from 'vitest'
import {
  escopoOrFilterPostgrest,
  FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO,
  faturamentoResumoDesdeDias,
} from './faturamentoResumoFetch'

describe('faturamentoResumoDesdeDias', () => {
  it('usa janela padrão quando env não está definida', () => {
    expect(faturamentoResumoDesdeDias()).toBe(FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO)
    expect(FATURAMENTO_RESUMO_DESDE_DIAS_PADRAO).toBe(180)
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
