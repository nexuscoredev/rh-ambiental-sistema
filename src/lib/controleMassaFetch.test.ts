import { describe, expect, it } from 'vitest'
import {
  CONTROLE_MASSA_JANELA_DIAS_PADRAO,
  controleMassaJanelaDias,
  dataCorteIsoControleMassa,
  resolverDataCampoPesagemForm,
} from './controleMassaFetch'

describe('controleMassaJanelaDias', () => {
  it('usa 120 dias por defeito', () => {
    expect(controleMassaJanelaDias()).toBe(CONTROLE_MASSA_JANELA_DIAS_PADRAO)
    expect(CONTROLE_MASSA_JANELA_DIAS_PADRAO).toBe(120)
  })
})

describe('resolverDataCampoPesagemForm', () => {
  it('prioriza pesagem gravada e deixa vazio em ticket novo', () => {
    expect(
      resolverDataCampoPesagemForm({
        coletaId: 'c1',
        prevColetaId: 'c1',
        prevData: '2026-05-27',
        pesagem: { data: '2026-05-20' },
      })
    ).toBe('2026-05-20')

    expect(
      resolverDataCampoPesagemForm({
        coletaId: 'c2',
        prevColetaId: 'c1',
        prevData: '2026-05-27',
      })
    ).toBe('')

    expect(
      resolverDataCampoPesagemForm({
        coletaId: 'c3',
        prevColetaId: '',
        prevData: '',
        coletaDataExecucao: '2026-04-15',
      })
    ).toBe('2026-04-15')
  })
})

describe('dataCorteIsoControleMassa', () => {
  it('retorna ISO no passado', () => {
    const corte = new Date(dataCorteIsoControleMassa())
    expect(Number.isNaN(corte.getTime())).toBe(false)
    expect(corte.getTime()).toBeLessThan(Date.now())
  })
})
