import { useCallback, useEffect, useRef, useState } from 'react'
import 'emoji-picker-element'
import type { EmojiClickEventDetail } from 'emoji-picker-element/shared'
import ptI18n from 'emoji-picker-element/i18n/pt_PT'
import {
  chatAdicionarSticker,
  chatCriarStickerPack,
  chatListarStickerPacks,
  chatListarStickers,
  chatStickerPublicUrl,
  type ChatSticker,
  type ChatStickerPack,
} from '../../lib/chatStickers'
import { rgAlert } from '../../lib/RgDialogProvider'

type TabId = 'emoji' | 'figurinhas' | 'adicionar'

type Props = {
  open: boolean
  onClose: () => void
  podeGerirFigurinhas: boolean
  onEmojiSelect: (emoji: string) => void
  onStickerSelect: (sticker: ChatSticker) => void
}

export function ChatComposerPicker({
  open,
  onClose,
  podeGerirFigurinhas,
  onEmojiSelect,
  onStickerSelect,
}: Props) {
  const pickerHostRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<TabId>('emoji')
  const [packs, setPacks] = useState<ChatStickerPack[]>([])
  const [packId, setPackId] = useState('')
  const [stickers, setStickers] = useState<ChatSticker[]>([])
  const [carregandoStickers, setCarregandoStickers] = useState(false)
  const [catalogoIndisponivel, setCatalogoIndisponivel] = useState(false)

  const [novoPackNome, setNovoPackNome] = useState('')
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoFicheiro, setNovoFicheiro] = useState<File | null>(null)
  const [enviandoSticker, setEnviandoSticker] = useState(false)

  const recarregarCatalogo = useCallback(async (packAtivo?: string) => {
    setCarregandoStickers(true)
    try {
      const listaPacks = await chatListarStickerPacks()
      if (!listaPacks.length) {
        setCatalogoIndisponivel(true)
        setPacks([])
        setStickers([])
        return
      }
      setCatalogoIndisponivel(false)
      setPacks(listaPacks)
      const id = packAtivo && listaPacks.some((p) => p.id === packAtivo) ? packAtivo : listaPacks[0]!.id
      setPackId(id)
      const listaStickers = await chatListarStickers(id)
      setStickers(listaStickers)
    } catch {
      setCatalogoIndisponivel(true)
      setPacks([])
      setStickers([])
    } finally {
      setCarregandoStickers(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void recarregarCatalogo(packId || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao abrir
  }, [open])

  useEffect(() => {
    if (!open || (tab !== 'figurinhas' && tab !== 'adicionar') || !packId) return
    let cancel = false
    void chatListarStickers(packId).then((rows) => {
      if (!cancel) setStickers(rows)
    })
    return () => {
      cancel = true
    }
  }, [open, tab, packId])

  useEffect(() => {
    if (!open || tab !== 'emoji') return
    const host = pickerHostRef.current
    if (!host) return

    host.innerHTML = ''
    const el = document.createElement('emoji-picker') as HTMLElement & {
      i18n?: typeof ptI18n
      locale?: string
    }
    el.i18n = ptI18n
    el.locale = 'pt'
    el.className = 'chat-composer-picker__emoji-el'

    const onEmoji = (ev: Event) => {
      const detail = (ev as CustomEvent<EmojiClickEventDetail>).detail
      const emoji =
        detail?.unicode ||
        (detail?.emoji && 'unicode' in detail.emoji ? detail.emoji.unicode : undefined)
      if (emoji) {
        onEmojiSelect(emoji)
        onClose()
      }
    }
    el.addEventListener('emoji-click', onEmoji)
    host.appendChild(el)

    return () => {
      el.removeEventListener('emoji-click', onEmoji)
      host.innerHTML = ''
    }
  }, [open, tab, onEmojiSelect, onClose])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, onClose])

  async function handleAdicionarFigurinha() {
    if (!packId || !novoFicheiro) return
    setEnviandoSticker(true)
    try {
      const criada = await chatAdicionarSticker({
        packId,
        ficheiro: novoFicheiro,
        titulo: novoTitulo,
      })
      setNovoFicheiro(null)
      setNovoTitulo('')
      await recarregarCatalogo(packId)
      setTab('figurinhas')
      onStickerSelect(criada)
      onClose()
    } catch (e) {
      void rgAlert({
        title: 'Figurinha',
        message: e instanceof Error ? e.message : 'Não foi possível adicionar.',
        variant: 'warning',
      })
    } finally {
      setEnviandoSticker(false)
    }
  }

  async function handleCriarPack() {
    const nome = novoPackNome.trim()
    if (!nome) return
    setEnviandoSticker(true)
    try {
      const pack = await chatCriarStickerPack(nome)
      setNovoPackNome('')
      await recarregarCatalogo(pack.id)
      setPackId(pack.id)
    } catch (e) {
      void rgAlert({
        title: 'Pack de figurinhas',
        message: e instanceof Error ? e.message : 'Não foi possível criar o pack.',
        variant: 'warning',
      })
    } finally {
      setEnviandoSticker(false)
    }
  }

  if (!open) return null

  return (
    <div ref={wrapRef} className="chat-composer-picker" role="dialog" aria-label="Emojis e figurinhas">
      <div className="chat-composer-picker__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === 'emoji' ? 'chat-composer-picker__tab chat-composer-picker__tab--on' : 'chat-composer-picker__tab'}
          aria-selected={tab === 'emoji'}
          onClick={() => setTab('emoji')}
        >
          Emoji
        </button>
        <button
          type="button"
          role="tab"
          className={
            tab === 'figurinhas' ? 'chat-composer-picker__tab chat-composer-picker__tab--on' : 'chat-composer-picker__tab'
          }
          aria-selected={tab === 'figurinhas'}
          onClick={() => setTab('figurinhas')}
        >
          Figurinhas
        </button>
        {podeGerirFigurinhas ? (
          <button
            type="button"
            role="tab"
            className={
              tab === 'adicionar' ? 'chat-composer-picker__tab chat-composer-picker__tab--on' : 'chat-composer-picker__tab'
            }
            aria-selected={tab === 'adicionar'}
            onClick={() => setTab('adicionar')}
          >
            + Nova
          </button>
        ) : null}
      </div>

      {tab === 'emoji' ? <div ref={pickerHostRef} className="chat-composer-picker__emoji-host" /> : null}

      {tab === 'figurinhas' ? (
        <div className="chat-composer-picker__stickers">
          {catalogoIndisponivel ? (
            <p className="chat-composer-picker__empty">
              Catálogo de figurinhas indisponível. Peça ao Desenvolvedor para aplicar a migração chat_stickers no
              Supabase.
            </p>
          ) : (
            <>
              {packs.length > 1 ? (
                <select
                  className="chat-composer-picker__pack-select"
                  value={packId}
                  aria-label="Pack de figurinhas"
                  onChange={(e) => setPackId(e.target.value)}
                >
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              ) : null}
              {carregandoStickers ? (
                <p className="chat-composer-picker__empty">A carregar…</p>
              ) : stickers.length === 0 ? (
                <p className="chat-composer-picker__empty">
                  {podeGerirFigurinhas
                    ? 'Nenhuma figurinha ainda. Use «+ Nova» para enviar a primeira imagem.'
                    : 'Nenhuma figurinha disponível.'}
                </p>
              ) : (
                <div className="chat-composer-picker__grid" role="list">
                  {stickers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="chat-composer-picker__sticker-btn"
                      title={s.titulo || 'Figurinha'}
                      onClick={() => {
                        onStickerSelect(s)
                        onClose()
                      }}
                    >
                      <img
                        src={chatStickerPublicUrl(s.storage_path)}
                        alt={s.titulo || 'Figurinha'}
                        loading="lazy"
                        className="chat-composer-picker__sticker-img"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === 'adicionar' && podeGerirFigurinhas ? (
        <div className="chat-composer-picker__add">
          <label className="chat-composer-picker__field">
            <span>Pack</span>
            <select value={packId} onChange={(e) => setPackId(e.target.value)}>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="chat-composer-picker__add-pack">
            <input
              type="text"
              placeholder="Nome do novo pack (opcional)"
              value={novoPackNome}
              onChange={(e) => setNovoPackNome(e.target.value)}
            />
            <button type="button" disabled={enviandoSticker || !novoPackNome.trim()} onClick={() => void handleCriarPack()}>
              Criar pack
            </button>
          </div>
          <label className="chat-composer-picker__field">
            <span>Título (opcional)</span>
            <input
              type="text"
              value={novoTitulo}
              placeholder="Ex.: OK, Atenção…"
              onChange={(e) => setNovoTitulo(e.target.value)}
            />
          </label>
          <label className="chat-composer-picker__field">
            <span>Imagem (PNG, JPG, WebP ou GIF)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setNovoFicheiro(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className="chat-composer-picker__add-btn"
            disabled={enviandoSticker || !novoFicheiro || !packId}
            onClick={() => void handleAdicionarFigurinha()}
          >
            {enviandoSticker ? 'A guardar…' : 'Guardar e enviar figurinha'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
