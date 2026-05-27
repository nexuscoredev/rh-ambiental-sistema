import type { CSSProperties } from 'react'

type Props = {
  ticketsSemMtr: number | null
  rotuloMesVigente?: string | null
}

export function ControleMassaTicketsSemMtrContador({
  ticketsSemMtr,
  rotuloMesVigente,
}: Props) {
  const alerta = ticketsSemMtr != null && ticketsSemMtr > 0
  const rotulo = (rotuloMesVigente ?? '').trim()

  const wrap: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '12px',
    border: `1px solid ${alerta ? '#fcd34d' : '#e2e8f0'}`,
    background: alerta ? '#fffbeb' : '#f8fafc',
    color: alerta ? '#92400e' : '#475569',
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
  }

  const numero: CSSProperties = {
    fontSize: '15px',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    color: alerta ? '#b45309' : '#0f172a',
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={wrap}
      title={
        rotulo
          ? `Coletas/tickets do mês (${rotulo}) sem MTR vinculada — aguardam documento MTR antes da pesagem.`
          : 'Coletas/tickets do mês vigente sem MTR vinculada.'
      }
    >
      <span style={numero}>{ticketsSemMtr ?? '…'}</span>
      <span>na fila sem MTR</span>
    </div>
  )
}
