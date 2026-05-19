import type { CSSProperties } from 'react'

export type ProgramacaoStatus =
  | 'PENDENTE'
  | 'QUADRO_ATUALIZADO'
  | 'EM_COLETA'
  | 'CONCLUIDA'
  | 'CANCELADA'

export const STATUS_LABELS: Record<ProgramacaoStatus, string> = {
  PENDENTE: 'Pendente',
  QUADRO_ATUALIZADO: 'Quadro atualizado',
  EM_COLETA: 'Em coleta',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

export type ProgramacaoStatusVisual = {
  backgroundColor: string
  color: string
  border: string
  stripeColor: string
  dotColor: string
}

export function getStatusStyle(status: ProgramacaoStatus): ProgramacaoStatusVisual {
  switch (status) {
    case 'PENDENTE':
      return {
        backgroundColor: '#fffbeb',
        color: '#78350f',
        border: '1px solid rgba(245, 158, 11, 0.42)',
        stripeColor: '#f59e0b',
        dotColor: '#d97706',
      }
    case 'QUADRO_ATUALIZADO':
      return {
        backgroundColor: '#eff6ff',
        color: '#1e3a8a',
        border: '1px solid rgba(59, 130, 246, 0.38)',
        stripeColor: '#3b82f6',
        dotColor: '#2563eb',
      }
    case 'EM_COLETA':
      return {
        backgroundColor: '#f5f3ff',
        color: '#5b21b6',
        border: '1px solid rgba(139, 92, 246, 0.38)',
        stripeColor: '#8b5cf6',
        dotColor: '#7c3aed',
      }
    case 'CONCLUIDA':
      return {
        backgroundColor: '#f0fdf4',
        color: '#14532d',
        border: '1px solid rgba(34, 197, 94, 0.35)',
        stripeColor: '#22c55e',
        dotColor: '#16a34a',
      }
    case 'CANCELADA':
      return {
        backgroundColor: '#fef2f2',
        color: '#991b1b',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        stripeColor: '#ef4444',
        dotColor: '#dc2626',
      }
    default:
      return {
        backgroundColor: '#f9fafb',
        color: '#374151',
        border: '1px solid #e5e7eb',
        stripeColor: '#9ca3af',
        dotColor: '#6b7280',
      }
  }
}

export const programacaoStatusTagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  padding: '6px 11px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  letterSpacing: '-0.01em',
  lineHeight: 1,
  flexShrink: 0,
}
