import { describe, expect, it } from 'vitest'
import { rotuloMotivoInelegivel } from './faturamentoElegibilidade'

describe('mtrCicloVida / elegibilidade', () => {
  it('rotulo para MTR cancelada', () => {
    expect(rotuloMotivoInelegivel('mtr_cancelada')).toMatch(/cancelada/i)
  })
})
