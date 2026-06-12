import { useEffect, useState, type CSSProperties } from 'react'

export type SolicitarExclusaoMotivoDialogProps = {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (motivo: string) => void
  onCancel: () => void
}

const btnCancel: CSSProperties = {
  padding: '10px 18px',
  borderRadius: '10px',
  border: "1px solid var(--input-border, #cbd5e1)",
  background: "var(--bg-card, #ffffff)",
  color: "var(--text-secondary, #475569)",
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
}

export function SolicitarExclusaoMotivoDialog({
  open,
  title,
  message,
  confirmLabel = 'Enviar solicitação',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: SolicitarExclusaoMotivoDialogProps) {
  const [motivo, setMotivo] = useState('')
  const [erroLocal, setErroLocal] = useState('')

  useEffect(() => {
    if (open) {
      setMotivo('')
      setErroLocal('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  function confirmar() {
    const t = motivo.trim()
    if (t.length < 3) {
      setErroLocal('Informe o motivo da exclusão (mínimo 3 caracteres).')
      return
    }
    onConfirm(t)
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="solicitar-exclusao-title"
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
          maxWidth: '480px',
          background: "var(--bg-card, #ffffff)",
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
          border: "1px solid var(--border-color, #e2e8f0)",
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
              color: '#b45309',
              marginBottom: '4px',
            }}
          >
            Aprovação da Thais
          </div>
          <h2
            id="solicitar-exclusao-title"
            style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: "var(--text-primary, #0f172a)" }}
          >
            {title}
          </h2>
          {message ? (
            <p style={{ margin: '10px 0 0', fontSize: '14px', color: "var(--text-primary, #334155)", lineHeight: 1.5 }}>
              {message}
            </p>
          ) : null}
        </div>

        <div style={{ padding: '16px 22px' }}>
          <label
            htmlFor="motivo-exclusao"
            style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: "var(--text-secondary, #475569)", marginBottom: 8 }}
          >
            Motivo da exclusão *
          </label>
          <textarea
            id="motivo-exclusao"
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              if (erroLocal) setErroLocal('')
            }}
            rows={4}
            placeholder="Descreva por que este registro deve ser excluído…"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${erroLocal ? '#f87171' : '#cbd5e1'}`,
              fontSize: '14px',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          {erroLocal ? (
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#b91c1c' }}>{erroLocal}</p>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: "var(--text-secondary, #64748b)" }}>
              A solicitação será enviada para a fila de aprovação da Thais.
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'flex-end',
            padding: '14px 22px 20px',
            borderTop: '1px solid #f1f5f9',
            background: "var(--bg-inset, #fafafa)",
          }}
        >
          <button type="button" onClick={onCancel} style={btnCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirmar}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid #b45309',
              background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
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
