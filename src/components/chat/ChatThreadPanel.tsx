import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ChatAvatar } from './ChatAvatar'
import { ChatComposerPicker } from './ChatComposerPicker'
import { chatUrlAssinadaAnexo, chatMensagemLidaPeloOutro } from '../../lib/chat'
import { chatMensagemEhFigurinha, type ChatSticker } from '../../lib/chatStickers'
import {
  chatMensagemEhPedidoAjuste,
  type PedidoAjusteAguardandoFeedback,
} from '../../lib/chatPedidoAjuste'
import { type PresencaStatus, etiquetaPresenca } from '../../lib/presencaStatus'
import type { ChatMensagem } from '../../types/chat'
import { rgAlert } from '../../lib/RgDialogProvider'
import { ChatPedidoAjusteFeedback } from './ChatPedidoAjusteFeedback'

type Props = {
  meuId: string
  outroNome: string
  outroFoto: string | null
  presencaOutro: PresencaStatus
  mensagens: ChatMensagem[]
  carregandoMensagens?: boolean
  enviando: boolean
  /** Só Desenvolvedor: menu com exclusão de histórico. */
  podeApagarHistorico?: boolean
  /** Só Desenvolvedor: adicionar figurinhas ao catálogo. */
  podeGerirFigurinhas?: boolean
  apagandoHistorico?: boolean
  onApagarHistorico?: () => void
  /** `last_read_at` do destinatário — confirmação de leitura nas mensagens enviadas. */
  outroLastReadAt?: string | null
  onEnviarTexto: (texto: string) => Promise<void>
  onEnviarFicheiro: (f: File, legenda: string) => Promise<void>
  onEnviarFigurinha: (sticker: ChatSticker) => Promise<void>
  /** Desenvolvedor: pedidos ficam na coluna «Solicitações», não no histórico. */
  ocultarPedidosAjusteNoHistorico?: boolean
  /** Solicitante: confirmação após resposta do desenvolvedor (por mensagem de resposta). */
  pedidosAguardandoFeedback?: PedidoAjusteAguardandoFeedback[]
  decidindoPedidoAjusteId?: string | null
  onDecidirPedidoAjuste?: (
    mensagemPedidoId: string,
    aprovado: boolean,
    justificativa?: string
  ) => Promise<void>
}

export function ChatThreadPanel({
  meuId,
  outroNome,
  outroFoto,
  presencaOutro,
  mensagens,
  carregandoMensagens = false,
  enviando,
  podeApagarHistorico = false,
  podeGerirFigurinhas = false,
  apagandoHistorico = false,
  onApagarHistorico,
  onEnviarTexto,
  onEnviarFicheiro,
  onEnviarFigurinha,
  ocultarPedidosAjusteNoHistorico = false,
  pedidosAguardandoFeedback = [],
  decidindoPedidoAjusteId = null,
  onDecidirPedidoAjuste,
  outroLastReadAt = null,
}: Props) {
  const feedbackPorResposta = new Map(
    pedidosAguardandoFeedback.map((p) => [p.respostaMensagemId, p])
  )
  const mensagensVisiveis = ocultarPedidosAjusteNoHistorico
    ? mensagens.filter((m) => !chatMensagemEhPedidoAjuste(m))
    : mensagens
  const [texto, setTexto] = useState('')
  const [menuMaisAberto, setMenuMaisAberto] = useState(false)
  const [pickerAberto, setPickerAberto] = useState(false)
  const fRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const menuMaisRef = useRef<HTMLDivElement>(null)

  function focarComposer() {
    let frames = 0
    const run = () => {
      const el = textareaRef.current
      if (!el) return
      if (el.disabled && frames < 40) {
        frames += 1
        requestAnimationFrame(run)
        return
      }
      if (el.disabled) return
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
    requestAnimationFrame(run)
  }

  useEffect(() => {
    if (!menuMaisAberto) return
    const onDown = (e: MouseEvent) => {
      if (menuMaisRef.current && !menuMaisRef.current.contains(e.target as Node)) {
        setMenuMaisAberto(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuMaisAberto])

  useEffect(() => {
    if (!menuMaisAberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuMaisAberto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuMaisAberto])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [mensagens.length])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t || enviando) return
    setTexto('')
    try {
      await onEnviarTexto(t)
    } catch {
      setTexto(t)
    } finally {
      focarComposer()
    }
  }

  function inserirEmoji(emoji: string) {
    setTexto((prev) => {
      const el = textareaRef.current
      if (!el) return prev + emoji
      const start = el.selectionStart ?? prev.length
      const end = el.selectionEnd ?? prev.length
      return prev.slice(0, start) + emoji + prev.slice(end)
    })
    focarComposer()
  }

  async function enviarFigurinha(sticker: ChatSticker) {
    if (enviando) return
    try {
      await onEnviarFigurinha(sticker)
    } catch (err) {
      console.error(err)
      void rgAlert({
        title: 'Figurinha',
        message: 'Não foi possível enviar a figurinha.',
        variant: 'danger',
      })
    } finally {
      focarComposer()
    }
  }

  return (
    <section className="chat-interno-thread" aria-label="Mensagens">
      <header className="chat-interno-thread__head">
        <div className="chat-interno-thread__head-main">
          <ChatAvatar nome={outroNome} fotoUrl={outroFoto} size={48} />
          <div className="chat-interno-thread__head-text">
            <h2 className="chat-interno-thread__title">{outroNome}</h2>
            <p
              className={
                presencaOutro === 'online'
                  ? 'chat-interno-status chat-interno-status--on'
                  : presencaOutro === 'ausente'
                    ? 'chat-interno-status chat-interno-status--ausente'
                    : 'chat-interno-status chat-interno-status--offline'
              }
            >
              {etiquetaPresenca(presencaOutro)}
            </p>
          </div>
        </div>
        {podeApagarHistorico && onApagarHistorico ? (
          <div className="chat-interno-thread__menu-wrap" ref={menuMaisRef}>
            <button
              type="button"
              className="chat-interno-thread__menu-trigger"
              aria-label="Mais opções da conversa"
              aria-expanded={menuMaisAberto}
              aria-haspopup="menu"
              disabled={apagandoHistorico || enviando}
              onClick={() => setMenuMaisAberto((v) => !v)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="6" r="1.85" />
                <circle cx="12" cy="12" r="1.85" />
                <circle cx="12" cy="18" r="1.85" />
              </svg>
            </button>
            {menuMaisAberto ? (
              <ul className="chat-interno-thread__dropdown" role="menu">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="chat-interno-thread__dropdown-danger"
                    disabled={apagandoHistorico}
                    onClick={() => {
                      setMenuMaisAberto(false)
                      onApagarHistorico()
                    }}
                  >
                    Excluir histórico da conversa…
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        ) : null}
      </header>

      <div ref={scrollRef} className="chat-interno-thread__scroll">
        {carregandoMensagens && mensagensVisiveis.length === 0 ? (
          <div className="chat-interno-muted chat-interno-thread__empty">A carregar mensagens…</div>
        ) : mensagensVisiveis.length === 0 ? (
          <div className="chat-interno-muted chat-interno-thread__empty">
            {ocultarPedidosAjusteNoHistorico && mensagens.some((m) => chatMensagemEhPedidoAjuste(m))
              ? 'Os pedidos de ajuste aparecem na coluna «Solicitações». Use o compositor para responder.'
              : 'Sem mensagens. Escreva abaixo.'}
          </div>
        ) : (
          mensagensVisiveis.map((m) => {
            const feedback = feedbackPorResposta.get(m.id)
            return (
              <MensagemBolha
                key={m.id}
                m={m}
                meuId={meuId}
                outroLastReadAt={outroLastReadAt}
                feedbackPedido={
                  feedback && onDecidirPedidoAjuste
                    ? {
                        mensagemPedidoId: feedback.mensagemPedidoId,
                        ciclo: feedback.ciclo,
                        decidindo: decidindoPedidoAjusteId === feedback.mensagemPedidoId,
                        onDecidir: (aprovado, justificativa) =>
                          onDecidirPedidoAjuste(feedback.mensagemPedidoId, aprovado, justificativa),
                      }
                    : undefined
                }
              />
            )
          })
        )}
      </div>

      <form className="chat-interno-composer" onSubmit={onSubmit}>
        <ChatComposerPicker
          open={pickerAberto}
          onClose={() => setPickerAberto(false)}
          podeGerirFigurinhas={podeGerirFigurinhas}
          onEmojiSelect={inserirEmoji}
          onStickerSelect={(s) => void enviarFigurinha(s)}
        />
        <input
          ref={fRef}
          type="file"
          className="chat-interno-file"
          aria-label="Anexar ficheiro"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f || enviando) return
            if (f.size > 15 * 1024 * 1024) {
              void rgAlert({
                title: 'Anexo',
                message: 'Ficheiro demasiado grande (máx. 15 MB).',
                variant: 'warning',
              })
              return
            }
            try {
              await onEnviarFicheiro(f, texto.trim())
              setTexto('')
            } catch (err) {
              console.error(err)
              void rgAlert({
                title: 'Anexo',
                message: 'Não foi possível enviar o anexo.',
                variant: 'danger',
              })
            } finally {
              focarComposer()
            }
          }}
        />
        <button
          type="button"
          className="chat-interno-icon-btn"
          title="Emoji e figurinhas"
          aria-label="Emoji e figurinhas"
          aria-expanded={pickerAberto}
          disabled={enviando}
          onClick={() => setPickerAberto((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-6c.83 0 1.5-.67 1.5-1.5S8.83 11 8 11s-1.5.67-1.5 1.5S7.17 14 8 14zm8 0c.83 0 1.5-.67 1.5-1.5S16.83 11 16 11s-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-4 4.5c2.33 0 4.32-1.45 5.12-3.5H6.88c.8 2.05 2.79 3.5 5.12 3.5z"
            />
          </svg>
        </button>
        <button
          type="button"
          className="chat-interno-icon-btn"
          title="Anexar"
          aria-label="Anexar ficheiro"
          disabled={enviando}
          onClick={() => fRef.current?.click()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S5 2.79 5 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"
            />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          className="chat-interno-textarea"
          rows={1}
          placeholder="Escreva uma mensagem…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void onSubmit(e as unknown as FormEvent)
            }
          }}
          disabled={enviando}
          aria-label="Mensagem"
        />
        <button type="submit" className="chat-interno-send" disabled={enviando || !texto.trim()}>
          Enviar
        </button>
      </form>
    </section>
  )
}

type FeedbackPedidoProps = {
  mensagemPedidoId: string
  ciclo: number
  decidindo: boolean
  onDecidir: (aprovado: boolean, justificativa?: string) => Promise<void>
}

function MensagemBolha({
  m,
  meuId,
  outroLastReadAt,
  feedbackPedido,
}: {
  m: ChatMensagem
  meuId: string
  outroLastReadAt?: string | null
  feedbackPedido?: FeedbackPedidoProps
}) {
  const meu = m.remetente_id === meuId
  const [url, setUrl] = useState<string | null>(null)
  const ehPedidoAjuste = chatMensagemEhPedidoAjuste(m)
  const temAnexo = !!(m.anexo_path && m.anexo_nome)
  const ehFigurinha = chatMensagemEhFigurinha(m)
  const ehImagemAnexo = temAnexo && !ehFigurinha && !!m.anexo_mime?.startsWith('image/')

  useEffect(() => {
    if (!m.anexo_path || (!ehFigurinha && !ehImagemAnexo)) return
    let cancel = false
    void chatUrlAssinadaAnexo(m.anexo_path).then((u) => {
      if (!cancel) setUrl(u)
    })
    return () => {
      cancel = true
    }
  }, [m.anexo_path, ehFigurinha, ehImagemAnexo])

  async function abrir() {
    if (!m.anexo_path) return
    const u = await chatUrlAssinadaAnexo(m.anexo_path)
    setUrl(u)
    if (u) window.open(u, '_blank', 'noopener,noreferrer')
  }

  const hora = new Date(m.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const lida = meu && chatMensagemLidaPeloOutro(m.created_at, outroLastReadAt)

  const mostrarTexto = !!(
    m.conteudo &&
    (!temAnexo || (m.conteudo.trim() !== 'Anexo enviado' && !ehFigurinha))
  )

  return (
    <div className={meu ? 'chat-interno-bubble-wrap chat-interno-bubble-wrap--meu' : 'chat-interno-bubble-wrap'}>
      <div
        className={
          meu
            ? 'chat-interno-bubble chat-interno-bubble--meu'
            : `chat-interno-bubble${ehPedidoAjuste ? ' chat-interno-bubble--pedido-ajuste' : ''}`
        }
      >
        {ehPedidoAjuste ? (
          <div className="chat-interno-pedido-ajuste__badge" aria-hidden>
            Pedido de ajuste
          </div>
        ) : null}
        {mostrarTexto ? <p className="chat-interno-bubble__text">{m.conteudo}</p> : null}
        {ehFigurinha && url ? (
          <img src={url} alt="Figurinha" className="chat-interno-figurinha" loading="lazy" />
        ) : ehImagemAnexo && url ? (
          <button type="button" className="chat-interno-imagem-anexo" onClick={() => void abrir()}>
            <img src={url} alt={m.anexo_nome || 'Imagem'} className="chat-interno-imagem-anexo__img" loading="lazy" />
          </button>
        ) : temAnexo ? (
          <button type="button" className="chat-interno-anexo" onClick={() => void abrir()}>
            <span className="chat-interno-anexo__icon" aria-hidden>
              📎
            </span>
            <span className="chat-interno-anexo__nome">{m.anexo_nome}</span>
            {m.anexo_size != null ? (
              <span className="chat-interno-anexo__meta">
                {(m.anexo_size / 1024).toFixed(0)} KB
              </span>
            ) : null}
            {url ? <span className="chat-interno-anexo__hint">Aberto num novo separador</span> : null}
          </button>
        ) : null}
        <div className="chat-interno-bubble__meta">
          {meu ? (
            <span
              className={`chat-interno-bubble__read${lida ? ' chat-interno-bubble__read--lida' : ''}`}
              title={lida ? 'Lida' : 'Enviada'}
              aria-label={lida ? 'Lida' : 'Enviada'}
            >
              {lida ? (
                <svg width="16" height="11" viewBox="0 0 18 12" aria-hidden>
                  <path
                    d="M1 6.5 4 9.5 9.5 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5.5 6.5 8.5 9.5 16 2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="12" height="11" viewBox="0 0 12 11" aria-hidden>
                  <path
                    d="M1 5.5 4 8.5 11 1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
          ) : null}
          <time className="chat-interno-bubble__time" dateTime={m.created_at}>
            {hora}
          </time>
        </div>
      </div>
      {feedbackPedido ? (
        <ChatPedidoAjusteFeedback
          ciclo={feedbackPedido.ciclo}
          decidindo={feedbackPedido.decidindo}
          onDecidir={async (aprovado, justificativa) => {
            try {
              await feedbackPedido.onDecidir(aprovado, justificativa)
            } catch (e) {
              void rgAlert({
                title: 'Pedido de ajuste',
                message:
                  e instanceof Error ? e.message : 'Não foi possível registar a sua decisão.',
                variant: 'warning',
              })
              throw e
            }
          }}
        />
      ) : null}
    </div>
  )
}
