import { describe, expect, it } from 'vitest'
import {
  calcularPrecoContratoCliente,
  encontrarResiduoContrato,
  quantidadeNaUnidadeContrato,
} from './faturamentoPrecoContrato'
import type { ResiduoContratoItem } from './clienteContratoCadastro'

describe('faturamentoPrecoContrato', () => {
  const itens: ResiduoContratoItem[] = [
    {
      tipo_residuo: 'RG-R-016 — Lâmpadas',
      classificacao: 'Perigoso',
      unidade_medida: 'kg',
      valor: '2,50',
      frequencia_coleta: 'Mensal',
      faturamento_minimo: '500,00',
    },
  ]

  it('encontra resíduo por código RG-R', () => {
    const r = encontrarResiduoContrato(itens, 'RG-R-016 — Lâmpadas fluorescentes')
    expect(r?.tipo_residuo).toContain('RG-R-016')
  })

  it('calcula subtotal por kg e aplica mínimo', () => {
    const x = calcularPrecoContratoCliente({
      residuosContratoRaw: [
        {
          tipo_residuo: 'RG-R-016',
          unidade_medida: 'kg',
          valor: 2.5,
          faturamento_minimo: 500,
        },
      ],
      tipoResiduoColeta: 'RG-R-016 — Lâmpadas',
      pesoLiquidoKg: 100,
    })
    expect(x.total).toBe(500)
    expect(x.linhas.some((l) => l.chave === 'minimo')).toBe(true)
  })

  it('calcula por tonelada', () => {
    const x = calcularPrecoContratoCliente({
      residuosContratoRaw: [
        { tipo_residuo: 'Lodo', unidade_medida: 'ton', valor: 1000, faturamento_minimo: 0 },
      ],
      tipoResiduoColeta: 'Lodo',
      pesoLiquidoKg: 2000,
    })
    expect(x.quantidadeFaturada).toBe(2)
    expect(x.total).toBe(2000)
  })

  it('quantidadeNaUnidadeContrato usa quantidade informada em m³', () => {
    expect(quantidadeNaUnidadeContrato(800, 12, 'm3')).toBe(12)
  })
})
