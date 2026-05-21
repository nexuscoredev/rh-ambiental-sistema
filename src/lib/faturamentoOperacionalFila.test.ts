import { describe, expect, it } from 'vitest'
import {
  coletaHistoricoFaturamentoEmitido,
  coletaNaFilaFaturamento,
  coletaProntaNaVistaExcluindoFluxoTicket,
} from './faturamentoOperacionalFila'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

function linhaBase(
  patch: Partial<FaturamentoResumoViewRow> = {}
): FaturamentoResumoViewRow {
  return {
    coleta_id: 'c1',
    numero: '90001',
    numero_coleta: 90001,
    cliente_id: 'cli',
    cliente_nome: 'Cliente',
    data_agendada: '2026-05-20',
    tipo_residuo: 'Resíduo',
    cidade: 'SP',
    created_at: '2026-05-20T10:00:00Z',
    status_conferencia: 'PRONTO_PARA_FATURAR',
    peso_liquido: 100,
    mtr_id: 'm1',
    ticket_impresso_em: '2026-05-20T11:00:00Z',
    faturamento_ticket_aprovado_em: '2026-05-20T12:00:00Z',
    fluxo_status: 'ENVIADO_FINANCEIRO',
    etapa_operacional: 'ENVIADO_FINANCEIRO',
    faturamento_registro_status: 'emitido',
    ...patch,
  } as FaturamentoResumoViewRow
}

describe('coletaProntaNaVistaExcluindoFluxoTicket', () => {
  it('não conta coleta já emitida ao Financeiro', () => {
    const row = linhaBase()
    expect(coletaHistoricoFaturamentoEmitido(row)).toBe(true)
    expect(coletaNaFilaFaturamento(row)).toBe(false)
    expect(coletaProntaNaVistaExcluindoFluxoTicket(row)).toBe(false)
  })

  it('conta coleta liberada para faturar (medição aprovada)', () => {
    const row = linhaBase({
      fluxo_status: 'TICKET_GERADO',
      etapa_operacional: 'TICKET_GERADO',
      faturamento_registro_status: 'pendente',
      faturamento_esteira_status: 'LIBERADO_FATURAMENTO',
      medicao_cliente_aprovado_em: '2026-05-20T13:00:00Z',
    })
    expect(coletaNaFilaFaturamento(row)).toBe(true)
    expect(coletaProntaNaVistaExcluindoFluxoTicket(row)).toBe(true)
  })
})
