type Props = { slug: string; className?: string }

export function PresidenteModuloIcon({ slug, className = 'rh-icon' }: Props) {
  const p = {
    strokeWidth: 1.75,
    stroke: 'currentColor',
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (slug) {
    case 'sede':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M4 20V9l8-5 8 5v11" {...p} />
          <path d="M9 20v-6h6v6" {...p} />
          <path d="M9 12h6" {...p} />
        </svg>
      )
    case 'frota':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M3 13h11v6H3z" {...p} />
          <path d="M14 11h4l3 4v4h-7v-8z" {...p} />
          <circle cx="7" cy="19" r="1.5" {...p} />
          <circle cx="17" cy="19" r="1.5" {...p} />
        </svg>
      )
    case 'balanca':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3v18" {...p} />
          <path d="M5 8h14" {...p} />
          <path d="M7 8 5 21h4l-2-13zM17 8l2 13h-4l2-13z" {...p} />
          <circle cx="12" cy="6" r="2" {...p} />
        </svg>
      )
    case 'rastreamento':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" {...p} />
          <circle cx="12" cy="10" r="2.5" {...p} />
        </svg>
      )
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="5" width="14" height="12" rx="2" {...p} />
          <path d="M17 9l4-2v10l-4-2" {...p} />
        </svg>
      )
  }
}
