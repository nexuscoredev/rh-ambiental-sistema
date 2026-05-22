import { describe, expect, it } from 'vitest'
import { coletaNaFilaFaturamento } from './faturamentoOperacionalFila'
import {
  agruparGruposMedicaoPorMtr,
  agruparGruposNfBoletoPorMtr,
  coletaAguardandoConfirmacaoNfBoleto,
  coletaLiberadaParaFaturarEsteira,
  coletaNaFilaRelatorioMedicao,
  coletaPertenceGrupoMedicaoMtr,
  etapaUnificadaGrupoMedicao,
  inferirEsteiraStatus,
} from './faturamentoEsteira'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

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
    mtr_numero: 'MTR-1',
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

describe('inferirEsteiraStatus', () => {
  it('ticket aprovado sem medição → AJUSTE_VALORES_MEDICAO', () => {
    expect(inferirEsteiraStatus(row({}))).toBe('AJUSTE_VALORES_MEDICAO')
  })

  it('valores revisados → MEDICAO_PENDENTE', () => {
    expect(
      inferirEsteiraStatus(row({ faturamento_esteira_status: 'MEDICAO_PENDENTE' }))
    ).toBe('MEDICAO_PENDENTE')
  })

  it('cliente aprovou → LIBERADO_FATURAMENTO', () => {
    expect(
      inferirEsteiraStatus(
        row({ faturamento_esteira_status: 'LIBERADO_FATURAMENTO' })
      )
    ).toBe('LIBERADO_FATURAMENTO')
  })
})

describe('coletaAguardandoConfirmacaoNfBoleto', () => {
  it('emitido com esteira liberado financeiro aguarda confirmação', () => {
    expect(
      coletaAguardandoConfirmacaoNfBoleto(
        row({
          faturamento_esteira_status: 'LIBERADO_FINANCEIRO',
          faturamento_registro_status: 'emitido',
        })
      )
    ).toBe(true)
  })

  it('finalizado não aguarda', () => {
    expect(
      coletaAguardandoConfirmacaoNfBoleto(
        row({ faturamento_esteira_status: 'FINALIZADO', faturamento_registro_status: 'emitido' })
      )
    ).toBe(false)
  })
})

describe('coletaNaFilaRelatorioMedicao', () => {
  it('identifica fila de relatório', () => {
    expect(coletaNaFilaRelatorioMedicao(row({ faturamento_esteira_status: 'MEDICAO_PENDENTE' }))).toBe(
      true
    )
  })
})

describe('coletaPertenceGrupoMedicaoMtr / fila faturar', () => {
  it('inclui ticket sem medição iniciada quando irmão está na esteira', () => {
    const linhas = [
      row({
        coleta_id: 'c1',
        numero_coleta: 90001,
        faturamento_esteira_status: 'MEDICAO_AGUARDANDO_CLIENTE',
        medicao_email_enviado_em: '2026-05-20T00:00:00Z',
      }),
      row({
        coleta_id: 'c2',
        numero_coleta: 90002,
        faturamento_esteira_status: null,
        medicao_email_enviado_em: null,
      }),
    ]
    expect(coletaPertenceGrupoMedicaoMtr(linhas[1]!, linhas)).toBe(true)
    const grupos = agruparGruposMedicaoPorMtr(linhas)
    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.linhas).toHaveLength(2)
  })

  it('não libera irmão na fila para faturar enquanto outro está em medição', () => {
    const linhas = [
      row({
        coleta_id: 'c1',
        numero_coleta: 90001,
        faturamento_esteira_status: 'MEDICAO_AGUARDANDO_CLIENTE',
        medicao_email_enviado_em: '2026-05-20T00:00:00Z',
        fluxo_status: 'TICKET_GERADO',
        etapa_operacional: 'TICKET_GERADO',
        faturamento_registro_status: null,
      }),
      row({
        coleta_id: 'c2',
        numero_coleta: 90002,
        faturamento_esteira_status: null,
        fluxo_status: 'TICKET_GERADO',
        etapa_operacional: 'TICKET_GERADO',
        faturamento_registro_status: null,
      }),
    ]
    expect(coletaNaFilaFaturamento(linhas[1]!, linhas)).toBe(false)
    expect(coletaLiberadaParaFaturarEsteira(linhas[1]!, linhas)).toBe(false)
  })
})

describe('agruparGruposMedicaoPorMtr', () => {
  it('consolida vários tickets da mesma MTR num único grupo', () => {
    const grupos = agruparGruposMedicaoPorMtr([
      row({
        coleta_id: 'c1',
        numero_coleta: 90001,
        faturamento_esteira_status: 'MEDICAO_PENDENTE',
        tipo_residuo: 'Resíduo 1',
      }),
      row({
        coleta_id: 'c2',
        numero_coleta: 90002,
        faturamento_esteira_status: 'MEDICAO_EMAIL_PENDENTE',
        medicao_relatorio_gerado_em: '2026-05-20T00:00:00Z',
        tipo_residuo: 'Resíduo 2',
      }),
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.linhas).toHaveLength(2)
    expect(etapaUnificadaGrupoMedicao(grupos[0]!.linhas)).toBe('relatorio')
  })
})

describe('agruparGruposNfBoletoPorMtr', () => {
  it('consolida tickets da mesma MTR num único registo de NF', () => {
    const base = {
      faturamento_esteira_status: 'LIBERADO_FINANCEIRO' as const,
      faturamento_registro_status: 'emitido' as const,
      mtr_id: 'm1',
      mtr_numero: 'MTR-1',
      cliente_id: 'cli',
    }
    const grupos = agruparGruposNfBoletoPorMtr([
      row({ ...base, coleta_id: 'c1', numero_coleta: 90001 }),
      row({ ...base, coleta_id: 'c2', numero_coleta: 90002 }),
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.linhas).toHaveLength(2)
  })
})

describe('coletaLiberadaParaFaturarEsteira', () => {
  it('libera só com status correto', () => {
    expect(coletaLiberadaParaFaturarEsteira(row({ faturamento_esteira_status: 'LIBERADO_FATURAMENTO' }))).toBe(
      true
    )
    expect(coletaLiberadaParaFaturarEsteira(row({ faturamento_esteira_status: 'MEDICAO_PENDENTE' }))).toBe(
      false
    )
  })
})
