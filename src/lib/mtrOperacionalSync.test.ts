import { describe, expect, it } from 'vitest'
import {
  montarPatchColetaDesdeMtr,
  resolverLinhaMtrParaColeta,
} from './mtrOperacionalSync'
import { linhaVaziaResiduoPesagem } from './residuosPesagem'
import type { MtrResiduoDetalhesCampos } from './mtrClienteContratoAutofill'

const camposA: MtrResiduoDetalhesCampos = {
  fonte_origem: 'Industrial',
  caracterizacao: 'Lodo A',
  estado_fisico: 'SÓLIDO',
  acondicionamento: 'Big bag',
  quantidade_aproximada: '1500',
  onu: '',
}

const camposB: MtrResiduoDetalhesCampos = {
  ...camposA,
  caracterizacao: 'Lodo B',
  quantidade_aproximada: '800',
}

describe('resolverLinhaMtrParaColeta', () => {
  it('associa coleta ao resíduo correspondente quando há segmentação', () => {
    const linhas = [
      { ...linhaVaziaResiduoPesagem(), texto: 'Lodo A — SÓLIDO' },
      { ...linhaVaziaResiduoPesagem(), texto: 'Lodo B — SÓLIDO' },
    ]
    const { linha } = resolverLinhaMtrParaColeta(
      { tipo_residuo: 'Lodo B — SÓLIDO', residuos_itens: null },
      linhas,
      [camposA, camposB],
      0,
      true
    )
    expect(linha.texto).toContain('Lodo B')
  })
})

describe('montarPatchColetaDesdeMtr', () => {
  it('espelha resíduo e peso da MTR sem apagar peso já conferido', () => {
    const patch = montarPatchColetaDesdeMtr(
      {
        tipo_residuo: 'Antigo',
        residuos_itens: [
          {
            texto: 'Antigo',
            peso_tara: '',
            peso_bruto: '',
            peso_liquido: '2000',
          },
        ],
        peso_liquido: 2000,
        motorista: 'João',
        placa: 'ABC1D23',
      },
      { ...linhaVaziaResiduoPesagem(), texto: 'Lodo A — SÓLIDO' },
      camposA,
      { motorista: 'Maria', placa: 'XYZ9Z99' },
      5000,
      false,
      1
    )

    expect(patch.tipo_residuo).toBe('Lodo A — SÓLIDO')
    expect(patch.motorista).toBe('Maria')
    expect(patch.placa).toBe('XYZ9Z99')
    expect(patch.peso_liquido).toBeUndefined()
    const itens = patch.residuos_itens as { peso_liquido: number }[]
    expect(itens[0]?.peso_liquido).toBe(2000)
  })

  it('preenche peso da MTR quando o ticket ainda não tem peso', () => {
    const patch = montarPatchColetaDesdeMtr(
      {
        tipo_residuo: '',
        residuos_itens: null,
        peso_liquido: null,
        motorista: null,
        placa: null,
      },
      { ...linhaVaziaResiduoPesagem(), texto: 'Lodo A — SÓLIDO' },
      camposA,
      { motorista: '', placa: '' },
      null,
      true,
      2
    )

    expect(patch.peso_liquido).toBe(1500)
  })
})
