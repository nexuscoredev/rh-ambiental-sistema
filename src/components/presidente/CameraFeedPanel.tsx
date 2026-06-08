import type { PresidenteCamera } from '../../lib/presidenteModulos'

const STATUS_LABEL: Record<PresidenteCamera['status'], string> = {
  online: 'Ao vivo',
  offline: 'Offline',
  integracao: 'Aguarda API',
}

const STATUS_CLASS: Record<PresidenteCamera['status'], string> = {
  online: 'presidente-cam__status--online',
  offline: 'presidente-cam__status--offline',
  integracao: 'presidente-cam__status--integracao',
}

type Props = {
  camera: PresidenteCamera
  destaque?: boolean
  onSelecionar?: () => void
  selecionada?: boolean
}

export function CameraFeedPanel({ camera, destaque = false, onSelecionar, selecionada }: Props) {
  const temStream = !!(camera.streamUrl && camera.status === 'online')

  return (
    <article
      className={`presidente-cam${destaque ? ' presidente-cam--destaque' : ''}${selecionada ? ' presidente-cam--selected' : ''}`}
      role={onSelecionar ? 'button' : undefined}
      tabIndex={onSelecionar ? 0 : undefined}
      onClick={onSelecionar}
      onKeyDown={
        onSelecionar
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelecionar()
              }
            }
          : undefined
      }
    >
      <div className="presidente-cam__viewport">
        {temStream ? (
          <iframe
            title={camera.nome}
            src={camera.streamUrl!}
            className="presidente-cam__stream"
            allow="autoplay; fullscreen"
          />
        ) : (
          <div className="presidente-cam__placeholder" aria-hidden>
            <span className="presidente-cam__placeholder-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="6" width="14" height="12" rx="2" />
                <path d="M17 10l4-2v8l-4-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="presidente-cam__placeholder-text">
              {camera.status === 'integracao'
                ? 'Stream será ligado à API de câmaras'
                : 'Câmara indisponível'}
            </span>
          </div>
        )}
        <span className={`presidente-cam__status ${STATUS_CLASS[camera.status]}`}>
          {camera.status === 'online' ? (
            <span className="presidente-cam__live-dot" aria-hidden />
          ) : null}
          {STATUS_LABEL[camera.status]}
        </span>
      </div>
      <footer className="presidente-cam__foot">
        <strong className="presidente-cam__nome">{camera.nome}</strong>
        {camera.angulo ? <span className="presidente-cam__angulo">{camera.angulo}</span> : null}
      </footer>
    </article>
  )
}
