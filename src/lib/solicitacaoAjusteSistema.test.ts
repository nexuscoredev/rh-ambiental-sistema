import { describe, expect, it } from 'vitest'
import {
  deveOcultarSolicitacaoAjuste,
  nomeIndicaRafaelCavalcanteDesenvolvedor,
} from './solicitacaoAjusteSistema'

describe('solicitacaoAjusteSistema', () => {
  it('identifica Rafael Cavalcante desenvolvedor', () => {
    expect(nomeIndicaRafaelCavalcanteDesenvolvedor('Rafael Cavalcante')).toBe(true)
    expect(nomeIndicaRafaelCavalcanteDesenvolvedor('Rafael')).toBe(false)
  })

  it('oculta formulário para o próprio desenvolvedor', () => {
    expect(deveOcultarSolicitacaoAjuste('x', 'Rafael Cavalcante')).toBe(true)
    expect(deveOcultarSolicitacaoAjuste('x', 'Thais')).toBe(false)
  })
})
