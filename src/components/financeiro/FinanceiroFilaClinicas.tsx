import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  listarFilaFinanceiroClinicas,
  salvarPagamentoContaClinica,
} from '../../lib/clinicasApi'
import { formatarMoedaClinica } from '../../lib/clinicasFaturamento'
import type { ClinicaContaReceberFilaRow } from '../../lib/clinicasTypes'
import { useRgDialog } from '../../lib/RgDialogProvider'
type Props = {
  podeMutar: boolean
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px 22px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function FinanceiroFilaClinicas({ podeMutar }: Props) {
  const { alert } = useRgDialog()
  const [linhas, setLinhas] = useState<ClinicaContaReceberFilaRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [datasPagamento, setDatasPagamento] = useState<Record<string, string>>({})

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    const res = await listarFilaFinanceiroClinicas()
    setCarregando(false)
    if (!res.ok) {
      setErro(res.message)
      setLinhas([])
      return
    }
    setLinhas(res.linhas)
    const datas: Record<string, string> = {}
    for (const r of res.linhas) {
      datas[r.conta_id] = r.data_pagamento?.slice(0, 10) || hojeIso()
    }
    setDatasPagamento(datas)
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const resumo = useMemo(() => {
    let aberto = 0
    let pago = 0
    for (const r of linhas) {
      const saldo = r.valor - r.valor_pago
      if (r.status_pagamento === 'Pago' || saldo <= 0) pago += r.valor
      else aberto += saldo
    }
    return { aberto, pago, qtd: linhas.length }
  }, [linhas])

  async function togglePago(row: ClinicaContaReceberFilaRow, marcar: boolean) {
    if (!podeMutar) return
    const dataPag = datasPagamento[row.conta_id] || hojeIso()
    if (marcar && !dataPag) {
      await alert({ title: 'Pagamento', message: 'Informe a data de pagamento.', variant: 'warning' })
      return
    }
    setSalvandoId(row.conta_id)
    const res = await salvarPagamentoContaClinica(row.conta_id, marcar, marcar ? dataPag : null)
    setSalvandoId(null)
    if (!res.ok) {
      await alert({ title: 'Pagamento', message: res.message, variant: 'danger' })
      return
    }
    await recarregar()
  }

  return (
    <section style={cardStyle} aria-labelledby="fila-financeiro-clinicas-titulo">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h2 id="fila-financeiro-clinicas-titulo" style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
            Fila — Clínicas
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b', maxWidth: 720, lineHeight: 1.55 }}>
            Títulos enviados a partir do faturamento de clínicas. Marque como pago e registe a data de recebimento.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            to="/faturamento-clinicas"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontWeight: 700,
              fontSize: '13px',
              color: '#0d9488',
              textDecoration: 'none',
            }}
          >
            Faturar clínicas
          </Link>
          <button
            type="button"
            onClick={() => void recarregar()}
            disabled={carregando}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: carregando ? 'wait' : 'pointer',
            }}
          >
            Atualizar
          </button>
        </div>
      </div>

      <p style={{ margin: '14px 0 0', fontSize: '13px', color: '#475569' }}>
        <strong>{resumo.qtd}</strong> título(s) · Em aberto:{' '}
        <strong>{formatarMoedaClinica(resumo.aberto)}</strong> · Quitado:{' '}
        <strong>{formatarMoedaClinica(resumo.pago)}</strong>
      </p>

      {erro ? (
        <p style={{ marginTop: '12px', color: '#b91c1c', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{erro}</p>
      ) : null}

      {carregando ? (
        <p style={{ marginTop: '16px', color: '#64748b' }}>A carregar fila…</p>
      ) : linhas.length === 0 ? (
        <p style={{ marginTop: '16px', color: '#64748b' }}>
          Nenhum título de clínica na fila. Envie O.S. emitidas em{' '}
          <Link to="/faturamento-clinicas" style={{ color: '#0d9488', fontWeight: 700 }}>
            Faturar clínicas
          </Link>
          .
        </p>
      ) : (
        <div style={{ marginTop: '16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 880 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>O.S.</th>
                <th style={{ padding: '8px' }}>Unidade</th>
                <th style={{ padding: '8px' }}>Valor</th>
                <th style={{ padding: '8px' }}>Venc.</th>
                <th style={{ padding: '8px' }}>Data pag.</th>
                <th style={{ padding: '8px' }}>Pago</th>
                <th style={{ padding: '8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => {
                const saldo = r.valor - r.valor_pago
                const quitado = r.status_pagamento === 'Pago' || saldo <= 0
                const busy = salvandoId === r.conta_id
                return (
                  <tr key={r.conta_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{r.numero_os}</td>
                    <td style={{ padding: '10px 8px' }}>{r.razao_social}</td>
                    <td style={{ padding: '10px 8px' }}>{formatarMoedaClinica(r.valor)}</td>
                    <td style={{ padding: '10px 8px' }}>{r.data_vencimento ?? '—'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <input
                        type="date"
                        value={datasPagamento[r.conta_id] ?? hojeIso()}
                        disabled={!podeMutar || quitado || busy}
                        onChange={(e) =>
                          setDatasPagamento((prev) => ({ ...prev, [r.conta_id]: e.target.value }))
                        }
                        style={{
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                          cursor: podeMutar && !busy ? 'pointer' : 'default',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={quitado}
                          disabled={!podeMutar || busy}
                          onChange={(e) => void togglePago(r, e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#15803d' }}
                        />
                        Pago
                      </label>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{r.status_pagamento}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!podeMutar ? (
        <p style={{ marginTop: '12px', fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
          Perfil só leitura — alterações exigem Financeiro ou Administrador.
        </p>
      ) : null}
    </section>
  )
}
