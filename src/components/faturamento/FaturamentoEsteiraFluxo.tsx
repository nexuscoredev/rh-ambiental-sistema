import { ORDEM_ESTEIRA_UI, ROTULO_ESTEIRA } from '../../lib/faturamentoEsteira'

const wrap = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '8px',
  marginBottom: '20px',
  padding: '12px 14px',
  background: '#f8fafc',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
}

import type { CSSProperties } from 'react'

const step = (ativo: boolean): CSSProperties => ({
  fontSize: '11px',
  fontWeight: 700,
  padding: '6px 10px',
  borderRadius: '8px',
  background: ativo ? '#0f172a' : '#fff',
  color: ativo ? '#fff' : '#64748b',
  border: '1px solid #cbd5e1',
})

/** Indicador visual da esteira (passos 1–7). */
export function FaturamentoEsteiraFluxo({ passoAtivo }: { passoAtivo?: number }) {
  const labels = [
    '1. Conferência ticket',
    '2. Ajuste de valores',
    '3. Relatório medição',
    '4. Mala Direta (medição)',
    '5. Aprovação cliente',
    '6. Faturar',
    '7. NF / boleto',
    '8. Finalizado',
  ]

  return (
    <div style={wrap}>
      {labels.map((lbl, i) => (
        <span key={lbl} style={step(passoAtivo === i + 1)}>
          {lbl}
        </span>
      ))}
      <span style={{ width: '100%', fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
        Status internos: {ORDEM_ESTEIRA_UI.map((s) => ROTULO_ESTEIRA[s]).join(' → ')}
      </span>
    </div>
  )
}
