import { useState, type FormEvent } from 'react'

type Props = {
  ciclo: number
  enviando: boolean
  onEnviarComplemento: (texto: string) => Promise<void>
}

export function ChatPedidoAjusteDetalhes({ ciclo, enviando, onEnviarComplemento }: Props) {
  const [complemento, setComplemento] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = complemento.trim()
    if (!t || enviando) return
    await onEnviarComplemento(t)
    setComplemento('')
  }

  return (
    <form
      className="chat-pedido-feedback chat-pedido-feedback--detalhes"
      role="region"
      aria-label="Complemento do pedido de ajuste"
      onSubmit={(e) => void submit(e)}
    >
      <p className="chat-pedido-feedback__titulo">O desenvolvimento pediu mais detalhes</p>
      <p className="chat-pedido-feedback__ciclo">
        {ciclo > 1 ? `Ciclo ${ciclo} — ` : ''}
        Descreva o que faltou no pedido original para facilitar a correção.
      </p>
      <label className="chat-pedido-feedback__label" htmlFor="chat-pedido-complemento">
        Complemento (obrigatório)
      </label>
      <textarea
        id="chat-pedido-complemento"
        className="chat-pedido-feedback__textarea"
        rows={4}
        placeholder="Ex.: passos para reproduzir, comportamento esperado, print ou exemplo…"
        value={complemento}
        onChange={(e) => setComplemento(e.target.value)}
        disabled={enviando}
        required
        minLength={3}
      />
      <div className="chat-pedido-feedback__acoes">
        <button
          type="submit"
          className="chat-pedido-feedback__btn chat-pedido-feedback__btn--ok"
          disabled={enviando || complemento.trim().length < 3}
        >
          {enviando ? 'A enviar…' : 'Enviar complemento'}
        </button>
      </div>
    </form>
  )
}
