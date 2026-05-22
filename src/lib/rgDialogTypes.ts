import type { ReactNode } from 'react'
import type { RgConfirmVariant } from '../components/ui/RgConfirmDialog'

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

export type RgDialogApi = {
  confirm: (opts: RgDialogOptions) => Promise<boolean>
  alert: (opts: RgAlertOptions) => Promise<void>
  prompt: (opts: RgPromptOptions) => Promise<string | null>
}
