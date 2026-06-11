import { useEffect, type CSSProperties, type ReactNode } from 'react'

export type RgConfirmVariant = 'default' | 'success' | 'warning' | 'danger'

export type RgConfirmDialogMode = 'confirm' | 'alert'

export type RgConfirmDialogProps = {
  open: boolean
  title: string
  message?: ReactNode
  /** Linhas de contexto (lista abaixo da mensagem). */
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  variant?: RgConfirmVariant
  /** `alert` = só botão OK (substitui `window.alert`). */
  mode?: RgConfirmDialogMode
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const variantStyles: Record<
  RgConfirmVariant,
  { accent: string; confirmBg: string; confirmBorder: string; iconBg: string }
> = {
  default: {
    accent: '#0f766e',
    confirmBg: 'linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)',
    confirmBorder: '#0f766e',
    iconBg: '#f0fdfa',
  },
  success: {
    accent: '#15803d',
    confirmBg: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
    confirmBorder: '#15803d',
    iconBg: '#f0fdf4',
  },
  warning: {
    accent: '#b45309',
    confirmBg: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)',
    confirmBorder: '#d97706',
    iconBg: '#fffbeb',
  },
  danger: {
    accent: '#b91c1c',
    confirmBg: 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)',
    confirmBorder: '#b91c1c',
    iconBg: '#fef2f2',
  },
}

const btnCancel: CSSProperties = {
  padding: '10px 18px',
  borderRadius: '10px',
  border: '1px solid var(--rg-confirm-cancel-border, #cbd5e1)',
  background: 'var(--rg-confirm-cancel-bg, #fff)',
  color: 'var(--rg-confirm-cancel-color, #475569)',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
}

export function RgConfirmDialog({
  open,
  title,
  message,
  details,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'default',
  mode = 'confirm',
  loading = false,
  onConfirm,
  onCancel,
}: RgConfirmDialogProps) {
  const v = variantStyles[variant]
  const isAlert = mode === 'alert'
  const btnConfirmLabel = confirmLabel ?? (isAlert ? 'OK' : 'Confirmar')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div
      className="rg-confirm-overlay"
      role="alertdialog"
      aria-modal
      aria-labelledby="rg-confirm-title"
      aria-describedby={message || details?.length ? 'rg-confirm-desc' : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 13000,
        background: 'var(--rg-confirm-overlay, rgba(15, 23, 42, 0.5))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className={`rg-confirm-panel rg-confirm-dialog rg-confirm-dialog--${variant}`}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--rg-confirm-bg, #fff)',
          borderRadius: '16px',
          boxShadow: 'var(--rg-confirm-shadow, 0 24px 60px rgba(15, 23, 42, 0.22))',
          border: '1px solid var(--rg-confirm-border, #e2e8f0)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rg-confirm-header"
          style={{
            display: 'flex',
            gap: '14px',
            padding: '22px 22px 16px',
            borderBottom: '1px solid var(--rg-confirm-header-border, #f1f5f9)',
          }}
        >
          <div
            className="rg-confirm-icon"
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: v.iconBg,
              border: `1px solid ${v.confirmBorder}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
            }}
          >
            {variant === 'danger' ? '!' : variant === 'warning' ? '?' : '✓'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: v.accent,
                marginBottom: '4px',
              }}
            >
              RG Ambiental
            </div>
            <h2
              id="rg-confirm-title"
              className="rg-confirm-title"
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--rg-confirm-title-color, #0f172a)',
                lineHeight: 1.3,
              }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="rg-confirm-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Fechar"
            style={{
              background: 'var(--rg-confirm-close-bg, #f1f5f9)',
              border: 'none',
              borderRadius: '10px',
              width: 36,
              height: 36,
              fontSize: 20,
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--rg-confirm-close-color, #64748b)',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div id="rg-confirm-desc" className="rg-confirm-body" style={{ padding: '16px 22px 20px' }}>
          {message ? (
            <p
              className="rg-confirm-message"
              style={{
                margin: '0 0 12px',
                fontSize: '14px',
                color: 'var(--rg-confirm-text-color, #334155)',
                lineHeight: 1.55,
                whiteSpace: typeof message === 'string' && message.includes('\n') ? 'pre-line' : undefined,
              }}
            >
              {message}
            </p>
          ) : null}
          {details && details.length > 0 ? (
            <ul
              className="rg-confirm-details"
              style={{
                margin: 0,
                padding: '12px 14px 12px 28px',
                borderRadius: '10px',
                background: 'var(--rg-confirm-details-bg, #f8fafc)',
                border: '1px solid var(--rg-confirm-details-border, #e2e8f0)',
                fontSize: '13px',
                color: 'var(--rg-confirm-details-color, #475569)',
                lineHeight: 1.5,
              }}
            >
              {details.map((line) => (
                <li key={line} style={{ marginBottom: details!.length > 1 ? 6 : 0 }}>
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div
          className="rg-confirm-footer"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'flex-end',
            padding: '14px 22px 20px',
            borderTop: '1px solid var(--rg-confirm-footer-border, #f1f5f9)',
            background: 'var(--rg-confirm-footer-bg, #fafafa)',
          }}
        >
          {!isAlert ? (
            <button type="button" onClick={onCancel} disabled={loading} style={btnCancel}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: `1px solid ${v.confirmBorder}`,
              background: v.confirmBg,
              color: '#fff',
              fontWeight: 800,
              fontSize: '14px',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.85 : 1,
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
            }}
          >
            {loading ? 'A processar…' : btnConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
