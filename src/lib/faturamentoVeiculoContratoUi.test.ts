import { describe, expect, it } from 'vitest'
import {
  CHAVE_VEICULO_MANUAL,
  aplicarVeiculoContratoAoResumoMtr,
  chaveVeiculoSelecionadoNoResumo,
  listarVeiculosContratoFaturamento,
  rotuloOpcaoVeiculoContrato,
  sugerirVeiculoContratoParaHints,
} from './faturamentoVeiculoContratoUi'
import type { ResumoFinanceiroDesvinculado } from './faturamentoDesvinculacao'

const resumoBase: ResumoFinanceiroDesvinculado = {
  v: 1,
  desvinculado_operacional: true,
  ticket: {
    peso_tara_kg: '',
    peso_bruto_kg: '',
    peso_liquido_kg: '',
    tipo_residuo: '',
    valor_total: '0',
  },
  mtr: {
    caminhao_rotulo: '',
    caminhao_valor: '',
    equipamento_rotulo: '',
    equipamento_valor: '',
    residuo_rotulo: '',
    residuo_quantidade: '',
    residuo_unidade: 'kg',
    residuo_valor_unitario: '',
    residuo_valor: '',
    peso_liquido_kg: '',
  },
  ajustes: { acrescimo: '', desconto: '' },
  ticket_encerrado_definitivo: false,
}

const contratoVeiculos = [
  { tipo_veiculo: 'CAIXA BAIXA', sem_custo: false, valor: '750' },
  { tipo_veiculo: 'CAMINHÃO BAU', sem_custo: false, valor: '750' },
]

describe('faturamentoVeiculoContratoUi', () => {
  it('lista veículos do contrato', () => {
    expect(listarVeiculosContratoFaturamento(contratoVeiculos)).toHaveLength(2)
  })

  it('aplica só caminhão no resumo sem alterar resíduo', () => {
    const next = aplicarVeiculoContratoAoResumoMtr(resumoBase, contratoVeiculos[1]!)
    expect(next.mtr.caminhao_rotulo).toBe('CAMINHÃO BAU')
    expect(next.mtr.caminhao_valor).toBe('750')
    expect(next.mtr.residuo_valor).toBe('')
  })

  it('detecta chave manual quando rótulo não está no contrato', () => {
    const r = {
      ...resumoBase,
      mtr: { ...resumoBase.mtr, caminhao_rotulo: 'Outro', caminhao_valor: '100' },
    }
    expect(chaveVeiculoSelecionadoNoResumo(contratoVeiculos, r)).toBe(CHAVE_VEICULO_MANUAL)
  })

  it('sugere CAMINHÃO BAU para programação Baú', () => {
    const s = sugerirVeiculoContratoParaHints(contratoVeiculos, {
      tipoCaminhaoProgramacao: 'Baú',
    })
    expect(s?.tipo_veiculo).toBe('CAMINHÃO BAU')
  })

  it('sugere CAIXA BAIXA para Rollon Caixa baixa', () => {
    const s = sugerirVeiculoContratoParaHints(contratoVeiculos, {
      tipoCaminhaoProgramacao: 'Rollon Caixa baixa',
    })
    expect(s?.tipo_veiculo).toBe('CAIXA BAIXA')
  })

  it('rotulo da opção inclui valor', () => {
    expect(rotuloOpcaoVeiculoContrato(contratoVeiculos[0]!)).toContain('750')
  })
})
