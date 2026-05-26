import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ChatAvatar } from './ChatAvatar'
import { ChatComposerPicker } from './ChatComposerPicker'
import { chatUrlAssinadaAnexo } from '../../lib/chat'
import { chatMensagemEhFigurinha, type ChatSticker } from '../../lib/chatStickers'
import { chatMensagemEhPedidoAjuste } from '../../lib/chatPedidoAjuste'
import { type PresencaStatus, etiquetaPresenca } from '../../lib/presencaStatus'
import type { ChatMensagem } from '../../types/chat'
import { rgAlert } from '../../lib/RgDialogProvider'

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
  onEnviarTexto: (texto: string) => Promise<void>
  onEnviarFicheiro: (f: File, legenda: string) => Promise<void>
  onEnviarFigurinha: (sticker: ChatSticker) => Promise<void>
  /** Desenvolvedor: marcar pedidos de ajuste como resolvidos. */
  podeMarcarPedidoAjuste?: boolean
  pedidosAjusteResolvidos?: Set<string>
  onMarcarPedidoAjusteResolvido?: (mensagemId: string) => Promise<void>
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
  podeMarcarPedidoAjuste = false,
  pedidosAjusteResolvidos,
  onMarcarPedidoAjusteResolvido,
}: Props) {
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
        {carregandoMensagens && mensagens.length === 0 ? (
          <div className="chat-interno-muted chat-interno-thread__empty">A carregar mensagens…</div>
        ) : mensagens.length === 0 ? (
          <div className="chat-interno-muted chat-interno-thread__empty">Sem mensagens. Escreva abaixo.</div>
        ) : (
          mensagens.map((m) => (
            <MensagemBolha
              key={m.id}
              m={m}
              meuId={meuId}
              podeMarcarPedidoAjuste={podeMarcarPedidoAjuste}
              pedidoResolvido={pedidosAjusteResolvidos?.has(m.id) ?? false}
              enviando={enviando}
              onMarcarResolvido={onMarcarPedidoAjusteResolvido}
            />
          ))
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

function MensagemBolha({
  m,
  meuId,
  podeMarcarPedidoAjuste,
  pedidoResolvido,
  enviando,
  onMarcarResolvido,
}: {
  m: ChatMensagem
  meuId: string
  podeMarcarPedidoAjuste: boolean
  pedidoResolvido: boolean
  enviando: boolean
  onMarcarResolvido?: (mensagemId: string) => Promise<void>
}) {
  const meu = m.remetente_id === meuId
  const [marcandoResolvido, setMarcandoResolvido] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const ehPedidoAjuste = chatMensagemEhPedidoAjuste(m)
  const mostrarMarcarResolvido =
    podeMarcarPedidoAjuste && !meu && ehPedidoAjuste && onMarcarResolvido
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

  const mostrarTexto = !!(
    m.conteudo &&
    (!temAnexo || (m.conteudo.trim() !== 'Anexo enviado' && !ehFigurinha))
  )

  async function marcarComoResolvido() {
    if (!onMarcarResolvido || marcandoResolvido || pedidoResolvido) return
    setMarcandoResolvido(true)
    try {
      await onMarcarResolvido(m.id)
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : e && typeof e === 'object' && 'message' in e
            ? String((e as { message?: unknown }).message || 'Não foi possível marcar como resolvido.')
            : 'Não foi possível marcar como resolvido.'
      void rgAlert({
        title: 'Pedido de ajuste',
        message: msg,
        variant: 'warning',
      })
    } finally {
      setMarcandoResolvido(false)
    }
  }

  return (
    <div className={meu ? 'chat-interno-bubble-wrap chat-interno-bubble-wrap--meu' : 'chat-interno-bubble-wrap'}>
      <div
        className={
          meu
            ? 'chat-interno-bubble chat-interno-bubble--meu'
            : `chat-interno-bubble${ehPedidoAjuste ? ' chat-interno-bubble--pedido-ajuste' : ''}${pedidoResolvido ? ' chat-interno-bubble--pedido-ajuste-resolvido' : ''}`
        }
      >
        {ehPedidoAjuste ? (
          <div className="chat-interno-pedido-ajuste__badge" aria-hidden>
            {pedidoResolvido ? 'Resolvido' : 'Pedido de ajuste'}
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
        {mostrarMarcarResolvido ? (
          <div className="chat-interno-pedido-ajuste__acoes">
            {pedidoResolvido ? (
              <span className="chat-interno-pedido-ajuste__ok" aria-live="polite">
                ✓ Resolvido — resposta enviada
              </span>
            ) : (
              <button
                type="button"
                className="chat-interno-pedido-ajuste__btn"
                disabled={marcandoResolvido || enviando}
                onClick={() => void marcarComoResolvido()}
              >
                {marcandoResolvido ? 'A enviar resposta…' : '✓ Marcar como resolvido'}
              </button>
            )}
          </div>
        ) : null}
        <time className="chat-interno-bubble__time" dateTime={m.created_at}>
          {hora}
        </time>
      </div>
    </div>
  )
}
