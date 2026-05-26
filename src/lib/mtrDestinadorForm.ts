/** Destinatário no JSON `mtrs.detalhes`. */
export type MtrDestinatarioDetalhes = {
  razao_social?: string | null
  atividade?: string | null
}

export type MtrDestinadorFormInput = {
  destinador?: string | null
  detalhes?: { destinatario?: MtrDestinatarioDetalhes | null } | null
}

/** Valor efetivo do destinador (topo da MTR ou razão social no modelo completo). */
export function resolverDestinadorMtrForm(input: MtrDestinadorFormInput): string {
  const topo = String(input.destinador ?? '').trim()
  if (topo) return topo

  const dest = input.detalhes?.destinatario
  const razao = String(dest?.razao_social ?? '').trim()
  if (razao) return razao

  return ''
}

/** Mantém `destinador` (coluna) e `detalhes.destinatario.razao_social` alinhados ao gravar. */
export function sincronizarDestinatarioDetalhesComDestinador<T extends MtrDestinatarioDetalhes>(
  destinatario: T,
  destinadorTopo: string
): T {
  const topo = destinadorTopo.trim()
  const razao = String(destinatario.razao_social ?? '').trim()
  if (!topo) return destinatario
  if (!razao || razao === topo) {
    return { ...destinatario, razao_social: topo }
  }
  return destinatario
}
