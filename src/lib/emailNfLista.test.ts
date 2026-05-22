import { describe, expect, it } from 'vitest'
import { emailNfTemAlgum, normalizarEmailNfLista, parsearEmailsNf } from './emailNfLista'

describe('emailNfLista', () => {
  it('separa e-mails por ponto e vírgula', () => {
    expect(parsearEmailsNf('a@x.com; b@y.com')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('normaliza lista válida', () => {
    expect(normalizarEmailNfLista('a@x.com;invalido;b@y.com')).toBe('a@x.com; b@y.com')
  })

  it('detecta presença de e-mail válido', () => {
    expect(emailNfTemAlgum('foo')).toBe(false)
    expect(emailNfTemAlgum('a@x.com')).toBe(true)
  })
})
