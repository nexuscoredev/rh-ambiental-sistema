import { describe, expect, it } from 'vitest'
import {
  agruparLinhasPorMtrBaixada,
  mensagemMtrsNaoEncontradasEnvio,
  rotaGerenciadorHistoricoEnvio,
} from './gerenciadorMtrEnvio'

describe('agruparLinhasPorMtrBaixada', () => {
  it('agrupa pelo número e funde campos vazios', () => {
    const map = agruparLinhasPorMtrBaixada([
      {
        mtr_baixada: '123',
        data: '',
        gerador: 'G1',
        residuo: '',
        quantidade: '',
        peso: '10',
        valor_unitario: '',
        valor_total: '',
      },
      {
        mtr_baixada: '123',
        data: '2026-05-01',
        gerador: '',
        residuo: 'RCC',
        quantidade: '1000 kg',
        peso: '',
        valor_unitario: '',
        valor_total: '',
      },
    ])
    expect(map.size).toBe(1)
    const linha = map.get('123')!
    expect(linha.gerador).toBe('G1')
    expect(linha.residuo).toBe('RCC')
    expect(linha.data).toBe('2026-05-01')
    expect(linha.peso).toBe('10')
  })
})

describe('rotaGerenciadorHistoricoEnvio', () => {
  it('inclui historico e numeros pendentes na query', () => {
    const url = rotaGerenciadorHistoricoEnvio({ naoEncontrados: ['234', '876'] })
    expect(url).toContain('historico=1')
    expect(url).toContain('mtrPendentes=234%2C876')
  })
})

describe('mensagemMtrsNaoEncontradasEnvio', () => {
  it('formata uma ou várias MTRs', () => {
    expect(mensagemMtrsNaoEncontradasEnvio([])).toBe('')
    expect(mensagemMtrsNaoEncontradasEnvio(['99'])).toContain('«99»')
    expect(mensagemMtrsNaoEncontradasEnvio(['1', '2'])).toContain('2 MTR')
  })
})
