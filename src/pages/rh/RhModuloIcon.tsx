type Props = { slug: string; className?: string }

/** Ícones lineares por módulo RH (24×24). */
export function RhModuloIcon({ slug, className = 'rh-icon' }: Props) {
  const p = { strokeWidth: 1.75, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (slug) {
    case 'departamento-pessoal':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <circle cx="9" cy="8" r="3" {...p} />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" {...p} />
          <path d="M16 11h5M18.5 8.5v5" {...p} />
        </svg>
      )
    case 'folha-pagamento':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" {...p} />
          <path d="M7 9h4M7 13h6" {...p} />
          <circle cx="17" cy="13" r="2" {...p} />
        </svg>
      )
    case 'admissoes-desligamentos':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M8 12h8M12 8v8" {...p} />
          <path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" {...p} />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" {...p} />
        </svg>
      )
    case 'ferias-afastamentos':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="5" width="16" height="16" rx="2" {...p} />
          <path d="M8 3v4M16 3v4M4 11h16" {...p} />
          <path d="M9 15l2 2 4-4" {...p} />
        </svg>
      )
    case 'ponto-jornada':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" {...p} />
          <path d="M12 8v4l3 2" {...p} />
        </svg>
      )
    case 'beneficios':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 21s-6-4.5-6-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-6 10-6 10z" {...p} />
        </svg>
      )
    case 'treinamentos':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M4 19V5l8 4 8-4v14l-8 4-8-4z" {...p} />
          <path d="M12 9v10" {...p} />
        </svg>
      )
    case 'documentos-esocial':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path d="M8 4h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" {...p} />
          <path d="M14 4v4h4M9 13h6M9 17h4" {...p} />
        </svg>
      )
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="3" {...p} />
        </svg>
      )
  }
}
