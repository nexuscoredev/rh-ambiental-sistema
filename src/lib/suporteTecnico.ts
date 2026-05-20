import { supabase } from './supabase'

const UUID_SUPORTE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * UUID do utilizador de suporte (Vite). Se definido, tem prioridade sobre o e-mail.
 */
export function idSuporteTecnicoConfig(): string | null {
  const raw = import.meta.env.VITE_SUPORTE_USER_ID
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  if (!s || !UUID_SUPORTE_RE.test(s)) return null
  return s
}

/** E-mail explícito em Vite (`VITE_SUPORTE_EMAIL`). Sem valor → resolve por cargo no Supabase. */
export function emailSuporteTecnicoConfig(): string | null {
  const raw = import.meta.env.VITE_SUPORTE_EMAIL
  if (typeof raw !== 'string' || !raw.trim()) return null
  return raw.trim().toLowerCase()
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

async function buscarUsuarioAtivoPorEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('status', 'ativo')
    .ilike('email', email)
    .limit(1)
  if (error) throw error
  return (data?.[0]?.id as string | undefined) ?? null
}

async function buscarPorCargoAtivo(
  padroesCargo: string[],
  excluirUserId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, cargo, created_at')
    .eq('status', 'ativo')
    .order('created_at', { ascending: true })
    .limit(80)

  if (error) throw error
  const excluir = excluirUserId.toLowerCase()

  for (const padrao of padroesCargo) {
    const p = padrao.toLowerCase()
    const hit = (data ?? []).find((row) => {
      const id = String(row.id ?? '').toLowerCase()
      if (!id || id === excluir) return false
      return String(row.cargo ?? '')
        .toLowerCase()
        .includes(p)
    })
    if (hit?.id) return String(hit.id)
  }
  return null
}

async function buscarViaRpc(excluirUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('chat_resolve_suporte_user_id', {
    p_caller: excluirUserId,
  })
  if (error) {
    if (error.code === 'PGRST202' || /function.*does not exist/i.test(error.message)) {
      return null
    }
    throw error
  }
  return typeof data === 'string' && data ? data : null
}

/** True se esta sessão é o contacto configurado (UUID ou e-mail em Vite). */
export function deveOcultarBalaoSuporteTecnico(userId: string, email: string | null | undefined): boolean {
  const byId = idSuporteTecnicoConfig()
  if (byId && userId.toLowerCase() === byId) return true
  if (byId) return false
  const emailCfg = emailSuporteTecnicoConfig()
  if (!emailCfg) return false
  const em = email?.toLowerCase()
  if (!em) return false
  return em === emailCfg
}

/**
 * Resolve o destinatário do pedido de suporte técnico (chat directo).
 * Ordem: VITE_SUPORTE_USER_ID → VITE_SUPORTE_EMAIL → Desenvolvedor → Administrador → RPC.
 */
export async function resolverIdContactoSuporteTecnico(solicitanteAuthId: string): Promise<string> {
  const sid = solicitanteAuthId.toLowerCase()

  const configuradoPorId = idSuporteTecnicoConfig()
  if (configuradoPorId) {
    if (sid === configuradoPorId) {
      throw new Error('Esta conta é o contacto de suporte; use o Chat Interno para responder aos colegas.')
    }
    const porId = await buscarUsuarioAtivoPorId(configuradoPorId)
    if (porId) return porId
  }

  const emailDestino = emailSuporteTecnicoConfig()
  if (emailDestino) {
    const porEmail = await buscarUsuarioAtivoPorEmail(emailDestino)
    if (porEmail && porEmail.toLowerCase() !== sid) return porEmail
  }

  const porCargo =
    (await buscarPorCargoAtivo(['desenvolvedor'], sid)) ??
    (await buscarPorCargoAtivo(['administrador'], sid))

  if (porCargo) return porCargo

  const porRpc = await buscarViaRpc(solicitanteAuthId)
  if (porRpc && porRpc.toLowerCase() !== sid) return porRpc

  throw new Error(
    'Não foi possível localizar um contacto de suporte activo. Crie um utilizador com cargo Desenvolvedor ou Administrador, ou defina VITE_SUPORTE_USER_ID / VITE_SUPORTE_EMAIL na Vercel.'
  )
}
