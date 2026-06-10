import { describe, expect, it } from 'vitest'
import {
  gravarDescricaoTicketArmazenada,
  lerDescricaoTicketArmazenada,
  resolverDescricaoTicketMultiSegmento,
} from './controleMassaDescricaoTicket'

describe('controleMassaDescricaoTicket', () => {
  it('mantém notas distintas por coleta e por segmento', () => {
    let map = new Map<string, string>()
    map = gravarDescricaoTicketArmazenada(map, 'Nota A', { coletaId: 'c1' })
    map = gravarDescricaoTicketArmazenada(map, 'Nota B', { coletaId: 'c2' })
    map = gravarDescricaoTicketArmazenada(map, 'Seg 0', { indiceSegmento: 0 })

    expect(lerDescricaoTicketArmazenada(map, { coletaId: 'c1' })).toBe('Nota A')
    expect(lerDescricaoTicketArmazenada(map, { coletaId: 'c2' })).toBe('Nota B')
    expect(lerDescricaoTicketArmazenada(map, { indiceSegmento: 0 })).toBe('Seg 0')
    expect(lerDescricaoTicketArmazenada(map, { indiceSegmento: 1 })).toBe('')
  })

  it('prioriza nota da coleta sobre índice de segmento', () => {
    let map = new Map<string, string>()
    map = gravarDescricaoTicketArmazenada(map, 'Por segmento', { indiceSegmento: 0 })
    map = gravarDescricaoTicketArmazenada(map, 'Por coleta', { coletaId: 'c1' })

    expect(lerDescricaoTicketArmazenada(map, { coletaId: 'c1', indiceSegmento: 0 })).toBe(
      'Por coleta'
    )
  })

  it('propaga nota do ticket 1 aos demais segmentos quando não há nota própria', () => {
    let map = new Map<string, string>()
    map = gravarDescricaoTicketArmazenada(map, 'OBS compartilhada', { coletaId: 'c1' })

    expect(
      resolverDescricaoTicketMultiSegmento(map, {
        indiceSegmento: 0,
        coletaId: 'c1',
        coletaIdSegmento0: 'c1',
      })
    ).toBe('OBS compartilhada')

    expect(
      resolverDescricaoTicketMultiSegmento(map, {
        indiceSegmento: 1,
        coletaId: 'c2',
        coletaIdSegmento0: 'c1',
      })
    ).toBe('OBS compartilhada')
  })

  it('mantém nota distinta por segmento quando definida', () => {
    let map = new Map<string, string>()
    map = gravarDescricaoTicketArmazenada(map, 'Nota ticket 1', { coletaId: 'c1' })
    map = gravarDescricaoTicketArmazenada(map, 'Nota ticket 2', { indiceSegmento: 1 })

    expect(
      resolverDescricaoTicketMultiSegmento(map, {
        indiceSegmento: 1,
        coletaId: 'c2',
        coletaIdSegmento0: 'c1',
      })
    ).toBe('Nota ticket 2')
  })
})
