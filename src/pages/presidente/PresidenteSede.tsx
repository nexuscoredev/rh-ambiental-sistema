import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { PRESIDENTE_SETORES_SEDE } from '../../lib/presidenteModulos'
import { PresidentePageChrome } from './PresidentePageChrome'

export default function PresidenteSede() {
  const totalCam = PRESIDENTE_SETORES_SEDE.reduce((n, s) => n + s.cameras.length, 0)

  return (
    <PresidentePageChrome
      titulo="Instalações RG"
      subtitulo={`${PRESIDENTE_SETORES_SEDE.length} setores · ${totalCam} câmaras mapeadas na sede.`}
      breadcrumb={[{ label: 'Instalações' }]}
    >
      <div className="presidente-setores-grid">
        {PRESIDENTE_SETORES_SEDE.map((setor) => (
          <Link
            key={setor.slug}
            to={setor.path}
            className="presidente-setor-card"
            style={{ '--setor-accent': '#0f766e', '--setor-soft': '#ccfbf1' } as CSSProperties}
          >
            <div className="presidente-setor-card__icon" aria-hidden>
              {setor.icone === 'cozinha' ? '🍽' : null}
              {setor.icone === 'sala' ? '💼' : null}
              {setor.icone === 'recepcao' ? '🛎' : null}
              {setor.icone === 'escritorio' ? '🖥' : null}
              {setor.icone === 'patio' ? '🚛' : null}
              {setor.icone === 'almoxarifado' ? '📦' : null}
            </div>
            <h2 className="presidente-setor-card__title">{setor.label}</h2>
            <p className="presidente-setor-card__desc">{setor.descricao}</p>
            <span className="presidente-setor-card__meta">
              {setor.cameras.length} câmara{setor.cameras.length === 1 ? '' : 's'}
            </span>
            <span className="presidente-setor-card__cta">Ver câmaras →</span>
          </Link>
        ))}
      </div>
    </PresidentePageChrome>
  )
}
