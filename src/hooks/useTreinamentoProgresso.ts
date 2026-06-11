import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  KB_CONQUISTAS,
  kbMetaArtigo,
  kbProgressoNivel,
  type KbConquista,
} from '../lib/treinamentoKb/gamificacao'
import { kbNotaQuiz, kbQuizPorSlug } from '../lib/treinamentoKb/quizzes'
import {
  kbArtigosDoUsuario,
  kbStatusModulo,
  kbTotalModulosUsuario,
  type KbModuloStatus,
} from '../lib/treinamentoKb/treinamentoAcesso'
import type { UsuarioComPaginas } from '../lib/paginasSistema'
import { kbArtigoPorSlug } from '../lib/treinamentoKb/conteudo'

const STORAGE_PREFIX = 'rg-treinamento-progresso:v2'

export type TreinamentoProgressoState = {
  concluidos: string[]
  secoesLidas: Record<string, string[]>
  conquistas: string[]
  xpTotal: number
  ultimaAtividade: string | null
  sequenciaDias: number
  quizzesPerfeitosSeguidos: number
}

const ESTADO_VAZIO: TreinamentoProgressoState = {
  concluidos: [],
  secoesLidas: {},
  conquistas: [],
  xpTotal: 0,
  ultimaAtividade: null,
  sequenciaDias: 0,
  quizzesPerfeitosSeguidos: 0,
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

function xpBonusNovasConquistas(antigas: string[], novas: string[]): number {
  return novas
    .filter((id) => !antigas.includes(id))
    .reduce((s, id) => {
      const c = KB_CONQUISTAS.find((x) => x.id === id)
      return s + (c?.xpBonus ?? 0)
    }, 0)
}

function avaliarConquistas(
  estado: TreinamentoProgressoState,
  curriculumSlugs: string[],
): string[] {
  const ids: string[] = []
  const { concluidos, sequenciaDias, quizzesPerfeitosSeguidos } = estado

  if (concluidos.length >= 1) ids.push('primeira_certificacao')
  if (
    curriculumSlugs.length > 0 &&
    curriculumSlugs.every((s) => concluidos.includes(s))
  ) {
    ids.push('trilha_perfil')
  }
  if (sequenciaDias >= 3) ids.push('sequencia_3')
  if (sequenciaDias >= 7) ids.push('sequencia_7')
  if (quizzesPerfeitosSeguidos >= 3) ids.push('quiz_perfeito')

  return ids
}

function carregarLocal(userId: string): TreinamentoProgressoState {
  try {
    const raw = localStorage.getItem(chaveStorage(userId))
    if (!raw) return { ...ESTADO_VAZIO }
    const parsed = JSON.parse(raw) as Partial<TreinamentoProgressoState>
    return {
      concluidos: Array.isArray(parsed.concluidos) ? parsed.concluidos : [],
      secoesLidas:
        parsed.secoesLidas && typeof parsed.secoesLidas === 'object'
          ? parsed.secoesLidas
          : {},
      conquistas: Array.isArray(parsed.conquistas) ? parsed.conquistas : [],
      xpTotal: typeof parsed.xpTotal === 'number' ? parsed.xpTotal : 0,
      ultimaAtividade: parsed.ultimaAtividade ?? null,
      sequenciaDias: typeof parsed.sequenciaDias === 'number' ? parsed.sequenciaDias : 0,
      quizzesPerfeitosSeguidos:
        typeof parsed.quizzesPerfeitosSeguidos === 'number'
          ? parsed.quizzesPerfeitosSeguidos
          : 0,
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
  notaQuiz?: number
}

export function useTreinamentoProgresso() {
  const [userId, setUserId] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<UsuarioComPaginas | null>(null)
  const [estado, setEstado] = useState<TreinamentoProgressoState>(ESTADO_VAZIO)
  const [celebracao, setCelebracao] = useState<ConcluirModuloResultado | null>(null)

  useEffect(() => {
    let cancel = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancel || !user) {
        if (!cancel) {
          setUserId('anon')
          setUsuario(null)
        }
        return
      }
      const id = user.id.trim()
      setUserId(id)
      setEstado(carregarLocal(id))

      const { data } = await supabase
        .from('usuarios')
        .select('nome, email, cargo, paginas_permitidas')
        .eq('id', id)
        .maybeSingle()

      if (!cancel) {
        setUsuario(
          data
            ? {
                nome: data.nome,
                email: data.email ?? user.email,
                cargo: data.cargo,
                paginas_permitidas: data.paginas_permitidas,
              }
            : { email: user.email, cargo: null, nome: null, paginas_permitidas: null },
        )
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const curriculum = useMemo(() => kbArtigosDoUsuario(usuario), [usuario])
  const curriculumSlugs = useMemo(() => curriculum.map((a) => a.slug), [curriculum])

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

  const statusModulo = useCallback(
    (slug: string): KbModuloStatus =>
      kbStatusModulo(slug, usuario, estado.concluidos),
    [usuario, estado.concluidos],
  )

  const secoesLidasDoModulo = useCallback(
    (slug: string) => estado.secoesLidas[slug] ?? [],
    [estado.secoesLidas],
  )

  const marcarSecaoLida = useCallback(
    (slug: string, secaoId: string) => {
      const lidas = estado.secoesLidas[slug] ?? []
      if (lidas.includes(secaoId)) return

      const artigo = kbArtigoPorSlug(slug)
      const meta = kbMetaArtigo(slug)
      const xpSecao = meta.xpPorSecao

      const nextSecoes = { ...estado.secoesLidas, [slug]: [...lidas, secaoId] }
      const next: TreinamentoProgressoState = {
        ...estado,
        secoesLidas: nextSecoes,
        xpTotal: estado.xpTotal + xpSecao,
        ultimaAtividade: hojeIso(),
        sequenciaDias: calcularSequencia(estado.ultimaAtividade, estado.sequenciaDias),
      }

      const totalSecoes = artigo?.secoes.length ?? 0
      const lidasAgora = nextSecoes[slug]?.length ?? 0
      if (totalSecoes > 0 && lidasAgora >= totalSecoes) {
        // leitura completa — quiz liberado (sem XP extra aqui)
      }

      persistir(next)
    },
    [estado, persistir],
  )

  const leituraCompleta = useCallback(
    (slug: string): boolean => {
      const artigo = kbArtigoPorSlug(slug)
      if (!artigo || artigo.secoes.length === 0) return true
      const lidas = estado.secoesLidas[slug] ?? []
      return artigo.secoes.every((s) => lidas.includes(s.id))
    },
    [estado.secoesLidas],
  )

  const progressoLeitura = useCallback(
    (slug: string): { lidas: number; total: number; percentual: number } => {
      const artigo = kbArtigoPorSlug(slug)
      const total = artigo?.secoes.length ?? 0
      const lidas = (estado.secoesLidas[slug] ?? []).length
      const percentual = total ? Math.round((lidas / total) * 100) : 100
      return { lidas, total, percentual }
    },
    [estado.secoesLidas],
  )

  const certificarModuloQuiz = useCallback(
    (slug: string, respostas: number[]): ConcluirModuloResultado => {
      if (estado.concluidos.includes(slug)) {
        return { xpGanho: 0, novasConquistas: [], jaConcluido: true }
      }

      if (statusModulo(slug) !== 'disponivel' && statusModulo(slug) !== 'concluido') {
        return { xpGanho: 0, novasConquistas: [], jaConcluido: false }
      }

      if (!leituraCompleta(slug)) {
        return { xpGanho: 0, novasConquistas: [], jaConcluido: false }
      }

      const quiz = kbQuizPorSlug(slug)
      if (!quiz) {
        return { xpGanho: 0, novasConquistas: [], jaConcluido: false }
      }

      const nota = kbNotaQuiz(quiz.questoes, respostas)
      if (nota < quiz.notaMinima) {
        return { xpGanho: 0, novasConquistas: [], jaConcluido: false, notaQuiz: nota }
      }

      const hoje = hojeIso()
      const sequencia = calcularSequencia(estado.ultimaAtividade, estado.sequenciaDias)
      const concluidos = [...estado.concluidos, slug]
      const meta = kbMetaArtigo(slug)
      const xpCert = meta.xpCertificacao
      const perfeito = nota === 100
      const quizzesPerfeitosSeguidos = perfeito ? estado.quizzesPerfeitosSeguidos + 1 : 0

      const draft: TreinamentoProgressoState = {
        ...estado,
        concluidos,
        sequenciaDias: sequencia,
        ultimaAtividade: hoje,
        quizzesPerfeitosSeguidos,
      }

      const conquistasNovas = avaliarConquistas(draft, curriculumSlugs)
      const xpBonus = xpBonusNovasConquistas(estado.conquistas, conquistasNovas)
      const xpGanho = xpCert + xpBonus

      const next: TreinamentoProgressoState = {
        ...draft,
        conquistas: conquistasNovas,
        xpTotal: estado.xpTotal + xpGanho,
      }

      persistir(next)

      const novasConquistas = conquistasNovas
        .filter((id) => !estado.conquistas.includes(id))
        .map((id) => KB_CONQUISTAS.find((c) => c.id === id)!)
        .filter(Boolean)

      const resultado: ConcluirModuloResultado = {
        xpGanho,
        novasConquistas,
        jaConcluido: false,
        notaQuiz: nota,
      }
      setCelebracao(resultado)
      return resultado
    },
    [estado, persistir, statusModulo, leituraCompleta, curriculumSlugs],
  )

  const fecharCelebracao = useCallback(() => setCelebracao(null), [])

  const stats = useMemo(() => {
    const progresso = kbProgressoNivel(estado.xpTotal)
    const totalModulos = kbTotalModulosUsuario(usuario)
    const modulosConcluidos = curriculumSlugs.filter((s) =>
      estado.concluidos.includes(s),
    ).length
    const percentualTrilha =
      totalModulos > 0 ? Math.round((modulosConcluidos / totalModulos) * 100) : 0

    return {
      ...progresso,
      modulosConcluidos,
      totalModulos,
      percentualTrilha,
      pontosResgate: estado.xpTotal,
      sequenciaDias: estado.sequenciaDias,
      conquistasDesbloqueadas: estado.conquistas,
      cargo: usuario?.cargo ?? null,
      nome: usuario?.nome ?? null,
    }
  }, [estado, usuario, curriculumSlugs])

  return {
    estado,
    usuario,
    curriculum,
    stats,
    isConcluido,
    statusModulo,
    marcarSecaoLida,
    secoesLidasDoModulo,
    leituraCompleta,
    progressoLeitura,
    certificarModuloQuiz,
    celebracao,
    fecharCelebracao,
  }
}
