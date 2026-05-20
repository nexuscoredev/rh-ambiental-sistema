import { describe, expect, it } from 'vitest'
import {
  agruparFilaFaturamentoPorMtr,
  calcularPrecoContratoMtrConsolidado,
} from './faturamentoConsolidacaoMtr'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

function linha(partial: Partial<FaturamentoResumoViewRow> & { coleta_id: string }): FaturamentoResumoViewRow {
  return {
    coleta_id: partial.coleta_id,
    numero: partial.numero ?? '1',
    numero_coleta: partial.numero_coleta ?? 90001,
    cliente_id: 'c1',
    cliente_nome: 'Cliente',
    cliente_razao_social: null,
    data_agendada: '2026-05-01',
    data_programacao: null,
    data_execucao: null,
    programacao_id: null,
    programacao_numero: null,
    programacao_observacoes: null,
    mtr_id: partial.mtr_id ?? null,
    mtr_numero: partial.mtr_numero ?? null,
    mtr_observacoes: null,
    ticket_comprovante: null,
    peso_tara: null,
    peso_bruto: null,
    peso_liquido: partial.peso_liquido ?? 100,
    motorista: null,
    placa: null,
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
    created_at: '2026-05-01T10:00:00Z',
    ultima_aprovacao_decisao: null,
    ultima_aprovacao_obs: null,
    ultima_aprovacao_em: null,
    conferencia_documentos_ok: null,
    conferencia_operacional_obs: null,
    conferencia_em: null,
    status_conferencia: 'PRONTO_PARA_FATURAR',
    status_faturamento: null,
    pendencias_resumo: null,
  }
}

describe('agruparFilaFaturamentoPorMtr', () => {
  it('agrupa duas coletas da mesma MTR num item mtr', () => {
    const a = linha({ coleta_id: 'a', mtr_id: 'm1', mtr_numero: 'MTR-1', numero_coleta: 90001 })
    const b = linha({ coleta_id: 'b', mtr_id: 'm1', mtr_numero: 'MTR-1', numero_coleta: 90002, tipo_residuo: 'B' })
    const itens = agruparFilaFaturamentoPorMtr([a, b])
    expect(itens).toHaveLength(1)
    expect(itens[0]?.kind).toBe('mtr')
    if (itens[0]?.kind === 'mtr') {
      expect(itens[0].coletas).toHaveLength(2)
      expect(itens[0].coleta_lider.coleta_id).toBe('a')
    }
  })
})

describe('calcularPrecoContratoMtrConsolidado', () => {
  it('cobrar caminhão uma vez com dois resíduos', () => {
    const contrato = {
      veiculosContratoRaw: [{ tipo_veiculo: 'Truck', sem_custo: false, valor: '500' }],
      equipamentosContratoRaw: [],
      residuosContratoRaw: [
        { tipo_residuo: 'A', classificacao: 'I', unidade_medida: 'kg', valor: '10', faturamento_minimo: '' },
        { tipo_residuo: 'B', classificacao: 'II', unidade_medida: 'kg', valor: '20', faturamento_minimo: '' },
      ],
      tipoCaminhaoMtr: 'Truck',
      acondicionamentoMtr: null,
      tipoResiduoColeta: 'A',
      pesoLiquidoKg: 100,
    }
    const um = calcularPrecoContratoMtrConsolidado(contrato, [
      { tipo_residuo: 'A', peso_liquido: 100 },
    ])
    const dois = calcularPrecoContratoMtrConsolidado(contrato, [
      { tipo_residuo: 'A', peso_liquido: 100 },
      { tipo_residuo: 'B', peso_liquido: 50 },
    ])
    expect(dois.valorCaminhao).toBe(500)
    expect(dois.valorResiduo).toBeGreaterThan(um.valorResiduo)
    expect(dois.total).toBe(um.valorCaminhao + dois.valorResiduo)
  })
})
