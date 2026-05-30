import { describe, expect, it } from 'vitest'
import { formatarDataRh, rhColaboradorParaRelatorio } from './rhColaboradores'

describe('rhColaboradores', () => {
  it('formata data ISO para pt-BR', () => {
    expect(formatarDataRh('2026-05-15')).toBe('15/05/2026')
    expect(formatarDataRh(null)).toBe('—')
  })

  it('monta linha de relatório', () => {
    const linha = rhColaboradorParaRelatorio({
      id: '1',
      nome: 'Ana Silva',
      cpf: '123.456.789-09',
      data_admissao: '2026-01-10',
      cargo_funcao: 'Assistente',
      departamento: 'Administrativo',
      status: 'Ativo',
      email: 'ana@empresa.com',
      telefone: null,
      observacoes: null,
      motorista_id: null,
      created_at: null,
      updated_at: null,
      motoristas: { nome: 'João Motorista' },
    })
    expect(linha.nome).toBe('Ana Silva')
    expect(linha.dataAdmissao).toBe('10/01/2026')
    expect(linha.motorista).toBe('João Motorista')
  })
})
