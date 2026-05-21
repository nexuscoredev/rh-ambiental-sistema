import { describe, expect, it } from 'vitest'
import {
  aplicarSugestaoContratoNoResumoMtr,
  criarResumoFinanceiroDoOperacional,
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
