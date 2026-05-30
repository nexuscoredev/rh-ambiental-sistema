import type { CSSProperties } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { RH_HUB_PATH, RH_MODULOS_ORDENADOS, rhModuloPorPath } from '../../lib/rhModulos'
import { RhModuloIcon } from './RhModuloIcon'
import { rhVisual } from './rhModuloVisual'

const ROADMAP = [
  { fase: 'Cadastro', texto: 'Formulários, listagens e filtros do módulo.' },
  { fase: 'Integração', texto: 'Tabelas Supabase, RLS e auditoria de alterações.' },
  { fase: 'Automação', texto: 'Alertas, prazos legais e relatórios exportáveis.' },
]

export default function RhModuloPage() {
  const { pathname } = useLocation()
  const mod = rhModuloPorPath(pathname)

  if (!mod) {
    return <Navigate to={RH_HUB_PATH} replace />
  }

  const vis = rhVisual(mod.slug)
  const outros = RH_MODULOS_ORDENADOS.filter((m) => m.slug !== mod.slug).slice(0, 4)

  return (
    <MainLayout>
      <div
        className="page-shell rh-modulo"
        style={
          {
            '--rh-accent': vis.accent,
            '--rh-accent-soft': vis.accentSoft,
          } as CSSProperties
        }
      >
        <nav className="rh-modulo__breadcrumb" aria-label="Navegação">
          <Link to={RH_HUB_PATH}>RH</Link>
          <span className="rh-modulo__breadcrumb-sep" aria-hidden>/</span>
          <span>{mod.label}</span>
        </nav>

        <header className="rh-modulo__hero">
          <div className="rh-modulo__hero-icon">
            <RhModuloIcon slug={mod.slug} />
          </div>
          <div className="rh-modulo__hero-copy">
            <h1 className="rh-modulo__title">{mod.label}</h1>
            <p className="rh-modulo__lead">{mod.descricao}</p>
            <ul className="rh-modulo__tags">
              {vis.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </div>
          <span className="rh-modulo__status">Em desenvolvimento</span>
        </header>

        <div className="rh-modulo__layout">
          <section className="rh-modulo__panel rh-modulo__panel--main">
            <h2>Roadmap do módulo</h2>
            <ol className="rh-modulo__roadmap">
              {ROADMAP.map((item, i) => (
                <li key={item.fase}>
                  <span className="rh-modulo__roadmap-step">{i + 1}</span>
                  <div>
                    <strong>{item.fase}</strong>
                    <p>{item.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link to={RH_HUB_PATH} className="rh-modulo__back">
              ← Voltar ao RH
            </Link>
          </section>

          <aside className="rh-modulo__panel rh-modulo__panel--aside">
            <h2>Outros módulos</h2>
            <ul className="rh-modulo__links">
              {outros.map((m) => (
                <li key={m.slug}>
                  <Link to={m.path} className="rh-modulo__link">
                    <span className="rh-modulo__link-icon">
                      <RhModuloIcon slug={m.slug} />
                    </span>
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </MainLayout>
  )
}
