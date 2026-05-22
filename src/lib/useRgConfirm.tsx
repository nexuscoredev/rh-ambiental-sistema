import { useCallback, useState, type ReactNode } from 'react'
import { RgConfirmDialog, type RgConfirmVariant } from '../components/ui/RgConfirmDialog'

export type RgConfirmOptions = {
  title: string
  message?: ReactNode
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  variant?: RgConfirmVariant
}

type Pending = RgConfirmOptions & { resolve: (value: boolean) => void }

export function useRgConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback((opts: RgConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  const close = useCallback((result: boolean) => {
    setPending((p) => {
      if (p) p.resolve(result)
      return null
    })
  }, [])

  const dialogElement = (
    <RgConfirmDialog
      open={pending != null}
      title={pending?.title ?? ''}
      message={pending?.message}
      details={pending?.details}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      variant={pending?.variant}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  )

  return { confirm, dialogElement }
}
