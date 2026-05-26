import { describe, expect, it } from 'vitest'
import {
  mesclarLinhasRelatorioMtrGerenciador,
  normalizarNumeroMtrRelatorio,
  type MtrGerenciadorRelatorioLinha,
} from './mtrGerenciadorRelatorio'

function linhaMinima(
  partial: Partial<MtrGerenciadorRelatorioLinha> & Pick<MtrGerenciadorRelatorioLinha, 'chave' | 'mtrNumero' | 'origem'>
): MtrGerenciadorRelatorioLinha {
  return {
    chave: partial.chave,
    origem: partial.origem,
    linhaCadastroId: partial.linhaCadastroId ?? null,
    gerenciadorId: partial.gerenciadorId ?? null,
    gerenciadorNome: partial.gerenciadorNome ?? null,
    mtrId: partial.mtrId ?? '',
    mtrNumero: partial.mtrNumero,
    baixadaEm: '—',
    baixaJustificativa: '—',
    cenarioComplexo: false,
    gerador: '—',
    residuo: '—',
    quantidade: '—',
    quantidadeNum: null,
    unidade: '',
    clienteMtr: '—',
    coletaId: null,
    numeroColeta: '—',
    clienteNome: '—',
    pesoLiquidoKg: '—',
    pesoLiquidoNum: null,
    statusConferencia: '—',
    pendencias: '—',
    passoEsteira: '—',
    naFilaFaturar: false,
    bloqueios: [],
    registroFaturamento: '—',
    urlFaturamento: null,
    urlMalaDiretaMedicao: null,
    urlMalaDiretaNf: null,
    urlMtr: null,
    urlControleMassa: null,
    podeEnviarParaFilaFaturamento: false,
    bloqueioEnviarFila: null,
    tooltipEnviarFilaFaturamento: '',
  }
}

describe('normalizarNumeroMtrRelatorio', () => {
  it('ignora espaços e caixa', () => {
    expect(normalizarNumeroMtrRelatorio('  ABC 123 ')).toBe('abc123')
  })
})

describe('mesclarLinhasRelatorioMtrGerenciador', () => {
  it('mantém cadastro manual quando não há MTR baixada no sistema', () => {
    const sistema: MtrGerenciadorRelatorioLinha[] = []
    const cadastro = [
      linhaMinima({
        chave: 'cadastro-1',
        origem: 'cadastro_manual',
        mtrNumero: '999',
        linhaCadastroId: '1',
      }),
    ]
    const merged = mesclarLinhasRelatorioMtrGerenciador(sistema, cadastro)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.origem).toBe('cadastro_manual')
  })

  it('remove duplicata manual se o número já está no relatório do sistema', () => {
    const sistema = [
      linhaMinima({
        chave: 'mtr-1',
        origem: 'sistema',
        mtrId: 'uuid-1',
        mtrNumero: '123',
      }),
    ]
    const cadastro = [
      linhaMinima({
        chave: 'cadastro-1',
        origem: 'cadastro_manual',
        mtrNumero: '123',
        linhaCadastroId: '1',
      }),
    ]
    const merged = mesclarLinhasRelatorioMtrGerenciador(sistema, cadastro)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.origem).toBe('sistema')
  })
})
