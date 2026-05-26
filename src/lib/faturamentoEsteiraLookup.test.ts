import { describe, expect, it } from 'vitest'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { linhasEtapaPorColetas, resumirPassoPrincipal, rotuloPassoEsteira } from './faturamentoEsteiraLookup'

function row(partial: Partial<FaturamentoResumoViewRow>): FaturamentoResumoViewRow {
  return {
    coleta_id: 'c1',
    numero: '1',
    numero_coleta: 1,
    cliente_id: 'cli',
    cliente_nome: 'Cliente',
    data_agendada: '2026-05-01',
    data_programacao: null,
    data_execucao: null,
    programacao_id: null,
    programacao_numero: null,
    programacao_observacoes: null,
    mtr_id: 'm1',
    mtr_numero: '100/2026',
    mtr_observacoes: null,
    ticket_comprovante: 'T-1',
    peso_tara: 1000,
    peso_bruto: 7000,
    peso_liquido: 6000,
    motorista: 'João',
    placa: 'ABC-1234',
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
    tipo_residuo: 'Resíduo A',
    cidade: 'SP',
    created_at: '2026-05-01T00:00:00Z',
    ultima_aprovacao_decisao: null,
    ultima_aprovacao_obs: null,
    ultima_aprovacao_em: null,
    conferencia_documentos_ok: null,
    conferencia_operacional_obs: null,
    conferencia_em: null,
    status_conferencia: 'PRONTO_PARA_FATURAR',
    pendencias_resumo: null,
    status_faturamento: null,
    faturamento_ticket_aprovado_em: '2026-05-02T00:00:00Z',
    ...partial,
  } as FaturamentoResumoViewRow
}

describe('rotuloPassoEsteira', () => {
  it('formata passo conhecido', () => {
    expect(rotuloPassoEsteira(3)).toBe('3. Relatório medição')
  })

  it('indica fora da esteira quando null', () => {
    expect(rotuloPassoEsteira(null)).toBe('Fora da esteira de faturamento')
  })
})

describe('linhasEtapaPorColetas', () => {
  it('mapeia ticket aprovado para passo 2', () => {
    const linhas = linhasEtapaPorColetas([row({})])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.passo).toBe(2)
    expect(linhas[0]?.rotulo_passo).toBe('2. Ajuste de valores')
  })
})

describe('resumirPassoPrincipal', () => {
  it('sem coletas indica ausência de vínculo', () => {
    const r = resumirPassoPrincipal([], [])
    expect(r.passo_principal).toBeNull()
    expect(r.rotulo_passo_principal).toContain('Sem coleta vinculada')
  })

  it('detecta passos distintos entre coletas', () => {
    const a = row({
      coleta_id: 'a',
      numero_coleta: 1,
      faturamento_esteira_status: 'MEDICAO_PENDENTE',
    })
    const b = row({
      coleta_id: 'b',
      numero_coleta: 2,
      faturamento_esteira_status: 'AJUSTE_VALORES_MEDICAO',
    })
    const linhas = linhasEtapaPorColetas([a, b], [a, b])
    const r = resumirPassoPrincipal(linhas, [a, b])
    expect(r.passos_distintos).toBe(true)
  })
})
