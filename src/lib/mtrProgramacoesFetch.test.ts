import { describe, expect, it } from 'vitest'
import {
  MTR_PROGRAMACOES_MESES_PADRAO,
  coletarProgramacaoIdsVinculadasMtr,
  mergeProgramacoesMtrPorId,
  mtrProgramacoesMesesJanela,
} from './mtrProgramacoesFetch'

describe('mtrProgramacoesMesesJanela', () => {
  it('usa 6 meses por defeito', () => {
    expect(mtrProgramacoesMesesJanela()).toBe(MTR_PROGRAMACOES_MESES_PADRAO)
    expect(MTR_PROGRAMACOES_MESES_PADRAO).toBe(6)
  })
})

describe('mergeProgramacoesMtrPorId', () => {
  it('deduplica por id', () => {
    const a = [{ id: '1', numero: 'A' }]
    const b = [{ id: '1', numero: 'B' }, { id: '2', numero: 'C' }]
    const m = mergeProgramacoesMtrPorId(a, b)
    expect(m).toHaveLength(2)
    expect(m.find((x) => x.id === '1')?.numero).toBe('B')
  })
})

describe('coletarProgramacaoIdsVinculadasMtr', () => {
  it('reúne ids de mtr, coleta e extras', () => {
    const ids = coletarProgramacaoIdsVinculadasMtr(
      [{ programacao_id: 'p1' }],
      [{ programacao_id: 'p2' }],
      ['p2', 'p3', '']
    )
    expect(ids.sort()).toEqual(['p1', 'p2', 'p3'])
  })
})
