import { describe, expect, it } from 'vitest'
import {
  patchResiduosItensPesoLiquido,
  pesoGravadoConfere,
  rpcPesoConferenciaDeveTentarGravacaoDireta,
} from './faturamentoTicketFluxo'
import { parsePesoLiquidoKgInput } from './pesoKgInput'

describe('peso conferência ticket', () => {
  it('parsePesoLiquidoKgInput aceita vírgula', () => {
    expect(parsePesoLiquidoKgInput('21,5')).toBe(21.5)
  })

  it('pesoGravadoConfere tolera arredondamento', () => {
    expect(pesoGravadoConfere({ peso_liquido: 21.005 }, 21)).toBe(true)
    expect(pesoGravadoConfere({ peso_liquido: 20 }, 21)).toBe(false)
  })

  it('rpcPesoConferenciaDeveTentarGravacaoDireta na mensagem de persistência antiga', () => {
    expect(
      rpcPesoConferenciaDeveTentarGravacaoDireta(
        'O peso não foi persistido na coleta (verifique RLS ou permissões).'
      )
    ).toBe(true)
    expect(rpcPesoConferenciaDeveTentarGravacaoDireta('Sem permissão para alterar o peso')).toBe(
      false
    )
  })

  it('patchResiduosItensPesoLiquido alinha bruto com tara + líquido manual', () => {
    const itens = patchResiduosItensPesoLiquido(
      [
        {
          catalogo_id: null,
          texto: 'Resíduo A',
          peso_tara: 3000,
          peso_bruto: 5000,
          peso_liquido: 2000,
        },
      ],
      4500
    )
    expect(itens).toHaveLength(1)
    expect(itens![0].peso_liquido).toBe(4500)
    expect(itens![0].peso_bruto).toBe(7500)
    expect(itens![0].peso_tara).toBe(3000)
  })
})
