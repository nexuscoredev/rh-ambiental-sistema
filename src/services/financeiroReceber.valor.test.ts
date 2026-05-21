import { describe, expect, it } from 'vitest'
import { valorTotalDoRegistroFaturamento } from './financeiroReceber'

describe('valorTotalDoRegistroFaturamento', () => {
  it('usa coluna valor quando positiva', () => {
    expect(valorTotalDoRegistroFaturamento({ valor: 1500 })).toBe(1500)
  })

  it('calcula total a partir de resumo_financeiro quando valor é null (MTR consolidada)', () => {
    expect(
      valorTotalDoRegistroFaturamento({
        valor: null,
        resumo_financeiro: {
          v: 1,
          desvinculado_operacional: true,
          ticket: {
            peso_tara_kg: '0',
            peso_bruto_kg: '0',
            peso_liquido_kg: '33',
            tipo_residuo: 'Resíduo A',
            valor_total: '1000,00',
          },
          mtr: {
            caminhao_rotulo: '',
            caminhao_valor: '0',
            equipamento_rotulo: '',
            equipamento_valor: '0',
            residuo_rotulo: '',
            residuo_quantidade: '',
            residuo_unidade: '',
            residuo_valor_unitario: '',
            residuo_valor: '500,00',
            peso_liquido_kg: '33',
          },
          ajustes: { acrescimo: '', desconto: '' },
        },
      })
    ).toBe(1500)
  })
})
