import { describe, expect, it } from 'vitest'
import {
  coletasComFretePorMtr,
  diasAbsolutosEntreDatasIso,
  montarLinhasRelatorioMedicao,
  totaisRelatorioMedicao,
  vencimentoRelatorioMedicao,
} from './faturamentoRelatorioMedicao'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

function row(partial: Partial<FaturamentoResumoViewRow> & { coleta_id: string }): FaturamentoResumoViewRow {
  return {
    numero: '1',
    numero_coleta: 1,
    cliente_id: 'c1',
    cliente_nome: 'VIGENT CONSTRUÇÕES LTDA',
    cliente_razao_social: 'VIGENT CONSTRUÇÕES LTDA',
    data_agendada: '2026-04-20',
    data_programacao: null,
    data_execucao: '2026-04-20',
    programacao_id: null,
    programacao_numero: null,
    programacao_observacoes: null,
    mtr_id: partial.mtr_id ?? 'm1',
    mtr_numero: partial.mtr_numero ?? '2377/2026',
    mtr_observacoes: null,
    ticket_comprovante: null,
    peso_tara: null,
    peso_bruto: null,
    peso_liquido: partial.peso_liquido ?? 1150,
    motorista: null,
    placa: partial.placa ?? 'EFO3B58',
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
    tipo_residuo: partial.tipo_residuo ?? 'ENTULHO',
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

const contrato = {
  veiculos_contrato: [{ tipo_veiculo: 'Truck', sem_custo: false, valor: '1540' }],
  equipamentos_contrato: [],
  residuos_contrato: [
    {
      tipo_residuo: 'ENTULHO',
      unidade_medida: 'kg',
      valor: '0,50',
      faturamento_minimo: '0',
      classificacao: '',
      frequencia_coleta: '',
    },
  ],
}

describe('diasAbsolutosEntreDatasIso', () => {
  it('calcula diferença em dias de calendário', () => {
    expect(diasAbsolutosEntreDatasIso('2026-04-01', '2026-05-01')).toBe(30)
    expect(diasAbsolutosEntreDatasIso('2026-04-01', '2026-05-02')).toBe(31)
  })
})

describe('montarLinhasRelatorioMedicao', () => {
  it('calcula total = peso × taxa + frete (modelo impresso)', () => {
    const linhas = montarLinhasRelatorioMedicao(
      [
        row({
          coleta_id: 'a',
          mtr_id: 'm1',
          mtr_numero: '2377/2026',
          peso_liquido: 1150,
        }),
      ],
      contrato,
      {}
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0]!.valorFrete).toBe(1540)
    expect(linhas[0]!.valorTaxa).toBe(0.5)
    expect(linhas[0]!.total).toBe(2115)
  })

  it('frete só na primeira coleta da mesma MTR', () => {
    const r1 = row({
      coleta_id: 'a',
      mtr_id: 'm1',
      mtr_numero: '2377/2026',
      peso_liquido: 1150,
      data_execucao: '2026-04-20',
    })
    const r2 = row({
      coleta_id: 'b',
      mtr_id: 'm1',
      mtr_numero: '2377/2026',
      peso_liquido: 1200,
      data_execucao: '2026-04-21',
      numero_coleta: 2,
    })
    const linhas = montarLinhasRelatorioMedicao([r2, r1], contrato, {})
    const comFrete = linhas.filter((l) => l.valorFrete > 0)
    expect(comFrete).toHaveLength(1)
    expect(comFrete[0]!.coleta_id).toBe('a')
    const semFrete = linhas.find((l) => l.coleta_id === 'b')!
    expect(semFrete.total).toBe(600)
  })

  it('MTRs distintas: frete em cada primeira linha', () => {
    const linhas = montarLinhasRelatorioMedicao(
      [
        row({ coleta_id: 'a', mtr_id: 'm1', peso_liquido: 1150 }),
        row({ coleta_id: 'b', mtr_id: 'm2', mtr_numero: '2378/2026', peso_liquido: 1200 }),
      ],
      contrato,
      {}
    )
    expect(linhas.filter((l) => l.valorFrete > 0)).toHaveLength(2)
    const tot = totaisRelatorioMedicao(linhas)
    expect(tot.total).toBe(2115 + 2140)
  })
})

describe('coletasComFretePorMtr', () => {
  it('escolhe a coleta mais antiga por data', () => {
    const ids = coletasComFretePorMtr([
      row({ coleta_id: 'b', data_execucao: '2026-04-21' }),
      row({ coleta_id: 'a', data_execucao: '2026-04-20' }),
    ])
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(false)
  })
})

describe('vencimentoRelatorioMedicao', () => {
  it('dia 20 do mês seguinte', () => {
    const v = vencimentoRelatorioMedicao([
      {
        coleta_id: 'x',
        data: '2026-04-20',
        mtr: '',
        gerador: '',
        tipoResiduo: '',
        placa: '',
        quantViagens: 1,
        valorFrete: 0,
        pesoKg: 0,
        valorTaxa: 0,
        total: 0,
      },
    ])
    expect(v).toBe('2026-05-20')
  })
})
