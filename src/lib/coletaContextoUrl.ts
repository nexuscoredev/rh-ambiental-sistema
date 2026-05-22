/**
 * Resolver qual coleta está ativa a partir de ?coleta= | ?mtr= | ?programacao= | ?cliente=.
 * Usado em várias telas do seguimento da coleta — uma única implementação.
 */

export type ColetaComIdsContexto = {
  id: string
  mtr_id: string | null
  programacao_id: string | null
  cliente_id: string | null
}

export type IdsContextoUrl = {
  coleta: string | null
  mtr: string | null
  programacao: string | null
  cliente: string | null
}

export function idsContextoFromSearchParams(searchParams: URLSearchParams): IdsContextoUrl {
  return {
    coleta: searchParams.get('coleta'),
    mtr: searchParams.get('mtr'),
    programacao: searchParams.get('programacao'),
    cliente: searchParams.get('cliente'),
  }
}

export function resolverColetaPorContextoUrl<T extends ColetaComIdsContexto>(
  lista: T[],
  ids: IdsContextoUrl
): T | null {
  if (ids.coleta) {
    const c = lista.find((x) => x.id === ids.coleta)
    if (c) return c
  }
  if (ids.mtr) {
    const c = lista.find((x) => x.mtr_id === ids.mtr)
    if (c) return c
  }
  if (ids.programacao) {
    const c = lista.find((x) => x.programacao_id === ids.programacao)
    if (c) return c
  }
  if (ids.cliente) {
    const c = lista.find((x) => x.cliente_id === ids.cliente)
    if (c) return c
  }
  return null
}

/** Mala Direta — Medição com cliente (e opcionalmente coleta) já no contexto da esteira. */
export function buildUrlEnvioNfMedicao(opts?: {
  clienteId?: string | null
  coletaId?: string | null
}): string {
  const p = new URLSearchParams({ tipo: 'medicao' })
  const cliente = (opts?.clienteId ?? '').trim()
  const coleta = (opts?.coletaId ?? '').trim()
  if (cliente) p.set('cliente', cliente)
  if (coleta) p.set('coleta', coleta)
  return `/envio-nf?${p.toString()}`
}

export function resolverClienteIdParaEnvioNf<T extends ColetaComIdsContexto>(
  lista: T[],
  ids: IdsContextoUrl
): string | null {
  const direto = (ids.cliente ?? '').trim()
  if (direto) return direto
  return resolverColetaPorContextoUrl(lista, ids)?.cliente_id?.trim() ?? null
}
