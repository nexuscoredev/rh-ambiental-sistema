import { supabase } from './supabase'

export type ResiduoCatalogo = {
  id: string
  codigo: string
  nome: string
  ativo: boolean
  grupo: string | null
}

export async function fetchResiduosCatalogo(): Promise<ResiduoCatalogo[]> {
  const { data, error } = await supabase
    .from('residuos')
    .select('id, codigo, nome, ativo, grupo')
    .order('sort_order', { ascending: true })

  if (error) {
    console.warn('[residuos] catálogo indisponível (migração aplicada?):', error.message)
    return []
  }

  return (data || []) as ResiduoCatalogo[]
}

export function mapResiduosPorId(rows: ResiduoCatalogo[]): Map<string, ResiduoCatalogo> {
  return new Map(rows.map((r) => [r.id, r]))
}

/** Texto padrão gravado em coletas / regras / contrato (código — nome). */
export function rotuloResiduoCatalogo(r: Pick<ResiduoCatalogo, 'codigo' | 'nome'>): string {
  const codigo = (r.codigo ?? '').trim()
  const nome = (r.nome ?? '').trim()
  if (codigo && nome) return `${codigo} — ${nome}`
  return codigo || nome || '—'
}

/** Valor sentinela em regras de preço = qualquer resíduo. */
export const TIPO_RESIDUO_REGRA_QUALQUER = '*'
