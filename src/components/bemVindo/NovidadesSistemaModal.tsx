import { useEffect, useId } from 'react'
import { NOVIDADES_SISTEMA_ATUAL } from '../../lib/novidadesSistema'

type Props = {
  open: boolean
  onClose: () => void
}

export function NovidadesSistemaModal({ open, onClose }: Props) {
  const tituloId = useId()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const { titulo, subtitulo, itens } = NOVIDADES_SISTEMA_ATUAL

  return (
    <div className="novidades-sistema" role="presentation">
      <button
        type="button"
        className="novidades-sistema__backdrop"
        aria-label="Fechar novidades"
        onClick={onClose}
      />
      <div
        className="novidades-sistema__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <div className="novidades-sistema__header">
          <span className="novidades-sistema__badge" aria-hidden>
            ✦
          </span>
          <h2 id={tituloId} className="novidades-sistema__title">
            {titulo}
          </h2>
          <p className="novidades-sistema__subtitle">{subtitulo}</p>
        </div>

        <ol className="novidades-sistema__list">
          {itens.map((item) => (
            <li key={item.ordem} className="novidades-sistema__item">
              <span className="novidades-sistema__num" aria-hidden>
                {item.ordem}
              </span>
              <div className="novidades-sistema__body">
                {item.destaque ? (
                  <span className="novidades-sistema__tag">{item.destaque}</span>
                ) : null}
                <p className="novidades-sistema__item-title">{item.titulo}</p>
                {item.descricao ? (
                  <p className="novidades-sistema__item-desc">{item.descricao}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="novidades-sistema__footer">
          <button type="button" className="novidades-sistema__btn" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
