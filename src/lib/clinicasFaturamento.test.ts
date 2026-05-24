import { describe, expect, it } from 'vitest'
import { exigeReferenciaNfNaEmissao, parseValorClinicaInput } from './clinicasFaturamento'
import type { ClinicaFilaFaturamentoRow } from './clinicasTypes'

function row(partial: Partial<ClinicaFilaFaturamentoRow>): ClinicaFilaFaturamentoRow {
  return {
    ordem_servico_id: 'os1',
    numero_os: 'OS-CLIN-2026-0001',
    os_status: 'aguardando_faturamento',
    data_servico: '2026-05-22',
    emite_nota_snapshot: false,
    pagamento_pix_snapshot: true,
    os_observacoes: null,
    referencia_nf: null,
    nf_registrada_em: null,
    os_created_at: '2026-05-22T12:00:00Z',
    unidade_id: 'u1',
    razao_social: 'Teste',
    cnpj: null,
    cpf: null,
    endereco_coleta: null,
    grupo_nome: 'CLINICA',
    faturamento_registro_id: null,
    faturamento_valor: null,
    faturamento_observacoes: null,
    faturamento_status: 'pendente',
    conta_receber_id: null,
    status_pagamento: null,
    meio_cobranca: 'pix',
    ...partial,
  }
}

describe('clinicasFaturamento', () => {
  it('parseValorClinicaInput aceita vírgula', () => {
    expect(parseValorClinicaInput('1.250,50')).toBe(1250.5)
  })

  it('exige NF quando emite_nota', () => {
    expect(exigeReferenciaNfNaEmissao(row({ emite_nota_snapshot: true, pagamento_pix_snapshot: false }))).toBe(
      true
    )
    expect(exigeReferenciaNfNaEmissao(row({ emite_nota_snapshot: false, pagamento_pix_snapshot: true }))).toBe(
      false
    )
  })
})
