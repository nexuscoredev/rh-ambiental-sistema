import { describe, expect, it } from 'vitest'
import {
  aplicarPesoLiquidoMtrNoResumo,
  aplicarSugestaoContratoNoResumoMtr,
  criarResumoFinanceiroDoOperacional,
  parseNumeroCampo,
  pesoLiquidoKgDoResumoMtr,
  resumoMtrPrecosVazios,
} from './faturamentoDesvinculacao'
import type { ResultadoPrecoContrato } from './faturamentoPrecoContrato'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

const rowMin = {
  coleta_id: 'c1',
  numero_coleta: 90002,
  numero: '90002',
  cliente_id: 'cli1',
  cliente_nome: 'Cliente teste',
  tipo_residuo: 'Teste Residuo 1 — Classe I',
  peso_liquido: 5600,
  programacao_id: null,
  mtr_id: null,
  data_agendada: '2026-05-01',
  cidade: 'SP',
  created_at: '2026-05-01T00:00:00Z',
} as FaturamentoResumoViewRow

describe('resumoMtrPrecosVazios', () => {
  it('detecta MTR sem valores monetários', () => {
    const r = criarResumoFinanceiroDoOperacional(rowMin, null)
    expect(resumoMtrPrecosVazios(r.mtr)).toBe(true)
  })
})

describe('pesoLiquidoKgDoResumoMtr', () => {
  it('não usa peso da coleta quando o campo MTR está vazio (edição)', () => {
    const base = criarResumoFinanceiroDoOperacional(rowMin, null)
    const mtr = { ...base.mtr, peso_liquido_kg: '', residuo_quantidade: '1' }
    expect(pesoLiquidoKgDoResumoMtr(mtr)).toBeNull()
  })

  it('usa peso digitado no campo MTR', () => {
    const base = criarResumoFinanceiroDoOperacional(rowMin, null)
    const mtr = { ...base.mtr, peso_liquido_kg: '234', residuo_quantidade: '1' }
    expect(pesoLiquidoKgDoResumoMtr(mtr)).toBe(234)
  })
})

describe('aplicarSugestaoContratoNoResumoMtr', () => {
  it('preserva peso_liquido_kg vazio sem repor do ticket', () => {
    const base = criarResumoFinanceiroDoOperacional(rowMin, null)
    const resumo = {
      ...base,
      ticket: { ...base.ticket, peso_liquido_kg: '1' },
      mtr: { ...base.mtr, peso_liquido_kg: '', residuo_valor: '300', residuo_valor_unitario: '300' },
    }
    const sugestao = {
      total: 300,
      linhas: [],
      origem: 'contrato_cliente_residuo' as const,
      residuoContrato: null,
      veiculoContrato: null,
      equipamentosContrato: [],
      unidadeMedida: 'kg',
      quantidadeFaturada: 1,
      valorUnitario: 300,
      faturamentoMinimoKg: 0,
      valorCaminhao: 0,
      valorEquipamentos: 0,
      valorResiduo: 300,
    }
    const next = aplicarSugestaoContratoNoResumoMtr(resumo, sugestao)
    expect(next.mtr.peso_liquido_kg).toBe('')
  })
})

describe('aplicarPesoLiquidoMtrNoResumo', () => {
  it('atualiza qtd. faturada e valor do resíduo (qtd × unitário)', () => {
    const base = criarResumoFinanceiroDoOperacional(rowMin, null)
    const comPreco = {
      ...base,
      mtr: {
        ...base.mtr,
        residuo_quantidade: '5600',
        residuo_valor_unitario: '300',
        residuo_valor: '1680000',
        peso_liquido_kg: '5600',
      },
    }
    const next = aplicarPesoLiquidoMtrNoResumo(comPreco, '234')
    expect(parseNumeroCampo(next.mtr.peso_liquido_kg)).toBe(234)
    expect(parseNumeroCampo(next.mtr.residuo_quantidade)).toBe(234)
    expect(parseNumeroCampo(next.mtr.residuo_valor)).toBe(234 * 300)
  })
})

describe('aplicarSugestaoContratoNoResumoMtr', () => {
  it('preenche caminhão, equipamento e resíduo', () => {
    const base = criarResumoFinanceiroDoOperacional(rowMin, null)
    const sugestao: ResultadoPrecoContrato = {
      total: 1500,
      linhas: [],
      origem: 'contrato_cliente_mtr_consolidado',
      residuoContrato: {
        tipo_residuo: 'Teste Residuo 1',
        classificacao: 'I',
        unidade_medida: 'kg',
        valor: '0,50',
        frequencia_coleta: '',
        faturamento_minimo: '',
      },
      veiculoContrato: { tipo_veiculo: 'Truck', sem_custo: false, valor: '200' },
      equipamentosContrato: [{ descricao: 'Caçamba', com_custo: true, valor: '100' }],
      unidadeMedida: 'kg',
      quantidadeFaturada: 5600,
      valorUnitario: 0.5,
      faturamentoMinimoKg: 0,
      valorCaminhao: 200,
      valorEquipamentos: 100,
      valorResiduo: 2800,
    }
    const next = aplicarSugestaoContratoNoResumoMtr(base, sugestao)
    expect(resumoMtrPrecosVazios(next.mtr)).toBe(false)
    expect(Number(next.mtr.caminhao_valor)).toBe(200)
    expect(Number(next.mtr.equipamento_valor)).toBe(100)
    expect(Number(next.mtr.residuo_valor)).toBe(2800)
  })
})
