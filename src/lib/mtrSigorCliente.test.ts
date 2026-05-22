import { describe, expect, it } from 'vitest'
import { normalizarMtrSigorValor, parseMtrSigorImport, rotuloMtrSigor } from './mtrSigorCliente'

describe('mtrSigorCliente', () => {
  it('rotula opções', () => {
    expect(rotuloMtrSigor('cliente')).toBe('Cliente')
    expect(rotuloMtrSigor('rg')).toBe('RG')
    expect(rotuloMtrSigor('nao_tem')).toBe('Não tem')
  })

  it('normaliza legado boolean', () => {
    expect(normalizarMtrSigorValor(true)).toBe('cliente')
    expect(normalizarMtrSigorValor(false)).toBe('nao_tem')
  })

  it('importa texto da planilha', () => {
    expect(parseMtrSigorImport('RG')).toBe('rg')
    expect(parseMtrSigorImport('Não tem')).toBe('nao_tem')
    expect(parseMtrSigorImport('Cliente')).toBe('cliente')
  })
})
