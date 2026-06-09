import type { ReactNode, SVGProps } from 'react'

type SvgProps = SVGProps<SVGSVGElement>

function Svg({ children, ...rest }: SvgProps) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

const GRUPO_ICONES: Record<string, ReactNode> = {
  'Visão geral': (
    <Svg>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9 20v-6h6v6" />
    </Svg>
  ),
  Presidência: (
    <Svg>
      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
    </Svg>
  ),
  Cadastros: (
    <Svg>
      <path d="M4 6h16M4 12h16M4 18h10" />
      <circle cx="19" cy="18" r="2" />
    </Svg>
  ),
  'Fluxo operacional': (
    <Svg>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  ),
  Faturamento: (
    <Svg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </Svg>
  ),
  Financeiro: (
    <Svg>
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  ),
  RH: (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  'Pós-venda': (
    <Svg>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-6A4 4 0 0 1 7 15h1" />
      <path d="M17 3a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z" />
    </Svg>
  ),
  Sistema: (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </Svg>
  ),
}

const ITEM_ICONES_POR_PATH: Record<string, ReactNode> = {
  '/bem-vindo': (
    <Svg>
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 6v6l4 2" />
    </Svg>
  ),
  '/dashboard': (
    <Svg>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Svg>
  ),
  '/programacao': (
    <Svg>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  ),
  '/mtr': (
    <Svg>
      <path d="M9 12h6M9 16h6M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M13 2v7h7" />
    </Svg>
  ),
  '/controle-massa': (
    <Svg>
      <path d="M12 3v18" />
      <path d="M5 8h14M5 16h14" />
      <circle cx="12" cy="8" r="2" />
      <circle cx="12" cy="16" r="2" />
    </Svg>
  ),
  '/clientes': (
    <Svg>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </Svg>
  ),
  '/motoristas': (
    <Svg>
      <circle cx="12" cy="7" r="3" />
      <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
    </Svg>
  ),
  '/caminhoes': (
    <Svg>
      <path d="M3 13h11v5H3z" />
      <path d="M14 15h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </Svg>
  ),
  '/faturamento': (
    <Svg>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  ),
  '/usuarios': (
    <Svg>
      <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5z" />
      <path d="M3 21v-1a7 7 0 0 1 14 0v1" />
    </Svg>
  ),
}

const ITEM_ICONE_PADRAO = (
  <Svg>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41" />
  </Svg>
)

const GRUPO_ICONE_PADRAO = (
  <Svg>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Svg>
)

export function iconeGrupoMenu(titulo: string): ReactNode {
  return GRUPO_ICONES[titulo] ?? GRUPO_ICONE_PADRAO
}

export function iconeItemMenu(path: string): ReactNode {
  const ordenados = Object.keys(ITEM_ICONES_POR_PATH).sort((a, b) => b.length - a.length)
  const hit = ordenados.find((p) => path === p || path.startsWith(`${p}/`))
  return hit ? ITEM_ICONES_POR_PATH[hit] : ITEM_ICONE_PADRAO
}
