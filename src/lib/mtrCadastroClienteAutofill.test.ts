import { describe, expect, it } from 'vitest'
import {
  montarCidadeUfCliente,
  parseCidadeUfCampoTopo,
  patchCidadeEnderecoGeradorDesdeCliente,
} from './mtrCadastroClienteAutofill'

describe('mtrCadastroClienteAutofill', () => {
  it('monta cidade e UF do cadastro', () => {
    expect(montarCidadeUfCliente({ cidade: 'Araçariguama', estado: 'SP' })).toBe(
      'Araçariguama — SP'
    )
  })

  it('interpreta campo combinado do topo', () => {
    expect(parseCidadeUfCampoTopo('Campinas — SP')).toEqual({
      cidade: 'Campinas',
      estado: 'SP',
      combinado: 'Campinas — SP',
    })
  })

  it('preenche somente campos vazios', () => {
    const patch = patchCidadeEnderecoGeradorDesdeCliente(
      { nome: 'X', razao_social: null, cidade: 'Jundiaí', estado: 'SP', cep: null, rua: null, numero: null, complemento: null, bairro: null, endereco_coleta: null },
      { cidadeTopo: '', endereco: 'Rua antiga', gerador: { cidade: '', estado: '' } },
      { somenteVazios: true }
    )
    expect(patch.cidadeTopo).toBe('Jundiaí — SP')
    expect(patch.endereco).toBeUndefined()
    expect(patch.gerador?.cidade).toBe('Jundiaí')
  })
})
