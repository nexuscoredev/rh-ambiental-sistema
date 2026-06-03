import { useMemo } from 'react'
import { rbacPode, type UsuarioAcessoContext } from '../lib/rbac'
import { useUsuarioAcesso } from '../lib/useUsuarioAcesso'

export function frotaPermissoesDe(ctx: UsuarioAcessoContext) {
  return {
    podeLer: rbacPode('frota_operacional', 'ler', ctx),
    podeMutar: rbacPode('frota_operacional', 'editar', ctx),
    podeExcluir: rbacPode('frota_operacional', 'excluir', ctx),
    podeRelatorio: rbacPode('frota_operacional', 'editar', ctx),
  }
}

/** Permissões UI da frota (edição, inclusão, relatório; exclusão só Comercial Adm). */
export function useFrotaPermissoes() {
  const ctx = useUsuarioAcesso()
  return useMemo(() => frotaPermissoesDe(ctx), [ctx.cargo, ctx.nome, ctx.email])
}
