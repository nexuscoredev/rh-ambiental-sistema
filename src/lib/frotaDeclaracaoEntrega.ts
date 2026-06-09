import { RG_AMBIENTAL_DADOS_CORPORATIVOS } from './rgAmbientalDadosCorporativos'
import type { EquipamentoClienteCatalogo } from './frotaTypes'

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
