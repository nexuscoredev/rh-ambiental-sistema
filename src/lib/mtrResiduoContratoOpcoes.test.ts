import { describe, expect, it } from 'vitest'
import { escolherTipoResiduoContratoMtr, opcoesResiduoContratoMtr } from './mtrResiduoContratoOpcoes'

describe('mtrResiduoContratoOpcoes', () => {
  const residuos = [
    {
      tipo_residuo: 'Resíduos Sólidos Diversos',
      classificacao: 'Classe I',
      unidade_medida: 'kg',
      valor: '1',
      frequencia_coleta: '',
      faturamento_minimo: '',
    },
    {
      tipo_residuo: 'Efluente Industrial',
      classificacao: 'Classe I',
      unidade_medida: 'kg',
      valor: '2',
      frequencia_coleta: '',
      faturamento_minimo: '',
    },
  ]

  it('gera uma opção por resíduo do contrato', () => {
    const op = opcoesResiduoContratoMtr(residuos)
    expect(op).toHaveLength(2)
    expect(op[0]!.value).toContain('Resíduos Sólidos')
    expect(op[1]!.value).toContain('Efluente')
  })

  it('não concatena todos os resíduos no valor inicial', () => {
    const escolhido = escolherTipoResiduoContratoMtr(residuos)
    expect(escolhido).not.toContain(' · ')
    expect(escolhido).toContain('Resíduos Sólidos')
  })

  it('prefere tipo da programação quando coincide', () => {
    const escolhido = escolherTipoResiduoContratoMtr(residuos, {
      preferencia: 'Efluente Industrial',
    })
    expect(escolhido).toContain('Efluente')
  })
})
