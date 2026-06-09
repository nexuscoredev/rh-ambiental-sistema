/** Endereço de coleta do cliente — estruturado ou texto livre legado. */
export function formatarEnderecoClienteColeta(row: {
  rua?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  endereco_coleta?: string | null
}): string {
  const partes: string[] = []
  const linha = [String(row.rua ?? '').trim(), String(row.numero ?? '').trim()].filter(Boolean).join(', ')
  if (linha) partes.push(linha)
  const complemento = String(row.complemento ?? '').trim()
  if (complemento) partes.push(complemento)
  const bairro = String(row.bairro ?? '').trim()
  if (bairro) partes.push(bairro)
  const cidadeUf = [String(row.cidade ?? '').trim(), String(row.estado ?? '').trim()].filter(Boolean).join(' – ')
  if (cidadeUf) partes.push(cidadeUf)
  const cep = String(row.cep ?? '').trim()
  if (cep) partes.push(cep)
  const estruturado = partes.join(', ')
  if (estruturado) return estruturado
  return String(row.endereco_coleta ?? '').trim()
}
