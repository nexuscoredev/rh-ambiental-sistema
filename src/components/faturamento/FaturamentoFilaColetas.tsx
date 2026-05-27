import { useMemo, useState, type ReactNode } from 'react'
import type { CSSProperties } from 'react'
import {
  agruparFilaFaturamentoPorMtr,
  resolverGrupoFaturamentoNaFila,
  type ItemFilaFaturamento,
} from '../../lib/faturamentoConsolidacaoMtr'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import { devolverTicketParaFilaConferenciaColeta } from '../../lib/faturamentoTicketFluxo'
import {
  coletaFaturamentoSlaVencido,
  rotuloConferenciaResumo,
  statusFaturamentoUi,
} from '../../lib/faturamentoOperacionalFila'
import { useRgDialog } from '../../lib/RgDialogProvider'
import { useClienteEmpresaGrupoFaturamentoMap } from '../../hooks/useClienteEmpresaGrupoFaturamentoMap'
import { FaturamentoEmpresaGrupoMeta } from './FaturamentoEmpresaGrupoMeta'

const R = { sm: '4px', md: '6px', lg: '8px' } as const

const wrap: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: R.lg,
  padding: '20px 22px',
  marginBottom: '20px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
}

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#64748b',
  padding: '10px 12px',
  borderBottom: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const td: CSSProperties = {
  padding: '12px',
  fontSize: '13px',
  color: '#0f172a',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
}

const FAT = {
  teal: '#0d9488',
  tealBg: '#f0fdfa',
  tealBorder: '#99f6e4',
  violet: '#5b21b6',
  violetBg: '#ede9fe',
  violetBorder: '#a78bfa',
  ink: '#0f172a',
  inkMuted: '#64748b',
  surface: '#ffffff',
  line: '#e2e8f0',
} as const

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: R.sm,
  fontWeight: 800,
  lineHeight: 1.2,
  boxSizing: 'border-box',
}

const btnPrimario: CSSProperties = {
  padding: '8px 14px',
  borderRadius: R.md,
  border: '1px solid #0f766e',
  background: FAT.teal,
  color: '#fff',
  fontWeight: 800,
  fontSize: '12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxShadow: '0 1px 0 rgba(15, 118, 110, 0.35)',
}

const btnSecundario: CSSProperties = {
  padding: '8px 12px',
  borderRadius: R.md,
  border: `1px solid ${FAT.line}`,
  background: FAT.surface,
  color: FAT.inkMuted,
  fontWeight: 700,
  fontSize: '11px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function CelulaColetasConsolidadas({
  coletas,
}: {
  coletas: {
    coleta_id: string
    numero_coleta: number | null
    numero: string
    tipo_residuo: string
    ticket_comprovante?: string | null
    peso_liquido?: number | null
  }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
      <span
        style={{
          ...chipBase,
          alignSelf: 'flex-start',
          padding: '4px 8px',
          background: FAT.violetBg,
          border: `1px solid ${FAT.violetBorder}`,
          color: FAT.violet,
          fontSize: '10px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {coletas.length} tickets · 1 faturamento
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {coletas.map((c) => (
          <span
            key={c.coleta_id}
            title={(c.ticket_comprovante ?? '').trim() ? `Ticket ${(c.ticket_comprovante ?? '').trim()}` : undefined}
            style={{
              ...chipBase,
              padding: '4px 10px',
              background: FAT.surface,
              border: `1px solid ${FAT.line}`,
              color: FAT.ink,
              fontSize: '12px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.numero_coleta ?? c.numero}
          </span>
        ))}
      </div>
    </div>
  )
}

function CelulaResiduosConsolidados({
  coletas,
}: {
  coletas: { coleta_id: string; tipo_residuo: string; peso_liquido?: number | null }[]
}) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {coletas.map((c) => (
        <li
          key={c.coleta_id}
          style={{
            fontSize: '12px',
            lineHeight: 1.4,
            color: FAT.ink,
            paddingLeft: '10px',
            borderLeft: `3px solid ${FAT.violetBorder}`,
          }}
        >
          <span style={{ fontWeight: 700, color: FAT.teal }}>{fmtPeso(c.peso_liquido)}</span>
          <span style={{ color: FAT.inkMuted }}> · </span>
          {c.tipo_residuo || '—'}
        </li>
      ))}
    </ul>
  )
}

function ChipFaturamento({
  children,
  variant,
}: {
  children: ReactNode
  variant: 'consolidado' | 'pendente' | 'faturado' | 'sla'
}) {
  const styles: Record<typeof variant, CSSProperties> = {
    consolidado: {
      background: '#ecfdf5',
      color: '#047857',
      border: '1px solid #6ee7b7',
    },
    pendente: { background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' },
    faturado: { background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' },
    sla: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  }
  return (
    <span
      style={{
        ...chipBase,
        padding: '5px 8px',
        fontSize: '10px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        ...styles[variant],
      }}
    >
      {children}
    </span>
  )
}

type Props = {
  linhas: FaturamentoResumoViewRow[]
  carregando: boolean
  onFaturar: (coletaId: string) => void | Promise<void>
  emitindoColetaId?: string | null
  /** Após devolver à fila de conferência/aprovação do ticket. */
  onDevolvidoConferencia?: () => void
  podeDevolverConferencia?: boolean
  titulo?: string
  subtitulo?: string
  mensagemVazia?: string
  rotuloBotao?: string
  /** Uma linha por MTR quando há vários tickets (faturamento consolidado). */
  agruparPorMtr?: boolean
}

function fmtData(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function fmtPeso(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`
}

function fmtValor(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n)) || Number(n) <= 0) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function CelulaClienteFaturamento({
  clienteId,
  clienteNome,
  rotulos,
  indisponivel,
}: {
  clienteId: string
  clienteNome: string
  rotulos: Record<string, string>
  indisponivel: boolean
}) {
  const rotulo = rotulos[clienteId.trim()] ?? null
  return (
    <div style={{ minWidth: '120px' }}>
      <div>{clienteNome || '—'}</div>
      <FaturamentoEmpresaGrupoMeta rotulo={rotulo} indisponivel={indisponivel} />
    </div>
  )
}

function textoPendencias(resumo: string | null | undefined, max = 56) {
  const t = (resumo ?? '').trim()
  if (!t) return '—'
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function FaturamentoFilaColetas({
  linhas,
  carregando,
  onFaturar,
  onDevolvidoConferencia,
  podeDevolverConferencia = false,
  titulo = 'Fila para faturar',
  subtitulo =
    'Medição e valores já conferidos. Use o botão para confirmar a emissão e avançar na esteira (Mala Direta → NF/boleto). Os cálculos foram guardados na etapa «Ajuste de valores» — aqui não se editam ticket nem MTR.',
  mensagemVazia = 'Nenhuma coleta aprovada aguardando faturamento.',
  rotuloBotao = 'Confirmar e avançar',
  agruparPorMtr = true,
  emitindoColetaId = null,
}: Props) {
  const { confirm, alert, prompt } = useRgDialog()
  const [devolvendoId, setDevolvendoId] = useState<string | null>(null)

  const itensFila = useMemo(
    () => (agruparPorMtr ? agruparFilaFaturamentoPorMtr(linhas) : linhas.map((row) => ({ kind: 'unico' as const, row }))),
    [linhas, agruparPorMtr]
  )

  const clienteIdsFila = useMemo(
    () => linhas.map((r) => r.cliente_id).filter(Boolean),
    [linhas]
  )
  const { rotulos: rotulosEmpresaGrupo, indisponivel: empresaGrupoIndisponivel } =
    useClienteEmpresaGrupoFaturamentoMap(clienteIdsFila)

  async function handleDevolver(row: FaturamentoResumoViewRow) {
    if (!podeDevolverConferencia) return
    const grupo = resolverGrupoFaturamentoNaFila(row.coleta_id, linhas)
    const n = row.numero_coleta ?? row.numero
    const mtr = (row.mtr_numero ?? '').trim()
    const ok = await confirm(
      grupo.length > 1
        ? {
            title: 'Devolver tickets à conferência',
            message: `Devolver os ${grupo.length} tickets da MTR ${mtr || '—'} à fila de conferência?`,
            details: [
              `Coletas: ${grupo.map((c) => c.numero_coleta ?? c.numero).join(', ')}.`,
              'A aprovação do Faturamento será anulada em todas; cada ticket voltará a aguardar validação antes de faturar (consolidam só na fila de faturamento).',
            ],
            confirmLabel: 'Devolver',
            variant: 'warning',
          }
        : {
            title: 'Devolver à conferência do ticket',
            message: `Devolver a coleta ${n} à fila de conferência do ticket?`,
            details: [
              'A aprovação do Faturamento será anulada e a coleta voltará a aguardar validação antes de faturar.',
            ],
            confirmLabel: 'Devolver',
            variant: 'warning',
          }
    )
    if (!ok) return

    const motivoInput = await prompt({
      title: 'Motivo da devolução',
      message: 'Opcional — ficará registado na devolução.',
      defaultValue: '',
      placeholder: 'Ex.: peso divergente, ticket incorreto…',
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
    })
    if (motivoInput === null) return
    const motivo = motivoInput
    setDevolvendoId(row.coleta_id)
    const res = await devolverTicketParaFilaConferenciaColeta(row.coleta_id, motivo)
    setDevolvendoId(null)

    if (!res.ok) {
      await alert({ title: 'Devolução à conferência', message: res.message, variant: 'danger' })
      return
    }
    if (res.coletasAfetadas > 1) {
      await alert({
        title: 'Devolução concluída',
        message: `${res.coletasAfetadas} tickets da mesma MTR foram devolvidos à fila de conferência.`,
        variant: 'success',
      })
    }
    onDevolvidoConferencia?.()
  }

  return (
    <div style={{ ...wrap, borderTop: '4px solid #0d9488' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{titulo}</h2>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b', maxWidth: '900px', lineHeight: 1.55 }}>
            {subtitulo}
          </p>
        </div>
      </div>

      {carregando ? (
        <p style={{ color: '#64748b', fontSize: '14px' }}>Carregando dados…</p>
      ) : itensFila.length === 0 ? (
        <div
          style={{
            padding: '28px 20px',
            textAlign: 'center',
            borderRadius: R.lg,
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            color: '#64748b',
            fontSize: '14px',
          }}
        >
          {mensagemVazia}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: R.lg, border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1020px' }}>
            <thead>
              <tr>
                <th style={{ ...th, minWidth: '140px' }}>Faturar (tickets)</th>
                <th style={th}>Cliente</th>
                <th style={th}>MTR</th>
                <th style={th}>Resíduo</th>
                <th style={th}>Peso líq.</th>
                <th style={th}>Data</th>
                <th style={th}>Valor (ref.)</th>
                <th style={th}>Conferência</th>
                <th style={th}>Faturamento</th>
                <th style={{ ...th, maxWidth: '240px' }}>Pendências</th>
                <th style={{ ...th, textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {itensFila.map((item) => (
                <LinhaFilaFaturamento
                  key={item.kind === 'mtr' ? `mtr-${item.mtr_id}` : item.row.coleta_id}
                  item={item}
                  devolvendoId={devolvendoId}
                  podeDevolverConferencia={podeDevolverConferencia}
                  onDevolvidoConferencia={onDevolvidoConferencia}
                  onFaturar={onFaturar}
                  emitindoColetaId={emitindoColetaId}
                  onDevolver={handleDevolver}
                  rotuloBotao={rotuloBotao}
                  rotulosEmpresaGrupo={rotulosEmpresaGrupo}
                  empresaGrupoIndisponivel={empresaGrupoIndisponivel}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LinhaFilaFaturamento({
  item,
  devolvendoId,
  podeDevolverConferencia,
  onDevolvidoConferencia,
  onFaturar,
  emitindoColetaId,
  onDevolver,
  rotuloBotao,
  rotulosEmpresaGrupo,
  empresaGrupoIndisponivel,
}: {
  item: ItemFilaFaturamento
  devolvendoId: string | null
  podeDevolverConferencia: boolean
  onDevolvidoConferencia?: () => void
  onFaturar: (coletaId: string) => void | Promise<void>
  emitindoColetaId?: string | null
  onDevolver: (row: FaturamentoResumoViewRow) => void
  rotuloBotao: string
  rotulosEmpresaGrupo: Record<string, string>
  empresaGrupoIndisponivel: boolean
}) {
  if (item.kind === 'unico') {
    return (
      <LinhaColetaFaturamento
        r={item.row}
        devolvendoId={devolvendoId}
        podeDevolverConferencia={podeDevolverConferencia}
        onDevolvidoConferencia={onDevolvidoConferencia}
        onFaturar={onFaturar}
        emitindoColetaId={emitindoColetaId}
        onDevolver={onDevolver}
        rotuloBotao={rotuloBotao}
        rotulosEmpresaGrupo={rotulosEmpresaGrupo}
        empresaGrupoIndisponivel={empresaGrupoIndisponivel}
      />
    )
  }

  const { coletas, coleta_lider, mtr_numero } = item
  const pesoTotal = coletas.reduce((s, c) => s + (Number(c.peso_liquido) || 0), 0)
  const valorRef = coletas.reduce((s, c) => {
    const v = c.valor_coleta ?? c.faturamento_registro_valor
    return s + (v != null && Number.isFinite(Number(v)) ? Number(v) : 0)
  }, 0)
  const fat = statusFaturamentoUi(coleta_lider)
  const slaCritico =
    coletas.some((c) => coletaFaturamentoSlaVencido(c)) && fat === 'Pendente'
  return (
    <>
      <tr
        style={{
          background: FAT.tealBg,
          ...(slaCritico ? { boxShadow: 'inset 4px 0 0 #dc2626' } : { boxShadow: `inset 4px 0 0 ${FAT.teal}` }),
        }}
      >
        <td style={{ ...td, verticalAlign: 'top', minWidth: '110px' }}>
          <CelulaColetasConsolidadas coletas={coletas} />
        </td>
        <td style={td}>
          <CelulaClienteFaturamento
            clienteId={coleta_lider.cliente_id}
            clienteNome={item.cliente_nome}
            rotulos={rotulosEmpresaGrupo}
            indisponivel={empresaGrupoIndisponivel}
          />
        </td>
        <td style={{ ...td, fontWeight: 700 }}>{mtr_numero}</td>
        <td style={{ ...td, maxWidth: '260px', verticalAlign: 'top' }}>
          <CelulaResiduosConsolidados coletas={coletas} />
        </td>
        <td style={{ ...td, fontWeight: 700, color: FAT.teal, whiteSpace: 'nowrap' }}>
          {fmtPeso(pesoTotal > 0 ? pesoTotal : null)}
          <div style={{ fontSize: '10px', fontWeight: 600, color: FAT.inkMuted, marginTop: '2px' }}>
            total consolidado
          </div>
        </td>
        <td style={td}>{fmtData(coleta_lider.data_execucao || coleta_lider.data_agendada)}</td>
        <td style={{ ...td, fontWeight: 700 }}>{fmtValor(valorRef > 0 ? valorRef : null)}</td>
        <td style={{ ...td, fontWeight: 700, color: '#0f766e' }}>Consolidado</td>
        <td style={td}>
          <ChipFaturamento variant="consolidado">1 faturamento</ChipFaturamento>
        </td>
        <td style={{ ...td, maxWidth: '200px', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
          Caminhão/equip. uma vez
          <br />
          Resíduos somados no valor
        </td>
        <td style={{ ...td, textAlign: 'center', verticalAlign: 'middle', minWidth: '168px' }}>
          <button
            type="button"
            disabled={!!emitindoColetaId}
            onClick={() => void onFaturar(coleta_lider.coleta_id)}
            style={{
              ...btnPrimario,
              width: '100%',
              maxWidth: '200px',
              opacity: emitindoColetaId ? 0.65 : 1,
              cursor: emitindoColetaId ? 'wait' : 'pointer',
            }}
          >
            {emitindoColetaId === coleta_lider.coleta_id ? 'A confirmar…' : rotuloBotao}
          </button>
        </td>
      </tr>
      {onDevolvidoConferencia && podeDevolverConferencia
        ? coletas.map((c) => (
            <tr key={`det-${c.coleta_id}`} style={{ background: '#f8fafc' }}>
              <td colSpan={11} style={{ ...td, padding: '8px 14px 8px 28px', borderBottom: '1px solid #eef2f7' }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px 14px',
                  }}
                >
                  <span style={{ fontSize: '12px', color: FAT.inkMuted }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: FAT.violet, marginRight: '8px' }}>
                      Devolver ticket
                    </span>
                    <strong style={{ color: FAT.ink, fontVariantNumeric: 'tabular-nums' }}>
                      {c.numero_coleta ?? c.numero}
                    </strong>
                    <span style={{ color: FAT.teal, fontWeight: 700 }}> · {fmtPeso(c.peso_liquido)}</span>
                    <span> · {c.tipo_residuo || '—'}</span>
                  </span>
                  <button
                    type="button"
                    disabled={devolvendoId === c.coleta_id}
                    onClick={() => void onDevolver(c)}
                    style={{
                      ...btnSecundario,
                      flexShrink: 0,
                      cursor: devolvendoId === c.coleta_id ? 'wait' : 'pointer',
                      opacity: devolvendoId === c.coleta_id ? 0.7 : 1,
                    }}
                  >
                    {devolvendoId === c.coleta_id ? 'A devolver…' : 'Devolver à conferência'}
                  </button>
                </div>
              </td>
            </tr>
          ))
        : null}
    </>
  )
}

function LinhaColetaFaturamento({
  r,
  devolvendoId,
  podeDevolverConferencia,
  onDevolvidoConferencia,
  onFaturar,
  emitindoColetaId,
  onDevolver,
  rotuloBotao,
  rotulosEmpresaGrupo,
  empresaGrupoIndisponivel,
}: {
  r: FaturamentoResumoViewRow
  devolvendoId: string | null
  podeDevolverConferencia: boolean
  onDevolvidoConferencia?: () => void
  onFaturar: (coletaId: string) => void | Promise<void>
  emitindoColetaId?: string | null
  onDevolver: (row: FaturamentoResumoViewRow) => void
  rotuloBotao: string
  rotulosEmpresaGrupo: Record<string, string>
  empresaGrupoIndisponivel: boolean
}) {
  const fat = statusFaturamentoUi(r)
  const slaCritico = coletaFaturamentoSlaVencido(r) && fat === 'Pendente'

  return (
    <tr
      style={{
        background: '#fafefd',
        ...(slaCritico ? { boxShadow: 'inset 4px 0 0 #dc2626' } : {}),
      }}
    >
      <td style={{ ...td, fontWeight: 800, color: FAT.teal }}>{r.numero_coleta ?? r.numero}</td>
      <td style={td}>
        <CelulaClienteFaturamento
          clienteId={r.cliente_id}
          clienteNome={r.cliente_nome || '—'}
          rotulos={rotulosEmpresaGrupo}
          indisponivel={empresaGrupoIndisponivel}
        />
      </td>
      <td style={td}>{r.mtr_numero || '—'}</td>
      <td style={{ ...td, maxWidth: '200px' }}>{r.tipo_residuo || '—'}</td>
      <td style={td}>{fmtPeso(r.peso_liquido)}</td>
      <td style={td}>{fmtData(r.data_execucao || r.data_agendada)}</td>
      <td style={td}>{fmtValor(r.valor_coleta ?? r.faturamento_registro_valor)}</td>
      <td
        style={{
          ...td,
          fontWeight: 700,
          color: r.status_conferencia === 'PRONTO_PARA_FATURAR' ? '#0f766e' : '#b45309',
        }}
      >
        {rotuloConferenciaResumo(r)}
      </td>
      <td style={td}>
        <span className={slaCritico ? 'rg-faturamento-sla-critico' : undefined}>
          <ChipFaturamento
            variant={slaCritico ? 'sla' : fat === 'Faturado' ? 'faturado' : 'pendente'}
          >
            {fat}
          </ChipFaturamento>
        </span>
      </td>
      <td
        style={{ ...td, maxWidth: '240px', fontSize: '12px', color: '#64748b' }}
        title={r.pendencias_resumo ?? ''}
      >
        {textoPendencias(r.pendencias_resumo)}
      </td>
      <td style={{ ...td, textAlign: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {onDevolvidoConferencia ? (
            <button
              type="button"
              disabled={!podeDevolverConferencia || devolvendoId === r.coleta_id}
              onClick={() => void onDevolver(r)}
              title="Anula a aprovação e devolve à fila de conferência do ticket"
              style={{
                ...btnSecundario,
                color: podeDevolverConferencia ? FAT.inkMuted : '#94a3b8',
                background: podeDevolverConferencia ? FAT.surface : '#f1f5f9',
                cursor:
                  podeDevolverConferencia && devolvendoId !== r.coleta_id ? 'pointer' : 'not-allowed',
              }}
            >
              {devolvendoId === r.coleta_id ? 'A devolver…' : 'Devolver à conferência'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!!emitindoColetaId}
            onClick={() => void onFaturar(r.coleta_id)}
            style={{
              ...btnPrimario,
              opacity: emitindoColetaId ? 0.65 : 1,
              cursor: emitindoColetaId ? 'wait' : 'pointer',
            }}
          >
            {emitindoColetaId === r.coleta_id ? 'A confirmar…' : rotuloBotao}
          </button>
        </div>
      </td>
    </tr>
  )
}
