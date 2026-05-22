import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingClienteContratoColumnsError } from './clienteContratoCadastro'

export type ClienteEnderecoAutofill = {
  nome: string | null
  razao_social: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  endereco_coleta: string | null
}

const SEL_ENDERECO_CONTRATO =
  'id, nome, razao_social, cidade, estado, cep, rua, numero, complemento, bairro, endereco_coleta'
const SEL_ENDERECO_LEGADO = SEL_ENDERECO_CONTRATO

export function montarCidadeUfCliente(row: {
  cidade?: string | null
  estado?: string | null
}): string {
  const c = row.cidade?.trim()
  const uf = row.estado?.trim()
  if (c && uf) return `${c} — ${uf}`
  return c || uf || ''
}

/** Interpreta o campo combinado do topo («Município — UF»). */
export function parseCidadeUfCampoTopo(valor: string): {
  cidade: string
  estado: string
  combinado: string
} {
  const t = valor.trim()
  if (!t) return { cidade: '', estado: '', combinado: '' }
  const m = t.match(/^(.+?)\s*[—–-]\s*([A-Za-z]{2})\s*$/u)
  if (m) {
    const cidade = m[1].trim()
    const estado = m[2].trim().toUpperCase()
    return { cidade, estado, combinado: `${cidade} — ${estado}` }
  }
  return { cidade: t, estado: '', combinado: t }
}

export function montarEnderecoLinhaCliente(row: ClienteEnderecoAutofill): string {
  const logradouro = [row.rua?.trim(), row.numero?.trim()].filter(Boolean).join(', ')
  const parts: string[] = []
  if (logradouro) parts.push(logradouro)
  if (row.complemento?.trim()) parts.push(row.complemento.trim())
  if (row.bairro?.trim()) parts.push(row.bairro.trim())
  if (row.cep?.trim()) parts.push(`CEP ${row.cep.trim()}`)
  const estruturado = parts.join(' — ')
  const livre = row.endereco_coleta?.trim()
  return estruturado || livre || ''
}

export async function fetchClienteEnderecoAutofill(
  client: SupabaseClient,
  clienteId: string
): Promise<ClienteEnderecoAutofill | null> {
  const id = clienteId.trim()
  if (!id) return null

  let res = await client.from('clientes').select(SEL_ENDERECO_CONTRATO).eq('id', id).maybeSingle()
  if (res.error && isMissingClienteContratoColumnsError(res.error)) {
    res = await client.from('clientes').select(SEL_ENDERECO_LEGADO).eq('id', id).maybeSingle()
  }
  if (res.error || !res.data) return null
  return res.data as ClienteEnderecoAutofill
}

/** Programação sem `cliente_id` → tenta localizar pelo nome/razão social no cadastro. */
export async function resolverClienteIdProgramacaoMtr(
  client: SupabaseClient,
  programacao: { cliente_id?: string | null; cliente?: string | null }
): Promise<string | null> {
  const direto = (programacao.cliente_id ?? '').trim()
  if (direto) return direto

  const nome = (programacao.cliente ?? '').trim()
  if (!nome) return null

  const tentativas = [
    () => client.from('clientes').select('id').eq('nome', nome).limit(1).maybeSingle(),
    () => client.from('clientes').select('id').eq('razao_social', nome).limit(1).maybeSingle(),
    () =>
      client.from('clientes').select('id').ilike('nome', nome).limit(1).maybeSingle(),
  ]

  for (const fn of tentativas) {
    const { data, error } = await fn()
    if (!error && data?.id) return String(data.id)
  }
  return null
}

export type GeradorCidadePatch = {
  cidade?: string
  estado?: string
  bairro?: string
  cep?: string
}

export function patchCidadeEnderecoGeradorDesdeCliente(
  row: ClienteEnderecoAutofill,
  atual: {
    cidadeTopo: string
    endereco: string
    gerador: GeradorCidadePatch
  },
  opts?: { somenteVazios?: boolean }
): {
  cidadeTopo?: string
  endereco?: string
  gerador?: GeradorCidadePatch
} {
  const somenteVazios = opts?.somenteVazios !== false
  const cidadeCad = montarCidadeUfCliente(row)
  const enderecoCad = montarEnderecoLinhaCliente(row)
  const out: {
    cidadeTopo?: string
    endereco?: string
    gerador?: GeradorCidadePatch
  } = {}

  if (cidadeCad && (!somenteVazios || !atual.cidadeTopo.trim())) {
    out.cidadeTopo = cidadeCad
  }
  if (enderecoCad && (!somenteVazios || !atual.endereco.trim())) {
    out.endereco = enderecoCad
  }

  const g: GeradorCidadePatch = { ...atual.gerador }
  let mudou = false
  const cidadeG = (row.cidade ?? '').trim()
  const estadoG = (row.estado ?? '').trim()
  if (cidadeG && (!somenteVazios || !(g.cidade ?? '').trim())) {
    g.cidade = cidadeG
    mudou = true
  }
  if (estadoG && (!somenteVazios || !(g.estado ?? '').trim())) {
    g.estado = estadoG
    mudou = true
  }
  const bairroG = (row.bairro ?? '').trim()
  if (bairroG && (!somenteVazios || !(g.bairro ?? '').trim())) {
    g.bairro = bairroG
    mudou = true
  }
  const cepG = (row.cep ?? '').trim()
  if (cepG && (!somenteVazios || !(g.cep ?? '').trim())) {
    g.cep = cepG
    mudou = true
  }
  if (mudou) out.gerador = g

  return out
}
