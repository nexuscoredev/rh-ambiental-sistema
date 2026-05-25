import { supabase } from './supabase'
import { sanitizeIlikePattern } from './sanitizeIlike'

export type ClienteAtivoOpt = { id: string; nome: string }

/** Clientes ativos por nome (ou razão social); sem termo, primeiros por ordem alfabética. */
export async function buscarClientesAtivos(opts?: {
  termo?: string
  limit?: number
}): Promise<ClienteAtivoOpt[]> {
  const limit = opts?.limit ?? 30
  const termo = (opts?.termo ?? '').trim()

  let q = supabase
    .from('clientes')
    .select('id, nome, razao_social')
    // Cadastro grava «Ativo» / «Inativo» (não «ativo» em minúsculas)
    .or('status.eq.Ativo,status.eq.ativo,status.is.null')
    .order('nome', { ascending: true })
    .limit(limit)

  if (termo.length > 0) {
    const s = sanitizeIlikePattern(termo)
    q = q.or(`nome.ilike.%${s}%,razao_social.ilike.%${s}%,cnpj.ilike.%${s}%`)
  }

  const { data, error } = await q
  if (error) return []
  return (data ?? []).map((r) => {
    const nome = String(r.nome ?? '').trim()
    const razao = String(r.razao_social ?? '').trim()
    return {
      id: String(r.id),
      nome: nome || razao || String(r.id),
    }
  })
}

export async function obterClienteAtivoPorId(id: string): Promise<ClienteAtivoOpt | null> {
  if (!id) return null
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome')
    .or('status.eq.Ativo,status.eq.ativo,status.is.null')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return { id: String(data.id), nome: String(data.nome ?? data.id) }
}
