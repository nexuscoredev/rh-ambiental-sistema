import { describe, expect, it } from 'vitest'
import {
  atividadeGeradorDesdeClienteProgramacao,
  resolverAtividadeGeradorMtr,
  enriquecerClienteEnderecoAutofill,
  inferirCidadeEstadoEnderecoTexto,
  montarCidadeUfCliente,
  parseCidadeUfCampoTopo,
  patchCidadeEnderecoGeradorDesdeCliente,
} from './mtrCadastroClienteAutofill'

describe('mtrCadastroClienteAutofill', () => {
  it('resolve atividade do gerador sem usar classificação de resíduo', () => {
    expect(
      atividadeGeradorDesdeClienteProgramacao(
        { observacoes_operacionais: 'Hospitalar' },
        { tipo_servico: 'RSS' }
      )
    ).toBe('RSS')
    expect(
      atividadeGeradorDesdeClienteProgramacao({}, { tipo_servico: 'Coleta fixa' })
    ).toBe('Coleta fixa')
    expect(
      atividadeGeradorDesdeClienteProgramacao(
        { observacoes_operacionais: '  Cadastro  ' },
        { tipo_servico: '' }
      )
    ).toBe('Cadastro')
  })

  it('resolverAtividadeGeradorMtr ignora atividade salva com classe de resíduo', () => {
    expect(resolverAtividadeGeradorMtr('Classe II | Classe II', 'Coleta RSS')).toBe('Coleta RSS')
    expect(resolverAtividadeGeradorMtr('Laboratório', 'RSS')).toBe('Laboratório')
  })

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

  it('infere cidade e UF do endereço de coleta', () => {
    expect(
      inferirCidadeEstadoEnderecoTexto(
        'Rua X, 100 — CEP 18190-000, Bairro Centro, Araçariguama, SP'
      )
    ).toEqual({ cidade: 'Araçariguama', estado: 'SP' })
  })

  it('enriquece cadastro quando cidade/UF só estão no endereço livre', () => {
    const r = enriquecerClienteEnderecoAutofill({
      nome: 'A',
      razao_social: null,
      cidade: null,
      estado: null,
      cep: null,
      rua: null,
      numero: null,
      complemento: null,
      bairro: null,
      endereco_coleta: 'Av. Principal, 50, Jundiaí — SP',
    })
    expect(r.cidade).toBe('Jundiaí')
    expect(r.estado).toBe('SP')
    expect(montarCidadeUfCliente(r)).toBe('Jundiaí — SP')
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
