import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { PRESIDENTE_HUB_LABEL, PRESIDENTE_HUB_PATH } from '../../lib/presidenteModulos'

type Props = {
  titulo: string
  subtitulo?: string
  eyebrow?: string
  children: ReactNode
  acoes?: ReactNode
  breadcrumb?: { label: string; path?: string }[]
}

export function PresidentePageChrome({
  titulo,
  subtitulo,
  eyebrow = 'RG Ambiental · Presidência',
  children,
  acoes,
  breadcrumb = [],
}: Props) {
  return (
    <MainLayout>
      <div className="page-shell presidente-page">
        <nav className="presidente-breadcrumb" aria-label="Navegação">
          <Link to={PRESIDENTE_HUB_PATH}>{PRESIDENTE_HUB_LABEL}</Link>
          {breadcrumb.map((b, i) => (
            <span key={`${b.label}-${i}`}>
              <span className="presidente-breadcrumb__sep" aria-hidden>
                /
              </span>
              {b.path ? <Link to={b.path}>{b.label}</Link> : <span>{b.label}</span>}
            </span>
          ))}
        </nav>

        <header className="presidente-page__head">
          <div>
            <p className="presidente-page__eyebrow">{eyebrow}</p>
            <h1 className="presidente-page__title">{titulo}</h1>
            {subtitulo ? <p className="presidente-page__lead">{subtitulo}</p> : null}
          </div>
          {acoes ? <div className="presidente-page__acoes">{acoes}</div> : null}
        </header>

        {children}
      </div>
    </MainLayout>
  )
}
