import { useState, type FormEvent } from 'react'

type Props = {
  ciclo: number
  decidindo: boolean
  onDecidir: (aprovado: boolean, justificativa?: string) => Promise<void>
}

export function ChatPedidoAjusteFeedback({ ciclo, decidindo, onDecidir }: Props) {
  const [mostrarNegar, setMostrarNegar] = useState(false)
  const [justificativa, setJustificativa] = useState('')

  async function submitNegar(e: FormEvent) {
    e.preventDefault()
    const t = justificativa.trim()
    if (!t || decidindo) return
    await onDecidir(false, t)
    setMostrarNegar(false)
    setJustificativa('')
  }

  return (
    <div className="chat-pedido-feedback" role="region" aria-label="Confirmação do ajuste">
      <p className="chat-pedido-feedback__titulo">O ajuste resolveu o seu pedido?</p>
      {ciclo > 1 ? (
        <p className="chat-pedido-feedback__ciclo">Tentativa {ciclo} — aguarda a sua confirmação.</p>
      ) : null}
      {!mostrarNegar ? (
        <div className="chat-pedido-feedback__acoes">
          <button
            type="button"
            className="chat-pedido-feedback__btn chat-pedido-feedback__btn--ok"
            disabled={decidindo}
            onClick={() => void onDecidir(true)}
          >
            {decidindo ? 'A guardar…' : 'Aprovar ajuste'}
          </button>
          <button
            type="button"
            className="chat-pedido-feedback__btn chat-pedido-feedback__btn--neg"
            disabled={decidindo}
            onClick={() => setMostrarNegar(true)}
          >
            Negar — precisa de mais ajustes
          </button>
        </div>
      ) : (
        <form className="chat-pedido-feedback__negar" onSubmit={(e) => void submitNegar(e)}>
          <label className="chat-pedido-feedback__label" htmlFor="chat-pedido-justificativa">
            Justificativa (obrigatória)
          </label>
          <textarea
            id="chat-pedido-justificativa"
            className="chat-pedido-feedback__textarea"
            rows={3}
            placeholder="Descreva o que ainda não ficou resolvido…"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            disabled={decidindo}
            required
            minLength={3}
          />
          <div className="chat-pedido-feedback__acoes">
            <button
              type="button"
              className="chat-pedido-feedback__btn chat-pedido-feedback__btn--ghost"
              disabled={decidindo}
              onClick={() => {
                setMostrarNegar(false)
                setJustificativa('')
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="chat-pedido-feedback__btn chat-pedido-feedback__btn--neg"
              disabled={decidindo || justificativa.trim().length < 3}
            >
              {decidindo ? 'A enviar…' : 'Enviar e reabrir pedido'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
