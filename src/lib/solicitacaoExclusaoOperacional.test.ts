import { describe, expect, it } from 'vitest'
import { motivoExclusaoValido, rotuloTipoEntidadeExclusao } from './solicitacaoExclusaoOperacional'
import {
  cargoPodeSolicitarExclusaoMtr,
  cargoPodeSolicitarExclusaoProgramacao,
  usuarioEhAprovadorExclusaoOperacionalThais,
} from './workflowPermissions'
import { CARGO_COMERCIAL_ADM, CARGO_OPERADORES_TIME_R } from './workflowPermissions'

describe('solicitacaoExclusaoOperacional', () => {
  it('valida motivo mínimo', () => {
    expect(motivoExclusaoValido('')).toBe(false)
    expect(motivoExclusaoValido('ab')).toBe(false)
    expect(motivoExclusaoValido('  motivo  ')).toBe(true)
  })

  it('rotula tipo de entidade', () => {
    expect(rotuloTipoEntidadeExclusao('programacao')).toBe('Programação')
    expect(rotuloTipoEntidadeExclusao('mtr')).toBe('MTR')
  })
})

describe('workflowPermissions — solicitação de exclusão', () => {
  it('comercial e operação podem solicitar', () => {
    expect(cargoPodeSolicitarExclusaoProgramacao('Comercial', 'Rose')).toBe(true)
    expect(cargoPodeSolicitarExclusaoMtr(CARGO_OPERADORES_TIME_R, 'Matheus')).toBe(true)
  })

  it('visualizador não solicita exclusão', () => {
    expect(cargoPodeSolicitarExclusaoProgramacao('Visualizador', 'Convidado')).toBe(false)
  })

  it('Thais é aprovadora da fila', () => {
    expect(usuarioEhAprovadorExclusaoOperacionalThais('Thais Pichirilli', CARGO_COMERCIAL_ADM)).toBe(
      true
    )
    expect(usuarioEhAprovadorExclusaoOperacionalThais('Rose', 'Comercial')).toBe(false)
  })
})
