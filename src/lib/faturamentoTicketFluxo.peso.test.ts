import { describe, expect, it } from 'vitest'
import { pesoGravadoConfere } from './faturamentoTicketFluxo'
import { parsePesoLiquidoKgInput } from './pesoKgInput'

describe('peso conferência ticket', () => {
  it('parsePesoLiquidoKgInput aceita vírgula', () => {
    expect(parsePesoLiquidoKgInput('21,5')).toBe(21.5)
  })

  it('pesoGravadoConfere tolera arredondamento', () => {
    expect(pesoGravadoConfere({ peso_liquido: 21.005 }, 21)).toBe(true)
    expect(pesoGravadoConfere({ peso_liquido: 20 }, 21)).toBe(false)
  })
})
