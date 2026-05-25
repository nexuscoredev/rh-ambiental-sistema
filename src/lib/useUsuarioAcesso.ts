import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { UsuarioAcessoContext } from './rbac'

const vazio: UsuarioAcessoContext = { cargo: null, nome: null, email: null }

/**
 * Carrega cargo/nome do utilizador autenticado para gates RBAC nas páginas.
 */
export function useUsuarioAcesso(): UsuarioAcessoContext {
  const [ctx, setCtx] = useState<UsuarioAcessoContext>(vazio)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      const uid = user?.id
      const email = user?.email ?? null
      if (!uid) {
        if (ativo) setCtx({ cargo: null, nome: null, email })
        return
      }
      const meta = user?.user_metadata as Record<string, unknown> | undefined
      const nomeMeta =
        (typeof meta?.nome === 'string' && meta.nome.trim()) ||
        (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta?.name === 'string' && meta.name.trim()) ||
        null
      const { data } = await supabase
        .from('usuarios')
        .select('cargo, nome')
        .eq('id', uid)
        .maybeSingle()
      if (!ativo) return
      const nomeDb = (data?.nome as string | null)?.trim() || null
      setCtx({
        cargo: (data?.cargo as string | null) ?? null,
        nome: nomeDb ?? nomeMeta,
        email,
      })
    })()
    return () => {
      ativo = false
    }
  }, [])

  return ctx
}

export function mergeUsuarioAcesso(
  ctx: UsuarioAcessoContext,
  patch: Partial<UsuarioAcessoContext>
): UsuarioAcessoContext {
  return { ...ctx, ...patch }
}
