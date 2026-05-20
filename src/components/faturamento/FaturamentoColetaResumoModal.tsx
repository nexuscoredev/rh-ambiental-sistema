import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  formatarEtapaParaUI,
  formatarFaseFluxoOficialParaUI,
  normalizarEtapaColeta,
} from '../../lib/fluxoEtapas'
import { rotuloConferenciaResumo } from '../../lib/faturamentoOperacionalFila'
import {
  montarParamsFluxoColeta,
  type FaturamentoResumoViewRow,
} from '../../lib/faturamentoResumo'
import { abrirPdfTicketOperacional } from '../../lib/ticketOperacionalPdf'

type Props = {
  open: boolean
  row: FaturamentoResumoViewRow | null
  onClose: () => void
}

function fmtData(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtValor(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPeso(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`
}

const labelStyle: CSSProperties = {
  fontWeight: 700,
  color: '#64748b',
  display: 'block',
  marginBottom: '4px',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const valorStyle: CSSProperties = { fontSize: '14px', color: '#0f172a', lineHeight: 1.45 }

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '14px 16px',
}

const secaoTitStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '13px',
  fontWeight: 800,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const btnNavStyle: CSSProperties = {
  background: '#ffffff',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={valorStyle}>{children}</div>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: '20px' }}>
      <h3 style={secaoTitStyle}>{titulo}</h3>
      {children}
    </section>
  )
}

export function FaturamentoColetaResumoModal({ open, row, onClose }: Props) {
  const navigate = useNavigate()
  const [abrindoPdf, setAbrindoPdf] = useState(false)

  const etapaUi = useMemo(() => {
    if (!row) return { fase: '—', etapa: '—' }
    const etapa = normalizarEtapaColeta({
      fluxo_status: row.fluxo_status,
      etapa_operacional: row.etapa_operacional,
    })
    return {
      fase: formatarFaseFluxoOficialParaUI(etapa, { statusPagamento: row.status_pagamento }),
      etapa: formatarEtapaParaUI(etapa),
    }
  }, [row])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !row) return null

  const params = montarParamsFluxoColeta(row)
  const valorFat = row.faturamento_registro_valor ?? row.valor_coleta

  async function handleVisualizarTicket() {
    setAbrindoPdf(true)
    const res = await abrirPdfTicketOperacional(row!)
    setAbrindoPdf(false)
    if (!res.ok) window.alert(res.message ?? 'Não foi possível abrir o PDF do ticket.')
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="fat-resumo-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12050,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: 'min(92vh, 820px)',
          overflow: 'auto',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.2)',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 id="fat-resumo-titulo" style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              Resumo do caso
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b' }}>
              Coleta <strong>{row.numero_coleta ?? row.numero}</strong> — {row.cliente_nome || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              width: '36px',
              height: '36px',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#475569',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          <Secao titulo="Identificação">
            <div style={gridStyle}>
              <Campo label="Nº coleta">{row.numero_coleta ?? row.numero}</Campo>
              <Campo label="Cliente">{row.cliente_nome || '—'}</Campo>
              <Campo label="Razão social">{row.cliente_razao_social?.trim() || '—'}</Campo>
              <Campo label="Cidade">{row.cidade || '—'}</Campo>
              <Campo label="Resíduo">{row.tipo_residuo || '—'}</Campo>
              <Campo label="Situação faturamento">
                <span
                  style={{
                    display: 'inline-flex',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 800,
                    background: '#dcfce7',
                    color: '#15803d',
                  }}
                >
                  {row.status_faturamento?.trim() || row.faturamento_registro_status?.trim() || 'Faturado'}
                </span>
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Operacional">
            <div style={gridStyle}>
              <Campo label="Programação">
                {row.programacao_numero || '—'}
                {row.data_programacao ? (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {fmtData(row.data_programacao)}
                  </div>
                ) : null}
              </Campo>
              <Campo label="MTR">{row.mtr_numero || '—'}</Campo>
              <Campo label="Ticket / comprovante">{row.ticket_comprovante?.trim() || '—'}</Campo>
              <Campo label="Peso tara">{fmtPeso(row.peso_tara)}</Campo>
              <Campo label="Peso bruto">{fmtPeso(row.peso_bruto)}</Campo>
              <Campo label="Peso líquido">{fmtPeso(row.peso_liquido)}</Campo>
              <Campo label="Motorista / placa">
                {row.motorista || '—'} · {row.placa || '—'}
              </Campo>
              <Campo label="Data agendada">{fmtData(row.data_agendada)}</Campo>
              <Campo label="Data execução (coleta)">{fmtData(row.data_execucao)}</Campo>
              <Campo label="Fase do fluxo">
                <span style={{ fontWeight: 700, color: '#0f766e' }}>{etapaUi.fase}</span>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{etapaUi.etapa}</div>
              </Campo>
            </div>
            {row.programacao_observacoes || row.mtr_observacoes ? (
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                {row.programacao_observacoes ? (
                  <div style={{ marginBottom: '6px' }}>
                    <strong>Obs. programação:</strong> {row.programacao_observacoes}
                  </div>
                ) : null}
                {row.mtr_observacoes ? (
                  <div>
                    <strong>Obs. MTR:</strong> {row.mtr_observacoes}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Secao>

          <Secao titulo="Conferência e ticket">
            <div style={gridStyle}>
              <Campo label="Conferência (status)">{rotuloConferenciaResumo(row)}</Campo>
              <Campo label="Conferência em">{fmtDataHora(row.conferencia_em)}</Campo>
              <Campo label="Docs conferidos">
                {row.conferencia_documentos_ok === true
                  ? 'Sim'
                  : row.conferencia_documentos_ok === false
                    ? 'Pendente'
                    : '—'}
              </Campo>
              <Campo label="Ticket impresso">{fmtDataHora(row.ticket_impresso_em)}</Campo>
              <Campo label="Ticket aprovado (faturamento)">
                {fmtDataHora(row.faturamento_ticket_aprovado_em)}
              </Campo>
              <Campo label="Última aprovação diretoria">
                {row.ultima_aprovacao_decisao?.trim() || '—'}
                {row.ultima_aprovacao_em ? (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {fmtDataHora(row.ultima_aprovacao_em)}
                  </div>
                ) : null}
              </Campo>
            </div>
            {row.pendencias_resumo?.trim() ? (
              <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#b45309', fontWeight: 600 }}>
                Pendências: {row.pendencias_resumo.trim()}
              </p>
            ) : null}
            {row.conferencia_operacional_obs?.trim() ? (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#475569' }}>
                <strong>Obs. conferência:</strong> {row.conferencia_operacional_obs.trim()}
              </p>
            ) : null}
            {row.faturamento_ticket_aprovacao_obs?.trim() ? (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#475569' }}>
                <strong>Obs. aprovação ticket:</strong> {row.faturamento_ticket_aprovacao_obs.trim()}
              </p>
            ) : null}
            {row.ultima_aprovacao_obs?.trim() ? (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#475569' }}>
                <strong>Obs. aprovação:</strong> {row.ultima_aprovacao_obs.trim()}
              </p>
            ) : null}
          </Secao>

          <Secao titulo="Faturamento e financeiro">
            <div style={gridStyle}>
              <Campo label="Valor faturado">{fmtValor(valorFat)}</Campo>
              <Campo label="Registo faturamento">{row.faturamento_registro_status?.trim() || '—'}</Campo>
              <Campo label="Liberado financeiro">{row.liberado_financeiro ? 'Sim' : 'Não'}</Campo>
              <Campo label="Pagamento">{row.status_pagamento?.trim() || '—'}</Campo>
              <Campo label="Vencimento">{fmtData(row.data_vencimento)}</Campo>
              <Campo label="Confirmação recebimento">
                {row.confirmacao_recebimento ? 'Sim' : 'Não'}
              </Campo>
              {row.conta_receber_nf_enviada_em ? (
                <Campo label="NF enviada (conta)">{fmtDataHora(row.conta_receber_nf_enviada_em)}</Campo>
              ) : null}
              {row.conta_receber_valor_pago != null ? (
                <Campo label="Valor pago (conta)">{fmtValor(row.conta_receber_valor_pago)}</Campo>
              ) : null}
            </div>
            {row.conta_receber_nf_envio_obs?.trim() ? (
              <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#475569' }}>
                <strong>Obs. envio NF:</strong> {row.conta_receber_nf_envio_obs.trim()}
              </p>
            ) : null}
          </Secao>

          {row.coleta_observacoes?.trim() ? (
            <Secao titulo="Observações da coleta">
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {row.coleta_observacoes.trim()}
              </p>
            </Secao>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              style={btnNavStyle}
              onClick={() => navigate(`/programacao?${params.toString()}`)}
            >
              Abrir programação
            </button>
            <button type="button" style={btnNavStyle} onClick={() => navigate(`/mtr?${params.toString()}`)}>
              Abrir MTR
            </button>
            <button
              type="button"
              style={btnNavStyle}
              onClick={() => navigate(`/controle-massa?${params.toString()}`)}
            >
              Controle de massa
            </button>
            <button
              type="button"
              style={{ ...btnNavStyle, background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' }}
              disabled={abrindoPdf}
              onClick={() => void handleVisualizarTicket()}
            >
              {abrindoPdf ? 'A abrir PDF…' : 'Visualizar ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
