import { describe, expect, it } from 'vitest'
import { formatDataIsoCurtaParaBr, resolverDataExibicaoTicket } from './ticketOperacionalData'

describe('ticketOperacionalData', () => {
  it('formata YYYY-MM-DD sem deslocar fuso', () => {
    expect(formatDataIsoCurtaParaBr('2026-04-15')).toBe('15/04/2026')
  })

  it('prioriza data da pesagem sobre created_at do ticket', () => {
    expect(
      resolverDataExibicaoTicket({
        dataPesagem: '2026-04-15',
        ticketCriadoEm: '2026-05-22T10:00:00Z',
      })
    ).toBe('15/04/2026')
  })
})
