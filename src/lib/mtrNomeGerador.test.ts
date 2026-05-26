import { describe, expect, it } from 'vitest'
import {
  deveAtualizarGeradorMtrDesdeCadastro,
  exibirNomeGeradorMtr,
  nomeGeradorParaMtr,
  resolverNomeGeradorMtr,
} from './mtrNomeGerador'

describe('nomeGeradorParaMtr', () => {
  it('prioriza razão social e depois nome', () => {
    expect(
      nomeGeradorParaMtr({ razao_social: 'Clínica ABC LTDA', nome: 'ABC' }, 'Cliente X')
    ).toBe('Clínica ABC LTDA')
    expect(nomeGeradorParaMtr({ nome: 'Fantasia' }, 'Cliente X')).toBe('Fantasia')
    expect(nomeGeradorParaMtr({}, 'Cliente X')).toBe('Cliente X')
  })
})

describe('resolverNomeGeradorMtr', () => {
  it('usa cliente quando gerador vazio ou traço', () => {
    expect(
      resolverNomeGeradorMtr({ gerador: '', cliente: 'Clínica Sul', tipoResiduo: 'RSS' })
    ).toBe('Clínica Sul')
    expect(
      resolverNomeGeradorMtr({ gerador: '—', cliente: 'Clínica Sul', tipoResiduo: 'RSS' })
    ).toBe('Clínica Sul')
  })

  it('não confunde gerador com tipo de resíduo', () => {
    expect(
      resolverNomeGeradorMtr({
        gerador: 'RSS',
        cliente: 'Hospital Central',
        tipoResiduo: 'RSS',
      })
    ).toBe('Hospital Central')
  })

  it('mantém gerador válido distinto do resíduo', () => {
    expect(
      resolverNomeGeradorMtr({
        gerador: 'Laboratório Norte',
        cliente: 'Outro',
        tipoResiduo: 'RSS',
      })
    ).toBe('Laboratório Norte')
  })

  it('deveAtualizarGeradorMtrDesdeCadastro quando só há nome da programação', () => {
    expect(
      deveAtualizarGeradorMtrDesdeCadastro('Clínica X', 'Clínica X', 'Clínica X Serviços LTDA')
    ).toBe(true)
    expect(
      deveAtualizarGeradorMtrDesdeCadastro('Clínica X Serviços LTDA', 'Clínica X', 'Clínica X Serviços LTDA')
    ).toBe(false)
  })

  it('exibirNomeGeradorMtr usa placeholder', () => {
    expect(exibirNomeGeradorMtr({ gerador: '', cliente: '' })).toBe('—')
    expect(exibirNomeGeradorMtr({ gerador: '', cliente: 'A' })).toBe('A')
  })
})
