import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { RH_MODULOS_ORDENADOS } from '../../lib/rhModulos'
import { RhModuloIcon } from './RhModuloIcon'
import { rhVisual } from './rhModuloVisual'

export default function RhHub() {
  return (
    <MainLayout>
      <div className="page-shell rh-hub">
        <section className="rh-hub__hero" aria-labelledby="rh-hub-title">
          <div className="rh-hub__hero-glow" aria-hidden />
          <div className="rh-hub__hero-inner">
            <div className="rh-hub__hero-copy">
              <p className="rh-hub__eyebrow">RG Ambiental · Recursos Humanos</p>
              <h1 id="rh-hub-title" className="rh-hub__title">
                RH
              </h1>
              <p className="rh-hub__lead">
                Gestão de pessoas num só lugar: cadastro, folha, benefícios, conformidade legal e
                desenvolvimento dos colaboradores.
              </p>
            </div>
            <div className="rh-hub__stats" aria-label="Resumo da área">
              <div className="rh-hub__stat">
                <span className="rh-hub__stat-value">{RH_MODULOS_ORDENADOS.length}</span>
                <span className="rh-hub__stat-label">módulos</span>
              </div>
              <div className="rh-hub__stat">
                <span className="rh-hub__stat-value">1</span>
                <span className="rh-hub__stat-label">hub central</span>
              </div>
              <div className="rh-hub__stat rh-hub__stat--soft">
                <span className="rh-hub__stat-value">Fase 1</span>
                <span className="rh-hub__stat-label">estrutura pronta</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rh-hub__modules" aria-labelledby="rh-modules-title">
          <div className="rh-hub__section-head">
            <h2 id="rh-modules-title" className="rh-hub__section-title">
              Áreas do departamento
            </h2>
            <p className="rh-hub__section-sub">
              Selecione um módulo para abrir a área correspondente.
            </p>
          </div>

          <div className="rh-hub__grid">
            {RH_MODULOS_ORDENADOS.map((mod, index) => {
              const vis = rhVisual(mod.slug)
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
                      <RhModuloIcon slug={mod.slug} />
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
                    <span
                      className={`rh-hub__card-badge${mod.slug === 'treinamentos' || mod.slug === 'departamento-pessoal' ? ' rh-hub__card-badge--live' : ''}`}
                    >
                      {mod.slug === 'treinamentos' || mod.slug === 'departamento-pessoal'
                        ? 'Disponível'
                        : 'Em breve'}
                    </span>
                    <span className="rh-hub__card-cta">Abrir →</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <footer className="rh-hub__footer">
          <p>
            Integração com Supabase e regras de negócio por área — sem impacto no fluxo operacional,
            faturamento ou financeiro já em produção.
          </p>
        </footer>
      </div>
    </MainLayout>
  )
}
