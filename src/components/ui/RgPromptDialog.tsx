import { useEffect, useState, type CSSProperties } from 'react'

export type RgPromptDialogProps = {
  open: boolean
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

const btnCancel: CSSProperties = {
  padding: '10px 18px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#475569',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
}

export function RgPromptDialog({
  open,
  title,
  message,
  defaultValue = '',
  placeholder,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: RgPromptDialogProps) {
  const [valor, setValor] = useState(defaultValue)

  useEffect(() => {
    if (open) setValor(defaultValue)
  }, [open, defaultValue])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="rg-prompt-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 13000,
        background: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '22px 22px 12px', borderBottom: '1px solid #f1f5f9' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#0f766e',
              marginBottom: '4px',
            }}
          >
            RG Ambiental
          </div>
          <h2 id="rg-prompt-title" style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
            {title}
          </h2>
          {message ? (
            <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>{message}</p>
          ) : null}
        </div>

        <div style={{ padding: '16px 22px' }}>
          <input
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={placeholder}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(valor)
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'flex-end',
            padding: '14px 22px 20px',
            borderTop: '1px solid #f1f5f9',
            background: '#fafafa',
          }}
        >
          <button type="button" onClick={onCancel} style={btnCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(valor)}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid #0f766e',
              background: 'linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
