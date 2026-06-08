import { describe, expect, it } from 'vitest'
import {
  avisosConferenciaDeclaracao,
  DECLARACAO_RESIDUO_RG_ANEXO2,
  estadoFisicoDeclaracaoDesdeTexto,
  formatarResiduosDeclaracaoTexto,
  montarDeclaracaoResiduoContaminadoFromMtr,
  type DeclaracaoResiduoContaminadoDados,
} from './mtrResiduoContaminadoDeclaracao'

describe('mtrResiduoContaminadoDeclaracao', () => {
  it('mapeia estado físico e dados do gerador a partir da MTR', () => {
    const d = montarDeclaracaoResiduoContaminadoFromMtr({
      numero: 'MTR-100',
      cliente: 'Clínica Teste',
      gerador: '',
      endereco: 'Rua A, 10',
      cidade: 'São Paulo/SP',
      tipo_residuo: 'RSS',
      quantidade: 150,
      unidade: 'kg',
      detalhes: {
        gerador: { cnpj: '12.345.678/0001-99' },
        residuo: { estado_fisico: 'LÍQUIDO', quantidade_aproximada: '' },
      },
    })
    expect(d.numeroMtr).toBe('MTR-100')
    expect(d.gerador.razaoSocial).toBe('Clínica Teste')
    expect(d.gerador.cnpj).toBe('12.345.678/0001-99')
    expect(d.gerador.endereco).toContain('Rua A, 10')
    expect(d.residuos).toEqual([''])
    expect(d.estadoFisico).toBe('liquido')
    expect(d.destino.razao_social).toContain('RG AMBIENTAL')
  })

  it('estadoFisicoDeclaracaoDesdeTexto reconhece variantes', () => {
    expect(estadoFisicoDeclaracaoDesdeTexto('SÓLIDO')).toBe('solido')
    expect(estadoFisicoDeclaracaoDesdeTexto('pastoso')).toBe('pastoso')
    expect(estadoFisicoDeclaracaoDesdeTexto('')).toBe('')
  })

  it('formatarResiduosDeclaracaoTexto junta vários tipos', () => {
    expect(formatarResiduosDeclaracaoTexto(['EFLUENTE'])).toBe('EFLUENTE')
    expect(formatarResiduosDeclaracaoTexto(['EFLUENTE', 'RSS'])).toBe('EFLUENTE e RSS')
    expect(formatarResiduosDeclaracaoTexto(['A', 'B', 'C'])).toBe('A, B e C')
    expect(formatarResiduosDeclaracaoTexto(['', '  '])).toBe('')
  })

  it('conferência exige pelo menos um resíduo e não exige quantidade (Kg)', () => {
    const base: DeclaracaoResiduoContaminadoDados = {
      numeroMtr: 'MTR-1',
      gerador: { razaoSocial: 'ETHOS', cnpj: '10.313.205/0001-80', endereco: 'Rua X' },
      quantidadeKg: '',
      residuos: [''],
      estadoFisico: 'liquido',
      destino: DECLARACAO_RESIDUO_RG_ANEXO2,
      transporte: DECLARACAO_RESIDUO_RG_ANEXO2,
      assinatura: {
        responsavel: '',
        departamento: '',
        email: '',
        telefone: '',
        data: '01/06/2026',
      },
    }
    expect(avisosConferenciaDeclaracao(base)).toContain('Pelo menos um resíduo (tipo/classe)')
    expect(avisosConferenciaDeclaracao({ ...base, residuos: ['EFLUENTE'] })).toEqual([])
    expect(avisosConferenciaDeclaracao(base)).not.toContain('Quantidade (Kg)')
  })
})
