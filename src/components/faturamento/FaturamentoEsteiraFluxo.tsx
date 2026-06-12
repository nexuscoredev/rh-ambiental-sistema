import type { CSSProperties } from 'react'
import {
  ORDEM_ESTEIRA_UI,
  ROTULO_ESTEIRA,
  ROTULO_PASSO_UI_ESTEIRA,
  type PassoUiEsteiraFaturamento,
} from '../../lib/faturamentoEsteira'
import { FaturamentoEsteiraBuscaMtr } from './FaturamentoEsteiraBuscaMtr'

const wrap: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '20px',
  padding: '12px 14px',
  background: "var(--bg-subtle, #f8fafc)",
  borderRadius: '12px',
  border: "1px solid var(--border-color, #e2e8f0)",
}

function stepStyle(n: number, passoAtivo?: PassoUiEsteiraFaturamento): CSSProperties {
  const ativo = passoAtivo === n
  const concluido = passoAtivo != null && n < passoAtivo
  if (ativo) {
    return {
      fontSize: '11px',
      fontWeight: 800,
      padding: '7px 12px',
      borderRadius: '8px',
      background: 'linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)',
      color: '#fff',
      border: '2px solid #0f766e',
      boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.25)',
    }
  }
  if (concluido) {
    return {
      fontSize: '11px',
      fontWeight: 700,
      padding: '6px 10px',
      borderRadius: '8px',
      background: "var(--accent-teal-soft, #ecfdf5)",
      color: '#0f766e',
      border: '1px solid #99f6e4',
    }
  }
  return {
    fontSize: '11px',
    fontWeight: 700,
    padding: '6px 10px',
    borderRadius: '8px',
    background: "var(--bg-card, #ffffff)",
    color: "var(--text-secondary, #64748b)",
    border: "1px solid var(--input-border, #cbd5e1)",
  }
}

const LABELS_UI: { passo: PassoUiEsteiraFaturamento; lbl: string }[] = [
  { passo: 1, lbl: `1. ${ROTULO_PASSO_UI_ESTEIRA[1]}` },
  { passo: 2, lbl: `2. ${ROTULO_PASSO_UI_ESTEIRA[2]}` },
  { passo: 3, lbl: `3. ${ROTULO_PASSO_UI_ESTEIRA[3]}` },
  { passo: 4, lbl: `4. ${ROTULO_PASSO_UI_ESTEIRA[4]}` },
  { passo: 5, lbl: `5. ${ROTULO_PASSO_UI_ESTEIRA[5]}` },
  { passo: 6, lbl: `6. ${ROTULO_PASSO_UI_ESTEIRA[6]}` },
  { passo: 7, lbl: `7. ${ROTULO_PASSO_UI_ESTEIRA[7]}` },
  { passo: 8, lbl: `8. ${ROTULO_PASSO_UI_ESTEIRA[8]}` },
]

/** Indicador visual da esteira (passos 1–8). */
export function FaturamentoEsteiraFluxo({ passoAtivo }: { passoAtivo?: PassoUiEsteiraFaturamento }) {
  return (
    <div className="faturamento-esteira-fluxo" style={wrap}>
      {LABELS_UI.map(({ passo, lbl }) => (
        <span key={passo} style={stepStyle(passo, passoAtivo)} title={ROTULO_PASSO_UI_ESTEIRA[passo]}>
          {lbl}
        </span>
      ))}
      {passoAtivo ? (
        <span
          style={{
            width: '100%',
            marginTop: '6px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: "var(--accent-teal-soft, #f0fdfa)",
            border: '1px solid #99f6e4',
            fontSize: '12px',
            fontWeight: 700,
            color: '#0f766e',
          }}
        >
          Você está na etapa <strong>{passoAtivo}. {ROTULO_PASSO_UI_ESTEIRA[passoAtivo]}</strong>
        </span>
      ) : null}
      <span style={{ width: '100%', fontSize: '10px', color: "var(--text-secondary, #94a3b8)", marginTop: passoAtivo ? '4px' : '4px' }}>
        Status internos: {ORDEM_ESTEIRA_UI.map((s) => ROTULO_ESTEIRA[s]).join(' → ')}
      </span>
      <div style={{ width: '100%' }}>
        <FaturamentoEsteiraBuscaMtr />
      </div>
    </div>
  )
}
