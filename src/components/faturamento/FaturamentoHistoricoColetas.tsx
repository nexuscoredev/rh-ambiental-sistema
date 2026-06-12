import { useMemo, useState, type CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import {
  agruparHistoricoFaturamentoEmitido,
  chaveGrupoHistoricoFaturamento,
  linhaLiderGrupoHistoricoFaturamento,
  pesoLiquidoGrupoHistoricoFaturamento,
  rotuloColetasGrupoHistoricoFaturamento,
  rotuloResiduoGrupoHistoricoFaturamento,
  valorGrupoHistoricoFaturamento,
  type GrupoHistoricoFaturamento,
} from '../../lib/faturamentoConsolidacaoMtr'
import { FaturamentoColetaResumoModal } from './FaturamentoColetaResumoModal'

const wrap: CSSProperties = {
  background: "var(--bg-card, #ffffff)",
  border: "1px solid var(--border-color, #e2e8f0)",
  borderRadius: '16px',
  padding: '20px 22px',
  marginBottom: '20px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: "var(--text-secondary, #64748b)",
  padding: '8px 10px',
  borderBottom: "1px solid var(--border-color, #e2e8f0)",
  background: "var(--bg-subtle, #f8fafc)",
}

const td: CSSProperties = {
  padding: '10px',
  fontSize: '12px',
  color: "var(--text-primary, #334155)",
  borderBottom: '1px solid #f1f5f9',
}

const btnResumo: CSSProperties = {
  background: "var(--bg-inset, #f1f5f9)",
  color: "var(--text-primary, #0f172a)",
  border: "1px solid var(--input-border, #cbd5e1)",
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
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

function inicioDia(isoDate: string): number {
  const d = new Date(isoDate + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function fimDiaInclusive(isoDate: string): number {
  const d = new Date(isoDate + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

type Props = {
  linhas: FaturamentoResumoViewRow[]
  /** Histórico ainda não chegou do servidor. */
  naoCarregado?: boolean
  carregando?: boolean
}

export function FaturamentoHistoricoColetas({
  linhas,
  naoCarregado = false,
  carregando = false,
}: Props) {
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [resumoGrupo, setResumoGrupo] = useState<GrupoHistoricoFaturamento | null>(null)

  const gruposHistorico = useMemo(() => agruparHistoricoFaturamentoEmitido(linhas), [linhas])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const tokens = q.split(/\s+/).filter(Boolean)
    const t0 = de ? inicioDia(de) : null
    const t1 = ate ? fimDiaInclusive(ate) : null
    return gruposHistorico.filter((g) => {
      const lider = linhaLiderGrupoHistoricoFaturamento(g)
      const nums =
        g.kind === 'mtr'
          ? g.coletas.map((c) => `${c.numero_coleta ?? c.numero}`).join(' ')
          : String(lider.numero_coleta ?? lider.numero)
      const ref = `${lider.numero} ${nums} ${lider.cliente_nome ?? ''} ${lider.mtr_numero ?? ''}`.toLowerCase()
      if (tokens.length && !tokens.every((t) => ref.includes(t))) return false
      const refData = lider.data_execucao || lider.created_at
      if (!refData) return t0 == null && t1 == null
      const ts = new Date(refData).getTime()
      if (t0 != null && ts < t0) return false
      if (t1 != null && ts > t1) return false
      return true
    })
  }, [gruposHistorico, busca, de, ate])

  return (
    <div id="faturamento-historico-coletas" style={wrap}>
      <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: "var(--text-secondary, #475569)" }}>Coletas faturadas</h2>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: "var(--text-secondary, #94a3b8)", maxWidth: '820px', lineHeight: 1.5 }}>
        {naoCarregado
          ? 'Coletas já faturadas (emitidas). O histórico carrega automaticamente quando existir registo emitido; também pode usar «Carregar histórico» nos relatórios abaixo.'
          : 'Coletas já enviadas ao Financeiro — filtre por período ou busque por cliente / número.'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: "var(--text-secondary, #64748b)", marginBottom: '4px' }}>
            Busca
          </label>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente ou nº coleta"
            style={{
              width: '220px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: "1px solid var(--input-border, #cbd5e1)",
              fontSize: '13px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: "var(--text-secondary, #64748b)", marginBottom: '4px' }}>
            De
          </label>
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: '8px', border: "1px solid var(--input-border, #cbd5e1)", fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: "var(--text-secondary, #64748b)", marginBottom: '4px' }}>
            Até
          </label>
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: '8px', border: "1px solid var(--input-border, #cbd5e1)", fontSize: '13px' }}
          />
        </div>
      </div>
      <div className="rg-mobile-table-scroll" style={{ overflowX: 'auto', maxHeight: 'min(420px, 48vh)', overflowY: 'auto', border: "1px solid var(--border-color, #e2e8f0)", borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '920px' }}>
          <thead>
            <tr>
              <th style={th}>Coleta</th>
              <th style={th}>Cliente</th>
              <th style={th}>MTR</th>
              <th style={th}>Resíduo</th>
              <th style={th}>Peso líq.</th>
              <th style={th}>Data coleta</th>
              <th style={th}>Conferência</th>
              <th style={th}>Situação</th>
              <th style={th}>Valor</th>
              <th style={{ ...th, width: '108px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {naoCarregado ? (
              <tr>
                <td colSpan={10} style={{ ...td, textAlign: 'center', color: "var(--text-secondary, #94a3b8)", padding: '24px' }}>
                  {carregando ? 'A carregar coletas faturadas…' : 'A preparar histórico…'}
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...td, textAlign: 'center', color: "var(--text-secondary, #94a3b8)", padding: '24px' }}>
                  {carregando ? 'A carregar…' : 'Nenhum registro neste filtro.'}
                </td>
              </tr>
            ) : (
              filtradas.map((g) => {
                const lider = linhaLiderGrupoHistoricoFaturamento(g)
                const peso = pesoLiquidoGrupoHistoricoFaturamento(g)
                const consolidado = g.kind === 'mtr'
                return (
                  <tr key={`h-${chaveGrupoHistoricoFaturamento(g)}`}>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {rotuloColetasGrupoHistoricoFaturamento(g)}
                      {consolidado ? (
                        <span
                          style={{
                            display: 'block',
                            marginTop: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#0369a1',
                          }}
                        >
                          {g.coletas.length} tickets · 1 faturamento
                        </span>
                      ) : null}
                    </td>
                    <td style={td}>{lider.cliente_nome || '—'}</td>
                    <td style={td}>{lider.mtr_numero || '—'}</td>
                    <td style={{ ...td, maxWidth: '220px' }}>{rotuloResiduoGrupoHistoricoFaturamento(g)}</td>
                    <td style={td}>
                      {peso != null
                        ? `${Number(peso).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`
                        : '—'}
                    </td>
                    <td style={td}>{fmtData(lider.data_execucao || lider.data_agendada)}</td>
                    <td style={{ ...td, fontSize: '11px', color: "var(--text-secondary, #64748b)" }}>{fmtDataHora(lider.conferencia_em)}</td>
                    <td style={td}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: '#dcfce7',
                          color: '#15803d',
                        }}
                      >
                        Faturado
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmtValor(valorGrupoHistoricoFaturamento(g))}</td>
                    <td style={td}>
                      <button type="button" style={btnResumo} onClick={() => setResumoGrupo(g)}>
                        Ver resumo
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: '12px', color: "var(--text-secondary, #94a3b8)" }}>
        {filtradas.length} registro(s) no filtro.
      </p>
      <FaturamentoColetaResumoModal
        open={resumoGrupo != null}
        row={resumoGrupo ? linhaLiderGrupoHistoricoFaturamento(resumoGrupo) : null}
        coletasConsolidadas={
          resumoGrupo?.kind === 'mtr' ? resumoGrupo.coletas : undefined
        }
        onClose={() => setResumoGrupo(null)}
      />
    </div>
  )
}
