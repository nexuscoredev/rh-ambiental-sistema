import { describe, expect, it } from 'vitest'
import { coletaIrmaConsolidadaMtr, liderColetaIdResumoConsolidado } from './faturamentoConsolidacaoMtr'
import type { ResumoFinanceiroDesvinculado } from './faturamentoDesvinculacao'

const resumoConsolidado: ResumoFinanceiroDesvinculado = {
  v: 1,
  desvinculado_operacional: true,
  ticket: {
    peso_tara_kg: '',
    peso_bruto_kg: '',
    peso_liquido_kg: '533',
    tipo_residuo: '2 resíduos',
    valor_total: '0',
  },
  mtr: {
    caminhao_rotulo: '',
    caminhao_valor: '800',
    equipamento_rotulo: '',
    equipamento_valor: '250',
    mao_obra_rotulo: '',
    mao_obra_valor: '',
    residuo_rotulo: '',
    residuo_quantidade: '533',
    residuo_unidade: 'kg',
    residuo_valor_unitario: '',
    residuo_valor: '126600',
    peso_liquido_kg: '533',
  },
  ajustes: { acrescimo: '', desconto: '' },
  ticket_encerrado_definitivo: false,
  consolidacao_mtr: {
    mtr_id: 'm1',
    mtr_numero: 'MTR-1',
    coleta_lider_id: 'lider-1',
    coleta_ids: ['lider-1', 'irma-2'],
  },
}

describe('coletaIrmaConsolidadaMtr', () => {
  it('identifica irmã e mantém líder', () => {
    expect(liderColetaIdResumoConsolidado('lider-1', resumoConsolidado)).toBeNull()
    expect(
      coletaIrmaConsolidadaMtr('irma-2', {
        valor: null,
        observacoes: 'Consolidado na coleta 90001 (mesma MTR).',
        resumo_financeiro: resumoConsolidado,
      })
    ).toBe('lider-1')
  })
})
