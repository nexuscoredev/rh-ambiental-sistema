import { useState, type FormEvent } from 'react'

type Props = {
  descricaoInicial: string
  enviando: boolean
  onCancelar: () => void
  onSalvar: (texto: string) => Promise<void>
}

export function ChatPedidoAjusteEditar({
  descricaoInicial,
  enviando,
  onCancelar,
  onSalvar,
}: Props) {
  const [texto, setTexto] = useState(descricaoInicial)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t || enviando) return
    await onSalvar(t)
  }

  return (
    <form
      className="chat-pedido-feedback chat-pedido-feedback--editar"
      role="region"
      aria-label="Editar pedido de ajuste"
      onSubmit={(e) => void submit(e)}
    >
      <p className="chat-pedido-feedback__titulo">Editar solicitação</p>
      <p className="chat-pedido-feedback__ciclo">
        Altere o texto abaixo em vez de abrir um pedido novo. Só é possível enquanto o desenvolvimento
        ainda não respondeu.
      </p>
      <label className="chat-pedido-feedback__label" htmlFor="chat-pedido-editar-texto">
        Descrição
      </label>
      <textarea
        id="chat-pedido-editar-texto"
        className="chat-pedido-feedback__textarea"
        rows={5}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={enviando}
        required
        minLength={3}
      />
      <div className="chat-pedido-feedback__acoes chat-pedido-feedback__acoes--dupla">
        <button
          type="button"
          className="chat-pedido-feedback__btn chat-pedido-feedback__btn--ghost"
          disabled={enviando}
          onClick={onCancelar}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="chat-pedido-feedback__btn chat-pedido-feedback__btn--ok"
          disabled={enviando || texto.trim().length < 3}
        >
          {enviando ? 'A guardar…' : 'Guardar alterações'}
        </button>
      </div>
    </form>
  )
}
