import { describe, expect, it } from 'vitest'
import { validarAlterarSenhaPropria } from './alterarSenhaPropria'

describe('validarAlterarSenhaPropria', () => {
  it('exige senha atual, nova e confirmação', () => {
    expect(validarAlterarSenhaPropria({ senhaAtual: '', senhaNova: 'abc123', confirmacao: 'abc123' })).toEqual({
      ok: false,
      mensagem: 'Informe a senha atual.',
    })
    expect(validarAlterarSenhaPropria({ senhaAtual: 'old', senhaNova: '', confirmacao: '' })).toEqual({
      ok: false,
      mensagem: 'Informe a nova senha.',
    })
  })

  it('valida tamanho mínimo e confirmação', () => {
    expect(
      validarAlterarSenhaPropria({ senhaAtual: 'old12', senhaNova: 'ab', confirmacao: 'ab' })
    ).toMatchObject({ ok: false })
    expect(
      validarAlterarSenhaPropria({ senhaAtual: 'old12', senhaNova: 'nova12', confirmacao: 'outra' })
    ).toEqual({
      ok: false,
      mensagem: 'A confirmação não coincide com a nova senha.',
    })
  })

  it('impede reutilizar a senha atual', () => {
    expect(
      validarAlterarSenhaPropria({
        senhaAtual: 'senha12',
        senhaNova: 'senha12',
        confirmacao: 'senha12',
      })
    ).toEqual({
      ok: false,
      mensagem: 'A nova senha deve ser diferente da senha atual.',
    })
  })

  it('aceita dados válidos', () => {
    expect(
      validarAlterarSenhaPropria({
        senhaAtual: 'antiga1',
        senhaNova: 'nova123',
        confirmacao: 'nova123',
      })
    ).toEqual({ ok: true })
  })
})
