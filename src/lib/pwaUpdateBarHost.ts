/** Um único contentor no body para o balão de atualização PWA (evita duplicados). */
export const PWA_UPDATE_BAR_HOST_ID = 'rg-pwa-update-bar-host'

let hostEl: HTMLElement | null = null

export function getPwaUpdateBarHost(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  if (hostEl && document.body.contains(hostEl)) return hostEl
  const existing = document.getElementById(PWA_UPDATE_BAR_HOST_ID)
  if (existing) {
    hostEl = existing
    return hostEl
  }
  hostEl = document.createElement('div')
  hostEl.id = PWA_UPDATE_BAR_HOST_ID
  document.body.appendChild(hostEl)
  return hostEl
}

export function clearPwaUpdateBarHost(): void {
  const el = document.getElementById(PWA_UPDATE_BAR_HOST_ID)
  if (el) el.replaceChildren()
  hostEl = null
}
