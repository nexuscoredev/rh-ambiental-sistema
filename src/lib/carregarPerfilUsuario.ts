import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { UsuarioPerfilApp } from '../contexts/PerfilUsuarioContext'

const TENTATIVAS = 3
const TIMEOUT_MS = 12_000
const PAUSA_ENTRE_TENTATIVAS_MS = 800

export type ResultadoCarregarPerfil = {
  usuario: UsuarioPerfilApp | null
  erro: string | null
  /** Perfil completo da BD, reduzido (sessão) ou indisponível. */
  modo: 'completo' | 'sessao' | 'erro'
}

function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, rotulo: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Tempo esgotado ao ${rotulo} (${Math.round(ms / 1000)}s).`))
    }, ms)
    promise
      .then((v) => {
        window.clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        window.clearTimeout(timer)
        reject(e)
      })
  })
}

function erroColunaPaginasPermitidas(msg: string): boolean {
  const m = msg.toLowerCase()
  return m.includes('paginas_permitidas') && (m.includes('column') || m.includes('schema cache'))
}

function rpcPerfilIndisponivel(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('obter_meu_perfil_usuario') &&
    (m.includes('could not find') || m.includes('schema cache') || m.includes('does not exist'))
  )
}

function normalizarLinhaPerfil(row: Record<string, unknown> | null): UsuarioPerfilApp | null {
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    nome: String(row.nome ?? ''),
    email: String(row.email ?? ''),
    cargo: String(row.cargo ?? ''),
    status: String(row.status ?? ''),
    foto_url: (row.foto_url as string | null) ?? null,
    paginas_permitidas: (row.paginas_permitidas as string[] | null) ?? null,
  }
}

/** Perfil mínimo a partir da sessão Auth (entrada degradada se a BD não responder). */
export function perfilMinimoDaSessao(session: Session, userId: string): UsuarioPerfilApp {
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>
  const email = session.user.email ?? ''
  return {
    id: userId,
    nome: String(meta.nome ?? meta.full_name ?? email.split('@')[0] ?? 'Utilizador'),
    email,
    cargo: String(meta.cargo ?? 'Visualizador'),
    status: 'ativo',
    foto_url: (meta.foto_url as string | null) ?? null,
    paginas_permitidas: null,
  }
}

async function buscarViaRpc(supabase: SupabaseClient): Promise<UsuarioPerfilApp | null> {
  const { data, error } = await supabase.rpc('obter_meu_perfil_usuario')
  if (error) {
    if (rpcPerfilIndisponivel(error.message)) return null
    throw error
  }
  const bruto = Array.isArray(data) ? data[0] : data
  if (!bruto || typeof bruto !== 'object') return null
  return normalizarLinhaPerfil(bruto as Record<string, unknown>)
}

async function buscarViaTabela(
  supabase: SupabaseClient,
  userId: string
): Promise<UsuarioPerfilApp | null> {
  const selectComPaginas =
    'id, nome, email, cargo, status, foto_url, paginas_permitidas'
  const selectSemPaginas = 'id, nome, email, cargo, status, foto_url'

  const query = (select: string) =>
    supabase.from('usuarios').select(select).eq('id', userId).maybeSingle()

  let res = await query(selectComPaginas)
  if (res.error && erroColunaPaginasPermitidas(res.error.message)) {
    res = await query(selectSemPaginas)
  }
  if (res.error) throw res.error
  if (!res.data) return null
  return normalizarLinhaPerfil(res.data as unknown as Record<string, unknown>)
}

/**
 * Carrega o perfil do utilizador autenticado (RPC → tabela, com retentativas).
 * Se a BD falhar após as tentativas, devolve perfil mínimo da sessão para não bloquear o login.
 */
export async function carregarPerfilUsuario(
  supabase: SupabaseClient,
  userId: string,
  session?: Session | null
): Promise<ResultadoCarregarPerfil> {
  const uid = userId.trim()
  if (!uid) {
    return { usuario: null, erro: 'ID de utilizador inválido.', modo: 'erro' }
  }

  let ultimoErro = ''

  for (let t = 0; t < TENTATIVAS; t++) {
    if (t > 0) await pausa(PAUSA_ENTRE_TENTATIVAS_MS)

    try {
      const viaRpc = await withTimeout(buscarViaRpc(supabase), TIMEOUT_MS, 'ler perfil (RPC)')
      if (viaRpc) {
        return { usuario: viaRpc, erro: null, modo: 'completo' }
      }

      const viaTabela = await withTimeout(
        buscarViaTabela(supabase, uid),
        TIMEOUT_MS,
        'ler perfil'
      )
      if (viaTabela) {
        return { usuario: viaTabela, erro: null, modo: 'completo' }
      }

      return {
        usuario: null,
        erro:
          'Utilizador autenticado sem registo em «usuarios». Peça a um administrador para criar o acesso.',
        modo: 'erro',
      }
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e)
      console.warn(`[carregarPerfilUsuario] tentativa ${t + 1}/${TENTATIVAS}:`, ultimoErro)
    }
  }

  if (session?.user) {
    const emergencia = perfilMinimoDaSessao(session, uid)
    console.warn(
      '[carregarPerfilUsuario] Perfil em modo sessão (BD indisponível). Execute supabase/sql_editor_usuarios_perfil_login.sql no Supabase.'
    )
    return {
      usuario: emergencia,
      erro: null,
      modo: 'sessao',
    }
  }

  return {
    usuario: null,
    erro: ultimoErro || 'Não foi possível carregar o perfil.',
    modo: 'erro',
  }
}
