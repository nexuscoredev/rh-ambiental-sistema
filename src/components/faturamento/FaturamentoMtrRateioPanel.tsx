import { useEffect, useState, type CSSProperties } from 'react'
import { listarRateioMtr, salvarRateioMtr, type MtrCobrancaRateioRow, type MtrRateioLinha } from '../../lib/mtrCicloVida'
import { supabase } from '../../lib/supabase'
import { cargoPodeMutarMtrCicloVida } from '../../lib/workflowPermissions'

type ClienteOpt = { id: string; nome: string }

type Props = {
  mtrId: string | null | undefined
  mtrBaixaComplexa?: boolean | null
  usuarioCargo?: string | null
}

const boxStyle: CSSProperties = {
  marginTop: '12px',
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
}

export function FaturamentoMtrRateioPanel({ mtrId, mtrBaixaComplexa, usuarioCargo }: Props) {
  const [linhas, setLinhas] = useState<MtrRateioLinha[]>([])
  const [gravado, setGravado] = useState<MtrCobrancaRateioRow[]>([])
  const [clientes, setClientes] = useState<ClienteOpt[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const podeEditar = cargoPodeMutarMtrCicloVida(usuarioCargo)

  useEffect(() => {
    void supabase
      .from('clientes')
      .select('id, nome')
      .eq('status', 'ativo')
      .order('nome')
      .limit(400)
      .then(({ data }) => {
        setClientes((data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome ?? r.id) })))
      })
  }, [])

  useEffect(() => {
    if (!mtrId || !mtrBaixaComplexa) {
      setGravado([])
      return
    }
    void listarRateioMtr(mtrId).then((rows) => {
      setGravado(rows)
      if (rows.length > 0) {
        setLinhas(
          rows.map((r) => ({
            coleta_id: r.coleta_id,
            cliente_coleta_id: r.cliente_coleta_id,
            cliente_cobranca_id: r.cliente_cobranca_id,
            percentual: r.percentual,
            valor: r.valor,
            observacao: r.observacao,
          }))
        )
      }
    })
  }, [mtrId, mtrBaixaComplexa])

  if (!mtrId || !mtrBaixaComplexa) return null

  async function guardar() {
    if (!mtrId || !podeEditar) return
    setBusy(true)
    setMsg('')
    const res = await salvarRateioMtr(mtrId, linhas.filter((l) => l.cliente_cobranca_id))
    setBusy(false)
    if (!res.ok) {
      setMsg(res.message)
      return
    }
    setMsg('Rateio gravado.')
    setGravado(await listarRateioMtr(mtrId))
  }

  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? id.slice(0, 8)

  return (
    <div style={boxStyle}>
      <strong style={{ fontSize: '14px', color: '#0f172a' }}>Cobrança rateada (MTR baixada — cenário complexo)</strong>
      <p style={{ margin: '6px 0 10px', fontSize: '12px', color: '#64748b' }}>
        Coletado de um cliente e cobrado de outro: defina percentual ou valor por cliente de cobrança.
      </p>

      {gravado.length > 0 && linhas.length === 0 ? (
        <ul style={{ margin: '0 0 10px', paddingLeft: '18px', fontSize: '13px' }}>
          {gravado.map((r) => (
            <li key={r.id}>
              {nomeCliente(r.cliente_cobranca_id)}
              {r.percentual != null ? ` — ${r.percentual}%` : ''}
              {r.valor != null
                ? ` — ${Number(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                : ''}
            </li>
          ))}
        </ul>
      ) : null}

      {podeEditar ? (
        <>
          {linhas.map((linha, idx) => (
            <div
              key={idx}
              className="rg-mobile-stack-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 90px auto',
                gap: '8px',
                marginBottom: '8px',
                alignItems: 'end',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Cobrar de</label>
                <select
                  value={linha.cliente_cobranca_id}
                  onChange={(e) => {
                    const next = [...linhas]
                    next[idx] = { ...next[idx], cliente_cobranca_id: e.target.value }
                    setLinhas(next)
                  }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">—</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>%</label>
                <input
                  type="text"
                  value={linha.percentual ?? ''}
                  onChange={(e) => {
                    const next = [...linhas]
                    next[idx] = {
                      ...next[idx],
                      percentual: Number(String(e.target.value).replace(',', '.')) || 0,
                    }
                    setLinhas(next)
                  }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>R$</label>
                <input
                  type="text"
                  value={linha.valor ?? ''}
                  onChange={(e) => {
                    const next = [...linhas]
                    next[idx] = {
                      ...next[idx],
                      valor: Number(String(e.target.value).replace(',', '.')) || 0,
                    }
                    setLinhas(next)
                  }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              {linhas.length > 1 ? (
                <button type="button" className="mini-btn mini-btn-danger" onClick={() => setLinhas(linhas.filter((_, i) => i !== idx))}>
                  ×
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="mini-btn"
              onClick={() => setLinhas([...linhas, { cliente_cobranca_id: '', percentual: 0 }])}
            >
              + Cliente
            </button>
            <button type="button" className="mini-btn" disabled={busy} onClick={() => void guardar()}>
              {busy ? 'A gravar…' : 'Gravar rateio'}
            </button>
          </div>
        </>
      ) : (
        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Sem permissão para editar rateio.</p>
      )}
      {msg ? <p style={{ fontSize: '12px', marginTop: '8px', color: msg.startsWith('Rateio') ? '#15803d' : '#b91c1c' }}>{msg}</p> : null}
    </div>
  )
}
