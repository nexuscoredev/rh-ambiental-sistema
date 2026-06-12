import { describe, expect, it } from 'vitest'
import {
  montarInputPrecoContratoColeta,
  mtrTemSelecaoContrato,
  rotulosSelecionadosNaMtr,
  veiculosContratoRawParaResumo,
} from './faturamentoContratoDesdeMtr'
import { calcularPrecoContratoColetaMtr } from './faturamentoPrecoContrato'

describe('faturamentoContratoDesdeMtr', () => {
  const contratoCliente = {
    residuos_contrato: [
      {
        tipo_residuo: 'FOSSA',
        classificacao: 'Líquido',
        unidade_medida: 'kg',
        valor: '0,50',
        faturamento_minimo: '0',
      },
      {
        tipo_residuo: 'VACUO - FOSSA',
        classificacao: 'Líquido',
        unidade_medida: 'kg',
        valor: '2,00',
        faturamento_minimo: '0',
      },
    ],
    veiculos_contrato: [
      { tipo_veiculo: 'VACUO - FOSSA', sem_custo: false, valor: '1900' },
      { tipo_veiculo: 'ROLON', sem_custo: false, valor: '800' },
    ],
    equipamentos_contrato: [{ descricao: 'CONTAINER 1,2 (LOG)', valor: '150' }],
    tipo_residuo_legado: null,
    descricao_veiculo_legado: null,
    equipamentos_texto_legado: null,
  }

  it('detecta seleção de contrato na MTR', () => {
    expect(
      mtrTemSelecaoContrato({
        contrato_veiculos: [{ tipo_veiculo: 'ROLON', sem_custo: false, valor: '800' }],
      })
    ).toBe(true)
    expect(mtrTemSelecaoContrato({ residuo: { caracterizacao: 'FOSSA' } })).toBe(true)
    expect(mtrTemSelecaoContrato({})).toBe(false)
  })

  it('usa veículo e resíduo da MTR, não o cadastro inteiro do cliente', () => {
    const input = montarInputPrecoContratoColeta({
      contratoCliente,
      mtr: {
        tipo_residuo: 'FOSSA',
        detalhes: {
          contrato_veiculos: [{ tipo_veiculo: 'ROLON', sem_custo: false, valor: '800' }],
          contrato_equipamentos: [{ descricao: 'CONTAINER 1,2 (LOG)', valor: '150' }],
          residuos_contrato_catalogo: contratoCliente.residuos_contrato,
          residuo: { caracterizacao: 'FOSSA', estado_fisico: 'LÍQUIDO', acondicionamento: '' },
        },
      },
      tipoCaminhaoProgramacao: 'Vacuo de 15',
      tipoResiduoColetaFallback: 'VACUO - FOSSA',
      pesoLiquidoKg: 11350,
      quantidadeFaturada: 11350,
    })

    expect(input).not.toBeNull()
    const preco = calcularPrecoContratoColetaMtr(input!)
    expect(preco.veiculoContrato?.tipo_veiculo).toBe('ROLON')
    expect(preco.valorCaminhao).toBe(800)
    expect(preco.residuoContrato?.tipo_residuo).toBe('FOSSA')
    expect(preco.valorResiduo).toBe(5675)
    expect(preco.valorCaminhao).not.toBe(1900)
  })

  it('sem seleção na MTR mantém cadastro do cliente com hints da programação', () => {
    const input = montarInputPrecoContratoColeta({
      contratoCliente,
      mtr: { detalhes: {} },
      tipoCaminhaoProgramacao: 'VACUO - FOSSA',
      tipoResiduoColetaFallback: 'VACUO - FOSSA',
      pesoLiquidoKg: 1000,
    })
    expect(input).not.toBeNull()
    const preco = calcularPrecoContratoColetaMtr(input!)
    expect(preco.veiculoContrato?.tipo_veiculo).toBe('VACUO - FOSSA')
  })

  it('MTR grava identidade sem valor — preços vêm do cadastro do cliente', () => {
    const detalhesMtr = {
      contrato_veiculos: [{ tipo_veiculo: 'ROLON', sem_custo: true, valor: '' }],
      contrato_equipamentos: [{ descricao: 'CONTAINER 1,2 (LOG)', com_custo: false, valor: '' }],
      residuos_contrato_catalogo: contratoCliente.residuos_contrato,
      residuo: { caracterizacao: 'FOSSA', estado_fisico: 'LÍQUIDO', acondicionamento: '' },
    }
    const input = montarInputPrecoContratoColeta({
      contratoCliente,
      mtr: { tipo_residuo: 'FOSSA', detalhes: detalhesMtr },
      tipoCaminhaoProgramacao: 'VACUO - FOSSA',
      tipoResiduoColetaFallback: 'VACUO - FOSSA',
      pesoLiquidoKg: 11350,
      quantidadeFaturada: 11350,
    })
    expect(input).not.toBeNull()
    const preco = calcularPrecoContratoColetaMtr(input!)
    expect(preco.valorCaminhao).toBe(800)
    expect(preco.valorEquipamentos).toBe(150)
    expect(preco.valorResiduo).toBe(5675)
    expect(preco.veiculoContrato?.tipo_veiculo).toBe('ROLON')
    expect(preco.residuoContrato?.tipo_residuo).toBe('FOSSA')
  })

  it('rótulos e dropdown usam seleção da MTR, não programação', () => {
    const detalhesMtr = {
      contrato_veiculos: [{ tipo_veiculo: 'ROLON', sem_custo: true, valor: '' }],
      contrato_equipamentos: [{ descricao: 'Vacuo de 15', com_custo: false, valor: '' }],
      residuo: { caracterizacao: 'FOSSA', estado_fisico: 'LÍQUIDO', acondicionamento: '' },
    }
    const rotulos = rotulosSelecionadosNaMtr(detalhesMtr, 'FOSSA')
    expect(rotulos?.veiculo).toBe('ROLON')
    expect(rotulos?.equipamento).toBe('Vacuo de 15')
    expect(rotulos?.residuo).toBe('FOSSA')

    const veiculosDropdown = veiculosContratoRawParaResumo(contratoCliente, {
      detalhes: detalhesMtr,
    }) as { tipo_veiculo: string; valor: string; sem_custo: boolean }[]
    expect(veiculosDropdown).toHaveLength(1)
    expect(veiculosDropdown[0].tipo_veiculo).toBe('ROLON')
    expect(veiculosDropdown[0].sem_custo).toBe(false)
    expect(veiculosDropdown[0].valor).toBe('800,00')
  })
})
