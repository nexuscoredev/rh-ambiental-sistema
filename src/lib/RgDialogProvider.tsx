import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { RgConfirmDialog } from '../components/ui/RgConfirmDialog'
import { RgPromptDialog } from '../components/ui/RgPromptDialog'
import { bindRgDialogBridge } from './rgDialogBridge'
import type { RgAlertOptions, RgDialogApi, RgDialogOptions, RgPromptOptions } from './rgDialogTypes'

export type { RgAlertOptions, RgDialogOptions, RgPromptOptions } from './rgDialogTypes'
export { rgAlert, rgConfirm } from './rgDialogBridge'

type PendingConfirm = RgDialogOptions & { kind: 'confirm'; resolve: (v: boolean) => void }
type PendingAlert = RgAlertOptions & { kind: 'alert'; resolve: () => void }
type PendingPrompt = RgPromptOptions & { kind: 'prompt'; resolve: (v: string | null) => void }

type Pending = PendingConfirm | PendingAlert | PendingPrompt

const RgDialogContext = createContext<RgDialogApi | null>(null)

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

  const value = useMemo<RgDialogApi>(() => ({ confirm, alert, prompt }), [confirm, alert, prompt])

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

export function useRgDialog(): RgDialogApi {
  const ctx = useContext(RgDialogContext)
  if (!ctx) {
    throw new Error('useRgDialog deve ser usado dentro de RgDialogProvider')
  }
  return ctx
}
