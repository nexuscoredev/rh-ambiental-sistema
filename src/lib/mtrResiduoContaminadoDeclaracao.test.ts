import { describe, expect, it } from 'vitest'
import {
  estadoFisicoDeclaracaoDesdeTexto,
  montarDeclaracaoResiduoContaminadoFromMtr,
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
    expect(d.classeResiduo).toBe('EFLUENTE')
    expect(d.estadoFisico).toBe('liquido')
    expect(d.destino.razao_social).toContain('RG AMBIENTAL')
  })

  it('estadoFisicoDeclaracaoDesdeTexto reconhece variantes', () => {
    expect(estadoFisicoDeclaracaoDesdeTexto('SÓLIDO')).toBe('solido')
    expect(estadoFisicoDeclaracaoDesdeTexto('pastoso')).toBe('pastoso')
    expect(estadoFisicoDeclaracaoDesdeTexto('')).toBe('')
  })
})
