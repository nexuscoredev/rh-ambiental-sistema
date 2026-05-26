import { describe, expect, it } from 'vitest'
import {
  normalizarGeradorDonoFaturamentoOpcao,
  payloadGeradorDonoFaturamento,
  validarGeradorDonoFaturamentoForm,
} from './clienteGeradorDonoFaturamento'

describe('clienteGeradorDonoFaturamento', () => {
  it('valida obrigatoriedade e titular quando não', () => {
    expect(validarGeradorDonoFaturamentoForm({
      gerador_dono_faturamento: '',
      faturamento_titular_razao_social: '',
      faturamento_titular_cnpj: '',
    }).ok).toBe(false)

    expect(
      validarGeradorDonoFaturamentoForm({
        gerador_dono_faturamento: 'nao',
        faturamento_titular_razao_social: '',
        faturamento_titular_cnpj: '12',
      }).ok
    ).toBe(false)

    expect(
      validarGeradorDonoFaturamentoForm({
        gerador_dono_faturamento: 'nao',
        faturamento_titular_razao_social: 'Outra LTDA',
        faturamento_titular_cnpj: '12.345.678/0001-90',
      }).ok
    ).toBe(true)
  })

  it('monta payload', () => {
    expect(
      payloadGeradorDonoFaturamento({
        gerador_dono_faturamento: 'sim',
        faturamento_titular_razao_social: 'x',
        faturamento_titular_cnpj: 'y',
      })
    ).toEqual({
      gerador_dono_faturamento: 'sim',
      faturamento_titular_razao_social: null,
      faturamento_titular_cnpj: null,
    })
  })

  it('normaliza opções', () => {
    expect(normalizarGeradorDonoFaturamentoOpcao('SIM')).toBe('sim')
    expect(normalizarGeradorDonoFaturamentoOpcao('Não')).toBe('nao')
  })
})
