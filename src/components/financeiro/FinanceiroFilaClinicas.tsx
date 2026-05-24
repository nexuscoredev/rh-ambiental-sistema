import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  listarFilaFinanceiroClinicas,
  salvarPagamentoContaClinica,
} from '../../lib/clinicasApi'
import {
  gerarRelatorioFinanceiroClinicasPdf,
  type LinhaRelatorioFinanceiroClinicas,
} from '../../lib/gerarRelatorioFinanceiroClinicasPdf'
import type { ClinicaContaReceberFilaRow } from '../../lib/clinicasTypes'
import { useSessionPersistedState } from '../../lib/usePageSessionPersistence'
import { useRgDialog } from '../../lib/RgDialogProvider'

function inicioDiaMs(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function formatCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, da] = iso.slice(0, 10).split('-')
  if (!y || !m || !da) return iso
  return `${da}/${m}/${y}`
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export type FinanceiroFilaClinicasHandle = {
  recarregar: () => Promise<void>
  gerarRelatorioPdf: () => void
  exportarCsv: () => void
  readonly loading: boolean
  readonly qtdFiltradas: number
}

type Props = {
  podeMutar: boolean
  onResumoChange?: (resumo: { qtd: number; saldoAberto: number; saldoVencido: number }) => void
  onToolbarStateChange?: (estado: { loading: boolean; qtdFiltradas: number }) => void
}

export const FinanceiroFilaClinicas = forwardRef<FinanceiroFilaClinicasHandle, Props>(
  function FinanceiroFilaClinicas({ podeMutar, onResumoChange, onToolbarStateChange }, ref) {
    const { alert } = useRgDialog()
    const [linhas, setLinhas] = useState<ClinicaContaReceberFilaRow[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState('')
    const [salvandoId, setSalvandoId] = useState<string | null>(null)
    const [datasPagamento, setDatasPagamento] = useState<Record<string, string>>({})
    const [busca, setBusca] = useSessionPersistedState('cr-clinicas-busca', '')
    const [filtroStatus, setFiltroStatus] = useSessionPersistedState<
      '' | 'Pendente' | 'Parcial' | 'Pago'
    >('cr-clinicas-status', '')
    const [filtroFaixa, setFiltroFaixa] = useSessionPersistedState<
      'todos' | 'vencido' | '7d' | 'sem_venc'
    >('cr-clinicas-faixa', 'todos')

    const hojeMs = useMemo(() => {
      const d = new Date()
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    }, [])

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

    const filtradas = useMemo(() => {
      const t = busca.trim().toLowerCase()
      return linhas.filter((r) => {
        const saldo = r.valor - r.valor_pago
        if (filtroStatus && r.status_pagamento !== filtroStatus) return false
        if (filtroFaixa !== 'todos') {
          if (saldo <= 0 || r.status_pagamento === 'Pago') return false
          const v = r.data_vencimento
          if (filtroFaixa === 'sem_venc') {
            if (v) return false
          } else if (!v) {
            return false
          } else {
            const vm = inicioDiaMs(v)
            if (filtroFaixa === 'vencido') {
              if (vm >= hojeMs) return false
            } else {
              const alvo = hojeMs + 7 * 86400000
              if (vm < hojeMs || vm > alvo) return false
            }
          }
        }
        if (!t) return true
        const blob = [r.numero_os, r.razao_social, r.referencia_nf, r.status_pagamento]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return blob.includes(t)
      })
    }, [linhas, busca, filtroStatus, filtroFaixa, hojeMs])

    const resumo = useMemo(() => {
      let saldoAberto = 0
      let saldoVencido = 0
      for (const r of linhas) {
        if (r.status_pagamento === 'Pago' || r.status_pagamento === 'Cancelado') continue
        const saldo = r.valor - r.valor_pago
        if (saldo <= 0) continue
        saldoAberto += saldo
        const vencMs = r.data_vencimento ? inicioDiaMs(r.data_vencimento) : null
        if (vencMs != null && vencMs < hojeMs) saldoVencido += saldo
      }
      return { qtd: linhas.length, saldoAberto, saldoVencido }
    }, [linhas, hojeMs])

    useEffect(() => {
      onResumoChange?.(resumo)
    }, [resumo, onResumoChange])

    useEffect(() => {
      onToolbarStateChange?.({ loading: carregando, qtdFiltradas: filtradas.length })
    }, [carregando, filtradas.length, onToolbarStateChange])

    const linhasPdf = useMemo((): LinhaRelatorioFinanceiroClinicas[] => {
      return filtradas.map((r) => {
        const saldo = r.valor - r.valor_pago
        const vencMs = r.data_vencimento ? inicioDiaMs(r.data_vencimento) : null
        return {
          numero_os: r.numero_os,
          razao_social: r.razao_social,
          valor: r.valor,
          valor_pago: r.valor_pago,
          status_pagamento: r.status_pagamento,
          data_vencimento: r.data_vencimento,
          data_pagamento: r.data_pagamento,
          vencido: vencMs != null && saldo > 0 && vencMs < hojeMs,
        }
      })
    }, [filtradas, hojeMs])

    const gerarRelatorioPdf = useCallback(() => {
      if (carregando) return
      gerarRelatorioFinanceiroClinicasPdf({
        resumo,
        linhas: linhasPdf,
        filtros: {
          busca,
          status: filtroStatus,
          envelhecimento: filtroFaixa,
        },
      })
    }, [carregando, resumo, linhasPdf, busca, filtroStatus, filtroFaixa])

    const exportarCsv = useCallback(() => {
      const header = ['os', 'unidade', 'valor', 'valor_pago', 'saldo', 'status', 'vencimento', 'data_pagamento']
      const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
      const body = filtradas
        .map((r) => {
          const saldo = r.valor - r.valor_pago
          return [
            esc(r.numero_os),
            esc(r.razao_social),
            esc(r.valor),
            esc(r.valor_pago),
            esc(saldo),
            esc(r.status_pagamento),
            esc(r.data_vencimento || ''),
            esc(r.data_pagamento || datasPagamento[r.conta_id] || ''),
          ].join(';')
        })
        .join('\r\n')
      const bom = '\uFEFF'
      const blob = new Blob([bom + header.join(';') + '\r\n' + body], {
        type: 'text/csv;charset=utf-8;',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `contas-receber-clinicas_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    }, [filtradas, datasPagamento])

    useImperativeHandle(
      ref,
      () => ({
        recarregar,
        gerarRelatorioPdf,
        exportarCsv,
        loading: carregando,
        qtdFiltradas: filtradas.length,
      }),
      [recarregar, gerarRelatorioPdf, exportarCsv, carregando, filtradas.length]
    )

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
      <>
        {erro ? (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
            }}
          >
            {erro}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginTop: '22px',
          }}
        >
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              background: '#fff',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Títulos carregados</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{resumo.qtd}</div>
          </div>
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '14px',
              border: '1px solid #fde68a',
              background: '#fffbeb',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e' }}>Saldo em aberto</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#b45309' }}>
              {formatCurrency(resumo.saldoAberto)}
            </div>
          </div>
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '14px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>Saldo vencido (aberto)</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#b91c1c' }}>
              {formatCurrency(resumo.saldoVencido)}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Busca</div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="O.S., unidade, NF…"
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                minWidth: '220px',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Status</div>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            >
              <option value="">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Parcial">Parcial</option>
              <option value="Pago">Pago</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
              Envelhecimento
            </div>
            <select
              value={filtroFaixa}
              onChange={(e) => setFiltroFaixa(e.target.value as typeof filtroFaixa)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            >
              <option value="todos">Todos (com saldo)</option>
              <option value="vencido">Vencidos</option>
              <option value="7d">A vencer em 7 dias</option>
              <option value="sem_venc">Sem data vencimento</option>
            </select>
          </div>
          <Link
            to="/faturamento-clinicas"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #0d9488',
              background: '#ecfdf5',
              fontWeight: 700,
              fontSize: '13px',
              color: '#0f766e',
              textDecoration: 'none',
            }}
          >
            Faturar clínicas →
          </Link>
        </div>

        <div style={{ overflowX: 'auto', marginTop: '18px' }}>
          {carregando ? (
            <p style={{ color: '#64748b' }}>A carregar…</p>
          ) : (
            <table
              style={{
                width: '100%',
                minWidth: '920px',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>O.S.</th>
                  <th style={{ padding: '10px 8px' }}>Unidade</th>
                  <th style={{ padding: '10px 8px' }}>Valor</th>
                  <th style={{ padding: '10px 8px' }}>Pago</th>
                  <th style={{ padding: '10px 8px' }}>Saldo</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Venc.</th>
                  <th style={{ padding: '10px 8px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', color: '#64748b' }}>
                      Nenhum título de clínica na fila. Envie O.S. emitidas em{' '}
                      <Link to="/faturamento-clinicas" style={{ color: '#0d9488', fontWeight: 700 }}>
                        Faturar clínicas
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  filtradas.map((r) => {
                    const saldo = r.valor - r.valor_pago
                    const vencMs = r.data_vencimento ? inicioDiaMs(r.data_vencimento) : null
                    const vencido = vencMs != null && saldo > 0 && vencMs < hojeMs
                    const quitado = r.status_pagamento === 'Pago' || saldo <= 0
                    const busy = salvandoId === r.conta_id
                    return (
                      <tr key={r.conta_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>{r.numero_os}</td>
                        <td style={{ padding: '10px 8px' }}>{r.razao_social}</td>
                        <td style={{ padding: '10px 8px' }}>{formatCurrency(r.valor)}</td>
                        <td style={{ padding: '10px 8px' }}>{formatCurrency(r.valor_pago)}</td>
                        <td
                          style={{
                            padding: '10px 8px',
                            fontWeight: 700,
                            color: saldo > 0 ? '#b45309' : '#15803d',
                          }}
                        >
                          {formatCurrency(saldo)}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{r.status_pagamento}</td>
                        <td style={{ padding: '10px 8px', color: vencido ? '#b91c1c' : undefined }}>
                          {formatDate(r.data_vencimento)}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: '10px 14px',
                            }}
                          >
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                              Data pag.
                              <input
                                type="date"
                                value={datasPagamento[r.conta_id] ?? hojeIso()}
                                disabled={!podeMutar || quitado || busy}
                                onChange={(e) =>
                                  setDatasPagamento((prev) => ({
                                    ...prev,
                                    [r.conta_id]: e.target.value,
                                  }))
                                }
                                style={{
                                  display: 'block',
                                  marginTop: '4px',
                                  padding: '6px 8px',
                                  borderRadius: '8px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12px',
                                }}
                              />
                            </label>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: podeMutar && !busy ? 'pointer' : 'default',
                                userSelect: 'none',
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
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {!podeMutar ? (
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
            Perfil só leitura — alterações exigem Financeiro ou Administrador.
          </p>
        ) : null}
      </>
    )
  }
)
