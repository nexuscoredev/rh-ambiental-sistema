import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ResiduoCatalogo = {
  id: string
  codigo: string
  nome: string
  ativo: boolean
  grupo: string | null
}

export type FetchResiduosCatalogoResult = {
  data: ResiduoCatalogo[]
  error: string | null
  /** Pedido sem sessão autenticada (costuma resolver após refresh do token). */
  semSessao: boolean
}

let cache: { data: ResiduoCatalogo[]; at: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

export function clearResiduosCatalogoCache(): void {
  cache = null
}

async function aguardarSessaoAutenticada(timeoutMs = 10_000): Promise<boolean> {
  const inicio = Date.now()
  while (Date.now() - inicio < timeoutMs) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token) return true
    await new Promise((r) => window.setTimeout(r, 120))
  }
  return false
}

export async function fetchResiduosCatalogo(options?: {
  force?: boolean
}): Promise<ResiduoCatalogo[]> {
  const r = await fetchResiduosCatalogoDetalhado(options)
  return r.data
}

export async function fetchResiduosCatalogoDetalhado(options?: {
  force?: boolean
}): Promise<FetchResiduosCatalogoResult> {
  if (!options?.force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { data: cache.data, error: null, semSessao: false }
  }

  const temSessao = await aguardarSessaoAutenticada()
  if (!temSessao) {
    return {
      data: [],
      error: 'Sessão ainda não disponível. Aguarde ou recarregue a página.',
      semSessao: true,
    }
  }

  const executar = async (): Promise<FetchResiduosCatalogoResult> => {
    const { data, error } = await supabase
      .from('residuos')
      .select('id, codigo, nome, ativo, grupo')
      .order('sort_order', { ascending: true })

    if (error) {
      console.warn('[residuos] catálogo:', error.message, error.code)
      return {
        data: [],
        error: error.message,
        semSessao: error.code === 'PGRST301' || /jwt|session/i.test(error.message),
      }
    }

    const rows = (data || []) as ResiduoCatalogo[]
    cache = { data: rows, at: Date.now() }
    return { data: rows, error: null, semSessao: false }
  }

  let resultado = await executar()
  if (resultado.error && resultado.semSessao) {
    await aguardarSessaoAutenticada(4_000)
    resultado = await executar()
  }

  return resultado
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

/** Catálogo com retry quando a sessão Supabase fica pronta após o primeiro paint. */
export function useResiduosCatalogo() {
  const [catalogo, setCatalogo] = useState<ResiduoCatalogo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [semSessao, setSemSessao] = useState(false)

  const carregar = useCallback(async (force = false) => {
    setCarregando(true)
    const r = await fetchResiduosCatalogoDetalhado({ force })
    setCatalogo(r.data)
    setErro(r.error)
    setSemSessao(r.semSessao)
    setCarregando(false)
  }, [])

  useEffect(() => {
    let cancelado = false

    const run = async (force = false) => {
      if (cancelado) return
      await carregar(force)
    }

    void run()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelado) return
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        void run(true)
      }
    })

    const aoVisivel = () => {
      if (document.visibilityState === 'visible' && !cancelado) {
        const ativos = cache?.data.filter((r) => r.ativo).length ?? 0
        if (ativos === 0) void run(true)
      }
    }
    document.addEventListener('visibilitychange', aoVisivel)

    return () => {
      cancelado = true
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', aoVisivel)
    }
  }, [carregar])

  const recarregar = useCallback(() => {
    clearResiduosCatalogoCache()
    void carregar(true)
  }, [carregar])

  return {
    catalogo,
    carregando,
    erro,
    semSessao,
    recarregar,
    ativos: catalogo.filter((r) => r.ativo),
  }
}
