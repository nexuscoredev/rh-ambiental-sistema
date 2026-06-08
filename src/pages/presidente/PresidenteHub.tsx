import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import {
  PRESIDENTE_HUB_LABEL,
  PRESIDENTE_MODULOS,
  PRESIDENTE_SETORES_SEDE,
  PRESIDENTE_VEICULOS_DEMO,
  presidenteContarCameras,
} from '../../lib/presidenteModulos'
import { PresidenteModuloIcon } from './PresidenteModuloIcon'
import { presidenteVisual } from './presidenteModuloVisual'

const modulos = [...PRESIDENTE_MODULOS].sort((a, b) => a.ordem - b.ordem)

export default function PresidenteHub() {
  const totalCameras = presidenteContarCameras()
  const emRota = PRESIDENTE_VEICULOS_DEMO.filter((v) => v.status === 'em_rota').length

  return (
    <MainLayout>
      <div className="page-shell rh-hub presidente-hub">
        <section className="rh-hub__hero presidente-hub__hero" aria-labelledby="presidente-hub-title">
          <div className="rh-hub__hero-glow presidente-hub__glow" aria-hidden />
          <div className="rh-hub__hero-inner">
            <div className="rh-hub__hero-copy">
              <p className="rh-hub__eyebrow">RG Ambiental · Visão executiva</p>
              <h1 id="presidente-hub-title" className="rh-hub__title">
                {PRESIDENTE_HUB_LABEL}
              </h1>
              <p className="rh-hub__lead">
                Câmaras por setor, frota em tempo real, balança e rastreamento unificado — tudo num
                painel intuitivo. As APIs de vídeo e GPS serão ligadas nas próximas integrações.
              </p>
            </div>
            <div className="rh-hub__stats presidente-hub__stats" aria-label="Resumo">
              <div className="rh-hub__stat">
                <span className="rh-hub__stat-value">{totalCameras}</span>
                <span className="rh-hub__stat-label">câmaras mapeadas</span>
              </div>
              <div className="rh-hub__stat">
                <span className="rh-hub__stat-value">{PRESIDENTE_SETORES_SEDE.length}</span>
                <span className="rh-hub__stat-label">setores na sede</span>
              </div>
              <div className="rh-hub__stat rh-hub__stat--soft">
                <span className="rh-hub__stat-value">{emRota}</span>
                <span className="rh-hub__stat-label">veículos em rota (demo)</span>
              </div>
            </div>
          </div>
        </section>

        <section className="presidente-hub__pulse" aria-label="Estado geral">
          <div className="presidente-hub__pulse-card">
            <span className="presidente-hub__pulse-label">Monitorização</span>
            <strong>Pronta para integração</strong>
            <p>Layout e setores configurados — aguarda ligação às APIs de DVR, telemática e balança.</p>
          </div>
          <div className="presidente-hub__pulse-card presidente-hub__pulse-card--teal">
            <span className="presidente-hub__pulse-label">Frota</span>
            <strong>{PRESIDENTE_VEICULOS_DEMO.length} veículos</strong>
            <p>Dashcams e posição GPS aparecerão aqui assim que a API estiver activa.</p>
          </div>
          <div className="presidente-hub__pulse-card presidente-hub__pulse-card--amber">
            <span className="presidente-hub__pulse-label">Balança</span>
            <strong>4 pontos de vídeo</strong>
            <p>Plataformas, entrada e sala do balanceiro no mesmo painel.</p>
          </div>
        </section>

        <section className="rh-hub__modules" aria-labelledby="presidente-modules-title">
          <div className="rh-hub__section-head">
            <h2 id="presidente-modules-title" className="rh-hub__section-title">
              O que pretende ver?
            </h2>
            <p className="rh-hub__section-sub">
              Escolha uma área. Cada módulo abre grelha de câmaras ou mapa de rastreamento.
            </p>
          </div>

          <div className="rh-hub__grid presidente-hub__grid">
            {modulos.map((mod, index) => {
              const vis = presidenteVisual(mod.slug)
              return (
                <Link
                  key={mod.slug}
                  to={mod.path}
                  className="rh-hub__card presidente-hub__card"
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
                      <PresidenteModuloIcon slug={mod.slug} />
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
                    <span className="rh-hub__card-badge">{mod.badge ?? 'Abrir'}</span>
                    <span className="rh-hub__card-cta">Entrar →</span>
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
