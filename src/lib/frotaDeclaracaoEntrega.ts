import { formatarEnderecoClienteColeta } from './formatarEnderecoClienteColeta'
import { RG_AMBIENTAL_DADOS_CORPORATIVOS } from './rgAmbientalDadosCorporativos'
import { supabase } from './supabase'
import type { EquipamentoClienteCatalogo, FrotaMovimentacaoRow } from './frotaTypes'

export type FrotaDeclaracaoEntregaDados = {
  razaoSocial: string
  endereco: string
  telefone: string
  equipamento: string
  /** ISO date (yyyy-mm-dd) — data da entrega do equipamento */
  dataEntrega: string
  /** ISO date — data exibida no cabeçalho do documento */
  dataDocumento: string
  responsavelRecebimento: string
}

export function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatarDataEntrega(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function formatarDataDocumentoExtenso(iso: string): string {
  if (!iso) return '—'
  const dt = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(dt.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt)
}

export function montarDeclaracaoEntregaDefaults(eq: EquipamentoClienteCatalogo): FrotaDeclaracaoEntregaDados {
  const hoje = hojeIsoLocal()
  return {
    razaoSocial: eq.razao_social || eq.cliente_nome,
    endereco: eq.endereco,
    telefone: eq.telefone,
    equipamento: eq.descricao,
    dataEntrega: hoje,
    dataDocumento: hoje,
    responsavelRecebimento: '',
  }
}

export function localDocumentoRg(): string {
  return RG_AMBIENTAL_DADOS_CORPORATIVOS.municipio
}

export type ClienteDeclaracaoEntregaDados = {
  nome: string
  razaoSocial: string
  endereco: string
  telefone: string
}

export async function fetchDadosClienteDeclaracaoEntrega(
  clienteId: string
): Promise<ClienteDeclaracaoEntregaDados> {
  const { data, error } = await supabase
    .from('clientes')
    .select(
      'nome, razao_social, telefone, rua, numero, complemento, bairro, cidade, estado, cep, endereco_coleta'
    )
    .eq('id', clienteId)
    .maybeSingle()

  if (error) throw error

  const nome = String(data?.nome ?? '').trim() || 'Cliente'
  return {
    nome,
    razaoSocial: String(data?.razao_social ?? '').trim() || nome,
    endereco: formatarEnderecoClienteColeta(data ?? {}),
    telefone: String(data?.telefone ?? '').trim(),
  }
}

export function montarDeclaracaoEntregaDeMovimentacao(input: {
  clienteNome: string
  razaoSocial?: string
  endereco?: string
  telefone?: string
  equipamento: string
  dataEntrega?: string
  responsavelRecebimento?: string
}): FrotaDeclaracaoEntregaDados {
  const hoje = hojeIsoLocal()
  const dataEntrega = (input.dataEntrega || '').slice(0, 10) || hoje
  return {
    razaoSocial: (input.razaoSocial || input.clienteNome).trim(),
    endereco: (input.endereco ?? '').trim(),
    telefone: (input.telefone ?? '').trim(),
    equipamento: input.equipamento.trim(),
    dataEntrega,
    dataDocumento: hoje,
    responsavelRecebimento: (input.responsavelRecebimento ?? '').trim(),
  }
}

export function montarDeclaracaoEntregaDeMovimentacaoRow(
  m: FrotaMovimentacaoRow,
  cliente?: Partial<ClienteDeclaracaoEntregaDados>
): FrotaDeclaracaoEntregaDados {
  const dataEntrega = m.created_at ? m.created_at.slice(0, 10) : hojeIsoLocal()
  return montarDeclaracaoEntregaDeMovimentacao({
    clienteNome: m.cliente_nome ?? cliente?.nome ?? 'Cliente',
    razaoSocial: cliente?.razaoSocial,
    endereco: cliente?.endereco,
    telefone: cliente?.telefone,
    equipamento: m.equipamento_descricao,
    dataEntrega,
    responsavelRecebimento: '',
  })
}

export function montarDeclaracaoEntregaDeEquipamentoCatalogo(
  eq: EquipamentoClienteCatalogo
): FrotaDeclaracaoEntregaDados {
  return montarDeclaracaoEntregaDefaults(eq)
}
