import { useEffect, useId, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  clearPwaUpdateBarHost,
  getPwaUpdateBarHost,
  PWA_UPDATE_BAR_HOST_ID,
} from '../../lib/pwaUpdateBarHost'

type PwaUpdateNotificationProps = {
  visible: boolean
  onApply: () => void
}

let activeOwnerId: string | null = null

/**
 * Balão único de nova versão (portal no body + dono activo).
 * Impede dois avisos quando há registo SW duplicado ou remount do shell.
 */
export function PwaUpdateNotification({ visible, onApply }: PwaUpdateNotificationProps) {
  const ownerId = useId()

  useEffect(() => {
    if (!visible) {
      if (activeOwnerId === ownerId) activeOwnerId = null
      return
    }
    if (!activeOwnerId) activeOwnerId = ownerId
    return () => {
      if (activeOwnerId === ownerId) activeOwnerId = null
    }
  }, [visible, ownerId])

  useLayoutEffect(() => {
    if (!visible) {
      clearPwaUpdateBarHost()
      return
    }
    document.querySelectorAll('.pwa-update-bar').forEach((el) => {
      if (!el.closest(`#${PWA_UPDATE_BAR_HOST_ID}`)) el.remove()
    })
    return () => clearPwaUpdateBarHost()
  }, [visible])

  const isOwner = visible && activeOwnerId === ownerId
  const host = isOwner ? getPwaUpdateBarHost() : null

  if (!isOwner || !host) return null

  return createPortal(
    <div className="pwa-update-bar" role="alert" aria-live="polite">
      <p className="pwa-update-bar__intro">
        Ol{'\u00e1'}! Temos uma nova atualiza{'\u00e7'}{'\u00e3'}o para voc{'\u00ea'}!
      </p>
      <button type="button" className="pwa-update-bar__cta" onClick={() => void onApply()}>
        Clique aqui e atualize agora!
      </button>
    </div>,
    host
  )
}
