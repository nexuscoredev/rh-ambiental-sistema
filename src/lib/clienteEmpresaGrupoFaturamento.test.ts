import { describe, expect, it } from 'vitest'
import {
  normalizarEmpresaGrupoFaturamentoForm,
  payloadEmpresaGrupoFaturamento,
  rotuloEmpresaGrupoFaturamento,
} from './clienteEmpresaGrupoFaturamento'

describe('clienteEmpresaGrupoFaturamento', () => {
  it('normaliza objeto parcial', () => {
    expect(
      normalizarEmpresaGrupoFaturamentoForm({ rg1: true, rg1_caixa: true, rg2: 'x' })
    ).toEqual({
      rg1: true,
      rg1_brasdeco: false,
      rg1_caixa: true,
      rg1_itau: false,
      rg2: false,
      sdl: false,
    })
  })

  it('monta payload null quando vazio', () => {
    expect(
      payloadEmpresaGrupoFaturamento({
        rg1: false,
        rg1_brasdeco: false,
        rg1_caixa: false,
        rg1_itau: false,
        rg2: false,
        sdl: false,
      })
    ).toEqual({ empresa_grupo_faturamento: null })
  })

  it('limpa sub-opções RG1 quando RG1 desmarcado', () => {
    expect(
      payloadEmpresaGrupoFaturamento({
        rg1: false,
        rg1_brasdeco: true,
        rg1_caixa: true,
        rg1_itau: true,
        rg2: true,
        sdl: false,
      })
    ).toEqual({
      empresa_grupo_faturamento: {
        rg1: null,
        rg1_brasdeco: null,
        rg1_caixa: null,
        rg1_itau: null,
        rg2: true,
        sdl: null,
      },
    })
  })

  it('formata rótulo para exibição', () => {
    expect(
      rotuloEmpresaGrupoFaturamento({
        rg1: true,
        rg1_brasdeco: true,
        rg1_caixa: false,
        rg1_itau: true,
        rg2: false,
        sdl: true,
      })
    ).toBe('RG 1 (Bradesco, Itaú) · SDL')
  })
})
