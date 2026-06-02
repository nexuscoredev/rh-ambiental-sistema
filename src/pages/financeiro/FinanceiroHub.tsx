import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FINANCEIRO_MODULOS_ORDENADOS } from '../../lib/financeiroModulos'
import { FinanceiroModuloIcon } from './FinanceiroModuloIcon'
import { financeiroVisual } from './financeiroModuloVisual'

export default function FinanceiroHub() {
  const prontos = FINANCEIRO_MODULOS_ORDENADOS.filter((m) => m.pronto).length

  return (
    <MainLayout>
      <div className="page-shell rh-hub">
        <section className="rh-hub__hero" aria-labelledby="financeiro-hub-title">
          <div className="rh-hub__hero-glow" aria-hidden />
          <div className="rh-hub__hero-inner">
            <div className="rh-hub__hero-copy">
              <p className="rh-hub__eyebrow">RG Ambiental · Financeiro</p>
              <h1 id="financeiro-hub-title" className="rh-hub__title">
                Financeiro
              </h1>
              <p className="rh-hub__lead">
                Cobrança das coletas faturadas, contas a receber e a pagar — num hub central, com o
                mesmo padrão visual do departamento de RH.
              </p>
            </div>
            <div className="rh-hub__stats" aria-label="Resumo da área">
              <div className="rh-hub__stat">
                <span className="rh-hub__stat-value">{FINANCEIRO_MODULOS_ORDENADOS.length}</span>
                <span className="rh-hub__stat-label">módulos</span>
              </div>
              <div className="rh-hub__stat">
                <span className="rh-hub__stat-value">{prontos}</span>
                <span className="rh-hub__stat-label">disponíveis</span>
              </div>
              <div className="rh-hub__stat rh-hub__stat--soft">
                <span className="rh-hub__stat-value">Hub</span>
                <span className="rh-hub__stat-label">cobrança · receber · pagar</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rh-hub__modules" aria-labelledby="financeiro-modules-title">
          <div className="rh-hub__section-head">
            <h2 id="financeiro-modules-title" className="rh-hub__section-title">
              Áreas do financeiro
            </h2>
            <p className="rh-hub__section-sub">Selecione um módulo para abrir a área correspondente.</p>
          </div>

          <div className="rh-hub__grid">
            {FINANCEIRO_MODULOS_ORDENADOS.map((mod, index) => {
              const vis = financeiroVisual(mod.slug)
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
                      <FinanceiroModuloIcon slug={mod.slug} />
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
                    <span className="rh-hub__card-badge">{mod.pronto ? 'Disponível' : 'Em breve'}</span>
                    <span className="rh-hub__card-cta">Abrir →</span>
                  </span>
                </Link>
              )
            })}
          </div>

          <p className="rh-hub__section-sub" style={{ marginTop: 20 }}>
            A emissão operacional (conferência do ticket e fila para faturar) continua em{' '}
            <Link to="/faturamento">Faturamento</Link> — antes das coletas chegarem à cobrança aqui.
          </p>
        </section>
      </div>
    </MainLayout>
  )
}
