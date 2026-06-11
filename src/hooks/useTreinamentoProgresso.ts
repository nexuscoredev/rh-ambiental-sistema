import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  KB_APOIO_SLUGS_GAM,
  KB_CONQUISTAS,
  KB_FLUXO_SLUGS,
  KB_TOTAL_ARTIGOS,
  kbMetaArtigo,
  kbProgressoNivel,
  type KbConquista,
} from '../lib/treinamentoKb/gamificacao'

const STORAGE_PREFIX = 'rg-treinamento-progresso:v1'

export type TreinamentoProgressoState = {
  concluidos: string[]
  conquistas: string[]
  xpTotal: number
  ultimaAtividade: string | null
  sequenciaDias: number
}

const ESTADO_VAZIO: TreinamentoProgressoState = {
  concluidos: [],
  conquistas: [],
  xpTotal: 0,
  ultimaAtividade: null,
  sequenciaDias: 0,
}

function chaveStorage(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function ontemIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function calcularSequencia(ultima: string | null, sequenciaAtual: number): number {
  const hoje = hojeIso()
  if (!ultima) return 1
  if (ultima === hoje) return sequenciaAtual || 1
  if (ultima === ontemIso()) return (sequenciaAtual || 0) + 1
  return 1
}

function avaliarConquistas(concluidos: string[], sequencia: number): string[] {
  const ids: string[] = []
  if (concluidos.length >= 1) ids.push('primeira_missao')
  if (KB_FLUXO_SLUGS.every((s) => concluidos.includes(s))) ids.push('trilha_fluxo')
  if (KB_APOIO_SLUGS_GAM.every((s) => concluidos.includes(s))) ids.push('trilha_apoio')
  if (concluidos.length >= KB_TOTAL_ARTIGOS) ids.push('trilha_mestre')
  if (sequencia >= 3) ids.push('sequencia_3')
  if (sequencia >= 7) ids.push('sequencia_7')
  return ids
}

function xpBonusNovasConquistas(antigas: string[], novas: string[]): number {
  return novas
    .filter((id) => !antigas.includes(id))
    .reduce((s, id) => {
      const c = KB_CONQUISTAS.find((x) => x.id === id)
      return s + (c?.xpBonus ?? 0)
    }, 0)
}

function carregarLocal(userId: string): TreinamentoProgressoState {
  try {
    const raw = localStorage.getItem(chaveStorage(userId))
    if (!raw) return { ...ESTADO_VAZIO }
    const parsed = JSON.parse(raw) as Partial<TreinamentoProgressoState>
    return {
      concluidos: Array.isArray(parsed.concluidos) ? parsed.concluidos : [],
      conquistas: Array.isArray(parsed.conquistas) ? parsed.conquistas : [],
      xpTotal: typeof parsed.xpTotal === 'number' ? parsed.xpTotal : 0,
      ultimaAtividade: parsed.ultimaAtividade ?? null,
      sequenciaDias: typeof parsed.sequenciaDias === 'number' ? parsed.sequenciaDias : 0,
    }
  } catch {
    return { ...ESTADO_VAZIO }
  }
}

function salvarLocal(userId: string, estado: TreinamentoProgressoState) {
  localStorage.setItem(chaveStorage(userId), JSON.stringify(estado))
}

export type ConcluirModuloResultado = {
  xpGanho: number
  novasConquistas: KbConquista[]
  jaConcluido: boolean
}

export function useTreinamentoProgresso() {
  const [userId, setUserId] = useState<string | null>(null)
  const [estado, setEstado] = useState<TreinamentoProgressoState>(ESTADO_VAZIO)
  const [celebracao, setCelebracao] = useState<ConcluirModuloResultado | null>(null)

  useEffect(() => {
    let cancel = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancel) return
      const id = user?.id?.trim() || 'anon'
      setUserId(id)
      setEstado(carregarLocal(id))
    })()
    return () => {
      cancel = true
    }
  }, [])

  const persistir = useCallback(
    (next: TreinamentoProgressoState) => {
      setEstado(next)
      if (userId) salvarLocal(userId, next)
    },
    [userId],
  )

  const isConcluido = useCallback(
    (slug: string) => estado.concluidos.includes(slug),
    [estado.concluidos],
  )

  const concluirModulo = useCallback(
    (slug: string): ConcluirModuloResultado => {
      if (estado.concluidos.includes(slug)) {
        return { xpGanho: 0, novasConquistas: [], jaConcluido: true }
      }

      const hoje = hojeIso()
      const sequencia = calcularSequencia(estado.ultimaAtividade, estado.sequenciaDias)
      const concluidos = [...estado.concluidos, slug]
      const conquistasNovas = avaliarConquistas(concluidos, sequencia)
      const xpModulo = kbMetaArtigo(slug).xpRecompensa
      const xpBonus = xpBonusNovasConquistas(estado.conquistas, conquistasNovas)
      const xpGanho = xpModulo + xpBonus

      const next: TreinamentoProgressoState = {
        concluidos,
        conquistas: conquistasNovas,
        xpTotal: estado.xpTotal + xpGanho,
        ultimaAtividade: hoje,
        sequenciaDias: sequencia,
      }

      persistir(next)

      const novasConquistas = conquistasNovas
        .filter((id) => !estado.conquistas.includes(id))
        .map((id) => KB_CONQUISTAS.find((c) => c.id === id)!)
        .filter(Boolean)

      const resultado: ConcluirModuloResultado = { xpGanho, novasConquistas, jaConcluido: false }
      setCelebracao(resultado)
      return resultado
    },
    [estado, persistir],
  )

  const fecharCelebracao = useCallback(() => setCelebracao(null), [])

  const stats = useMemo(() => {
    const progresso = kbProgressoNivel(estado.xpTotal)
    const modulosConcluidos = estado.concluidos.length
    const percentualTrilha = Math.round((modulosConcluidos / KB_TOTAL_ARTIGOS) * 100)
    const pontosResgate = estado.xpTotal

    return {
      ...progresso,
      modulosConcluidos,
      percentualTrilha,
      pontosResgate,
      sequenciaDias: estado.sequenciaDias,
      conquistasDesbloqueadas: estado.conquistas,
    }
  }, [estado])

  return {
    estado,
    stats,
    isConcluido,
    concluirModulo,
    celebracao,
    fecharCelebracao,
  }
}
