import { lazy, type ComponentType } from 'react'

export const CHUNK_RELOAD_KEY = 'rg-chunk-reload-once'

export function isChunkOrImportFailure(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e)
  return (
    /Failed to fetch dynamically imported module/i.test(m) ||
    /Loading chunk \d+ failed/i.test(m) ||
    /Importing a module script failed/i.test(m) ||
    /error loading dynamically imported module/i.test(m)
  )
}

/** Recarrega uma vez após deploy (HTML/JS antigo a referenciar chunk que já não existe). */
export function reloadOnceForChunkDeploy(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  } catch {
    return false
  }
  const url = new URL(window.location.href)
  url.searchParams.set('_rg', String(Date.now()))
  window.location.replace(url.toString())
  return true
}

/**
 * Como `React.lazy`, mas após um novo deploy o utilizador pode ter o bundle antigo em memória
 * a referenciar chunks que já não existem. Recarrega a página uma vez para obter o HTML/JS novos.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory()
      sessionStorage.removeItem(CHUNK_RELOAD_KEY)
      return mod
    } catch (e) {
      if (isChunkOrImportFailure(e) && reloadOnceForChunkDeploy()) {
        return {
          default: (() => null) as unknown as T,
        }
      }
      try {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY)
      } catch {
        /* ignore */
      }
      throw e
    }
  })
}
