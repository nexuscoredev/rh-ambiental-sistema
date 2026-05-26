import { describe, expect, it } from 'vitest'
import { parseNumeroCampo } from './faturamentoDesvinculacao'
import {
  aplicarValorTotalLinha,
  calcularValorTotalMtrLinha,
  formatarValorTotalGerenciador,
  valorUnitarioResiduoContrato,
} from './gerenciadorMtrLinhaCalculo'

describe('gerenciadorMtrLinhaCalculo', () => {
  const contrato = [
    { tipo_residuo: 'RSS', classificacao: '', unidade_medida: 'kg', valor: '3,50', frequencia_coleta: '', faturamento_minimo: '' },
  ]

  it('usa valor do contrato pelo nome do resíduo', () => {
    expect(valorUnitarioResiduoContrato('rss', contrato)).toBe(3.5)
  })

  it('calcula peso × valor unitário', () => {
    expect(calcularValorTotalMtrLinha('100', 3.5)).toBe(350)
    expect(calcularValorTotalMtrLinha('10,5', 2)).toBe(21)
    expect(calcularValorTotalMtrLinha('80', 76)).toBe(6080)
    expect(calcularValorTotalMtrLinha('7', 9.8)).toBe(68.6)
    expect(calcularValorTotalMtrLinha('7', parseNumeroCampo('9,8'))).toBe(68.6)
  })

  it('soma total geral (peso × unit por linha)', () => {
    const linhas = [
      { peso: '80', valor_unitario: '76' },
      { peso: '7', valor_unitario: '9,8' },
    ]
    const soma = linhas.reduce(
      (acc, l) => acc + calcularValorTotalMtrLinha(l.peso, parseNumeroCampo(l.valor_unitario)),
      0
    )
    expect(soma).toBe(6148.6)
    expect(formatarValorTotalGerenciador(soma)).toBe('R$\u00a06.148,60')
  })

  it('peso vazio ou unitário zero → total 0', () => {
    expect(calcularValorTotalMtrLinha('', 76)).toBe(0)
    expect(calcularValorTotalMtrLinha('80', 0)).toBe(0)
    expect(formatarValorTotalGerenciador(0)).toBe('')
  })

  it('override manual do valor unitário', () => {
    const r = aplicarValorTotalLinha(
      { residuo: 'Outro', peso: '7', valor_unitario: '9,8', valor_total: '' },
      contrato
    )
    expect(r.valor_total).toBe('R$\u00a068,60')
  })

  it('formata valor total na linha', () => {
    const r = aplicarValorTotalLinha(
      { residuo: 'RSS', peso: '10', valor_unitario: '', valor_total: '' },
      contrato
    )
    expect(r.valor_total).toContain('35')
  })
})
