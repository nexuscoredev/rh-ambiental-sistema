import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import {
  chatAdminApagarHistoricoConversa,
  chatCarregarConversas,
  chatCarregarMensagens,
  chatEnviarAnexo,
  chatEnviarTexto,
  chatGetOrCreateDirect,
  chatListarUsuariosAtivos,
  chatMarcarLida,
  chatObterLastReadAtParticipante,
} from '../../lib/chat'
import { chatEnviarFigurinha, type ChatSticker } from '../../lib/chatStickers'
import {
  chatDecidirPedidoAjusteSolicitante,
  chatEditarPedidoAjusteSolicitante,
  chatMapStatusPedidosAjusteNaConversa,
  chatAprovarPedidoAjusteFilaThais,
  chatEnviarPedidoAjusteFilaThais,
  chatListarHistoricoPedidosAjuste,
  chatListarPedidosAguardandoDetalhesSolicitante,
  chatListarPedidosAguardandoFeedbackSolicitante,
  chatListarPedidosAjusteFilaThais,
  chatListarPedidosAjusteAguardandoDetalhesDev,
  chatListarPedidosAjustePendentes,
  chatMarcarPedidoAjusteResolvido,
  chatPedirDetalhesPedidoAjuste,
  chatResponderDetalhesPedidoAjuste,
  pedidoAjusteSolicitantePodeEditar,
  chatMensagemEhPedidoAjuste,
  type PedidoAjusteAguardandoDetalhes,
  type PedidoAjusteAguardandoFeedback,
  type PedidoAjusteFilaItem,
  type PedidoAjusteHistoricoItem,
  type PedidoAjusteStatus,
} from '../../lib/chatPedidoAjuste'
import { ChatPedidosAjusteColuna } from './ChatPedidosAjusteColuna'
import {
  cargoPodeApagarHistoricoChat,
  usuarioEhAprovadorSolicitacoesThais,
  usuarioPodeEnviarSolicitacaoFilaThais,
  usuarioVeColunaSolicitacoesChat,
} from '../../lib/workflowPermissions'
import { usePerfilUsuario } from '../../contexts/PerfilUsuarioContext'
import { normalizarPresencaStatus } from '../../lib/presencaStatus'
import type { ChatConversaLista, ChatMensagem, ChatUsuarioLista } from '../../types/chat'
import { useChatFloat } from '../../contexts/ChatFloatContext'
import { usePresencaAoVivo } from '../../contexts/PresencaAoVivoContext'
import { ChatSidebarPanel } from './ChatSidebarPanel'
import { ChatThreadPanel } from './ChatThreadPanel'
import { RgChatLogo } from './RgChatLogo'
import { BRAND_LOGO_MARK } from '../../lib/brandLogo'
import { rgConfirm } from '../../lib/RgDialogProvider'

const CHAT_HEAD_THEME_STORAGE_KEY = 'rg-chat-head-theme'
const CHAT_FAB_POS_STORAGE_KEY = 'rg-chat-fab-pos-v1'

type FabPos = { x: number; y: number }

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function parseFabPos(raw: string | null): FabPos | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { x?: unknown; y?: unknown }
    const x = Number(v.x)
    const y = Number(v.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x, y }
  } catch {
    return null
  }
}

export type ChatHeadThemeId = 'verde' | 'azul_escuro' | 'azul_claro' | 'rosa' | 'vermelho' | 'amarelo'

const CHAT_HEAD_THEMES: Record<ChatHeadThemeId, { label: string; gradient: string }> = {
  verde: {
    label: 'Verde',
    gradient: 'linear-gradient(180deg, #0f766e 0%, #0d9488 48%, #0f766e 100%)',
  },
  azul_escuro: {
    label: 'Azul escuro',
    gradient: 'linear-gradient(180deg, #1e3a8a 0%, #172554 48%, #1e3a8a 100%)',
  },
  azul_claro: {
    label: 'Azul claro',
    gradient: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 48%, #0284c7 100%)',
  },
  rosa: {
    label: 'Rosa',
    gradient: 'linear-gradient(180deg, #f472b6 0%, #db2777 48%, #be185d 100%)',
  },
  vermelho: {
    label: 'Vermelho',
    gradient: 'linear-gradient(180deg, #ef4444 0%, #dc2626 48%, #b91c1c 100%)',
  },
  amarelo: {
    label: 'Amarelo',
    gradient: 'linear-gradient(180deg, #facc15 0%, #eab308 48%, #ca8a04 100%)',
  },
}

const CHAT_HEAD_THEME_IDS = Object.keys(CHAT_HEAD_THEMES) as ChatHeadThemeId[]

function parseChatHeadTheme(raw: string | null): ChatHeadThemeId {
  if (raw && CHAT_HEAD_THEME_IDS.includes(raw as ChatHeadThemeId)) return raw as ChatHeadThemeId
  return 'verde'
}

type Props = {
  /** Total não lidas (sidebar do layout); reutilizado no FAB. */
  naoLidasBadge: number
}

const CHAT_NOTIFICACAO_AUDIO_SRC = '/msn-sound_1.mp3'

export function ChatInternoFloating({ naoLidasBadge }: Props) {
  const { open, setOpen, pendingUserId, clearPendingUserId } = useChatFloat()
  const { isOnline } = usePresencaAoVivo()
  const { usuario } = usePerfilUsuario()
  const podeApagarHistoricoChat = cargoPodeApagarHistoricoChat(
    usuario?.cargo,
    usuario?.nome,
    usuario?.email
  )
  const veColunaSolicitacoes = usuarioVeColunaSolicitacoesChat(
    usuario?.cargo,
    usuario?.nome,
    usuario?.email
  )
  const podeEnviarFilaThais = usuarioPodeEnviarSolicitacaoFilaThais(
    usuario?.cargo,
    usuario?.nome,
    usuario?.email
  )
  const ehAprovadorThais = usuarioEhAprovadorSolicitacoesThais(usuario?.nome, usuario?.cargo)
  const modoPedidosColuna: 'dev' | 'thais' =
    ehAprovadorThais && !podeEnviarFilaThais ? 'thais' : 'dev'

  const fabRef = useRef<HTMLButtonElement | null>(null)
  const [fabPos, setFabPos] = useState<FabPos | null>(() => {
    if (typeof window === 'undefined') return null
    return parseFabPos(localStorage.getItem(CHAT_FAB_POS_STORAGE_KEY))
  })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    baseX: number
    baseY: number
    moved: boolean
  } | null>(null)

  const [meuId, setMeuId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [tab, setTab] = useState<'conversas' | 'pessoas'>('conversas')
  const [busca, setBusca] = useState('')

  const [usuarios, setUsuarios] = useState<ChatUsuarioLista[]>([])
  const [conversas, setConversas] = useState<ChatConversaLista[]>([])
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [atualizandoPessoasTab, setAtualizandoPessoasTab] = useState(false)

  const [conversaId, setConversaId] = useState<string | null>(null)
  const [outroIdPainel, setOutroIdPainel] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([])
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)
  const [pedidosAjustePendentes, setPedidosAjustePendentes] = useState<PedidoAjusteFilaItem[]>([])
  const [historicoPedidosAjuste, setHistoricoPedidosAjuste] = useState<PedidoAjusteHistoricoItem[]>(
    []
  )
  const [carregandoPedidosAjuste, setCarregandoPedidosAjuste] = useState(false)
  const [carregandoHistoricoPedidosAjuste, setCarregandoHistoricoPedidosAjuste] = useState(false)
  const [marcandoPedidoAjusteId, setMarcandoPedidoAjusteId] = useState<string | null>(null)
  const [pedidosAguardandoFeedback, setPedidosAguardandoFeedback] = useState<
    PedidoAjusteAguardandoFeedback[]
  >([])
  const [decidindoPedidoAjusteId, setDecidindoPedidoAjusteId] = useState<string | null>(null)
  const [pedidosAguardandoDetalhes, setPedidosAguardandoDetalhes] = useState<
    PedidoAjusteAguardandoDetalhes[]
  >([])
  const [respondendoDetalhesId, setRespondendoDetalhesId] = useState<string | null>(null)
  const [pedindoDetalhesId, setPedindoDetalhesId] = useState<string | null>(null)
  const [statusPedidosConversa, setStatusPedidosConversa] = useState<
    Map<string, PedidoAjusteStatus | null>
  >(new Map())
  const [editandoPedidoId, setEditandoPedidoId] = useState<string | null>(null)
  const [aprovandoThaisId, setAprovandoThaisId] = useState<string | null>(null)
  const [enviandoThaisId, setEnviandoThaisId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [apagandoHistorico, setApagandoHistorico] = useState(false)
  const [abrindoComPessoa, setAbrindoComPessoa] = useState(false)
  const [outroLastReadAt, setOutroLastReadAt] = useState<string | null>(null)

  const [temaCabecalho, setTemaCabecalho] = useState<ChatHeadThemeId>(() =>
    typeof window !== 'undefined' ? parseChatHeadTheme(localStorage.getItem(CHAT_HEAD_THEME_STORAGE_KEY)) : 'verde'
  )
  const [menuTemaAberto, setMenuTemaAberto] = useState(false)
  const menuTemaRef = useRef<HTMLDivElement | null>(null)

  const aplicarTemaCabecalho = useCallback((id: ChatHeadThemeId) => {
    setTemaCabecalho(id)
    setMenuTemaAberto(false)
    try {
      localStorage.setItem(CHAT_HEAD_THEME_STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  // Mantém o FAB dentro da viewport (resize/zoom).
  useEffect(() => {
    if (!fabPos) return
    const handle = () => {
      const el = fabRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const x = clamp(fabPos.x, 8, Math.max(8, vw - rect.width - 8))
      const y = clamp(fabPos.y, 8, Math.max(8, vh - rect.height - 8))
      if (x === fabPos.x && y === fabPos.y) return
      setFabPos({ x, y })
    }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [fabPos])

  useEffect(() => {
    if (!fabPos) return
    try {
      localStorage.setItem(CHAT_FAB_POS_STORAGE_KEY, JSON.stringify(fabPos))
    } catch {
      /* ignore */
    }
  }, [fabPos])

  const handleFabPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (open) return
      const el = fabRef.current
      if (!el) return
      // Botão primário / toque.
      if (e.pointerType === 'mouse' && e.button !== 0) return

      const rect = el.getBoundingClientRect()
      const base = fabPos ?? { x: rect.left, y: rect.top }
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        baseX: base.x,
        baseY: base.y,
        moved: false,
      }

      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [fabPos, open]
  )

  const handleFabPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragRef.current
    const el = fabRef.current
    if (!st || !el) return
    if (e.pointerId !== st.pointerId) return

    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    if (!st.moved && Math.hypot(dx, dy) >= 6) st.moved = true

    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const nextX = clamp(st.baseX + dx, 8, Math.max(8, vw - rect.width - 8))
    const nextY = clamp(st.baseY + dy, 8, Math.max(8, vh - rect.height - 8))
    setFabPos({ x: nextX, y: nextY })
  }, [])

  const handleFabPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = dragRef.current
      const el = fabRef.current
      if (!st || !el) return
      if (e.pointerId !== st.pointerId) return

      dragRef.current = null
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    []
  )

  const handleFabClick = useCallback(() => {
    // Se houve arrasto, não abrir o chat no “click” final.
    if (dragRef.current?.moved) return
    setOpen(true)
  }, [setOpen])

  useEffect(() => {
    if (!menuTemaAberto) return
    const onDown = (e: MouseEvent) => {
      if (menuTemaRef.current && !menuTemaRef.current.contains(e.target as Node)) {
        setMenuTemaAberto(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuTemaAberto])

  const channelThreadRef = useRef<RealtimeChannel | null>(null)
  const channelListRef = useRef<RealtimeChannel | null>(null)
  const conversaIdRef = useRef<string | null>(null)
  const meuIdRef = useRef<string | null>(null)
  const openRef = useRef<boolean>(false)
  const mensagensLoadSeqRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    conversaIdRef.current = conversaId
  }, [conversaId])

  useEffect(() => {
    meuIdRef.current = meuId
  }, [meuId])

  useEffect(() => {
    openRef.current = open
  }, [open])

  const tocarNotificacao = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      if (!audioRef.current) {
        const a = new Audio(CHAT_NOTIFICACAO_AUDIO_SRC)
        a.preload = 'auto'
        audioRef.current = a
      }
      const a = audioRef.current
      if (!a) return
      a.currentTime = 0
      void a.play().catch(() => {
        // Autoplay pode ser bloqueado; ignorar silenciosamente.
      })
    } catch {
      /* ignore */
    }
  }, [])

  // “Aquece” o áudio no primeiro gesto do usuário para reduzir bloqueio de autoplay.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onFirstGesture = () => {
      if (audioRef.current) return
      try {
        const a = new Audio(CHAT_NOTIFICACAO_AUDIO_SRC)
        a.preload = 'auto'
        audioRef.current = a
      } catch {
        /* ignore */
      }
      window.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
    }
    window.addEventListener('pointerdown', onFirstGesture, { once: true })
    window.addEventListener('keydown', onFirstGesture, { once: true })
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
    }
  }, [])

  const recarregarConversas = useCallback(async () => {
    const uid = meuIdRef.current
    if (!uid) return
    try {
      const list = await chatCarregarConversas(uid)
      setConversas(list)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const recarregarPedidosAjustePendentes = useCallback(async () => {
    const uid = meuIdRef.current
    if (!uid || !veColunaSolicitacoes) {
      setPedidosAjustePendentes([])
      setHistoricoPedidosAjuste([])
      return
    }
    setCarregandoPedidosAjuste(true)
    setCarregandoHistoricoPedidosAjuste(true)
    try {
      const [list, hist] = await Promise.all([
        modoPedidosColuna === 'thais'
          ? chatListarPedidosAjusteFilaThais()
          : Promise.all([
              chatListarPedidosAjustePendentes(uid),
              chatListarPedidosAjusteAguardandoDetalhesDev(),
            ]).then(([dev, detalhes]) => [...dev, ...detalhes]),
        chatListarHistoricoPedidosAjuste(50),
      ])
      setPedidosAjustePendentes(list)
      setHistoricoPedidosAjuste(hist)
    } catch (e) {
      console.error('[chat] fila pedidos ajuste:', e)
    } finally {
      setCarregandoPedidosAjuste(false)
      setCarregandoHistoricoPedidosAjuste(false)
    }
  }, [modoPedidosColuna, veColunaSolicitacoes])

  const recarregarPedidosAguardandoFeedback = useCallback(async (conversaId: string) => {
    const uid = meuIdRef.current
    if (!uid || podeApagarHistoricoChat) {
      setPedidosAguardandoFeedback([])
      setPedidosAguardandoDetalhes([])
      setStatusPedidosConversa(new Map())
      return
    }
    try {
      const [feedback, detalhes, statusMap] = await Promise.all([
        chatListarPedidosAguardandoFeedbackSolicitante(conversaId, uid),
        chatListarPedidosAguardandoDetalhesSolicitante(conversaId, uid),
        chatMapStatusPedidosAjusteNaConversa(conversaId),
      ])
      setPedidosAguardandoFeedback(feedback)
      setPedidosAguardandoDetalhes(detalhes)
      setStatusPedidosConversa(statusMap)
    } catch (e) {
      console.error('[chat] feedback pedidos ajuste:', e)
      setPedidosAguardandoFeedback([])
      setPedidosAguardandoDetalhes([])
      setStatusPedidosConversa(new Map())
    }
  }, [podeApagarHistoricoChat])

  const pedidosEditaveisIds = useMemo(() => {
    if (!meuId || podeApagarHistoricoChat) return new Set<string>()
    const ids = new Set<string>()
    for (const m of mensagens) {
      if (m.remetente_id !== meuId) continue
      if (!chatMensagemEhPedidoAjuste(m)) continue
      const status = statusPedidosConversa.get(m.id) ?? null
      if (pedidoAjusteSolicitantePodeEditar(status)) ids.add(m.id)
    }
    return ids
  }, [mensagens, meuId, podeApagarHistoricoChat, statusPedidosConversa])

  useEffect(() => {
    let cancel = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancel) return
      setMeuId(user.id)
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!meuId || !open) return
    let cancel = false
    void (async () => {
      setCarregandoLista(true)
      setErro('')
      try {
        const [u, c] = await Promise.all([chatListarUsuariosAtivos(meuId), chatCarregarConversas(meuId)])
        if (cancel) return
        setUsuarios(u)
        setConversas(c)
      } catch (e) {
        if (!cancel) {
          setErro(e instanceof Error ? e.message : 'Erro ao carregar o chat.')
        }
      } finally {
        if (!cancel) setCarregandoLista(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [meuId, open])

  const usuariosPorId = useMemo(() => {
    const m = new Map<string, ChatUsuarioLista>()
    for (const u of usuarios) m.set(u.id, u)
    return m
  }, [usuarios])

  const usuariosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return usuarios
    return usuarios.filter((u) => {
      const nome = (u.nome || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      const cargo = (u.cargo || '').toLowerCase()
      return nome.includes(t) || email.includes(t) || cargo.includes(t)
    })
  }, [usuarios, busca])

  const handleTab = useCallback(
    (t: 'conversas' | 'pessoas') => {
      setTab(t)
      if (t !== 'pessoas' || !meuId) return
      setAtualizandoPessoasTab(true)
      setErro('')
      void chatListarUsuariosAtivos(meuId)
        .then(setUsuarios)
        .catch((e) => {
          setErro(e instanceof Error ? e.message : 'Erro ao carregar a lista de pessoas.')
        })
        .finally(() => setAtualizandoPessoasTab(false))
    },
    [meuId]
  )

  const carregandoPainelLateral =
    tab === 'conversas' ? carregandoLista : carregandoLista || atualizandoPessoasTab

  const conversasFiltradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return conversas
    return conversas.filter((c) => {
      const u = usuariosPorId.get(c.outro_id)
      const nome = (u?.nome || u?.email || '').toLowerCase()
      return nome.includes(t)
    })
  }, [conversas, busca, usuariosPorId])

  useEffect(() => {
    if (!meuId || !open) return

    const ch = supabase
      .channel('chat-float-usuarios-presenca')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'usuarios' },
        (payload) => {
          const row = payload.new as { id?: string; presenca_status?: string | null }
          if (!row?.id) return
          setUsuarios((prev) =>
            prev.map((u) =>
              u.id === row.id ? { ...u, presenca_status: row.presenca_status ?? u.presenca_status } : u
            )
          )
        }
      )
      .subscribe()

    return () => {
      void ch.unsubscribe()
    }
  }, [meuId, open])

  // Canal de mensagens globais: mantemos sempre ativo para tocar notificação mesmo com chat minimizado,
  // mas usamos um canal leve (só INSERT) e reconectamos apenas quando meuId muda.
  // A recarga de conversas só ocorre se o chat estiver aberto (openRef.current).
  useEffect(() => {
    if (!meuId) return

    // Pequeno delay para não abrir imediatamente no mount (aguarda hydration)
    const tid = window.setTimeout(() => {
      const ch = supabase
        .channel('chat-float-mensagens-global')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_mensagens' },
          (payload) => {
            const row = payload.new as ChatMensagem
            const uid = meuIdRef.current
            if (uid && row?.remetente_id && row.remetente_id !== uid) {
              tocarNotificacao()
            }
            if (openRef.current) {
              void recarregarConversas()
              void recarregarPedidosAjustePendentes()
            }
          }
        )
        .subscribe()

      channelListRef.current = ch
    }, 2000)

    return () => {
      window.clearTimeout(tid)
      void channelListRef.current?.unsubscribe()
      channelListRef.current = null
    }
  }, [meuId, recarregarConversas, recarregarPedidosAjustePendentes, tocarNotificacao])

  useEffect(() => {
    if (!open || !meuId || !veColunaSolicitacoes) {
      queueMicrotask(() => setPedidosAjustePendentes([]))
      return
    }
    void recarregarPedidosAjustePendentes()
  }, [open, meuId, veColunaSolicitacoes, recarregarPedidosAjustePendentes])

  useEffect(() => {
    if (!conversaId) {
      queueMicrotask(() => {
        setMensagens([])
        setCarregandoMensagens(false)
        setEditandoPedidoId(null)
      })
    }
  }, [conversaId])

  useEffect(() => {
    void channelThreadRef.current?.unsubscribe()
    channelThreadRef.current = null

    if (!conversaId || !open) {
      return
    }

    const cid = conversaId
    const seq = ++mensagensLoadSeqRef.current
    queueMicrotask(() => setCarregandoMensagens(true))

    void (async () => {
      try {
        const list = await chatCarregarMensagens(cid)
        if (mensagensLoadSeqRef.current !== seq) return
        setMensagens(list)

        const uid = meuIdRef.current
        if (uid) await chatMarcarLida(cid, uid)
        if (mensagensLoadSeqRef.current === seq) {
          void recarregarConversas()
          void recarregarPedidosAguardandoFeedback(cid)
        }
      } catch (e) {
        console.error(e)
        if (mensagensLoadSeqRef.current === seq) {
          setErro(
            e instanceof Error
              ? e.message
              : 'Não foi possível carregar o histórico desta conversa.'
          )
        }
      } finally {
        if (mensagensLoadSeqRef.current === seq) setCarregandoMensagens(false)
      }
    })()

    const ch = supabase
      .channel(`chat-float-thread-${conversaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensagens',
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const row = payload.new as ChatMensagem
          setMensagens((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev
            return [...prev, row]
          })
          const uid = meuIdRef.current
          if (uid && row?.remetente_id && row.remetente_id !== uid) {
            tocarNotificacao()
          }
          if (uid && conversaIdRef.current === conversaId) {
            void chatMarcarLida(conversaId, uid)
            void recarregarConversas()
          }
        }
      )
      .subscribe()

    channelThreadRef.current = ch

    return () => {
      void ch.unsubscribe()
      channelThreadRef.current = null
    }
  }, [conversaId, open, recarregarConversas, recarregarPedidosAguardandoFeedback, tocarNotificacao])

  const abrirConversa = useCallback((id: string, opts?: { outroId?: string }) => {
    setErro('')
    setConversaId(id)
    setOutroIdPainel(opts?.outroId ?? null)
    setTab('conversas')
  }, [])

  const iniciarComUsuario = useCallback(
    async (outroId: string) => {
      if (!meuId) {
        setErro('Sessão ainda não está pronta. Aguarde um instante e tente de novo.')
        return
      }
      setErro('')
      setAbrindoComPessoa(true)
      try {
        const id = await chatGetOrCreateDirect(outroId)
        await recarregarConversas()
        abrirConversa(id, { outroId })
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível abrir a conversa.')
      } finally {
        setAbrindoComPessoa(false)
      }
    },
    [meuId, recarregarConversas, abrirConversa]
  )

  useEffect(() => {
    if (!open || !meuId || !pendingUserId) return
    if (pendingUserId === meuId) {
      clearPendingUserId()
      return
    }
    const uid = pendingUserId
    clearPendingUserId()
    queueMicrotask(() => {
      void iniciarComUsuario(uid)
    })
  }, [open, meuId, pendingUserId, clearPendingUserId, iniciarComUsuario])

  const conversaNaLista = conversaId ? conversas.find((c) => c.id === conversaId) : undefined
  const outroIdEfectivo = conversaNaLista?.outro_id ?? outroIdPainel ?? null
  const outroMeta = outroIdEfectivo ? usuariosPorId.get(outroIdEfectivo) : undefined
  const outroNome = outroMeta?.nome || outroMeta?.email || 'Conversa'
  const prefOutro = normalizarPresencaStatus(outroMeta?.presenca_status)
  const presencaOutro = !isOnline(outroIdEfectivo) || prefOutro === 'offline' ? 'offline' : prefOutro
  const mostrarThread = Boolean(conversaId && outroIdEfectivo)

  useEffect(() => {
    if (!conversaId || !outroIdPainel) return
    if (conversas.some((c) => c.id === conversaId)) {
      queueMicrotask(() => setOutroIdPainel(null))
    }
  }, [conversaId, conversas, outroIdPainel])

  useEffect(() => {
    if (!conversaId || !outroIdEfectivo || !open) {
      queueMicrotask(() => setOutroLastReadAt(null))
      return
    }

    const cid = conversaId
    const oid = outroIdEfectivo
    let cancel = false

    void chatObterLastReadAtParticipante(cid, oid)
      .then((ts) => {
        if (!cancel) setOutroLastReadAt(ts)
      })
      .catch((e) => {
        console.warn('[chat] last_read outro', e)
      })

    const ch = supabase
      .channel(`chat-float-read-${cid}-${oid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_participantes',
          filter: `conversa_id=eq.${cid}`,
        },
        (payload) => {
          const row = payload.new as { user_id?: string; last_read_at?: string | null }
          if (row?.user_id === oid) {
            setOutroLastReadAt(row.last_read_at ?? null)
          }
        }
      )
      .subscribe()

    return () => {
      cancel = true
      void ch.unsubscribe()
    }
  }, [conversaId, outroIdEfectivo, open])

  async function handleEnviarTexto(t: string) {
    if (!conversaId || !meuId) return
    setEnviando(true)
    setErro('')
    try {
      const m = await chatEnviarTexto(conversaId, meuId, t)
      setMensagens((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
      await recarregarConversas()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.')
      throw e
    } finally {
      setEnviando(false)
    }
  }

  async function handleEnviarFicheiro(f: File, legenda: string) {
    if (!conversaId || !meuId) return
    setEnviando(true)
    setErro('')
    try {
      const m = await chatEnviarAnexo(conversaId, meuId, f, legenda)
      setMensagens((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
      await recarregarConversas()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar anexo.')
      throw e
    } finally {
      setEnviando(false)
    }
  }

  const handlePedirDetalhesPedidoAjuste = useCallback(
    async (item: PedidoAjusteFilaItem, mensagem: string) => {
      if (!meuId || !podeApagarHistoricoChat) return
      setPedindoDetalhesId(item.mensagemId)
      setErro('')
      try {
        const resposta = await chatPedirDetalhesPedidoAjuste(
          item.conversaId,
          item.mensagemId,
          meuId,
          mensagem
        )
        setPedidosAjustePendentes((prev) => prev.filter((p) => p.mensagemId !== item.mensagemId))
        if (conversaIdRef.current === item.conversaId) {
          setMensagens((prev) => (prev.some((p) => p.id === resposta.id) ? prev : [...prev, resposta]))
        }
        await recarregarConversas()
        void recarregarPedidosAjustePendentes()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível pedir mais detalhes.')
        throw e
      } finally {
        setPedindoDetalhesId(null)
      }
    },
    [meuId, podeApagarHistoricoChat, recarregarConversas, recarregarPedidosAjustePendentes]
  )

  const handleResponderDetalhesPedido = useCallback(
    async (mensagemPedidoId: string, complemento: string) => {
      if (!meuId) return
      setRespondendoDetalhesId(mensagemPedidoId)
      setErro('')
      try {
        const resposta = await chatResponderDetalhesPedidoAjuste(mensagemPedidoId, complemento)
        setPedidosAguardandoDetalhes((prev) =>
          prev.filter((p) => p.mensagemPedidoId !== mensagemPedidoId)
        )
        if (conversaIdRef.current) {
          setMensagens((prev) => (prev.some((p) => p.id === resposta.id) ? prev : [...prev, resposta]))
          void recarregarPedidosAguardandoFeedback(conversaIdRef.current)
        }
        if (veColunaSolicitacoes && modoPedidosColuna === 'dev') {
          void recarregarPedidosAjustePendentes()
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível enviar o complemento.')
        throw e
      } finally {
        setRespondendoDetalhesId(null)
      }
    },
    [
      meuId,
      modoPedidosColuna,
      veColunaSolicitacoes,
      recarregarPedidosAguardandoFeedback,
      recarregarPedidosAjustePendentes,
    ]
  )

  const handleSalvarEditarPedido = useCallback(
    async (mensagemPedidoId: string, descricao: string) => {
      if (!meuId || podeApagarHistoricoChat) return
      setErro('')
      try {
        const atualizada = await chatEditarPedidoAjusteSolicitante(mensagemPedidoId, descricao)
        setMensagens((prev) =>
          prev.map((m) => (m.id === atualizada.id ? { ...m, ...atualizada } : m))
        )
        setEditandoPedidoId(null)
        if (conversaIdRef.current) {
          void recarregarPedidosAguardandoFeedback(conversaIdRef.current)
          void recarregarConversas()
        }
        if (veColunaSolicitacoes) {
          void recarregarPedidosAjustePendentes()
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível editar a solicitação.')
        throw e
      }
    },
    [
      meuId,
      podeApagarHistoricoChat,
      veColunaSolicitacoes,
      recarregarConversas,
      recarregarPedidosAguardandoFeedback,
      recarregarPedidosAjustePendentes,
    ]
  )

  const handleMarcarPedidoAjusteResolvido = useCallback(
    async (item: PedidoAjusteFilaItem) => {
      if (!meuId || !podeApagarHistoricoChat) return
      setMarcandoPedidoAjusteId(item.mensagemId)
      setErro('')
      try {
        const resposta = await chatMarcarPedidoAjusteResolvido(
          item.conversaId,
          item.mensagemId,
          meuId
        )
        setPedidosAjustePendentes((prev) => prev.filter((p) => p.mensagemId !== item.mensagemId))
        if (conversaIdRef.current === item.conversaId) {
          setMensagens((prev) => (prev.some((p) => p.id === resposta.id) ? prev : [...prev, resposta]))
        }
        await recarregarConversas()
        void recarregarPedidosAjustePendentes()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível marcar como resolvido.')
        throw e
      } finally {
        setMarcandoPedidoAjusteId(null)
      }
    },
    [meuId, podeApagarHistoricoChat, recarregarConversas, recarregarPedidosAjustePendentes]
  )

  const handleDecidirPedidoAjuste = useCallback(
    async (mensagemPedidoId: string, aprovado: boolean, justificativa?: string) => {
      if (!meuId) return
      setDecidindoPedidoAjusteId(mensagemPedidoId)
      setErro('')
      try {
        await chatDecidirPedidoAjusteSolicitante(mensagemPedidoId, aprovado, justificativa)
        setPedidosAguardandoFeedback((prev) =>
          prev.filter((p) => p.mensagemPedidoId !== mensagemPedidoId)
        )
        if (conversaIdRef.current) {
          void recarregarPedidosAguardandoFeedback(conversaIdRef.current)
        }
        if (veColunaSolicitacoes && modoPedidosColuna === 'dev') {
          void recarregarPedidosAjustePendentes()
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível registar a sua decisão.')
        throw e
      } finally {
        setDecidindoPedidoAjusteId(null)
      }
    },
    [
      meuId,
      modoPedidosColuna,
      veColunaSolicitacoes,
      recarregarPedidosAguardandoFeedback,
      recarregarPedidosAjustePendentes,
    ]
  )

  const handleEnviarPedidoFilaThais = useCallback(
    async (item: PedidoAjusteFilaItem) => {
      if (!podeEnviarFilaThais) return
      setEnviandoThaisId(item.mensagemId)
      setErro('')
      try {
        await chatEnviarPedidoAjusteFilaThais(item.conversaId, item.mensagemId)
        setPedidosAjustePendentes((prev) => prev.filter((p) => p.mensagemId !== item.mensagemId))
        void recarregarPedidosAjustePendentes()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível enviar para a fila da Thais.')
        throw e
      } finally {
        setEnviandoThaisId(null)
      }
    },
    [podeEnviarFilaThais, recarregarPedidosAjustePendentes]
  )

  const handleAprovarPedidoFilaThais = useCallback(
    async (item: PedidoAjusteFilaItem) => {
      setAprovandoThaisId(item.mensagemId)
      setErro('')
      try {
        await chatAprovarPedidoAjusteFilaThais(item.mensagemId)
        setPedidosAjustePendentes((prev) => prev.filter((p) => p.mensagemId !== item.mensagemId))
        void recarregarPedidosAjustePendentes()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível aprovar o pedido.')
        throw e
      } finally {
        setAprovandoThaisId(null)
      }
    },
    [recarregarPedidosAjustePendentes]
  )

  async function handleEnviarFigurinha(sticker: ChatSticker) {
    if (!conversaId || !meuId) return
    setEnviando(true)
    setErro('')
    try {
      const m = await chatEnviarFigurinha(conversaId, meuId, sticker)
      setMensagens((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
      await recarregarConversas()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar figurinha.')
      throw e
    } finally {
      setEnviando(false)
    }
  }

  const handleApagarHistoricoConversa = useCallback(async () => {
    if (!conversaId || !podeApagarHistoricoChat) return
    const ok = await rgConfirm({
      title: 'Apagar histórico do chat',
      message:
        'Excluir todo o histórico desta conversa? As mensagens e anexos serão removidos de forma irreversível para todos os participantes.',
      confirmLabel: 'Apagar histórico',
      variant: 'danger',
    })
    if (!ok) return
    setApagandoHistorico(true)
    setErro('')
    try {
      await chatAdminApagarHistoricoConversa(conversaId)
      setMensagens([])
      await recarregarConversas()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir o histórico.')
    } finally {
      setApagandoHistorico(false)
    }
  }, [conversaId, podeApagarHistoricoChat, recarregarConversas])

  const fechar = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (menuTemaAberto) {
        setMenuTemaAberto(false)
        return
      }
      fechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, fechar, menuTemaAberto])

  const painel = (
    <div className="chat-float-layer">
      {!open ? (
        <button
          type="button"
          className="chat-float-fab"
          ref={fabRef}
          title="RG CHAT — abrir conversas"
          aria-label={
            naoLidasBadge > 0
              ? `RG CHAT — ${naoLidasBadge} mensagens não lidas`
              : 'RG CHAT — abrir chat interno'
          }
          aria-expanded={false}
          aria-haspopup="dialog"
          style={
            fabPos
              ? ({
                  left: `${fabPos.x}px`,
                  top: `${fabPos.y}px`,
                  right: 'auto',
                  bottom: 'auto',
                } as React.CSSProperties)
              : undefined
          }
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={handleFabPointerUp}
          onPointerCancel={handleFabPointerUp}
          onClick={handleFabClick}
        >
          {naoLidasBadge > 0 ? (
            <span className="chat-float-fab__badge" aria-hidden>
              {naoLidasBadge > 99 ? '99+' : naoLidasBadge}
            </span>
          ) : null}
          <RgChatLogo className="chat-float-fab__logo" />
        </button>
      ) : (
        <div className="chat-float-open">
          <div className="chat-float-backdrop" aria-hidden onClick={fechar} />
          <div
            className={
              podeApagarHistoricoChat
                ? 'chat-float-sheet chat-float-sheet--com-fila-ajuste'
                : 'chat-float-sheet'
            }
            role="dialog"
            aria-label="CHAT INTERNO"
          >
            <header
              className="chat-float-sheet__head"
              style={{ background: CHAT_HEAD_THEMES[temaCabecalho].gradient }}
            >
              <h2 className="chat-float-sheet__title">CHAT INTERNO</h2>
              <div className="chat-float-sheet__head-logo-wrap">
                <img className="chat-float-sheet__head-logo" src={BRAND_LOGO_MARK} alt="RG Ambiental" decoding="async" />
              </div>
              <div className="chat-float-sheet__head-actions">
                <div className="chat-float-sheet__menu-wrap" ref={menuTemaRef}>
                  <button
                    type="button"
                    className="chat-float-sheet__menu-trigger"
                    aria-label="Cor do cabeçalho do chat"
                    aria-expanded={menuTemaAberto}
                    aria-haspopup="menu"
                    onClick={() => setMenuTemaAberto((v) => !v)}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <circle cx="12" cy="6" r="1.85" />
                      <circle cx="12" cy="12" r="1.85" />
                      <circle cx="12" cy="18" r="1.85" />
                    </svg>
                  </button>
                  {menuTemaAberto ? (
                    <ul className="chat-float-sheet__theme-menu" role="menu">
                      {CHAT_HEAD_THEME_IDS.map((id) => (
                        <li key={id} role="none">
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={temaCabecalho === id}
                            className="chat-float-sheet__theme-option"
                            onClick={() => aplicarTemaCabecalho(id)}
                          >
                            <span
                              className="chat-float-sheet__theme-swatch"
                              style={{ background: CHAT_HEAD_THEMES[id].gradient }}
                              aria-hidden
                            />
                            {CHAT_HEAD_THEMES[id].label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button type="button" className="chat-float-sheet__close" aria-label="Fechar chat" onClick={fechar}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            {erro ? <div className="chat-float-sheet__alert">{erro}</div> : null}

            <div className="chat-interno-shell chat-interno-shell--float">
              <ChatSidebarPanel
                meuId={meuId || ''}
                isOnline={isOnline}
                tab={tab}
                onTab={handleTab}
                busca={busca}
                onBusca={setBusca}
                conversas={conversasFiltradas}
                usuariosFiltrados={usuariosFiltrados}
                totalUsuariosAtivos={usuarios.length}
                usuariosPorId={usuariosPorId}
                conversaSelecionadaId={conversaId}
                onSelectConversa={(id) => abrirConversa(id)}
                onStartComUsuario={(id) => void iniciarComUsuario(id)}
                carregandoLista={carregandoPainelLateral || abrindoComPessoa}
              />

              {veColunaSolicitacoes ? (
                <ChatPedidosAjusteColuna
                  modo={modoPedidosColuna}
                  itens={pedidosAjustePendentes}
                  historico={historicoPedidosAjuste}
                  usuariosPorId={usuariosPorId}
                  carregando={carregandoPedidosAjuste}
                  carregandoHistorico={carregandoHistoricoPedidosAjuste}
                  marcandoId={marcandoPedidoAjusteId}
                  podeEnviarFilaThais={podeEnviarFilaThais}
                  enviandoThaisId={enviandoThaisId}
                  aprovandoId={aprovandoThaisId}
                  onAbrirConversa={(id, outroId) => abrirConversa(id, { outroId })}
                  onMarcarResolvido={handleMarcarPedidoAjusteResolvido}
                  onPedirDetalhes={podeApagarHistoricoChat ? handlePedirDetalhesPedidoAjuste : undefined}
                  pedindoDetalhesId={pedindoDetalhesId}
                  onEnviarFilaThais={handleEnviarPedidoFilaThais}
                  onAprovarFilaThais={handleAprovarPedidoFilaThais}
                />
              ) : null}

              {mostrarThread ? (
                <ChatThreadPanel
                  meuId={meuId || ''}
                  outroNome={outroNome}
                  outroFoto={outroMeta?.foto_url ?? null}
                  presencaOutro={presencaOutro}
                  outroLastReadAt={outroLastReadAt}
                  mensagens={mensagens}
                  carregandoMensagens={carregandoMensagens}
                  enviando={enviando || apagandoHistorico}
                  podeApagarHistorico={podeApagarHistoricoChat}
                  podeGerirFigurinhas={podeApagarHistoricoChat}
                  apagandoHistorico={apagandoHistorico}
                  onApagarHistorico={() => void handleApagarHistoricoConversa()}
                  onEnviarTexto={handleEnviarTexto}
                  onEnviarFicheiro={handleEnviarFicheiro}
                  onEnviarFigurinha={handleEnviarFigurinha}
                  ocultarPedidosAjusteNoHistorico={podeApagarHistoricoChat}
                  pedidosAguardandoFeedback={pedidosAguardandoFeedback}
                  decidindoPedidoAjusteId={decidindoPedidoAjusteId}
                  onDecidirPedidoAjuste={
                    podeApagarHistoricoChat ? undefined : handleDecidirPedidoAjuste
                  }
                  pedidosAguardandoDetalhes={pedidosAguardandoDetalhes}
                  respondendoDetalhesId={respondendoDetalhesId}
                  onResponderDetalhesPedido={
                    podeApagarHistoricoChat ? undefined : handleResponderDetalhesPedido
                  }
                  pedidosEditaveisIds={pedidosEditaveisIds}
                  editandoPedidoId={editandoPedidoId}
                  onIniciarEditarPedido={
                    podeApagarHistoricoChat ? undefined : (id) => setEditandoPedidoId(id)
                  }
                  onCancelarEditarPedido={
                    podeApagarHistoricoChat ? undefined : () => setEditandoPedidoId(null)
                  }
                  onSalvarEditarPedido={
                    podeApagarHistoricoChat ? undefined : handleSalvarEditarPedido
                  }
                />
              ) : (
                <div className="chat-interno-empty-main">
                  <p>Seleccione uma conversa ou escolha uma pessoa para começar.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null

  return createPortal(painel, document.body)
}
