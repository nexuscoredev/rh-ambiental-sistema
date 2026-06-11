import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import { agruparFilaFaturamentoPorMtr } from '../../lib/faturamentoConsolidacaoMtr'
import {
  coletaNaFilaAjusteValoresMedicao,
  rotuloEsteiraLinha,
} from '../../lib/faturamentoEsteira'

const FILA_AJUSTE_VISIVEL_INICIAL = 5
const FILA_AJUSTE_CARREGAR_MAIS = 20

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '18px 20px',
  marginBottom: '18px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}

type Props = {
  linhas: FaturamentoResumoViewRow[]
  carregando?: boolean
  esteiraAtiva: boolean
  podeRevisar: boolean
  onRevisarValores: (row: FaturamentoResumoViewRow, grupo?: FaturamentoResumoViewRow[]) => void
}

export function FaturamentoFilaAjusteValores({
  linhas,
  carregando,
  esteiraAtiva,
  podeRevisar,
  onRevisarValores,
}: Props) {
  const pendentes = useMemo(() => linhas.filter(coletaNaFilaAjusteValoresMedicao), [linhas])
  const itensMtr = useMemo(() => agruparFilaFaturamentoPorMtr(pendentes), [pendentes])
  const [visiveis, setVisiveis] = useState(FILA_AJUSTE_VISIVEL_INICIAL)

  useEffect(() => {
    setVisiveis(FILA_AJUSTE_VISIVEL_INICIAL)
  }, [linhas])

  const itensVisiveis = useMemo(() => itensMtr.slice(0, visiveis), [itensMtr, visiveis])
  const restantes = Math.max(0, itensMtr.length - visiveis)
  const proximoLote = Math.min(FILA_AJUSTE_CARREGAR_MAIS, restantes)
  const listaExpandida = visiveis > FILA_AJUSTE_VISIVEL_INICIAL
  const mostrarControlesLista = itensMtr.length > FILA_AJUSTE_VISIVEL_INICIAL

  if (carregando || pendentes.length === 0) {
    return null
  }

  return (
    <section style={{ ...card, borderLeft: '4px solid #0d9488' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: '#0f766e' }}>
        Esteira 2 · Ajuste de valores (antes da medição)
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#475569', lineHeight: 1.55 }}>
        Revise os <strong>cálculos detalhados</strong> do ticket e MTR (valores, frete, taxas). Só depois
        disso gere o relatório de medição e envie ao cliente para aprovação.
      </p>

      {!esteiraAtiva ? (
        <p style={{ margin: 0, fontSize: '12px', color: '#b45309' }}>
          Migração da esteira não aplicada — execute o SQL da esteira no Supabase.
        </p>
      ) : null}

      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
        {itensMtr.length} na fila
        {mostrarControlesLista
          ? ` · a mostrar ${Math.min(visiveis, itensMtr.length)}`
          : null}
      </p>

      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {itensVisiveis.map((item) => {
          if (item.kind === 'unico') {
            const lider = item.row
            return (
              <li
                key={lider.coleta_id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '10px 14px',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: '#f0fdfa',
                  border: '1px solid #99f6e4',
                }}
              >
                <span style={{ flex: '1 1 200px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {lider.cliente_nome ?? '—'} · coleta {lider.numero_coleta ?? lider.numero} ·{' '}
                  {rotuloEsteiraLinha(lider)}
                </span>
                <button
                  type="button"
                  className="rg-btn rg-btn--primary"
                  style={{ fontSize: '12px', padding: '8px 14px' }}
                  disabled={!podeRevisar || !esteiraAtiva}
                  onClick={() => onRevisarValores(lider)}
                >
                  Revisar valores do ticket
                </button>
              </li>
            )
          }

          const { coletas, coleta_lider, mtr_numero } = item
          return (
            <li
              key={`ajuste-mtr-${item.mtr_id}`}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px 14px',
                padding: '10px 12px',
                borderRadius: 10,
                background: '#f0fdfa',
                border: '1px solid #99f6e4',
              }}
            >
              <span style={{ flex: '1 1 240px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                {item.cliente_nome} · MTR {mtr_numero} · {coletas.length} tickets (
                {coletas.map((c) => c.numero_coleta ?? c.numero).join(', ')}) ·{' '}
                {rotuloEsteiraLinha(coleta_lider)}
              </span>
              <button
                type="button"
                className="rg-btn rg-btn--primary"
                style={{ fontSize: '12px', padding: '8px 14px' }}
                disabled={!podeRevisar || !esteiraAtiva}
                onClick={() => onRevisarValores(coleta_lider, coletas)}
              >
                Revisar valores (consolidado)
              </button>
            </li>
          )
        })}
      </ul>

      {mostrarControlesLista ? (
        <div
          style={{
            marginTop: '14px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          {restantes > 0 ? (
            <>
              <button
                type="button"
                className="rg-btn rg-btn--outline"
                style={{ fontSize: 13, padding: '10px 16px', fontWeight: 700 }}
                onClick={() => setVisiveis((v) => v + proximoLote)}
              >
                Carregar mais {proximoLote} ({restantes} restante{restantes === 1 ? '' : 's'})
              </button>
              <button
                type="button"
                className="rg-btn rg-btn--outline"
                style={{ fontSize: 12, padding: '8px 12px' }}
                onClick={() => setVisiveis(itensMtr.length)}
              >
                Mostrar todos ({itensMtr.length})
              </button>
            </>
          ) : null}
          {listaExpandida ? (
            <button
              type="button"
              className="rg-btn rg-btn--outline"
              style={{ fontSize: 12, padding: '8px 12px', fontWeight: 700 }}
              onClick={() => setVisiveis(FILA_AJUSTE_VISIVEL_INICIAL)}
            >
              Recolher lista (mostrar {FILA_AJUSTE_VISIVEL_INICIAL})
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
