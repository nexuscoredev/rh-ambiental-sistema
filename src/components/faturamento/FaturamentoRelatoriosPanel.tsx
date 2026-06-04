import { useMemo, useState, type CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import {
  agruparHistoricoFaturamentoEmitido,
  linhaLiderGrupoHistoricoFaturamento,
  valorGrupoHistoricoFaturamento,
} from '../../lib/faturamentoConsolidacaoMtr'
import { coletaNaFilaFaturamento } from '../../lib/faturamentoOperacionalFila'

const wrap: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px 22px',
  marginTop: '20px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#64748b',
  padding: '8px 10px',
  borderBottom: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const td: CSSProperties = {
  padding: '10px',
  fontSize: '12px',
  color: '#334155',
  borderBottom: '1px solid #f1f5f9',
}

function inicioDiaMs(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function fimDiaMs(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

function fmtMoeda(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Props = {
  linhasOperacional: FaturamentoResumoViewRow[]
  linhasHistorico: FaturamentoResumoViewRow[] | null
  naoCarregadoHistorico?: boolean
  carregandoHistorico?: boolean
  onCarregarHistorico?: () => void
}

export function FaturamentoRelatoriosPanel({
  linhasOperacional,
  linhasHistorico,
  naoCarregadoHistorico = false,
  carregandoHistorico = false,
  onCarregarHistorico,
}: Props) {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const gruposHistorico = useMemo(
    () => agruparHistoricoFaturamentoEmitido(linhasHistorico ?? []),
    [linhasHistorico]
  )

  const fila = useMemo(
    () => linhasOperacional.filter((r) => coletaNaFilaFaturamento(r, linhasOperacional)),
    [linhasOperacional]
  )

  const gruposHistoricoPeriodo = useMemo(() => {
    const t0 = de ? inicioDiaMs(de) : null
    const t1 = ate ? fimDiaMs(ate) : null
    return gruposHistorico.filter((g) => {
      const lider = linhaLiderGrupoHistoricoFaturamento(g)
      const ref = lider.data_execucao || lider.created_at
      if (!ref) return t0 == null && t1 == null
      const ts = new Date(ref).getTime()
      if (t0 != null && ts < t0) return false
      if (t1 != null && ts > t1) return false
      return true
    })
  }, [gruposHistorico, de, ate])

  const totais = useMemo(() => {
    let fat = 0
    for (const g of gruposHistoricoPeriodo) {
      fat += valorGrupoHistoricoFaturamento(g)
    }
    const n = gruposHistoricoPeriodo.length
    const ticket = n > 0 ? fat / n : 0
    let pendValor = 0
    for (const r of fila) {
      const v = r.valor_coleta ?? r.faturamento_registro_valor
      if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) pendValor += Number(v)
    }
    return { fat, ticket, n, pendQtd: fila.length, pendValor }
  }, [gruposHistoricoPeriodo, fila])

  const rankingClientes = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; qtd: number }>()
    for (const g of gruposHistoricoPeriodo) {
      const lider = linhaLiderGrupoHistoricoFaturamento(g)
      const nome = (lider.cliente_nome || '—').trim() || '—'
      const v = valorGrupoHistoricoFaturamento(g)
      const cur = map.get(nome) ?? { nome, valor: 0, qtd: 0 }
      cur.valor += v
      cur.qtd += 1
      map.set(nome, cur)
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 12)
  }, [gruposHistoricoPeriodo])

  const porDia = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of gruposHistoricoPeriodo) {
      const lider = linhaLiderGrupoHistoricoFaturamento(g)
      const ref = lider.data_execucao || lider.created_at
      if (!ref) continue
      const dia = ref.slice(0, 10)
      const v = valorGrupoHistoricoFaturamento(g)
      map.set(dia, (map.get(dia) ?? 0) + v)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  }, [gruposHistoricoPeriodo])

  const acumuladoHistorico = useMemo(() => {
    return gruposHistorico.reduce((acc, g) => acc + valorGrupoHistoricoFaturamento(g), 0)
  }, [gruposHistorico])

  return (
    <div style={wrap}>
      <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
        Relatórios e indicadores
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8', maxWidth: '880px', lineHeight: 1.5 }}>
        Fila «a faturar» usa dados operacionais já carregados; totais de emitidas exigem carregar o histórico.
      </p>

      {naoCarregadoHistorico ? (
        <div style={{ marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => onCarregarHistorico?.()}
            disabled={carregandoHistorico || !onCarregarHistorico}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '13px',
              cursor: carregandoHistorico ? 'wait' : 'pointer',
            }}
          >
            {carregandoHistorico ? 'A carregar histórico…' : 'Carregar histórico para relatórios'}
          </button>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
            De
          </label>
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
            Até
          </label>
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {(
          [
            ['Total faturado (período)', fmtMoeda(totais.fat)],
            ['Ticket médio', totais.n > 0 ? fmtMoeda(totais.ticket) : '—'],
            ['Coletas no período', String(totais.n)],
            ['Fila (não faturadas)', String(totais.pendQtd)],
            ['Estimado na fila', totais.pendValor > 0 ? fmtMoeda(totais.pendValor) : '—'],
            ['Acumulado (tudo carregado)', fmtMoeda(acumuladoHistorico)],
          ] as const
        ).map(([k, v]) => (
          <div
            key={k}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' }}>{k}</div>
            <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: '#475569' }}>Ranking por cliente</h3>
          <div className="rg-mobile-table-scroll" style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '240px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '260px' }}>
              <thead>
                <tr>
                  <th style={th}>Cliente</th>
                  <th style={th}>Coletas</th>
                  <th style={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rankingClientes.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>
                      Sem dados no período.
                    </td>
                  </tr>
                ) : (
                  rankingClientes.map((row) => (
                    <tr key={row.nome}>
                      <td style={{ ...td, fontWeight: 700 }}>{row.nome}</td>
                      <td style={td}>{row.qtd}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtMoeda(row.valor)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: '#475569' }}>
            Faturamento por dia (últimos 14 no período)
          </h3>
          <div className="rg-mobile-table-scroll" style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '240px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '200px' }}>
              <thead>
                <tr>
                  <th style={th}>Dia</th>
                  <th style={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {porDia.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>
                      Sem dados.
                    </td>
                  </tr>
                ) : (
                  porDia.map(([dia, val]) => (
                    <tr key={dia}>
                      <td style={td}>{dia.split('-').reverse().join('/')}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtMoeda(val)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '18px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: '#475569' }}>
          Pendências — coletas realizadas, ainda não faturadas (fila)
        </h3>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8' }}>{fila.length} coleta(s) na fila atual.</p>
      </div>
    </div>
  )
}
