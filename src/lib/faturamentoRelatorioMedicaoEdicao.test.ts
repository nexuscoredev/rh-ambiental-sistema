import { describe, expect, it } from 'vitest'
import {
  aplicarRascunhoLinhaMedicao,
  aplicarRascunhosLinhasMedicao,
  linhaParaRascunhoEdicao,
  recalcularTotalLinhaMedicao,
} from './faturamentoRelatorioMedicaoEdicao'
import type { LinhaRelatorioMedicao } from './faturamentoRelatorioMedicao'

const linhaBase = (): LinhaRelatorioMedicao => ({
  coleta_id: 'c1',
  data: '2026-05-11',
  mtr: 'MTR-1',
  gerador: 'Cliente',
  tipoResiduo: 'Resíduo',
  placa: 'ABC1234',
  quantViagens: 1,
  valorFrete: 840,
  pesoKg: 2500,
  valorTaxa: 0.62,
  total: 2390,
})

describe('faturamentoRelatorioMedicaoEdicao', () => {
  it('recalcula total como frete + peso × taxa', () => {
    const t = recalcularTotalLinhaMedicao(linhaBase())
    expect(t.total).toBe(2390)
  })

  it('edita uma linha individualmente', () => {
    const draft = linhaParaRascunhoEdicao(linhaBase())
    draft.pesoKg = '3000,00'
    draft.total = ''
    const next = aplicarRascunhoLinhaMedicao(linhaBase(), draft)
    expect(next.pesoKg).toBe(3000)
    expect(next.total).toBe(2700)
  })

  it('aplica rascunhos distintos por coleta', () => {
    const l2 = { ...linhaBase(), coleta_id: 'c2', valorFrete: 0, pesoKg: 250, total: 155 }
    const rascunhos = {
      c1: { ...linhaParaRascunhoEdicao(linhaBase()), valorTaxa: '0,60', total: '' },
      c2: { ...linhaParaRascunhoEdicao(l2), pesoKg: '500,00', total: '' },
    }
    const linhas = aplicarRascunhosLinhasMedicao([linhaBase(), l2], rascunhos)
    expect(linhas[0]?.valorTaxa).toBe(0.6)
    expect(linhas[1]?.pesoKg).toBe(500)
    expect(linhas[1]?.total).toBe(310)
  })
})
