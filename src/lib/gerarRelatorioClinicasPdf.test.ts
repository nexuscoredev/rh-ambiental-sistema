import { describe, expect, it } from 'vitest'
import { calcularResumoClinicasGestao } from './gerarRelatorioClinicasPdf'

describe('calcularResumoClinicasGestao', () => {
  it('soma totais do consolidado 30d e conta status das O.S.', () => {
    const resumo = calcularResumoClinicasGestao({
      unidades: [
        {
          id: '1',
          grupo_id: 'g',
          razao_social: 'A',
          cnpj: null,
          cpf: null,
          endereco_coleta: null,
          emite_nota: false,
          pagamento_pix: true,
          ativo: true,
        },
        {
          id: '2',
          grupo_id: 'g',
          razao_social: 'B',
          cnpj: null,
          cpf: null,
          endereco_coleta: null,
          emite_nota: true,
          pagamento_pix: false,
          ativo: false,
        },
      ],
      ordens: [
        { status: 'emitida', faturamento_valor: 100 },
        { status: 'aguardando_faturamento', faturamento_valor: null },
      ],
      relatorio30d: [
        {
          unidade_id: '1',
          razao_social: 'A',
          cnpj: null,
          grupo_nome: 'CLINICA',
          qtd_os: 2,
          valor_emitido_total: 3000,
          valor_pendente_total: 500,
          primeira_data: '2026-05-01',
          ultima_data: '2026-05-20',
        },
      ],
    })

    expect(resumo.qtdUnidades).toBe(2)
    expect(resumo.qtdUnidadesAtivas).toBe(1)
    expect(resumo.qtdOrdensEmitidas).toBe(1)
    expect(resumo.qtdOrdensAguardando).toBe(1)
    expect(resumo.totalEmitido30d).toBe(3000)
    expect(resumo.totalPendente30d).toBe(500)
  })
})
