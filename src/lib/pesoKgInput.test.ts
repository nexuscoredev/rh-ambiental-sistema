import { describe, expect, it } from 'vitest'
import { pesoKgParaCampoInput, pesoLiquidoParaInput } from './pesoKgInput'

describe('pesoKgParaCampoInput', () => {
  it('não pré-preenche zero', () => {
    expect(pesoKgParaCampoInput(0)).toBe('')
    expect(pesoKgParaCampoInput(null)).toBe('')
    expect(pesoKgParaCampoInput(1250.5)).toBe('1250.5')
  })
})

describe('pesoLiquidoParaInput', () => {
  it('não pré-preenche zero', () => {
    expect(pesoLiquidoParaInput(0)).toBe('')
    expect(pesoLiquidoParaInput(21.5)).toBe('21,5')
  })
})
