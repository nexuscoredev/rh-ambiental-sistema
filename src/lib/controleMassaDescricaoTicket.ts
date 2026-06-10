/** Chaves para nota do ticket — uma por coleta ou por índice de segmento (pré-vínculo). */

export function chaveDescricaoTicketColeta(coletaId: string): string {
  return `c:${coletaId.trim()}`
}

export function chaveDescricaoTicketSegmento(indice: number): string {
  return `s:${indice}`
}

export function lerDescricaoTicketArmazenada(
  map: Map<string, string>,
  opts: { coletaId?: string; indiceSegmento?: number }
): string {
  const cid = opts.coletaId?.trim()
  if (cid) {
    const porColeta = map.get(chaveDescricaoTicketColeta(cid))
    if (porColeta !== undefined) return porColeta
  }
  if (opts.indiceSegmento !== undefined && opts.indiceSegmento >= 0) {
    return map.get(chaveDescricaoTicketSegmento(opts.indiceSegmento)) ?? ''
  }
  return ''
}

export function gravarDescricaoTicketArmazenada(
  map: Map<string, string>,
  valor: string,
  opts: { coletaId?: string; indiceSegmento?: number }
): Map<string, string> {
  const next = new Map(map)
  const cid = opts.coletaId?.trim()
  if (cid) {
    next.set(chaveDescricaoTicketColeta(cid), valor)
  } else if (opts.indiceSegmento !== undefined && opts.indiceSegmento >= 0) {
    next.set(chaveDescricaoTicketSegmento(opts.indiceSegmento), valor)
  }
  return next
}

export function chavesDescricaoSegmentoTicket(
  indice: number,
  coletaIdSegmento: string | undefined
): { coletaId?: string; indiceSegmento?: number } {
  const cid = coletaIdSegmento?.trim()
  if (cid) return { coletaId: cid }
  return { indiceSegmento: indice }
}

/**
 * Nota do ticket para um segmento (vários resíduos → tickets 104757-1, 104757-2, …).
 * Usa a nota específica do segmento; se vazia, reutiliza a do ticket 1 (segmento 0).
 */
export function resolverDescricaoTicketMultiSegmento(
  map: Map<string, string>,
  opts: {
    indiceSegmento: number
    coletaId?: string
    coletaIdSegmento0?: string
    fallbackForm?: string | null
  }
): string {
  const especifica = lerDescricaoTicketArmazenada(map, {
    coletaId: opts.coletaId,
    indiceSegmento: opts.indiceSegmento,
  }).trim()
  if (especifica) return especifica

  const fallbackForm = (opts.fallbackForm ?? '').trim()
  if (opts.indiceSegmento === 0) return fallbackForm

  const notaSeg0 = lerDescricaoTicketArmazenada(map, {
    coletaId: opts.coletaIdSegmento0,
    indiceSegmento: 0,
  }).trim()
  return notaSeg0 || fallbackForm
}
