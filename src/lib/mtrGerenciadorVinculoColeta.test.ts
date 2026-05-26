import { describe, expect, it } from 'vitest'
import { separarColetasParaVinculo } from './mtrGerenciadorVinculoColeta'

describe('separarColetasParaVinculo', () => {
  it('aceita coletas sem mtr_id ou já da mesma MTR', () => {
    const rows = [
      { id: 'a', mtr_id: null },
      { id: 'b', mtr_id: 'm1' },
      { id: 'c', mtr_id: 'outra' },
    ]
    const { elegiveis, bloqueadas } = separarColetasParaVinculo(['a', 'b', 'c'], rows, 'm1')
    expect(elegiveis).toEqual(['a', 'b'])
    expect(bloqueadas).toEqual(['c'])
  })
})
