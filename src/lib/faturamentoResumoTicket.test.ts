import { describe, expect, it } from 'vitest'
import {
  formatarResiduosListaResumo,
  montarTicketResumoConsolidadoMtr,
  montarTicketResumoUnicoColeta,
  rotulosResiduoFromTextoColeta,
} from './faturamentoResumoTicket'
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
    ticket_comprovante: partial.ticket_comprovante ?? null,
    peso_tara: partial.peso_tara ?? 300,
    peso_bruto: partial.peso_bruto ?? 500,
    peso_liquido: partial.peso_liquido ?? 200,
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

describe('faturamentoResumoTicket', () => {
  it('separa vários resíduos no texto da coleta', () => {
    const partes = rotulosResiduoFromTextoColeta(
      'Teste Residuo 1 — Classe I · Teste Residuo 2 — Classe II'
    )
    expect(partes).toHaveLength(2)
    expect(formatarResiduosListaResumo(partes)).toBe(
      '2 resíduos (Teste Residuo 1 — Classe I · Teste Residuo 2 — Classe II)'
    )
  })

  it('ticket único lista um resíduo formatado', () => {
    const t = montarTicketResumoUnicoColeta(
      linha({ coleta_id: 'a', tipo_residuo: 'Lodo — Classe I' })
    )
    expect(t.linhas_tickets).toHaveLength(1)
    expect(t.tipo_residuo).toBe('Lodo — Classe I')
    expect(t.eh_consolidado_mtr).toBe(false)
  })

  it('consolidado MTR lista cada ticket com resíduo e peso', () => {
    const t = montarTicketResumoConsolidadoMtr([
      linha({
        coleta_id: 'a',
        numero_coleta: 90001,
        ticket_comprovante: '182245-1',
        tipo_residuo: 'Teste Residuo 1 — Classe I',
        peso_liquido: 200,
      }),
      linha({
        coleta_id: 'b',
        numero_coleta: 90002,
        ticket_comprovante: '182245-2',
        tipo_residuo: 'Teste Residuo 2 — Classe II',
        peso_liquido: 376,
      }),
    ])
    expect(t.eh_consolidado_mtr).toBe(true)
    expect(t.linhas_tickets).toHaveLength(2)
    expect(t.peso_liquido_kg).toBe('576')
    expect(t.tipo_residuo).toContain('182245-1')
    expect(t.tipo_residuo).toContain('182245-2')
    expect(t.tipo_residuo).toContain('Teste Residuo 2')
  })
})
