import { describe, expect, it } from 'vitest'
import { montarDetalheContaFaturamento, referenciaContratoComCaminhaoResumo } from './faturamentoDetalheConta'
import { ajustesFinanceirosVazios, type ResumoFinanceiroDesvinculado } from './faturamentoDesvinculacao'

function resumoBase(): ResumoFinanceiroDesvinculado {
  return {
    v: 1,
    desvinculado_operacional: true,
    ticket: {
      peso_tara_kg: '300',
      peso_bruto_kg: '500',
      peso_liquido_kg: '576',
      tipo_residuo: '2 resíduos (A · B)',
      valor_total: '0',
      linhas_tickets: [
        {
          coleta_numero: '90001',
          ticket_numero: 'T-1',
          residuo: 'Resíduo A',
          peso_tara_kg: '300',
          peso_bruto_kg: '500',
          peso_liquido_kg: '200',
        },
        {
          coleta_numero: '90002',
          ticket_numero: 'T-2',
          residuo: 'Resíduo B',
          peso_tara_kg: '600',
          peso_bruto_kg: '976',
          peso_liquido_kg: '376',
        },
      ],
      eh_consolidado_mtr: true,
    },
    mtr: {
      caminhao_rotulo: 'Truck',
      caminhao_valor: '250',
      equipamento_rotulo: 'Caçamba',
      equipamento_valor: '0',
      mao_obra_rotulo: '',
      mao_obra_valor: '',
      residuo_rotulo: '2 resíduos (A · B)',
      residuo_quantidade: '576',
      residuo_unidade: 'kg',
      residuo_valor_unitario: '300',
      residuo_valor: '135200',
      peso_liquido_kg: '576',
    },
    ajustes: ajustesFinanceirosVazios(),
    ticket_encerrado_definitivo: false,
  }
}

describe('montarDetalheContaFaturamento', () => {
  it('soma ticket + MTR e mostra detalhe do resíduo', () => {
    const linhas = montarDetalheContaFaturamento(resumoBase())
    const total = linhas.find((l) => l.grupo === 'total')
    expect(total?.valor).toBe(135450)
    const residuo = linhas.find((l) => l.rotulo.includes('resíduos'))
    expect(residuo?.detalhe).toContain('576')
    expect(residuo?.detalhe).toContain('referência')
  })
})

describe('referenciaContratoComCaminhaoResumo', () => {
  it('substitui linha de caminhão e ajusta total referência', () => {
    const linhas = [
      { chave: 'caminhao', rotulo: 'Caminhão (CAMINHÃO BAU)', valor: 750 },
      { chave: 'residuo', rotulo: 'Resíduo', valor: 3104 },
    ]
    const ajustada = referenciaContratoComCaminhaoResumo(linhas, 3854, 'CAMINHÃO VACUO - EFLUENTE', 0)
    expect(ajustada.linhas[0]!.rotulo).toContain('VACUO')
    expect(ajustada.linhas[0]!.valor).toBe(0)
    expect(ajustada.total).toBe(3104)
  })
})
