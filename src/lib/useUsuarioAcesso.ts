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
      const uid = auth.user?.id
      const email = auth.user?.email ?? null
      if (!uid) {
        if (ativo) setCtx({ cargo: null, nome: null, email })
        return
      }
      const { data } = await supabase
        .from('usuarios')
        .select('cargo, nome')
        .eq('id', uid)
        .maybeSingle()
      if (!ativo) return
      setCtx({
        cargo: (data?.cargo as string | null) ?? null,
        nome: (data?.nome as string | null) ?? null,
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
