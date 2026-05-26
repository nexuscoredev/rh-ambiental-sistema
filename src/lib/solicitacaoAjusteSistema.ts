import { supabase } from './supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NOME_DESENVOLVEDOR = 'rafael cavalcante'

/** UUID opcional (Vite) — prioridade sobre busca por nome. */
export function idDesenvolvedorAjustesConfig(): string | null {
  const raw = import.meta.env.VITE_AJUSTE_SISTEMA_USER_ID ?? import.meta.env.VITE_SUPORTE_USER_ID
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  if (!s || !UUID_RE.test(s)) return null
  return s
}

function normalizarNome(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function nomeIndicaRafaelCavalcanteDesenvolvedor(nome: string | null | undefined): boolean {
  return normalizarNome(nome ?? '') === NOME_DESENVOLVEDOR
}

async function buscarUsuarioAtivoPorId(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .eq('status', 'ativo')
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

/**
 * Destinatário dos pedidos de melhoria/ajuste (Rafael Cavalcante, desenvolvedor).
 */
export async function resolverIdDesenvolvedorAjustes(solicitanteAuthId: string): Promise<string> {
  const sid = solicitanteAuthId.toLowerCase()

  const configurado = idDesenvolvedorAjustesConfig()
  if (configurado) {
    if (sid === configurado) {
      throw new Error('Esta conta recebe os pedidos de ajuste; use o Chat Interno para responder.')
    }
    const porId = await buscarUsuarioAtivoPorId(configurado)
    if (porId) return porId
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, cargo')
    .eq('status', 'ativo')
    .ilike('nome', '%rafael%cavalcante%')
    .limit(10)

  if (error) throw error

  const candidatos = (data ?? []).filter((row) => {
    const id = String(row.id ?? '').toLowerCase()
    if (!id || id === sid) return false
    return nomeIndicaRafaelCavalcanteDesenvolvedor(String(row.nome ?? ''))
  })

  if (candidatos.length === 1 && candidatos[0]?.id) {
    return String(candidatos[0].id)
  }

  const porCargo = (data ?? []).find((row) => {
    const id = String(row.id ?? '').toLowerCase()
    if (!id || id === sid) return false
    const cargo = String(row.cargo ?? '').toLowerCase()
    return cargo.includes('desenvolvedor') && String(row.nome ?? '').toLowerCase().includes('rafael')
  })
  if (porCargo?.id) return String(porCargo.id)

  throw new Error(
    'Não foi possível localizar Rafael Cavalcante (desenvolvedor) no cadastro de utilizadores activos.'
  )
}

export function deveOcultarSolicitacaoAjuste(
  userId: string,
  nome: string | null | undefined
): boolean {
  const byId = idDesenvolvedorAjustesConfig()
  if (byId && userId.toLowerCase() === byId) return true
  return nomeIndicaRafaelCavalcanteDesenvolvedor(nome)
}
