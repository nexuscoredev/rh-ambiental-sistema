import { describe, expect, it } from 'vitest'
import {
  calcularPrecoContratoCliente,
  calcularPrecoContratoColetaMtr,
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
      faturamento_minimo: '500',
    },
  ]

  it('encontra resíduo por código RG-R', () => {
    const r = encontrarResiduoContrato(itens, 'RG-R-016 — Lâmpadas fluorescentes')
    expect(r?.tipo_residuo).toContain('RG-R-016')
  })

  it('calcula subtotal por kg e aplica mínimo em peso (kg)', () => {
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
    expect(x.total).toBe(1250)
    expect(x.quantidadeFaturada).toBe(500)
    expect(x.faturamentoMinimoKg).toBe(500)
    expect(x.linhas.some((l) => l.chave === 'minimo')).toBe(true)
  })

  it('contrato em ton é normalizado para kg (mínimo 1000 kg, 200 kg pesados)', () => {
    const x = calcularPrecoContratoCliente({
      residuosContratoRaw: [
        {
          tipo_residuo: 'Lodo',
          unidade_medida: 'ton',
          valor: 1000,
          faturamento_minimo: 1000,
        },
      ],
      tipoResiduoColeta: 'Lodo',
      pesoLiquidoKg: 200,
    })
    expect(x.unidadeMedida).toBe('kg')
    expect(x.quantidadeFaturada).toBe(1000)
    expect(x.total).toBe(1000)
  })

  it('contrato em ton normalizado: 2000 kg × R$ 1/kg', () => {
    const x = calcularPrecoContratoCliente({
      residuosContratoRaw: [
        { tipo_residuo: 'Lodo', unidade_medida: 'ton', valor: 1000, faturamento_minimo: 0 },
      ],
      tipoResiduoColeta: 'Lodo',
      pesoLiquidoKg: 2000,
    })
    expect(x.unidadeMedida).toBe('kg')
    expect(x.quantidadeFaturada).toBe(2000)
    expect(x.total).toBe(2000)
  })

  it('quantidadeNaUnidadeContrato usa quantidade informada em m³', () => {
    expect(quantidadeNaUnidadeContrato(800, 12, 'm3')).toBe(12)
  })

  it('soma caminhão + equipamento + resíduo (contexto MTR)', () => {
    const x = calcularPrecoContratoColetaMtr({
      veiculosContratoRaw: [{ tipo_veiculo: 'Truck', sem_custo: false, valor: 150 }],
      equipamentosContratoRaw: [{ descricao: 'BAU', com_custo: true, valor: 80 }],
      residuosContratoRaw: [
        {
          tipo_residuo: 'RG-R-016',
          unidade_medida: 'kg',
          valor: 2,
          faturamento_minimo: 0,
        },
      ],
      tipoCaminhaoMtr: 'Truck',
      acondicionamentoMtr: 'BAU',
      tipoResiduoColeta: 'RG-R-016',
      pesoLiquidoKg: 100,
    })
    expect(x.valorCaminhao).toBe(150)
    expect(x.valorEquipamentos).toBe(80)
    expect(x.valorResiduo).toBe(200)
    expect(x.total).toBe(430)
    expect(x.linhas.some((l) => l.chave === 'caminhao')).toBe(true)
    expect(x.linhas.some((l) => l.chave.startsWith('equipamento'))).toBe(true)
    expect(x.origem).toBe('contrato_cliente_mtr_consolidado')
  })
})
