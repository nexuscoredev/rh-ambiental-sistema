import type { CSSProperties } from 'react'

type Props = {
  percentual: number
}

const ROTULOS: { max: number; label: string }[] = [
  { max: 5, label: 'Semente no solo' },
  { max: 20, label: 'Broto nascendo' },
  { max: 45, label: 'Muda crescendo' },
  { max: 70, label: 'Arbusto jovem' },
  { max: 95, label: 'Árvore em formação' },
  { max: 100, label: 'Árvore RG — trilha completa!' },
]

function rotuloPlanta(pct: number): string {
  for (const r of ROTULOS) {
    if (pct <= r.max) return r.label
  }
  return ROTULOS[ROTULOS.length - 1].label
}

/** Planta/árvore RG que cresce do chão conforme % da trilha certificada. */
export function TreinamentoPlantaProgresso({ percentual }: Props) {
  const pct = Math.min(100, Math.max(0, percentual))
  /** Altura visível — mínimo mostra semente; máximo ~340px. */
  const alturaVisivel = Math.max(36, (pct / 100) * 340)

  return (
    <aside
      className="treinamento-kb__planta"
      aria-label={`Progresso da trilha: ${pct}%. ${rotuloPlanta(pct)}`}
    >
      <div className="treinamento-kb__planta-pct">{pct}%</div>
      <div
        className="treinamento-kb__planta-viewport"
        style={{ height: `${alturaVisivel}px` } as CSSProperties}
      >
        <svg
          className="treinamento-kb__planta-svg"
          viewBox="0 0 160 340"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          {/* Solo */}
          <ellipse cx="80" cy="328" rx="72" ry="10" fill="#78716c" opacity="0.35" />
          <ellipse cx="80" cy="326" rx="56" ry="7" fill="#57534e" opacity="0.5" />

          {/* Semente / broto inicial (sempre na base) */}
          <ellipse cx="80" cy="318" rx="6" ry="4" fill="#92400e" />
          <path
            d="M80 314 Q76 300 80 288 Q84 300 80 314"
            fill="#22c55e"
            opacity="0.9"
          />

          {/* Caule */}
          <path
            d="M76 318 L78 220 Q80 180 79 120 Q80 80 77 48 L83 48 Q80 80 81 120 Q82 180 82 220 L84 318 Z"
            fill="#92400e"
          />
          <path d="M77 48 L83 48 L82 30 L78 30 Z" fill="#a16207" />

          {/* Folhas baixas */}
          <ellipse cx="58" cy="260" rx="22" ry="12" fill="#16a34a" transform="rotate(-25 58 260)" />
          <ellipse cx="102" cy="248" rx="20" ry="11" fill="#22c55e" transform="rotate(20 102 248)" />

          {/* Copa média */}
          <circle cx="80" cy="175" r="38" fill="#0f766e" opacity="0.85" />
          <circle cx="55" cy="195" r="26" fill="#14b8a6" opacity="0.75" />
          <circle cx="108" cy="188" r="28" fill="#059669" opacity="0.8" />

          {/* Copa superior — árvore madura */}
          <circle cx="80" cy="95" r="48" fill="#0f766e" />
          <circle cx="48" cy="115" r="32" fill="#10b981" opacity="0.9" />
          <circle cx="115" cy="108" r="34" fill="#059669" opacity="0.92" />
          <circle cx="80" cy="62" r="28" fill="#22c55e" opacity="0.95" />

          {/* Destaque RG no topo em 100% */}
          <circle cx="80" cy="42" r="8" fill="#fef3c7" opacity="0.9" />
        </svg>
      </div>
      <p className="treinamento-kb__planta-label">{rotuloPlanta(pct)}</p>
    </aside>
  )
}
