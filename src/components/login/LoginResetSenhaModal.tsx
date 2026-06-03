import { useEffect, useId, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { solicitarResetSenhaLogin } from '../../lib/solicitarResetSenhaLogin'

type Props = {
  open: boolean
  emailInicial: string
  onClose: () => void
}

export function LoginResetSenhaModal({ open, emailInicial, onClose }: Props) {
  const tituloId = useId()
  const [email, setEmail] = useState(emailInicial)
  const [nome, setNome] = useState('')
  const [observacao, setObservacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail(emailInicial)
    setNome('')
    setObservacao('')
    setErro('')
    setSucesso(false)
    setEnviando(false)
  }, [open, emailInicial])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, enviando, onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await solicitarResetSenhaLogin({ email, nome, observacao })
      setSucesso(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar.')
    } finally {
      setEnviando(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="login-reset-modal" role="presentation">
      <button
        type="button"
        className="login-reset-modal__backdrop"
        aria-label="Fechar"
        onClick={() => !enviando && onClose()}
      />
      <div
        className="login-reset-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <h2 id={tituloId} className="login-reset-modal__title">
          Pedido de reset de senha
        </h2>
        <p className="login-reset-modal__lead">
          O pedido é enviado aos desenvolvedores pelo chat interno. A equipa entrará em contacto após
          redefinir o acesso.
        </p>

        {sucesso ? (
          <div className="login-reset-modal__ok">
            <p>Pedido enviado. Os desenvolvedores foram notificados no chat.</p>
            <button type="button" className="login-reset-modal__btn login-reset-modal__btn--primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <label className="login-reset-modal__label">
              <span>E-mail corporativo</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
              />
            </label>
            <label className="login-reset-modal__label">
              <span>Nome (opcional)</span>
              <input
                type="text"
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={enviando}
                placeholder="Como consta no cadastro"
              />
            </label>
            <label className="login-reset-modal__label">
              <span>Mensagem (opcional)</span>
              <textarea
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                disabled={enviando}
                placeholder="Ex.: não consigo entrar desde ontem"
              />
            </label>

            {erro ? (
              <p className="login-reset-modal__erro" role="alert">
                {erro}
              </p>
            ) : null}

            <div className="login-reset-modal__actions">
              <button
                type="button"
                className="login-reset-modal__btn login-reset-modal__btn--ghost"
                disabled={enviando}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="login-reset-modal__btn login-reset-modal__btn--primary"
                disabled={enviando}
              >
                {enviando ? 'A enviar…' : 'Enviar pedido'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
