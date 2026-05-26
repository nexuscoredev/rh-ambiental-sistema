import { describe, expect, it } from 'vitest'
import {
  aplicarRascunhoLinhaMedicao,
  aplicarRascunhosLinhasMedicao,
  atualizarCampoRascunhoMedicao,
  linhaParaRascunhoEdicao,
  recalcularTotalLinhaMedicao,
  recalcularValorResiduoLinhaMedicao,
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

  it('recalcula total ao mudar peso no rascunho (total pré-preenchido não trava)', () => {
    const linha = linhaBase()
    const draft = linhaParaRascunhoEdicao(linha)
    const nextDraft = atualizarCampoRascunhoMedicao(linha, draft, 'pesoKg', '1000,00')
    const aplicada = aplicarRascunhoLinhaMedicao(linha, nextDraft)
    expect(aplicada.pesoKg).toBe(1000)
    expect(aplicada.total).toBe(1460)
  })

  it('respeita faturamento mínimo em kg no recálculo', () => {
    expect(
      recalcularValorResiduoLinhaMedicao({
        pesoKg: 100,
        valorTaxa: 10,
        faturamentoMinimoKg: 1500,
      })
    ).toBe(15000)
  })

  it('mantém total manual quando o utilizador edita o campo Total', () => {
    const linha = linhaBase()
    const draft = linhaParaRascunhoEdicao(linha)
    const nextDraft = atualizarCampoRascunhoMedicao(linha, draft, 'total', '999,00')
    const aplicada = aplicarRascunhoLinhaMedicao(linha, nextDraft)
    expect(aplicada.total).toBe(999)
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
