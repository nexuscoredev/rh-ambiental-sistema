import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FROTA_DIVISOES, FROTA_HUB_LABEL } from '../../lib/frotaModulos'
import { FrotaModuloIcon } from './FrotaModuloIcon'
import { frotaVisual } from './frotaModuloVisual'

const modulos = [...FROTA_DIVISOES].sort((a, b) => a.ordem - b.ordem)

export default function FrotaHub() {
  return (
    <MainLayout>
      <div className="page-shell rh-hub frota-hub-transportes">
        <section className="rh-hub__hero" aria-labelledby="frota-hub-title">
          <div className="rh-hub__hero-glow" aria-hidden />
          <div className="rh-hub__hero-inner">
            <div className="rh-hub__hero-copy">
              <p className="rh-hub__eyebrow">RG Ambiental · Fluxo operacional</p>
              <h1 id="frota-hub-title" className="rh-hub__title">
                {FROTA_HUB_LABEL}
              </h1>
              <p className="rh-hub__lead">
                Movimentação de equipamentos do cliente, manutenção e diário da frota, e relatório
                consolidado para impressão — tudo num só lugar.
              </p>
            </div>
            <div className="rh-hub__stats" aria-label="Resumo da área">
              <div className="rh-hub__stat">
                <span className="rh-hub__stat-value">{modulos.length}</span>
                <span className="rh-hub__stat-label">áreas</span>
              </div>
              <div className="rh-hub__stat">
                <span className="rh-hub__stat-value">{modulos.length}</span>
                <span className="rh-hub__stat-label">disponíveis</span>
              </div>
              <div className="rh-hub__stat rh-hub__stat--soft">
                <span className="rh-hub__stat-value">Hub</span>
                <span className="rh-hub__stat-label">movimentação · manutenção · relatório</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rh-hub__modules" aria-labelledby="frota-modules-title">
          <div className="rh-hub__section-head">
            <h2 id="frota-modules-title" className="rh-hub__section-title">
              O que pretende fazer?
            </h2>
            <p className="rh-hub__section-sub">
              Escolha uma área abaixo. Cada módulo abre numa página dedicada, com formulários e histórico.
            </p>
          </div>

          <div className="rh-hub__grid">
            {modulos.map((mod, index) => {
              const vis = frotaVisual(mod.slug)
              return (
                <Link
                  key={mod.slug}
                  to={mod.path}
                  className="rh-hub__card"
                  style={
                    {
                      '--rh-accent': vis.accent,
                      '--rh-accent-soft': vis.accentSoft,
                    } as CSSProperties
                  }
                >
                  <div className="rh-hub__card-accent" aria-hidden />
                  <div className="rh-hub__card-head">
                    <span className="rh-hub__card-icon-wrap">
                      <FrotaModuloIcon slug={mod.slug} />
                    </span>
                    <span className="rh-hub__card-index">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="rh-hub__card-label">{mod.label}</h3>
                  <p className="rh-hub__card-desc">{mod.descricao}</p>
                  <ul className="rh-hub__card-tags">
                    {vis.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                  <span className="rh-hub__card-footer">
                    <span className="rh-hub__card-badge">Disponível</span>
                    <span className="rh-hub__card-cta">Abrir →</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </MainLayout>
  )
}
