import { describe, expect, it } from 'vitest'
import { faturamentoRegistrosErroColunaAusente, montarPayloadsFaturamentoRegistro } from './faturamentoRegistrosPersist'

describe('faturamentoRegistrosErroColunaAusente', () => {
  it('detecta observacoes em schema cache', () => {
    expect(
      faturamentoRegistrosErroColunaAusente(
        {
          message: "Could not find the 'observacoes' column of 'faturamento_registros' in the schema cache",
        },
        'observacoes'
      )
    ).toBe(true)
  })
})

describe('montarPayloadsFaturamentoRegistro', () => {
  it('cadeia sem observacoes', () => {
    const p = montarPayloadsFaturamentoRegistro({
      valor: 100,
      observacoes: 'teste',
      status: 'emitido',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(p.completo.observacoes).toBe('teste')
    expect(p.semObservacoes.observacoes).toBeUndefined()
    expect(p.soValor.valor).toBe(100)
  })
})
