import { useRgDialog } from './RgDialogProvider'

/** @deprecated Preferir `useRgDialog()` — mantido para imports existentes. */
export function useRgConfirm() {
  const { confirm, alert } = useRgDialog()
  return { confirm, alert, dialogElement: null }
}

export type { RgDialogOptions as RgConfirmOptions } from './RgDialogProvider'
