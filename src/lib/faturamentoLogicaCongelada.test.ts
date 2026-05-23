/**
 * Testes de contrato — lógica de faturamento congelada.
 * Falha aqui = regressão na regra aprovada (docs/faturamento-logica-aprovada.md).
 */
import { describe, expect, it } from 'vitest'
import { calcularPrecoContratoMtrConsolidado } from './faturamentoConsolidacaoMtr'
import { calcularPrecoContratoColetaMtr } from './faturamentoPrecoContrato'
import {
  coletasComFretePorMtr,
  montarLinhasRelatorioMedicao,
  totaisRelatorioMedicao,
} from './faturamentoRelatorioMedicao'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import {
  FATURAMENTO_INVARIANTES,
  FATURAMENTO_LOGICA_VERSION,
} from './faturamentoLogicaCongelada.manifest'

function row(partial: Partial<FaturamentoResumoViewRow> & { coleta_id: string }): FaturamentoResumoViewRow {
  return {
    numero: '1',
    numero_coleta: 1,
    cliente_id: 'actega',
    cliente_nome: 'ACTEGA',
    cliente_razao_social: 'ACTEGA DO BRASIL',
    data_agendada: '2026-04-20',
    data_programacao: null,
    data_execucao: partial.data_execucao ?? '2026-04-20',
    programacao_id: null,
    programacao_numero: null,
    programacao_observacoes: null,
    mtr_id: partial.mtr_id ?? 'm1',
    mtr_numero: partial.mtr_numero ?? 'MTR-1',
    mtr_observacoes: null,
    ticket_comprovante: null,
    peso_tara: null,
    peso_bruto: null,
    peso_liquido: partial.peso_liquido ?? 1000,
    motorista: null,
    placa: partial.placa ?? 'ABC1D23',
    valor_coleta: null,
    status_pagamento: null,
    data_vencimento: null,
    referencia_nf: null,
    numero_nf_coleta: null,
    faturamento_referencia_nf: null,
    faturamento_registro_status: null,
    faturamento_registro_valor: null,
    confirmacao_recebimento: null,
    fluxo_status: null,
    etapa_operacional: null,
    status_processo: null,
    liberado_financeiro: null,
    coleta_observacoes: null,
    tipo_residuo: partial.tipo_residuo ?? 'Resíduo A',
    cidade: '',
    created_at: '2026-04-20',
    ultima_aprovacao_decisao: null,
    ultima_aprovacao_obs: null,
    ultima_aprovacao_em: null,
    conferencia_documentos_ok: null,
    conferencia_operacional_obs: null,
    conferencia_em: null,
    status_conferencia: null,
    pendencias_resumo: null,
    status_faturamento: null,
    ...partial,
  }
}

/** Contrato simplificado no espírito ACTEGA (caminhão 750 + equip 90 + mínimos por resíduo). */
const contratoActegaSimplificado = {
  veiculos_contrato: [{ tipo_veiculo: 'CAMINHAO BAU', sem_custo: false, valor: '750' }],
  equipamentos_contrato: [
    { descricao: 'Container (Organico)', com_custo: true, valor: '90' },
  ],
  residuos_contrato: [
    {
      tipo_residuo: 'Resíduo geral',
      unidade_medida: 'kg',
      valor: '0,62',
      faturamento_minimo: '1000',
      classificacao: '',
      frequencia_coleta: '',
    },
    {
      tipo_residuo: 'Efluente contaminado',
      unidade_medida: 'kg',
      valor: '0,60',
      faturamento_minimo: '1000',
      classificacao: 'I',
      frequencia_coleta: '',
    },
    {
      tipo_residuo: 'Fossa Séptica',
      unidade_medida: 'kg',
      valor: '0,18',
      faturamento_minimo: '10000',
      classificacao: 'II',
      frequencia_coleta: '',
    },
  ],
  tipo_residuo_legado: null,
  descricao_veiculo_legado: null,
  equipamentos_texto_legado: null,
}

const inputPrecoBase = {
  veiculosContratoRaw: contratoActegaSimplificado.veiculos_contrato,
  equipamentosContratoRaw: contratoActegaSimplificado.equipamentos_contrato,
  residuosContratoRaw: contratoActegaSimplificado.residuos_contrato,
  legadoTipoResiduo: null,
  descricaoVeiculoLegado: null,
  equipamentosTextoLegado: null,
  tipoCaminhaoMtr: 'CAMINHAO BAU',
  acondicionamentoMtr: 'Container (Organico)',
  tipoResiduoColeta: 'Resíduo geral',
  pesoLiquidoKg: 1000,
}

describe('faturamentoLogicaCongelada — contrato de versão', () => {
  it('mantém versão documentada', () => {
    expect(FATURAMENTO_LOGICA_VERSION).toBe('2026-05-22.v1')
    expect(FATURAMENTO_INVARIANTES.length).toBeGreaterThanOrEqual(5)
  })
})

describe('invariante: referência MTR — caminhão uma vez', () => {
  it('dois resíduos na mesma MTR: valorCaminhao não duplica', () => {
    const ref = calcularPrecoContratoMtrConsolidado(inputPrecoBase, [
      { tipo_residuo: 'Resíduo geral', peso_liquido: 700 },
      { tipo_residuo: 'Efluente contaminado', peso_liquido: 450 },
    ])
    expect(ref.valorCaminhao).toBe(750)
    expect(ref.valorEquipamentos).toBe(90)
    expect(ref.valorCaminhao + ref.valorEquipamentos).toBe(840)
    const soUm = calcularPrecoContratoColetaMtr({
      ...inputPrecoBase,
      tipoResiduoColeta: 'Resíduo geral',
      pesoLiquidoKg: 700,
    })
    expect(ref.valorCaminhao).toBe(soUm.valorCaminhao)
  })
})

describe('invariante: relatório — frete por MTR', () => {
  it('duas MTRs → dois fretes no total do relatório', () => {
    const linhas = montarLinhasRelatorioMedicao(
      [
        row({ coleta_id: 'c1', mtr_id: 'm1', peso_liquido: 2500, tipo_residuo: 'Fossa Séptica' }),
        row({
          coleta_id: 'c2',
          mtr_id: 'm1',
          peso_liquido: 250,
          tipo_residuo: 'Resíduo geral',
          data_execucao: '2026-04-21',
          numero_coleta: 2,
        }),
        row({
          coleta_id: 'c3',
          mtr_id: 'm2',
          mtr_numero: 'MTR-2',
          peso_liquido: 1000,
          tipo_residuo: 'Efluente contaminado',
        }),
        row({
          coleta_id: 'c4',
          mtr_id: 'm2',
          mtr_numero: 'MTR-2',
          peso_liquido: 1000,
          tipo_residuo: 'Fossa Séptica',
          data_execucao: '2026-04-22',
          numero_coleta: 4,
        }),
      ],
      contratoActegaSimplificado,
      {
        c1: { tipoCaminhao: 'CAMINHAO BAU', acondicionamento: 'Container (Organico)' },
        c3: { tipoCaminhao: 'CAMINHAO BAU', acondicionamento: 'Container (Organico)' },
      }
    )
    const comFrete = linhas.filter((l) => l.valorFrete > 0)
    expect(comFrete).toHaveLength(2)
    expect(comFrete.every((l) => l.valorFrete === 840)).toBe(true)
    const tot = totaisRelatorioMedicao(linhas)
    expect(tot.valorFrete).toBe(1680)
  })

  it('coletasComFretePorMtr marca só a coleta mais antiga', () => {
    const ids = coletasComFretePorMtr([
      row({ coleta_id: 'b', data_execucao: '2026-04-21' }),
      row({ coleta_id: 'a', data_execucao: '2026-04-20' }),
    ])
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(false)
  })
})

describe('invariante: referência uma MTR ≠ relatório lote (ACTEGA)', () => {
  it('referência consolidada de uma MTR não iguala total do relatório de 4+ coletas em 2 MTRs', () => {
    const ticketsMtr1 = [
      { tipo_residuo: 'Resíduo geral', peso_liquido: 700 },
      { tipo_residuo: 'Resíduo geral', peso_liquido: 1200 },
      { tipo_residuo: 'Efluente contaminado', peso_liquido: 450 },
      { tipo_residuo: 'Fossa Séptica', peso_liquido: 2500 },
    ]
    const referenciaMtr1 = calcularPrecoContratoMtrConsolidado(inputPrecoBase, ticketsMtr1)

    const linhasRelatorio = montarLinhasRelatorioMedicao(
      [
        row({ coleta_id: '90001', mtr_id: 'm1', peso_liquido: 2500, tipo_residuo: 'Fossa Séptica' }),
        row({
          coleta_id: '90002',
          mtr_id: 'm1',
          peso_liquido: 250,
          tipo_residuo: 'Resíduo geral',
          data_execucao: '2026-04-21',
        }),
        row({
          coleta_id: '90003',
          mtr_id: 'm2',
          mtr_numero: 'MTR-2',
          peso_liquido: 1000,
          tipo_residuo: 'Efluente contaminado',
        }),
        row({
          coleta_id: '90004',
          mtr_id: 'm2',
          mtr_numero: 'MTR-2',
          peso_liquido: 1000,
          tipo_residuo: 'Fossa Séptica',
          data_execucao: '2026-04-22',
        }),
        row({
          coleta_id: '90005',
          mtr_id: 'm1',
          peso_liquido: 700,
          tipo_residuo: 'Resíduo geral',
          data_execucao: '2026-04-23',
        }),
        row({
          coleta_id: '90006',
          mtr_id: 'm1',
          peso_liquido: 1200,
          tipo_residuo: 'Resíduo geral',
          data_execucao: '2026-04-24',
        }),
        row({
          coleta_id: '90007',
          mtr_id: 'm2',
          mtr_numero: 'MTR-2',
          peso_liquido: 450,
          tipo_residuo: 'Efluente contaminado',
          data_execucao: '2026-04-25',
        }),
        row({
          coleta_id: '90008',
          mtr_id: 'm2',
          mtr_numero: 'MTR-2',
          peso_liquido: 2500,
          tipo_residuo: 'Fossa Séptica',
          data_execucao: '2026-04-26',
        }),
      ],
      contratoActegaSimplificado,
      Object.fromEntries(
        ['90001', '90003', '90005', '90007'].map((id) => [
          id,
          { tipoCaminhao: 'CAMINHAO BAU', acondicionamento: 'Container (Organico)' },
        ])
      )
    )
    const totalRelatorio = totaisRelatorioMedicao(linhasRelatorio).total

    expect(referenciaMtr1.total).toBeGreaterThan(0)
    expect(totalRelatorio).toBeGreaterThan(referenciaMtr1.total)
    expect(Math.abs(referenciaMtr1.total - totalRelatorio)).toBeGreaterThan(100)
  })
})
