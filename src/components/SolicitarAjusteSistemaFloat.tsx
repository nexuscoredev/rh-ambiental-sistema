import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useChatFloat } from '../contexts/ChatFloatContext'
import { chatEnviarPedidoAjusteSistema } from '../lib/chat'
import { deveOcultarSolicitacaoAjuste } from '../lib/solicitacaoAjusteSistema'

export type SolicitarAjusteSistemaFloatProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  panelId: string
}

export default function SolicitarAjusteSistemaFloat({
  open,
  onOpenChange,
  panelId,
}: SolicitarAjusteSistemaFloatProps) {
  const { openChat, openChatWithUser } = useChatFloat()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const ficheiroRef = useRef<HTMLInputElement>(null)

  const [texto, setTexto] = useState('')
  const [print, setPrint] = useState<File | null>(null)
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
      setPrint(null)
      if (ficheiroRef.current) ficheiroRef.current.value = ''
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
    if (!open) return
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const fecharPainel = useCallback(() => {
    onOpenChange(false)
    setErro('')
  }, [onOpenChange])

  const enviar = useCallback(async () => {
    setEnviando(true)
    setErro('')
    setSucessoId(null)
    try {
      const { destinoUserId } = await chatEnviarPedidoAjusteSistema(texto, print)
      setTexto('')
      setPrint(null)
      if (ficheiroRef.current) ficheiroRef.current.value = ''
      setSucessoId(destinoUserId)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.')
    } finally {
      setEnviando(false)
    }
  }, [texto, print])

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
                  Solicitar ajuste no sistema
                </h2>
                <p className="suporte-float-panel__lead">
                  {contaDesenvolvedor
                    ? 'Esta conta recebe os pedidos de melhoria. Responda pelo Chat Interno.'
                    : 'Descreva como podemos melhorar o sistema. A mensagem chega ao chat do desenvolvedor (Rafael Cavalcante).'}
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

                      <label htmlFor={`${panelId}-print`} className="suporte-float-label">
                        Print (opcional)
                      </label>
                      <input
                        ref={ficheiroRef}
                        id={`${panelId}-print`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="suporte-float-file"
                        disabled={enviando}
                        onChange={(e) => setPrint(e.target.files?.[0] ?? null)}
                      />
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Pré-visualização do print"
                          className="suporte-float-preview"
                        />
                      ) : null}

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
                          disabled={enviando || !texto.trim()}
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

  return createPortal(painel, document.body)
}
