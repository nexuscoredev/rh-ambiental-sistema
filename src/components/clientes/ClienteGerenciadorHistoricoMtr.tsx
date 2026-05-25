import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import {
  baixarMtrPorId,
  type MtrRateioLinha,
} from '../../lib/mtrCicloVida'
import {
  listarHistoricoMtrsBaixadas,
  type MtrBaixadaHistoricoRow,
} from '../../lib/gerenciadorMtrHistorico'
import { rgAlert } from '../../lib/RgDialogProvider'
import { ClienteBuscaSelect } from './ClienteBuscaSelect'

type Props = {
  baixarMtrId?: string | null
  baixarMtrNumero?: string | null
  onBaixaConcluida?: () => void
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 10px',
  color: '#0f172a',
  fontWeight: 800,
  fontSize: '12px',
  borderBottom: '2px solid #e2e8f0',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '10px',
  verticalAlign: 'middle',
  borderBottom: '1px solid #e2e8f0',
  fontSize: '13px',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '6px',
  color: '#334155',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  boxSizing: 'border-box',
}

export function ClienteGerenciadorHistoricoMtr({
  baixarMtrId,
  baixarMtrNumero,
  onBaixaConcluida,
}: Props) {
  const [rows, setRows] = useState<MtrBaixadaHistoricoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [justBaixa, setJustBaixa] = useState('')
  const [cenarioComplexo, setCenarioComplexo] = useState(false)
  const [rateioLinhas, setRateioLinhas] = useState<MtrRateioLinha[]>([
    { cliente_cobranca_id: '', percentual: 100 },
  ])
  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await listarHistoricoMtrsBaixadas()
    setRows(res.rows)
    setErro(res.erro)
    setLoading(false)
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function executarBaixa() {
    if (!baixarMtrId) return
    setBusy(true)
    const res = await baixarMtrPorId({
      mtrId: baixarMtrId,
      justificativa: justBaixa,
      cenarioComplexo,
      rateio: cenarioComplexo ? rateioLinhas.filter((l) => l.cliente_cobranca_id) : [],
    })
    setBusy(false)
    if (!res.ok) {
      void rgAlert({ title: 'Baixar MTR', message: res.message, variant: 'danger' })
      return
    }
    setJustBaixa('')
    setCenarioComplexo(false)
    void rgAlert({
      title: 'MTR baixada',
      message: `MTR ${baixarMtrNumero || ''} registrada no histórico.`,
      variant: 'success',
    })
    await carregar()
    onBaixaConcluida?.()
  }

  return (
    <div id="historico-mtr-baixadas">
      {baixarMtrId ? (
        <div
          className="alert-box alert-info"
          style={{ marginBottom: '14px' }}
        >
          <strong>Baixa da MTR {baixarMtrNumero || baixarMtrId}</strong>
          <p style={{ margin: '8px 0 12px', fontSize: '13px', lineHeight: 1.45 }}>
            Preencha a justificativa e confirme a baixa. O registo aparecerá no histórico abaixo.
          </p>
          <label style={labelStyle}>Justificativa / observação *</label>
          <textarea
            value={justBaixa}
            onChange={(e) => setJustBaixa(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px' }}
            placeholder="Descreva a baixa no sistema…"
          />
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={cenarioComplexo}
              onChange={(e) => setCenarioComplexo(e.target.checked)}
            />
            Cenário complexo (rateio entre clientes)
          </label>
          {cenarioComplexo ? (
            <div style={{ marginTop: '10px', marginBottom: '10px' }}>
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
                  <ClienteBuscaSelect
                    value={linha.cliente_cobranca_id}
                    onChange={(clienteId) => {
                      const next = [...rateioLinhas]
                      next[idx] = { ...next[idx], cliente_cobranca_id: clienteId }
                      setRateioLinhas(next)
                    }}
                    placeholder="Cliente a cobrar…"
                    style={inputStyle}
                  />
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
                    placeholder="%"
                  />
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
            </div>
          ) : null}
          <button
            type="button"
            className="rg-btn rg-btn--primary"
            disabled={busy}
            onClick={() => void executarBaixa()}
          >
            {busy ? 'A processar…' : 'Confirmar baixa no histórico'}
          </button>
        </div>
      ) : null}

      {erro ? <div className="alert-box alert-warning">{erro}</div> : null}

      {loading ? (
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Carregando histórico…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Nenhuma MTR com status Baixada no sistema.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>MTR baixada</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Gerador</th>
                <th style={thStyle}>Resíduo</th>
                <th style={thStyle}>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={
                    baixarMtrId === r.id
                      ? { background: '#f0fdf4' }
                      : undefined
                  }
                >
                  <td style={tdStyle}>{r.numero || '—'}</td>
                  <td style={tdStyle}>
                    {r.data
                      ? new Date(`${r.data}T12:00:00`).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td style={tdStyle}>{r.gerador || '—'}</td>
                  <td style={tdStyle}>{r.residuo || '—'}</td>
                  <td style={tdStyle}>{r.quantidade || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
