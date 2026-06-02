import type { FrotaDivisaoSlug } from '../../lib/frotaModulos'

type Props = { slug: string; className?: string }

export function FrotaModuloIcon({ slug, className = 'rh-icon' }: Props) {
  const p = {
    strokeWidth: 1.75,
    stroke: 'currentColor',
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (slug as FrotaDivisaoSlug) {
    case 'transportes':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M3 13h11v6H3z" {...p} />
          <path d="M14 11h4l3 4v4h-7v-8z" {...p} />
          <circle cx="7" cy="19" r="1.5" {...p} />
          <circle cx="17" cy="19" r="1.5" {...p} />
          <path d="M5 13V9a2 2 0 0 1 2-2h5" {...p} />
        </svg>
      )
    case 'manutencao':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-3.3-3.3 2.1-2.1z" {...p} />
        </svg>
      )
    case 'relatorio':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M8 4h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" {...p} />
          <path d="M14 4v4h4M9 13h6M9 17h4" {...p} />
        </svg>
      )
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" {...p} />
        </svg>
      )
  }
}
