import { useContext, useEffect, useMemo, useState } from 'react'
import { PerfilUsuarioContext } from '../contexts/PerfilUsuarioContext'
import { supabase } from './supabase'
import type { UsuarioAcessoContext } from './rbac'

const vazio: UsuarioAcessoContext = { cargo: null, nome: null, email: null }

/**
 * Carrega cargo/nome do utilizador autenticado para gates RBAC nas páginas.
 * Preferência: perfil já carregado no `PerfilUsuarioProvider` (evita corrida com cargo vazio).
 */
export function useUsuarioAcesso(): UsuarioAcessoContext {
  const perfilCtx = useContext(PerfilUsuarioContext)
  const [fallback, setFallback] = useState<UsuarioAcessoContext>(vazio)

  const doPerfil = perfilCtx?.usuario
    ? {
        cargo: perfilCtx.usuario.cargo?.trim() || null,
        nome: perfilCtx.usuario.nome?.trim() || null,
        email: perfilCtx.usuario.email?.trim() || null,
      }
    : null

  useEffect(() => {
    if (doPerfil) return
    let ativo = true
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      const uid = user?.id
      const email = user?.email ?? null
      if (!uid) {
        if (ativo) setFallback({ cargo: null, nome: null, email })
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
      setFallback({
        cargo: (data?.cargo as string | null) ?? null,
        nome: nomeDb ?? nomeMeta,
        email,
      })
    })()
    return () => {
      ativo = false
    }
  }, [doPerfil])

  return useMemo(() => doPerfil ?? fallback, [doPerfil, fallback])
}

export function mergeUsuarioAcesso(
  ctx: UsuarioAcessoContext,
  patch: Partial<UsuarioAcessoContext>
): UsuarioAcessoContext {
  return { ...ctx, ...patch }
}
