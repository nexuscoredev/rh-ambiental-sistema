import { describe, expect, it } from 'vitest'
import {
  normalizarResiduoContratoParaKg,
  parseResiduosContratoJsonb,
  residuosContratoParaJsonb,
} from './clienteContratoCadastro'

describe('normalizarResiduoContratoParaKg', () => {
  it('converte unidade ton e valor R$/ton para R$/kg', () => {
    const r = normalizarResiduoContratoParaKg({
      tipo_residuo: 'Lodo',
      classificacao: '',
      unidade_medida: 'ton',
      valor: '1.000,00',
      frequencia_coleta: '',
      faturamento_minimo: '500',
    })
    expect(r.unidade_medida).toBe('kg')
    expect(r.valor).toContain('1')
    const n = Number(r.valor.replace(/\./g, '').replace(',', '.'))
    expect(n).toBeCloseTo(1, 2)
    expect(r.faturamento_minimo).toBe('500')
  })

  it('converte faturamento mínimo legado em ton (ex.: 10) para kg na MTR', () => {
    const r = normalizarResiduoContratoParaKg({
      tipo_residuo: 'Teste',
      classificacao: '',
      unidade_medida: 'ton',
      valor: '',
      frequencia_coleta: '',
      faturamento_minimo: '10',
    })
    expect(r.unidade_medida).toBe('kg')
    expect(r.faturamento_minimo).toBe('10.000')
  })

  it('converte mínimo legado 10 com unidade já em kg (ton no JSON antigo)', () => {
    const r = normalizarResiduoContratoParaKg({
      tipo_residuo: 'Teste',
      classificacao: '',
      unidade_medida: 'kg',
      valor: '2,50',
      frequencia_coleta: '',
      faturamento_minimo: '10',
    })
    expect(r.faturamento_minimo).toBe('10.000')
  })

  it('mantém kg e não altera valor', () => {
    const r = normalizarResiduoContratoParaKg({
      tipo_residuo: 'A',
      classificacao: '',
      unidade_medida: 'kg',
      valor: '2,50',
      frequencia_coleta: '',
      faturamento_minimo: '',
    })
    expect(r.unidade_medida).toBe('kg')
    expect(r.valor).toBe('2,50')
  })

  it('parseResiduosContratoJsonb normaliza ton legado', () => {
    const itens = parseResiduosContratoJsonb([
      { tipo_residuo: 'X', unidade_medida: 'tonelada', valor: 2000, faturamento_minimo: 100 },
    ])
    expect(itens[0]?.unidade_medida).toBe('kg')
    expect(itens[0]?.valor).toContain('2')
  })

  it('residuosContratoParaJsonb grava sempre kg', () => {
    const json = residuosContratoParaJsonb([
      {
        tipo_residuo: 'Y',
        classificacao: '',
        unidade_medida: 'ton',
        valor: '500',
        frequencia_coleta: '',
        faturamento_minimo: '300',
      },
    ]) as Array<Record<string, unknown>>
    expect(json[0]?.unidade_medida).toBe('kg')
    expect(json[0]?.valor).toBe(0.5)
  })
})
