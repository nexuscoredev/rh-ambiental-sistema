/** Dados mínimos do cadastro de cliente para razão social / nome fantasia na MTR. */
export type ClienteNomeAutofill = {
  razao_social?: string | null
  nome?: string | null
}

/** Nome do gerador a gravar no topo da MTR (razão social → nome → cliente da programação). */
export function nomeGeradorParaMtr(row: ClienteNomeAutofill, fallbackCliente: string): string {
  return (row.razao_social ?? '').trim() || (row.nome ?? '').trim() || fallbackCliente.trim()
}

/** Atualiza o campo Gerador quando vazio ou ainda só com o nome curto da programação. */
export function deveAtualizarGeradorMtrDesdeCadastro(
  geradorAtual: string,
  clienteProgramacao: string,
  nomeCadastro: string
): boolean {
  const g = geradorAtual.trim()
  const nc = nomeCadastro.trim()
  if (!nc) return false
  if (!g) return true
  const cp = clienteProgramacao.trim()
  if (cp && g === cp && normTexto(nc) !== normTexto(g)) return true
  if (cp && normTexto(g) === normTexto(cp) && normTexto(nc) !== normTexto(g)) return true
  return false
}

function normTexto(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Nome exibido na coluna/campo «Gerador» da MTR.
 * Evita mostrar traço, tipo de resíduo ou rótulos genéricos no lugar do nome do cliente.
 */
export function resolverNomeGeradorMtr(opts: {
  gerador?: string | null
  cliente?: string | null
  tipoResiduo?: string | null
}): string {
  const g = String(opts.gerador ?? '').trim()
  const c = String(opts.cliente ?? '').trim()
  const t = String(opts.tipoResiduo ?? '').trim()

  if (!g) return c
  if (/^[-—–]+$/.test(g)) return c
  if (t && normTexto(g) === normTexto(t)) return c || g

  const gNorm = normTexto(g)
  if (
    gNorm === 'residuo' ||
    gNorm === 'resíduo' ||
    gNorm === 'residuos' ||
    gNorm === 'resíduos'
  ) {
    return c
  }

  return g
}

export function exibirNomeGeradorMtr(
  opts: Parameters<typeof resolverNomeGeradorMtr>[0],
  placeholder = '—'
): string {
  return resolverNomeGeradorMtr(opts) || placeholder
}
