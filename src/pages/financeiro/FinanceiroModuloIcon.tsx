type Props = { slug: string; className?: string }

export function FinanceiroModuloIcon({ slug, className = 'rh-icon' }: Props) {
  const p = {
    strokeWidth: 1.75,
    stroke: 'currentColor',
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (slug) {
    case 'cobranca':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="6" width="18" height="14" rx="2" {...p} />
          <path d="M7 10h6M7 14h10" {...p} />
          <path d="M12 3v3" {...p} />
        </svg>
      )
    case 'contas-receber':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3v18" {...p} />
          <path d="M7 8l5-3 5 3M7 16l5 3 5-3" {...p} />
        </svg>
      )
    case 'contas-pagar':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 21V3" {...p} />
          <path d="M7 16l5 3 5-3M7 8l5-3 5 3" {...p} />
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
