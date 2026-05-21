import { describe, expect, it } from 'vitest'
import {
  CONTROLE_MASSA_JANELA_DIAS_PADRAO,
  controleMassaJanelaDias,
  dataCorteIsoControleMassa,
} from './controleMassaFetch'

describe('controleMassaJanelaDias', () => {
  it('usa 120 dias por defeito', () => {
    expect(controleMassaJanelaDias()).toBe(CONTROLE_MASSA_JANELA_DIAS_PADRAO)
    expect(CONTROLE_MASSA_JANELA_DIAS_PADRAO).toBe(120)
  })
})

describe('dataCorteIsoControleMassa', () => {
  it('retorna ISO no passado', () => {
    const corte = new Date(dataCorteIsoControleMassa())
    expect(Number.isNaN(corte.getTime())).toBe(false)
    expect(corte.getTime()).toBeLessThan(Date.now())
  })
})
