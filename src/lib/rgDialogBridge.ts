import type { RgAlertOptions, RgDialogApi, RgDialogOptions } from './rgDialogTypes'

let dialogBridge: RgDialogApi | null = null

export function bindRgDialogBridge(api: RgDialogApi | null) {
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
