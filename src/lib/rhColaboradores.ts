/** Tipos e helpers — cadastro RH colaboradores (Departamento Pessoal). */

export type RhColaboradorStatus = 'Ativo' | 'Inativo'

export type RhColaboradorRow = {
  id: string
  nome: string
  cpf: string | null
  data_admissao: string | null
  cargo_funcao: string | null
  departamento: string | null
  status: RhColaboradorStatus
  email: string | null
  telefone: string | null
  observacoes: string | null
  motorista_id: string | null
  created_at: string | null
  updated_at: string | null
  motoristas?: { nome: string | null } | null
}

export type RhColaboradorRelatorioLinha = {
  nome: string
  cpf: string
  dataAdmissao: string
  cargoFuncao: string
  departamento: string
  status: string
  email: string
  telefone: string
  motorista: string
}

export const RH_COLABORADORES_SELECT =
  'id, nome, cpf, data_admissao, cargo_funcao, departamento, status, email, telefone, observacoes, motorista_id, created_at, updated_at, motoristas(nome)'

export function formatarDataRh(iso?: string | null): string {
  if (!iso) return '—'
  const limpa = iso.includes('T') ? iso.split('T')[0] : iso
  const partes = limpa.split('-')
  if (partes.length !== 3) return iso
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

export function rhColaboradorParaRelatorio(c: RhColaboradorRow): RhColaboradorRelatorioLinha {
  return {
    nome: c.nome ?? '',
    cpf: c.cpf ?? '—',
    dataAdmissao: formatarDataRh(c.data_admissao),
    cargoFuncao: c.cargo_funcao?.trim() || '—',
    departamento: c.departamento?.trim() || '—',
    status: c.status ?? 'Ativo',
    email: c.email?.trim() || '—',
    telefone: c.telefone?.trim() || '—',
    motorista: c.motoristas?.nome?.trim() || '—',
  }
}

export function limparTextoRh(valor: string): string | null {
  const t = valor.trim()
  return t === '' ? null : t
}

/** Normaliza join Supabase `motoristas(nome)` (objeto ou array). */
export function normalizarRhColaboradorRow(raw: Record<string, unknown>): RhColaboradorRow {
  const motRaw = raw.motoristas
  let motoristas: RhColaboradorRow['motoristas'] = null
  if (motRaw && typeof motRaw === 'object') {
    const item = Array.isArray(motRaw) ? motRaw[0] : motRaw
    if (item && typeof item === 'object' && 'nome' in item) {
      const n = String((item as { nome?: unknown }).nome ?? '').trim()
      motoristas = { nome: n || null }
    }
  }
  return {
    id: String(raw.id),
    nome: String(raw.nome ?? ''),
    cpf: raw.cpf != null ? String(raw.cpf) : null,
    data_admissao: raw.data_admissao != null ? String(raw.data_admissao) : null,
    cargo_funcao: raw.cargo_funcao != null ? String(raw.cargo_funcao) : null,
    departamento: raw.departamento != null ? String(raw.departamento) : null,
    status: (raw.status === 'Inativo' ? 'Inativo' : 'Ativo') as RhColaboradorStatus,
    email: raw.email != null ? String(raw.email) : null,
    telefone: raw.telefone != null ? String(raw.telefone) : null,
    observacoes: raw.observacoes != null ? String(raw.observacoes) : null,
    motorista_id: raw.motorista_id != null ? String(raw.motorista_id) : null,
    created_at: raw.created_at != null ? String(raw.created_at) : null,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
    motoristas,
  }
}
