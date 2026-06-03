import type { ReactNode } from 'react'

export type RhHubHeroStat = {
  value: string | number
  label: string
  soft?: boolean
}

type Props = {
  titleId: string
  eyebrow: string
  title: string
  lead: ReactNode
  stats: RhHubHeroStat[]
  className?: string
}

/** Cabeçalho minimalista (contorno verde) compartilhado pelos hubs e áreas operacionais. */
export function RhHubHeroBanner({ titleId, eyebrow, title, lead, stats, className }: Props) {
  return (
    <section
      className={['rh-hub__hero', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
    >
      <div className="rh-hub__hero-glow" aria-hidden />
      <div className="rh-hub__hero-inner">
        <div className="rh-hub__hero-copy">
          <p className="rh-hub__eyebrow">{eyebrow}</p>
          <h1 id={titleId} className="rh-hub__title">
            {title}
          </h1>
          <p className="rh-hub__lead">{lead}</p>
        </div>
        {stats.length > 0 ? (
          <div className="rh-hub__stats" aria-label="Resumo da área">
            {stats.map((stat) => (
              <div
                key={`${stat.label}-${stat.value}`}
                className={stat.soft ? 'rh-hub__stat rh-hub__stat--soft' : 'rh-hub__stat'}
              >
                <span className="rh-hub__stat-value">{stat.value}</span>
                <span className="rh-hub__stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
