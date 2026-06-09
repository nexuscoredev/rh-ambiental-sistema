import { useId } from 'react'
import { BRAND_CHAT_BOLA } from '../../lib/brandLogo'

/** Logótipo RG CHAT — bola branca com texto preto e fundo transparente. */
export function RgChatLogo({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const clipId = `rgchat-ball-${uid}`

  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="40" cy="40" r="39" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image
          href={BRAND_CHAT_BOLA}
          x="0"
          y="0"
          width="80"
          height="80"
          preserveAspectRatio="xMidYMid slice"
        />
        <text
          x="40"
          y="43"
          textAnchor="middle"
          fill="#000000"
          style={{
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '20px',
            fontStyle: 'italic',
            fontWeight: 800,
            letterSpacing: '-0.05em',
          }}
        >
          RG
        </text>
        <text
          x="40"
          y="56"
          textAnchor="middle"
          fill="#000000"
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.16em',
          }}
        >
          CHAT
        </text>
      </g>
    </svg>
  )
}
