import { useEffect, useState, type CSSProperties } from 'react'
import { rotaGerenciadorHistoricoMtr } from '../../lib/gerenciadorMtrHistorico'
import {
  baixarMtrPorId,
  cancelarMtrPorId,
  listarTicketsHistoricoMtr,
  reativarTicketHistorico,
  type MtrRateioLinha,
  type MtrStatusCiclo,
  type TicketHistoricoRow,
} from '../../lib/mtrCicloVida'
import { ClienteBuscaSelect } from '../clientes/ClienteBuscaSelect'
import { rgConfirm } from '../../lib/RgDialogProvider'
import {
  cargoPodeCancelarBaixarMtr,
  cargoPodeMutarMtrCicloVida,
} from '../../lib/workflowPermissions'

async function confirmarAcaoMtr(opts: {
  title: string
  message: string
  confirmLabel?: string
  variant?: 'default' | 'danger'
}): Promise<boolean> {
  return rgConfirm({
    title: opts.title,
    message: opts.message,
    confirmLabel: opts.confirmLabel ?? 'Continuar',
    cancelLabel: 'Cancelar',
    variant: opts.variant ?? 'default',
  })
}

type Props = {
  mtrId: string
  mtrNumero: string
  status: MtrStatusCiclo | string
  podeMutar?: boolean
  usuarioCargo?: string | null
  usuarioNome?: string | null
  usuarioEmail?: string | null
  onConcluido: () => void
  compact?: boolean
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  zIndex: 12000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
}

const modalStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  maxWidth: '520px',
  width: '100%',
  maxHeight: '90vh',
  overflow: 'auto',
  padding: '20px',
  boxShadow: '0 20px 50px rgba(15,23,42,0.2)',
}

const labelStyle: CSSProperties = { display: 'block', fontWeight: 700, fontSize: '13px', marginBottom: '6px', color: '#334155' }

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  boxSizing: 'border-box',
}

export function MtrCicloVidaAcoes({
  mtrId,
  mtrNumero,
  status,
  podeMutar = true,
  usuarioCargo = null,
  usuarioNome = null,
  usuarioEmail = null,
  onConcluido,
  compact = false,
}: Props) {
  const podeCancelarBaixar =
    podeMutar && cargoPodeCancelarBaixarMtr(usuarioCargo, usuarioNome, usuarioEmail)
  const podeHistorico = podeMutar && cargoPodeMutarMtrCicloVida(usuarioCargo)

  function abrirGerenciadorBaixa() {
    const url = rotaGerenciadorHistoricoMtr(mtrId, mtrNumero)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  const [modal, setModal] = useState<'cancelar' | 'baixar' | 'historico' | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')

  const [justCancel, setJustCancel] = useState('')
  const [cobrarFrete, setCobrarFrete] = useState(false)
  const [valorFrete, setValorFrete] = useState('')
  const [clienteCobrancaId, setClienteCobrancaId] = useState('')

  const [justBaixa, setJustBaixa] = useState('')
  const [cenarioComplexo, setCenarioComplexo] = useState(false)
  const [rateioLinhas, setRateioLinhas] = useState<MtrRateioLinha[]>([
    { cliente_cobranca_id: '', percentual: 100 },
  ])

  const [historico, setHistorico] = useState<TicketHistoricoRow[]>([])

  const stNorm = String(status || 'Emitido')
    .trim()
    .toLowerCase()
  const jaCancelada = stNorm === 'cancelado'
  const jaBaixada = stNorm === 'baixada'

  useEffect(() => {
    if (modal !== 'historico') return
    void listarTicketsHistoricoMtr(mtrId).then(setHistorico)
  }, [modal, mtrId])

  async function executarCancelar() {
    setBusy(true)
    setErro('')
    const res = await cancelarMtrPorId({
      mtrId,
      justificativa: justCancel,
      cobrarFrete,
      valorFrete: cobrarFrete ? Number(String(valorFrete).replace(',', '.')) : null,
      clienteCobrancaId: cobrarFrete ? clienteCobrancaId : null,
    })
    setBusy(false)
    if (!res.ok) {
      setErro(res.message)
      return
    }
    setModal(null)
    onConcluido()
  }

  async function executarBaixa() {
    setBusy(true)
    setErro('')
    const res = await baixarMtrPorId({
      mtrId,
      justificativa: justBaixa,
      cenarioComplexo,
      rateio: cenarioComplexo ? rateioLinhas.filter((l) => l.cliente_cobranca_id) : [],
    })
    setBusy(false)
    if (!res.ok) {
      setErro(res.message)
      return
    }
    setModal(null)
    onConcluido()
  }

  async function executarReativar(histId: string) {
    setBusy(true)
    setErro('')
    const res = await reativarTicketHistorico(histId)
    setBusy(false)
    if (!res.ok) {
      setErro(res.message)
      return
    }
    setHistorico((prev) => prev.filter((h) => h.id !== histId))
    onConcluido()
  }

  if (!podeCancelarBaixar && !podeHistorico && !jaBaixada) return null

  const btnStyle: CSSProperties = compact
    ? { fontSize: '12px', padding: '4px 8px' }
    : { fontSize: '13px', padding: '6px 10px' }

  return (
    <>
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', marginLeft: compact ? 0 : 8 }}>
        {podeCancelarBaixar && !jaCancelada && !jaBaixada ? (
          <>
            <button
              type="button"
              className="mini-btn"
              style={btnStyle}
              onClick={() => {
                void (async () => {
                  if (
                    !(await confirmarAcaoMtr({
                      title: 'Cancelar MTR',
                      message: `Deseja iniciar o cancelamento da MTR ${mtrNumero}?`,
                      confirmLabel: 'Continuar',
                      variant: 'danger',
                    }))
                  ) {
                    return
                  }
                  setModal('cancelar')
                })()
              }}
            >
              Cancelar MTR
            </button>
            <button
              type="button"
              className="mini-btn"
              style={btnStyle}
              title="Abre o Gerenciador (nova aba) para concluir a baixa no histórico"
              onClick={() => {
                void (async () => {
                  if (
                    !(await confirmarAcaoMtr({
                      title: 'Baixar MTR',
                      message: `Abrir o Gerenciador para concluir a baixa da MTR ${mtrNumero} no histórico?`,
                      confirmLabel: 'Continuar',
                    }))
                  ) {
                    return
                  }
                  abrirGerenciadorBaixa()
                })()
              }}
            >
              Baixar MTR
            </button>
          </>
        ) : null}
        {podeCancelarBaixar && jaBaixada ? (
          <button
            type="button"
            className="mini-btn"
            style={btnStyle}
            title="Ver esta MTR no histórico de baixadas"
            onClick={() => {
              void (async () => {
                if (
                  !(await confirmarAcaoMtr({
                    title: 'Ver baixa',
                    message: `Abrir o histórico de baixa da MTR ${mtrNumero} no Gerenciador?`,
                    confirmLabel: 'Continuar',
                  }))
                ) {
                  return
                }
                abrirGerenciadorBaixa()
              })()
            }}
          >
            Ver baixa
          </button>
        ) : null}
        {podeHistorico ? (
          <button
            type="button"
            className="mini-btn"
            style={btnStyle}
            onClick={() => {
              void (async () => {
                if (
                  !(await confirmarAcaoMtr({
                    title: 'Histórico de tickets',
                    message: `Consultar o histórico de tickets da MTR ${mtrNumero}?`,
                    confirmLabel: 'Continuar',
                  }))
                ) {
                  return
                }
                setModal('historico')
              })()
            }}
          >
            Histórico tickets
          </button>
        ) : null}
      </span>

      {modal ? (
        <div style={overlayStyle} role="dialog" aria-modal="true">
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: '17px' }}>
              {modal === 'cancelar' && `Cancelar MTR ${mtrNumero}`}
              {modal === 'baixar' && `Baixar MTR ${mtrNumero}`}
              {modal === 'historico' && `Histórico de tickets — MTR ${mtrNumero}`}
            </h3>

            {modal === 'cancelar' ? (
              <>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0 }}>
                  Sem custos atrelados (faturamento emitido), o ticket é arquivado e removido da coleta. Com custos,
                  a MTR é cancelada mas o histórico financeiro é preservado.
                </p>
                <label style={labelStyle}>Justificativa *</label>
                <textarea
                  value={justCancel}
                  onChange={(e) => setJustCancel(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Motivo do cancelamento…"
                />
                <label style={{ ...labelStyle, marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={cobrarFrete} onChange={(e) => setCobrarFrete(e.target.checked)} />
                  Cobrar frete / custo operacional (cliente não recebeu no local)
                </label>
                {cobrarFrete ? (
                  <div style={{ marginTop: '10px' }}>
                    <label style={labelStyle}>Valor (R$) *</label>
                    <input
                      type="text"
                      value={valorFrete}
                      onChange={(e) => setValorFrete(e.target.value)}
                      style={inputStyle}
                      placeholder="0,00"
                    />
                    <label style={{ ...labelStyle, marginTop: '10px' }}>Cliente a cobrar *</label>
                    <ClienteBuscaSelect
                      value={clienteCobrancaId}
                      onChange={setClienteCobrancaId}
                      placeholder="Pesquisar cliente por nome…"
                      style={inputStyle}
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {modal === 'baixar' ? (
              <>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0 }}>
                  A justificativa é obrigatória. No cenário complexo, defina para quem cobrar (coletado de um cliente,
                  cobrado de outro).
                </p>
                <label style={labelStyle}>Justificativa / observação *</label>
                <textarea
                  value={justBaixa}
                  onChange={(e) => setJustBaixa(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Descreva a baixa no sistema…"
                />
                <label style={{ ...labelStyle, marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={cenarioComplexo}
                    onChange={(e) => setCenarioComplexo(e.target.checked)}
                  />
                  Cenário complexo (rateio entre clientes)
                </label>
                {cenarioComplexo ? (
                  <div style={{ marginTop: '10px' }}>
                    {rateioLinhas.map((linha, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 100px auto',
                          gap: '8px',
                          marginBottom: '8px',
                          alignItems: 'end',
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Cobrar de</label>
                          <ClienteBuscaSelect
                            value={linha.cliente_cobranca_id}
                            onChange={(clienteId) => {
                              const next = [...rateioLinhas]
                              next[idx] = { ...next[idx], cliente_cobranca_id: clienteId }
                              setRateioLinhas(next)
                            }}
                            placeholder="Pesquisar cliente por nome…"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>%</label>
                          <input
                            type="text"
                            value={linha.percentual ?? ''}
                            onChange={(e) => {
                              const next = [...rateioLinhas]
                              next[idx] = {
                                ...next[idx],
                                percentual: Number(String(e.target.value).replace(',', '.')) || 0,
                              }
                              setRateioLinhas(next)
                            }}
                            style={inputStyle}
                          />
                        </div>
                        {rateioLinhas.length > 1 ? (
                          <button
                            type="button"
                            className="mini-btn mini-btn-danger"
                            onClick={() => setRateioLinhas(rateioLinhas.filter((_, i) => i !== idx))}
                          >
                            ×
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() =>
                        setRateioLinhas([...rateioLinhas, { cliente_cobranca_id: '', percentual: 0 }])
                      }
                    >
                      + Linha de cobrança
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {modal === 'historico' ? (
              historico.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#64748b' }}>Nenhum ticket arquivado para esta MTR.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {historico.map((h) => {
                    const snap = h.ticket_snapshot as { numero?: string; tipo_ticket?: string }
                    return (
                      <li
                        key={h.id}
                        style={{
                          padding: '10px 0',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span style={{ fontSize: '13px' }}>
                          Ticket {snap.numero || '—'} ({snap.tipo_ticket || 'saida'}) — {h.motivo}
                        </span>
                        <button
                          type="button"
                          className="mini-btn"
                          disabled={busy}
                          onClick={() => void executarReativar(h.id)}
                        >
                          Reativar
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )
            ) : null}

            {erro ? (
              <p style={{ color: '#b91c1c', fontSize: '13px', marginTop: '12px' }}>{erro}</p>
            ) : null}

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="mini-btn" disabled={busy} onClick={() => setModal(null)}>
                Fechar
              </button>
              {modal === 'cancelar' ? (
                <button
                  type="button"
                  className="mini-btn mini-btn-danger"
                  disabled={busy}
                  onClick={() => void executarCancelar()}
                >
                  {busy ? 'A processar…' : 'Confirmar cancelamento'}
                </button>
              ) : null}
              {modal === 'baixar' ? (
                <button type="button" className="mini-btn" disabled={busy} onClick={() => void executarBaixa()}>
                  {busy ? 'A processar…' : 'Concluir baixa'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
