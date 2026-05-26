import { describe, expect, it } from 'vitest'
import {
  aplicarRascunhoBulkLinhasMedicao,
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

  it('aplica taxa a todas as linhas', () => {
    const linhas = aplicarRascunhoBulkLinhasMedicao([linhaBase(), { ...linhaBase(), coleta_id: 'c2', valorFrete: 0, pesoKg: 250 }], {
      quantViagens: '',
      valorFrete: '',
      pesoKg: '',
      valorTaxa: '0,60',
      total: '',
    })
    expect(linhas[0]?.valorTaxa).toBe(0.6)
    expect(linhas[1]?.valorTaxa).toBe(0.6)
    expect(linhas[1]?.total).toBe(150)
  })
})
