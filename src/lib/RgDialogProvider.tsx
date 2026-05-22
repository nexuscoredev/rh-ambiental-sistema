import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { RgConfirmDialog, type RgConfirmVariant } from '../components/ui/RgConfirmDialog'
import { RgPromptDialog } from '../components/ui/RgPromptDialog'

export type RgDialogOptions = {
  title: string
  message?: ReactNode
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  variant?: RgConfirmVariant
}

export type RgAlertOptions = RgDialogOptions

export type RgPromptOptions = {
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
}

type PendingConfirm = RgDialogOptions & { kind: 'confirm'; resolve: (v: boolean) => void }
type PendingAlert = RgAlertOptions & { kind: 'alert'; resolve: () => void }
type PendingPrompt = RgPromptOptions & { kind: 'prompt'; resolve: (v: string | null) => void }

type Pending = PendingConfirm | PendingAlert | PendingPrompt

type RgDialogContextValue = {
  confirm: (opts: RgDialogOptions) => Promise<boolean>
  alert: (opts: RgAlertOptions) => Promise<void>
  prompt: (opts: RgPromptOptions) => Promise<string | null>
}

const RgDialogContext = createContext<RgDialogContextValue | null>(null)

export function RgDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback((opts: RgDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, kind: 'confirm', resolve })
    })
  }, [])

  const alert = useCallback((opts: RgAlertOptions) => {
    return new Promise<void>((resolve) => {
      setPending({ ...opts, kind: 'alert', resolve: () => resolve() })
    })
  }, [])

  const prompt = useCallback((opts: RgPromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPending({ ...opts, kind: 'prompt', resolve })
    })
  }, [])

  const closeConfirm = useCallback((result: boolean) => {
    setPending((p) => {
      if (p?.kind === 'confirm') p.resolve(result)
      return null
    })
  }, [])

  const closeAlert = useCallback(() => {
    setPending((p) => {
      if (p?.kind === 'alert') p.resolve()
      return null
    })
  }, [])

  const closePrompt = useCallback((result: string | null) => {
    setPending((p) => {
      if (p?.kind === 'prompt') p.resolve(result)
      return null
    })
  }, [])

  const value = useMemo(() => ({ confirm, alert, prompt }), [confirm, alert, prompt])

  useEffect(() => {
    bindRgDialogBridge(value)
    return () => bindRgDialogBridge(null)
  }, [value])

  return (
    <RgDialogContext.Provider value={value}>
      {children}
      {pending?.kind === 'prompt' ? (
        <RgPromptDialog
          open
          title={pending.title}
          message={pending.message}
          defaultValue={pending.defaultValue}
          placeholder={pending.placeholder}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          onConfirm={(v) => closePrompt(v)}
          onCancel={() => closePrompt(null)}
        />
      ) : (
        <RgConfirmDialog
          open={pending != null}
          mode={pending?.kind === 'alert' ? 'alert' : 'confirm'}
          title={pending?.title ?? ''}
          message={pending && 'message' in pending ? pending.message : undefined}
          details={pending && 'details' in pending ? pending.details : undefined}
          confirmLabel={pending && 'confirmLabel' in pending ? pending.confirmLabel : undefined}
          cancelLabel={pending && 'cancelLabel' in pending ? pending.cancelLabel : undefined}
          variant={pending && 'variant' in pending ? pending.variant : undefined}
          onConfirm={() => {
            if (pending?.kind === 'alert') closeAlert()
            else closeConfirm(true)
          }}
          onCancel={() => {
            if (pending?.kind === 'alert') closeAlert()
            else closeConfirm(false)
          }}
        />
      )}
    </RgDialogContext.Provider>
  )
}

export function useRgDialog(): RgDialogContextValue {
  const ctx = useContext(RgDialogContext)
  if (!ctx) {
    throw new Error('useRgDialog deve ser usado dentro de RgDialogProvider')
  }
  return ctx
}

/** API imperativa para módulos fora de React (ex.: impressão). */
let dialogBridge: RgDialogContextValue | null = null

export function bindRgDialogBridge(api: RgDialogContextValue | null) {
  dialogBridge = api
}

export async function rgAlert(opts: RgAlertOptions): Promise<void> {
  if (dialogBridge) return dialogBridge.alert(opts)
  const msg = typeof opts.message === 'string' ? opts.message : opts.title
  window.alert(msg)
}

export async function rgConfirm(opts: RgDialogOptions): Promise<boolean> {
  if (dialogBridge) return dialogBridge.confirm(opts)
  return window.confirm(typeof opts.message === 'string' ? opts.message : opts.title)
}
