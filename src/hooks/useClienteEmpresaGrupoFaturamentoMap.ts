import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  isMissingEmpresaGrupoFaturamentoColumnError,
  normalizarEmpresaGrupoFaturamentoForm,
  rotuloEmpresaGrupoFaturamento,
} from '../lib/clienteEmpresaGrupoFaturamento'

export function useClienteEmpresaGrupoFaturamentoMap(clienteIds: string[]) {
  const chave = useMemo(
    () =>
      [...new Set(clienteIds.map((id) => id.trim()).filter(Boolean))].sort().join('|'),
    [clienteIds]
  )
  const ids = useMemo(() => (chave ? chave.split('|') : []), [chave])

  const [rotulos, setRotulos] = useState<Record<string, string>>({})
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    if (ids.length === 0) {
      setRotulos({})
      setIndisponivel(false)
      return
    }
    let cancel = false
    void supabase
      .from('clientes')
      .select('id, empresa_grupo_faturamento')
      .in('id', ids)
      .then(({ data, error }) => {
        if (cancel) return
        if (error) {
          if (isMissingEmpresaGrupoFaturamentoColumnError(error)) {
            setIndisponivel(true)
            setRotulos({})
            return
          }
          setIndisponivel(false)
          setRotulos({})
          return
        }
        setIndisponivel(false)
        const map: Record<string, string> = {}
        for (const row of data ?? []) {
          const id = String((row as { id?: string }).id ?? '').trim()
          if (!id) continue
          const form = normalizarEmpresaGrupoFaturamentoForm(
            (row as { empresa_grupo_faturamento?: unknown }).empresa_grupo_faturamento
          )
          const rotulo = rotuloEmpresaGrupoFaturamento(form)
          if (rotulo) map[id] = rotulo
        }
        setRotulos(map)
      })
    return () => {
      cancel = true
    }
  }, [chave, ids])

  return { rotulos, indisponivel }
}
