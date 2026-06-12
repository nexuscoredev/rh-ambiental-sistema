import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useChatFloat } from '../contexts/ChatFloatContext'
import { chatEnviarPedidoAjusteSistema, chatEnviarPedidoCadastroSistema } from '../lib/chat'
import { ChatImagemAnexoEditor } from './chat/ChatImagemAnexoEditor'
import { deveOcultarSolicitacaoAjuste } from '../lib/solicitacaoAjusteSistema'
import {
  ITENS_CADASTRO_SOLICITACAO,
  rotuloItemCadastroSolicitacao,
  type ItemCadastroSolicitacao,
  type TipoSolicitacaoSistema,
} from '../lib/solicitacaoCadastroSistema'

export type SolicitarAjusteSistemaFloatProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  panelId: string
  /** Pré-preenche o campo ao abrir (ex.: pedido de reset na boas-vindas). */
  textoInicial?: string | null
}

function imagemColadaDoClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items
  if (!items?.length) return null
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const blob = item.getAsFile()
    if (!blob) continue
    const ext =
      blob.type === 'image/jpeg'
        ? 'jpg'
        : blob.type === 'image/webp'
          ? 'webp'
          : blob.type === 'image/gif'
            ? 'gif'
            : 'png'
    const nome =
      blob.name?.trim() && !/^image\.\w+$/i.test(blob.name)
        ? blob.name
        : `print-tela-${Date.now()}.${ext}`
    return new File([blob], nome, { type: blob.type || 'image/png' })
  }
  return null
}

export default function SolicitarAjusteSistemaFloat({
  open,
  onOpenChange,
  panelId,
  textoInicial = null,
}: SolicitarAjusteSistemaFloatProps) {
  const { openChat, openChatWithUser } = useChatFloat()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abriuComTextoInicial = useRef(false)

  const [texto, setTexto] = useState('')
  const [tipoSolicitacao, setTipoSolicitacao] = useState<TipoSolicitacaoSistema>('ajuste')
  const [clienteCadastro, setClienteCadastro] = useState('')
  const [itemCadastro, setItemCadastro] = useState<ItemCadastroSolicitacao>('residuo')
  const [detalhesCadastro, setDetalhesCadastro] = useState('')
  const [print, setPrint] = useState<File | null>(null)
  const [imagemEditor, setImagemEditor] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucessoId, setSucessoId] = useState<string | null>(null)
  const [contaDesenvolvedor, setContaDesenvolvedor] = useState(false)
  const abertoAnterior = useRef(false)

  useEffect(() => {
    if (open && !abertoAnterior.current) {
      setErro('')
      setSucessoId(null)
      setTexto('')
      setTipoSolicitacao('ajuste')
      setClienteCadastro('')
      setItemCadastro('residuo')
      setDetalhesCadastro('')
      setPrint(null)
    }
    abertoAnterior.current = open
  }, [open])

  useEffect(() => {
    let cancel = false

    async function aplicar(user: { id: string; email?: string | null } | null) {
      if (cancel || !user?.id) {
        setContaDesenvolvedor(false)
        return
      }
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle()
      if (cancel) return
      setContaDesenvolvedor(deveOcultarSolicitacaoAjuste(user.id, perfil?.nome ?? null))
    }

    void supabase.auth.getUser().then(({ data: { user } }) => {
      void aplicar(user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void aplicar(session?.user ?? null)
    })

    return () => {
      cancel = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!print) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(print)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [print])

  useEffect(() => {
    if (!open) {
      if (abriuComTextoInicial.current) {
        setTexto('')
        abriuComTextoInicial.current = false
      }
      return
    }
    if (textoInicial?.trim()) {
      abriuComTextoInicial.current = true
      setTexto(textoInicial.trim())
      setErro('')
      setSucessoId(null)
    }
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, textoInicial])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const aplicarPrintColado = useCallback((e: ClipboardEvent) => {
    const img = imagemColadaDoClipboard(e)
    if (!img) return false
    e.preventDefault()
    setImagemEditor(img)
    setErro('')
    return true
  }, [])

  useEffect(() => {
    if (!open || contaDesenvolvedor || sucessoId) return
    const onPaste = (e: ClipboardEvent) => {
      void aplicarPrintColado(e)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open, contaDesenvolvedor, sucessoId, aplicarPrintColado])

  const fecharPainel = useCallback(() => {
    onOpenChange(false)
    setErro('')
  }, [onOpenChange])

  const enviar = useCallback(async () => {
    setEnviando(true)
    setErro('')
    setSucessoId(null)
    try {
      const { destinoUserId } =
        tipoSolicitacao === 'cadastro'
          ? await chatEnviarPedidoCadastroSistema({
              cliente: clienteCadastro,
              itemCadastro: rotuloItemCadastroSolicitacao(itemCadastro),
              detalhes: detalhesCadastro,
              print,
            })
          : await chatEnviarPedidoAjusteSistema(texto, print)
      setTexto('')
      setClienteCadastro('')
      setDetalhesCadastro('')
      setPrint(null)
      setSucessoId(destinoUserId)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.')
    } finally {
      setEnviando(false)
    }
  }, [tipoSolicitacao, texto, print, clienteCadastro, itemCadastro, detalhesCadastro])

  const podeEnviar =
    tipoSolicitacao === 'cadastro'
      ? clienteCadastro.trim().length > 0 && detalhesCadastro.trim().length >= 3
      : texto.trim().length > 0

  const hintItemCadastro =
    ITENS_CADASTRO_SOLICITACAO.find((i) => i.id === itemCadastro)?.hint ?? ''

  const abrirNoChat = useCallback(() => {
    if (!sucessoId) return
    openChatWithUser(sucessoId)
    onOpenChange(false)
    setSucessoId(null)
  }, [openChatWithUser, sucessoId, onOpenChange])

  const painel = (
    <div className="suporte-float-root suporte-float-root--ajuste">
      {open ? (
        <>
          <div
            className="suporte-float-backdrop"
            aria-hidden
            onClick={() => !enviando && fecharPainel()}
          />
          <div className="suporte-float-panel-wrap">
            <section
              id={panelId}
              className="suporte-float-panel"
              role="dialog"
              aria-labelledby={`${panelId}-titulo`}
              aria-modal="true"
            >
              <div className="suporte-float-panel__head">
                <h2 id={`${panelId}-titulo`} className="suporte-float-panel__title">
                  Solicitar no sistema
                </h2>
                <p className="suporte-float-panel__lead">
                  {contaDesenvolvedor
                    ? 'Esta conta recebe os pedidos de melhoria. Responda pelo Chat Interno.'
                    : 'Melhoria no sistema ou pedido de cadastro (resíduo, equipamento, campo em falta). Pode colar um print com Ctrl+V.'}
                </p>
              </div>

              {contaDesenvolvedor ? (
                <div className="suporte-float-actions suporte-float-actions--solo">
                  <button
                    type="button"
                    className="suporte-float-btn suporte-float-btn--primary"
                    onClick={() => {
                      fecharPainel()
                      openChat()
                    }}
                  >
                    Abrir Chat Interno
                  </button>
                  <button type="button" className="suporte-float-btn suporte-float-btn--ghost" onClick={fecharPainel}>
                    Fechar
                  </button>
                </div>
              ) : (
                <>
                  {erro ? (
                    <div className="suporte-float-alert" role="alert">
                      {erro}
                    </div>
                  ) : null}

                  {sucessoId ? (
                    <div className="suporte-float-ok">
                      <p>Solicitação enviada. Pode acompanhar no Chat Interno.</p>
                      <div className="suporte-float-ok__actions">
                        <button type="button" className="suporte-float-btn suporte-float-btn--primary" onClick={abrirNoChat}>
                          Abrir conversa
                        </button>
                        <button
                          type="button"
                          className="suporte-float-btn suporte-float-btn--ghost"
                          onClick={() => {
                            setSucessoId(null)
                            fecharPainel()
                          }}
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="suporte-float-tipo"
                        role="tablist"
                        aria-label="Tipo de solicitação"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={tipoSolicitacao === 'ajuste'}
                          className={
                            tipoSolicitacao === 'ajuste'
                              ? 'suporte-float-tipo__btn suporte-float-tipo__btn--on'
                              : 'suporte-float-tipo__btn'
                          }
                          disabled={enviando}
                          onClick={() => setTipoSolicitacao('ajuste')}
                        >
                          Melhoria / ajuste
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={tipoSolicitacao === 'cadastro'}
                          className={
                            tipoSolicitacao === 'cadastro'
                              ? 'suporte-float-tipo__btn suporte-float-tipo__btn--on'
                              : 'suporte-float-tipo__btn'
                          }
                          disabled={enviando}
                          onClick={() => setTipoSolicitacao('cadastro')}
                        >
                          Cadastro em falta
                        </button>
                      </div>

                      {tipoSolicitacao === 'ajuste' ? (
                        <>
                          <label htmlFor={`${panelId}-msg`} className="suporte-float-label">
                            Como podemos melhorar?
                          </label>
                          <textarea
                            ref={textareaRef}
                            id={`${panelId}-msg`}
                            className="suporte-float-textarea"
                            rows={4}
                            placeholder="Ex.: incluir filtro por data, mudar texto do botão, facilitar o passo X…"
                            value={texto}
                            disabled={enviando}
                            onChange={(e) => setTexto(e.target.value)}
                          />
                        </>
                      ) : (
                        <>
                          <p className="suporte-float-cadastro-lead">
                            Use quando resíduo, equipamento, campo ou cliente ainda não estiverem
                            cadastrados no sistema.
                          </p>
                          <label htmlFor={`${panelId}-cliente`} className="suporte-float-label">
                            Cliente
                          </label>
                          <input
                            id={`${panelId}-cliente`}
                            className="suporte-float-input"
                            type="text"
                            placeholder="Nome ou razão social do cliente"
                            value={clienteCadastro}
                            disabled={enviando}
                            onChange={(e) => setClienteCadastro(e.target.value)}
                          />
                          <label htmlFor={`${panelId}-item`} className="suporte-float-label">
                            O que cadastrar
                          </label>
                          <select
                            id={`${panelId}-item`}
                            className="suporte-float-input"
                            value={itemCadastro}
                            disabled={enviando}
                            onChange={(e) =>
                              setItemCadastro(e.target.value as ItemCadastroSolicitacao)
                            }
                          >
                            {ITENS_CADASTRO_SOLICITACAO.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                          <label htmlFor={`${panelId}-detalhes`} className="suporte-float-label">
                            Dados a incluir no cadastro
                          </label>
                          <textarea
                            ref={textareaRef}
                            id={`${panelId}-detalhes`}
                            className="suporte-float-textarea"
                            rows={4}
                            placeholder={hintItemCadastro}
                            value={detalhesCadastro}
                            disabled={enviando}
                            onChange={(e) => setDetalhesCadastro(e.target.value)}
                          />
                        </>
                      )}

                      <span className="suporte-float-label" id={`${panelId}-print-label`}>
                        Print da tela (opcional)
                      </span>
                      <div
                        className={`suporte-float-paste${previewUrl ? ' suporte-float-paste--filled' : ''}`}
                        tabIndex={0}
                        role="group"
                        aria-labelledby={`${panelId}-print-label`}
                        aria-describedby={`${panelId}-print-hint`}
                        onPaste={(e) => {
                          if (enviando) return
                          aplicarPrintColado(e.nativeEvent)
                        }}
                      >
                        {previewUrl ? (
                          <>
                            <img
                              src={previewUrl}
                              alt="Print colado"
                              className="suporte-float-preview suporte-float-preview--in-paste"
                            />
                            <div className="suporte-float-paste__acoes">
                              <button
                                type="button"
                                className="suporte-float-paste__rabiscar"
                                disabled={enviando || !print}
                                onClick={() => print && setImagemEditor(print)}
                              >
                                Rabiscar no print
                              </button>
                              <button
                                type="button"
                                className="suporte-float-paste__remover"
                                disabled={enviando}
                                onClick={() => setPrint(null)}
                              >
                                Remover print
                              </button>
                            </div>
                          </>
                        ) : (
                          <p id={`${panelId}-print-hint`} className="suporte-float-paste__hint">
                            Capture o ecrã (ex.: Win+Shift+S) e prima{' '}
                            <kbd>Ctrl</kbd>+<kbd>V</kbd> aqui ou em qualquer lugar deste formulário.
                          </p>
                        )}
                      </div>

                      <div className="suporte-float-actions">
                        <button
                          type="button"
                          className="suporte-float-btn suporte-float-btn--ghost"
                          disabled={enviando}
                          onClick={fecharPainel}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="suporte-float-btn suporte-float-btn--primary"
                          disabled={enviando || !podeEnviar}
                          onClick={() => void enviar()}
                        >
                          {enviando ? 'A enviar…' : 'Enviar'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  )

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {painel}
      <ChatImagemAnexoEditor
        open={!!imagemEditor}
        file={imagemEditor}
        onCancel={() => setImagemEditor(null)}
        onConfirm={(f) => {
          setPrint(f)
          setImagemEditor(null)
        }}
      />
    </>,
    document.body
  )
}
