import { describe, expect, it } from 'vitest'
import {
  formatarCNPJDigitacao,
  formatarCnpjParaArmazenar,
  formatarCPFDigitacao,
  formatarCpfParaArmazenar,
} from './brasilCadastro'

describe('máscaras CNPJ/CPF', () => {
  it('limita CNPJ a 14 dígitos', () => {
    const fmt = formatarCNPJDigitacao('21322342343423424234')
    expect(fmt.replace(/\D/g, '').length).toBe(14)
  })

  it('limita CPF a 11 dígitos', () => {
    const fmt = formatarCPFDigitacao('423423423423423')
    expect(fmt.replace(/\D/g, '').length).toBe(11)
  })

  it('só armazena documento completo', () => {
    expect(formatarCnpjParaArmazenar('12.345.678/0001-95')).toBe('12.345.678/0001-95')
    expect(formatarCnpjParaArmazenar('123')).toBe('')
    expect(formatarCpfParaArmazenar('529.982.247-25')).toBe('529.982.247-25')
    expect(formatarCpfParaArmazenar('123')).toBe('')
  })
})
