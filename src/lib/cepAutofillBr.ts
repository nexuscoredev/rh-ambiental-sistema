/** Consulta CEP (ViaCEP) para preencher endereço no cadastro de clientes. */

export type EnderecoCepBr = {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

export async function buscarEnderecoPorCepBr(cep: string): Promise<EnderecoCepBr | null> {
  const digitos = cep.replace(/\D/g, '')
  if (digitos.length !== 8) return null

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      erro?: boolean
      logradouro?: string
      bairro?: string
      localidade?: string
      uf?: string
    }
    if (data.erro) return null
    return {
      logradouro: String(data.logradouro ?? '').trim(),
      bairro: String(data.bairro ?? '').trim(),
      localidade: String(data.localidade ?? '').trim(),
      uf: String(data.uf ?? '').trim().toUpperCase(),
    }
  } catch {
    return null
  }
}
