import type { SupabaseClient } from '@supabase/supabase-js'
import { formClienteFromJson } from './clienteCadastroForm'
import { nomeGeradorParaMtr, type ClienteNomeAutofill } from './mtrNomeGerador'
import { MTR_PROGRAMACAO_SELECT, type ProgramacaoMtrRow } from './mtrProgramacoesFetch'

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

const SEL_CLIENTE_ENDERECO =
  'id, nome, razao_social, cidade, estado, cep, rua, numero, complemento, bairro, endereco_coleta'

const UFS_BR = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])

export function montarCidadeUfCliente(row: {
  cidade?: string | null
  estado?: string | null
}): string {
  const c = row.cidade?.trim()
  const uf = row.estado?.trim()
  if (c && uf) return `${c} — ${uf}`
  return c || uf || ''
}

/** Tenta extrair município e UF de `endereco_coleta` (planilha / texto livre). */
export function inferirCidadeEstadoEnderecoTexto(texto: string): { cidade: string; estado: string } {
  const t = texto.trim().replace(/\s+/g, ' ')
  if (!t) return { cidade: '', estado: '' }

  const partes = t
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (partes.length >= 2) {
    const ultimo = partes[partes.length - 1]!
    const penultimo = partes[partes.length - 2]!
    const soUf = /^([A-Za-z]{2})$/i.exec(ultimo)
    if (soUf && UFS_BR.has(soUf[1]!.toUpperCase())) {
      return { cidade: penultimo, estado: soUf[1]!.toUpperCase() }
    }
    const comb = /^(.+?)\s*[—–/-]\s*([A-Za-z]{2})$/i.exec(ultimo)
    if (comb && UFS_BR.has(comb[2]!.toUpperCase())) {
      return { cidade: comb[1]!.trim(), estado: comb[2]!.toUpperCase() }
    }
  }

  const fim = /([^,]+?)\s*[—–-]\s*([A-Za-z]{2})\s*$/i.exec(t)
  if (fim && UFS_BR.has(fim[2]!.toUpperCase())) {
    return { cidade: fim[1]!.trim(), estado: fim[2]!.toUpperCase() }
  }

  return { cidade: '', estado: '' }
}

/** Preenche `cidade`/`estado` vazios a partir do endereço de coleta. */
export function enriquecerClienteEnderecoAutofill(
  row: ClienteEnderecoAutofill
): ClienteEnderecoAutofill {
  let cidade = (row.cidade ?? '').trim()
  let estado = (row.estado ?? '').trim()
  if (cidade && estado) return { ...row, cidade, estado }

  const inferido = inferirCidadeEstadoEnderecoTexto(row.endereco_coleta ?? '')
  if (!cidade && inferido.cidade) cidade = inferido.cidade
  if (!estado && inferido.estado) estado = inferido.estado

  return { ...row, cidade: cidade || row.cidade, estado: estado || row.estado }
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
    const cidade = m[1]!.trim()
    const estado = m[2]!.trim().toUpperCase()
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

export async function fetchClienteNomeGeradorMtr(
  client: SupabaseClient,
  clienteId: string
): Promise<ClienteNomeAutofill | null> {
  const id = clienteId.trim()
  if (!id) return null

  const { data, error } = await client
    .from('clientes')
    .select('nome, razao_social')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    if (error && import.meta.env?.DEV) {
      console.debug('[MTR] nome gerador cliente:', error.message)
    }
    return null
  }
  return data as ClienteNomeAutofill
}

async function buscarNomeGeradorGerenciadorPorTexto(
  client: SupabaseClient,
  nomeProgramacao: string
): Promise<ClienteNomeAutofill | null> {
  const nome = normalizarNomeBuscaCliente(nomeProgramacao)
  if (!nome) return null

  const tentativas = [
    () =>
      client
        .from('clientes_gerenciador')
        .select('dados_cadastro, nome_exibicao')
        .eq('nome_exibicao', nome)
        .limit(1)
        .maybeSingle(),
    () =>
      client
        .from('clientes_gerenciador')
        .select('dados_cadastro, nome_exibicao')
        .ilike('nome_exibicao', nome)
        .limit(1)
        .maybeSingle(),
    () =>
      client
        .from('clientes_gerenciador')
        .select('dados_cadastro, nome_exibicao')
        .ilike('nome_exibicao', `%${nome}%`)
        .limit(1)
        .maybeSingle(),
  ]

  for (const fn of tentativas) {
    const { data, error } = await fn()
    if (error || !data) continue
    const row = data as { dados_cadastro: unknown; nome_exibicao: string | null }
    const form = formClienteFromJson(row.dados_cadastro)
    return {
      razao_social: form.razao_social || null,
      nome: form.nome || row.nome_exibicao || null,
    }
  }

  return null
}

/**
 * Razão social / nome do gerador a partir da programação (clientes → fallback Gerenciador).
 */
export async function buscarNomeGeradorPorProgramacaoMtr(
  client: SupabaseClient,
  programacao: { cliente_id?: string | null; cliente?: string | null }
): Promise<string> {
  const fallback = (programacao.cliente ?? '').trim()
  const clienteId = await resolverClienteIdProgramacaoMtr(client, programacao)
  if (clienteId) {
    const row = await fetchClienteNomeGeradorMtr(client, clienteId)
    if (row) return nomeGeradorParaMtr(row, fallback)
  }

  const ger = await buscarNomeGeradorGerenciadorPorTexto(client, fallback)
  if (ger) return nomeGeradorParaMtr(ger, fallback)

  return fallback
}

export async function fetchClienteEnderecoAutofill(
  client: SupabaseClient,
  clienteId: string
): Promise<ClienteEnderecoAutofill | null> {
  const id = clienteId.trim()
  if (!id) return null

  const { data, error } = await client
    .from('clientes')
    .select(SEL_CLIENTE_ENDERECO)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    if (error && import.meta.env?.DEV) {
      console.debug('[MTR] endereço cliente:', error.message)
    }
    return null
  }
  return enriquecerClienteEnderecoAutofill(data as ClienteEnderecoAutofill)
}

export async function buscarProgramacaoMtrPorId(
  client: SupabaseClient,
  programacaoId: string
): Promise<ProgramacaoMtrRow | null> {
  const id = programacaoId.trim()
  if (!id) return null
  const { data, error } = await client
    .from('programacoes')
    .select(MTR_PROGRAMACAO_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as ProgramacaoMtrRow
}

function normalizarNomeBuscaCliente(nome: string): string {
  return nome.trim().replace(/%/g, '')
}

/** Programação sem `cliente_id` → localiza pelo nome/razão social no cadastro. */
export async function resolverClienteIdProgramacaoMtr(
  client: SupabaseClient,
  programacao: { cliente_id?: string | null; cliente?: string | null }
): Promise<string | null> {
  const direto = (programacao.cliente_id ?? '').trim()
  if (direto) return direto

  const nome = normalizarNomeBuscaCliente(programacao.cliente ?? '')
  if (!nome) return null

  const tentativas = [
    () => client.from('clientes').select('id').eq('nome', nome).limit(1).maybeSingle(),
    () => client.from('clientes').select('id').eq('razao_social', nome).limit(1).maybeSingle(),
    () => client.from('clientes').select('id').ilike('nome', nome).limit(1).maybeSingle(),
    () => client.from('clientes').select('id').ilike('razao_social', nome).limit(1).maybeSingle(),
    () =>
      client
        .from('clientes')
        .select('id')
        .ilike('nome', `%${nome}%`)
        .limit(1)
        .maybeSingle(),
    () =>
      client
        .from('clientes')
        .select('id')
        .ilike('razao_social', `%${nome}%`)
        .limit(1)
        .maybeSingle(),
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

/** Campo «Atividade» (secção 1. Gerador) — prioridade alinhada ao autofill histórico da MTR. */
export function atividadeGeradorDesdeClienteProgramacao(
  row: {
    classificacao?: string | null
    observacoes_operacionais?: string | null
    observacoes_gerais?: string | null
  },
  programacao: { tipo_servico?: string | null }
): string {
  const obs = (s: string | null | undefined, max = 120) => (s ?? '').trim().slice(0, max)
  return (
    (row.classificacao ?? '').trim() ||
    (programacao.tipo_servico ?? '').trim() ||
    obs(row.observacoes_operacionais) ||
    obs(row.observacoes_gerais) ||
    ''
  )
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
  const enriquecido = enriquecerClienteEnderecoAutofill(row)
  const cidadeCad = montarCidadeUfCliente(enriquecido)
  const enderecoCad = montarEnderecoLinhaCliente(enriquecido)
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
  const cidadeG = (enriquecido.cidade ?? '').trim()
  const estadoG = (enriquecido.estado ?? '').trim()
  if (cidadeG && (!somenteVazios || !(g.cidade ?? '').trim())) {
    g.cidade = cidadeG
    mudou = true
  }
  if (estadoG && (!somenteVazios || !(g.estado ?? '').trim())) {
    g.estado = estadoG
    mudou = true
  }
  const bairroG = (enriquecido.bairro ?? '').trim()
  if (bairroG && (!somenteVazios || !(g.bairro ?? '').trim())) {
    g.bairro = bairroG
    mudou = true
  }
  const cepG = (enriquecido.cep ?? '').trim()
  if (cepG && (!somenteVazios || !(g.cep ?? '').trim())) {
    g.cep = cepG
    mudou = true
  }
  if (mudou) out.gerador = g

  return out
}
