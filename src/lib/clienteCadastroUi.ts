import type { CSSProperties } from 'react'
import type { MtrSigorOpcao } from './mtrSigorCliente'

export const clienteInputStyle: CSSProperties = {
  width: '100%',
  height: '40px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  outline: 'none',
  padding: '0 12px',
  fontSize: '14px',
  color: '#0f172a',
  boxSizing: 'border-box',
}

export const clienteFieldLabelStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: 0,
}

export const clienteFieldLabelTextStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#334155',
  letterSpacing: '0.01em',
}

export const clienteFieldLabelHelpStyle: CSSProperties = {
  fontSize: '11px',
  color: '#64748b',
  lineHeight: 1.35,
}

export const clienteLabelSigorCheckboxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '13px',
  fontWeight: 600,
  color: '#334155',
  cursor: 'pointer',
}

/** Grelhas do formulário de cliente; `fluido` preenche melhor painéis largos (ex.: Gerenciador). */
export function clienteGridCols(
  kind: '4' | '3' | '6' | '2-1',
  fluido?: boolean
): string {
  if (!fluido) {
    if (kind === '4') return 'repeat(4, minmax(0, 1fr))'
    if (kind === '3') return 'repeat(3, minmax(0, 1fr))'
    if (kind === '6') return 'repeat(6, minmax(0, 1fr))'
    return '2fr 1fr'
  }
  if (kind === '4') return 'repeat(auto-fit, minmax(240px, 1fr))'
  if (kind === '3') return 'repeat(auto-fit, minmax(220px, 1fr))'
  if (kind === '6') return 'repeat(auto-fit, minmax(180px, 1fr))'
  return 'repeat(auto-fit, minmax(280px, 1fr))'
}

export function alternarMtrSigorOpcao(
  atual: MtrSigorOpcao | null,
  opcao: MtrSigorOpcao
): MtrSigorOpcao | null {
  return atual === opcao ? null : opcao
}
