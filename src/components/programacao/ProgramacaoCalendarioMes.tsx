import { useMemo, type CSSProperties } from 'react'
import {
  STATUS_LABELS,
  getStatusStyle,
  type ProgramacaoStatus,
} from '../../lib/programacaoStatusVisual'

export type ProgramacaoCalendarioItemPreview = {
  id: string
  clienteNome: string
  tipoServico?: string
  caminhaoPlaca?: string
  tipoCaminhao?: string
  coletaFixa: boolean
  statusProgramacao: ProgramacaoStatus
}

export type ProgramacaoCalendarioCell = {
  key: string
  date: string | null
  dayNumber: number | null
  items: ProgramacaoCalendarioItemPreview[]
  isCurrentMonth: boolean
  isToday: boolean
}

const CALENDAR_PREVIEW_MAX = 2

const STATUS_LEGEND_ORDER: ProgramacaoStatus[] = [
  'PENDENTE',
  'QUADRO_ATUALIZADO',
  'EM_COLETA',
  'CONCLUIDA',
  'CANCELADA',
]

function addMonthsYyyyMm(yyyyMm: string, deltaMonths: number): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const d = new Date(y, m - 1 + deltaMonths, 1)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}`
}

function textoServicoCalendario(item: ProgramacaoCalendarioItemPreview): string | null {
  const t = (item.tipoServico || '').trim()
  if (!t) return null
  if (t.toLowerCase() === 'coleta') return null
  return t
}

function isWeekendIso(date: string): boolean {
  const dow = new Date(`${date}T12:00:00`).getDay()
  return dow === 0 || dow === 6
}

function tituloItemCalendario(item: ProgramacaoCalendarioItemPreview): string {
  const sec = textoServicoCalendario(item)
  const veic =
    (item.caminhaoPlaca || '').trim() ||
    ((item.tipoCaminhao || '').trim() ? (item.tipoCaminhao || '').trim() : '')
  const parts = [item.clienteNome]
  if (sec) parts.push(sec)
  if (veic) parts.push(veic)
  parts.push(STATUS_LABELS[item.statusProgramacao])
  return parts.join(' Â· ')
}

function CalendarioStatusDensityBar({ items }: { items: ProgramacaoCalendarioItemPreview[] }) {
  const segments = useMemo(() => {
    const counts = new Map<ProgramacaoStatus, number>()
    for (const item of items) {
      counts.set(item.statusProgramacao, (counts.get(item.statusProgramacao) ?? 0) + 1)
    }
    return STATUS_LEGEND_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((status) => ({
      status,
      count: counts.get(status) ?? 0,
      color: getStatusStyle(status).stripeColor,
    }))
  }, [items])

  if (segments.length === 0) return null

  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        height: 3,
        borderRadius: 999,
        overflow: 'hidden',
        background: '#e2e8f0',
        marginTop: 2,
      }}
    >
      {segments.map((seg) => (
        <span
          key={seg.status}
          style={{
            flex: seg.count,
            minWidth: seg.count > 0 ? 3 : 0,
            background: seg.color,
          }}
        />
      ))}
    </div>
  )
}

type ProgramacaoCalendarioMesProps = {
  mesSelecionado: string
  monthTitle: string
  cells: ProgramacaoCalendarioCell[]
  contextoDestaqueId?: string | null
  onMesChange: (mes: string) => void
  onAbrirDia: (date: string, mesDoDia: string) => void
  showMonthNav?: boolean
}

export default function ProgramacaoCalendarioMes({
  mesSelecionado,
  monthTitle,
  cells,
  contextoDestaqueId = null,
  onMesChange,
  onAbrirDia,
  showMonthNav = true,
}: ProgramacaoCalendarioMesProps) {
  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {showMonthNav ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          <button
            type="button"
            aria-label="MÃªs anterior"
            title="MÃªs anterior"
            onClick={() => onMesChange(addMonthsYyyyMm(mesSelecionado, -1))}
            style={navBtnStyle}
          >
            â€¹
          </button>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 'clamp(17px, 2.4vw, 22px)',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {monthTitle}
          </div>
          <button
            type="button"
            aria-label="PrÃ³ximo mÃªs"
            title="PrÃ³ximo mÃªs"
            onClick={() => onMesChange(addMonthsYyyyMm(mesSelecionado, 1))}
            style={navBtnStyle}
          >
            â€º
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 14px',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748b',
        }}
        aria-label="Legenda de status"
      >
        {STATUS_LEGEND_ORDER.map((status) => {
          const s = getStatusStyle(status)
          return (
            <span
              key={status}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: s.dotColor,
                  flexShrink: 0,
                }}
              />
              {STATUS_LABELS[status]}
            </span>
          )
        })}
      </div>

      <div style={weekHeaderStyle}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'SÃ¡b', 'Dom'].map((day, idx) => (
          <div
            key={day}
            style={{
              ...weekDayStyle,
              color: idx >= 5 ? '#94a3b8' : '#64748b',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      <div style={gridStyle}>
        {cells.map((cell) => {
          const destaqueContexto =
            !!contextoDestaqueId && cell.items.some((i) => i.id === contextoDestaqueId)
          const podeAbrirPainelDia = Boolean(cell.date)
          const fimDeSemana = cell.date ? isWeekendIso(cell.date) : false

          const abrirPainelDia = () => {
            if (!cell.date) return
            onAbrirDia(cell.date, cell.date.slice(0, 7))
          }

          const cellBg = !cell.isCurrentMonth
            ? '#fafafa'
            : fimDeSemana
              ? '#f8fafc'
              : '#ffffff'

          return (
            <div
              key={cell.key}
              role={podeAbrirPainelDia ? 'button' : undefined}
              tabIndex={podeAbrirPainelDia ? 0 : undefined}
              onClick={abrirPainelDia}
              onKeyDown={(e) => {
                if (!podeAbrirPainelDia || !cell.date) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  abrirPainelDia()
                }
              }}
              style={{
                ...cellStyle,
                background: cellBg,
                opacity: cell.isCurrentMonth ? 1 : 0.45,
                borderColor: destaqueContexto
                  ? '#22c55e'
                  : cell.isToday
                    ? '#86efac'
                    : '#e8ecf1',
                boxShadow: destaqueContexto
                  ? '0 0 0 2px rgba(34, 197, 94, 0.28)'
                  : cell.isToday
                    ? 'inset 0 0 0 1px rgba(34, 197, 94, 0.35)'
                    : 'none',
                cursor: podeAbrirPainelDia ? 'pointer' : 'default',
              }}
              aria-label={
                podeAbrirPainelDia && cell.dayNumber
                  ? `Dia ${cell.dayNumber}, ${cell.items.length} programaÃ§Ã£o(Ãµes). Clique para detalhes.`
                  : undefined
              }
            >
              {cell.dayNumber ? (
                <>
                  <div style={cellTopStyle}>
                    <span
                      style={{
                        ...dayNumberStyle,
                        background: cell.isToday ? '#16a34a' : 'transparent',
                        color: cell.isToday ? '#ffffff' : '#334155',
                        fontWeight: cell.isToday ? 800 : 700,
                      }}
                    >
                      {cell.dayNumber}
                    </span>
                    {cell.items.length > 0 ? (
                      <span style={countPillStyle}>{cell.items.length}</span>
                    ) : null}
                  </div>

                  {cell.items.length > 0 ? (
                    <div style={itemsListStyle}>
                      {cell.items.slice(0, CALENDAR_PREVIEW_MAX).map((item) => {
                        const statusStyle = getStatusStyle(item.statusProgramacao)
                        return (
                          <div
                            key={item.id}
                            style={previewRowStyle}
                            title={tituloItemCalendario(item)}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: statusStyle.stripeColor,
                                flexShrink: 0,
                              }}
                              aria-hidden
                            />
                            <span style={previewTextStyle}>{item.clienteNome}</span>
                            {item.coletaFixa ? (
                              <span style={fixaBadgeStyle} title="Coleta fixa">
                                F
                              </span>
                            ) : null}
                          </div>
                        )
                      })}

                      {cell.items.length > CALENDAR_PREVIEW_MAX ? (
                        <div style={overflowStyle}>
                          +{cell.items.length - CALENDAR_PREVIEW_MAX} mais
                        </div>
                      ) : null}

                      {cell.items.length >= 4 ? (
                        <CalendarioStatusDensityBar items={cell.items} />
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const navBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  color: '#334155',
  fontSize: 20,
  fontWeight: 700,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const weekHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: '6px',
}

const weekDayStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: '6px',
}

const cellStyle: CSSProperties = {
  minHeight: '84px',
  border: '1px solid #e8ecf1',
  borderRadius: '10px',
  padding: '6px 7px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
}

const cellTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '4px',
}

const dayNumberStyle: CSSProperties = {
  minWidth: '24px',
  height: '24px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
}

const countPillStyle: CSSProperties = {
  minWidth: '18px',
  height: '18px',
  borderRadius: 999,
  padding: '0 5px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f1f5f9',
  color: '#475569',
  fontSize: '10px',
  fontWeight: 800,
}

const itemsListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  flex: 1,
  minHeight: 0,
}

const previewRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  minWidth: 0,
}

const previewTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: '10px',
  fontWeight: 600,
  color: '#334155',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.25,
}

const fixaBadgeStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: '8px',
  fontWeight: 800,
  color: '#c2410c',
  lineHeight: 1,
}

const overflowStyle: CSSProperties = {
  fontSize: '9px',
  color: '#94a3b8',
  fontWeight: 700,
  textAlign: 'center',
  marginTop: 1,
}


