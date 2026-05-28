import { lazy, type ComponentType, type CSSProperties } from 'react'

export const CHUNK_RELOAD_KEY = 'rg-chunk-reload-once'

const telaBase: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f1f5f9',
  padding: 24,
  fontFamily: 'system-ui, sans-serif',
}

const cartaoBase: CSSProperties = {
  maxWidth: 480,
  width: '100%',
  background: '#fff',
  borderRadius: 16,
  padding: '24px 28px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.08)',
  textAlign: 'center',
}

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

export function limparCacheERecarregarApp(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
  } catch {
    /* ignore */
  }
  const runReload = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('_rg', String(Date.now()))
    window.location.replace(url.toString())
  }
  if ('caches' in window) {
    void caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k))).finally(runReload)
    )
    return
  }
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) void r.unregister()
      runReload()
    })
    return
  }
  runReload()
}

/** Ecrã visível enquanto a página recarrega após deploy (nunca retornar `null`). */
function ChunkDeployReloadScreen() {
  return (
    <div style={telaBase}>
      <div style={cartaoBase}>
        <h1 style={{ margin: '0 0 10px', fontSize: 20, color: '#0f766e' }}>A atualizar o sistema</h1>
        <p style={{ margin: '0 0 16px', color: '#64748b', lineHeight: 1.5, fontSize: 15 }}>
          Foi publicada uma versão nova. O navegador está a obter os ficheiros atualizados…
        </p>
        <button
          type="button"
          onClick={limparCacheERecarregarApp}
          style={{
            padding: '12px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#0d9488',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Recarregar agora
        </button>
      </div>
    </div>
  )
}

/** Falha persistente de chunk após uma recarga automática. */
function ChunkDeployErrorScreen() {
  return (
    <div style={telaBase}>
      <div style={{ ...cartaoBase, borderColor: '#fecaca' }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 20, color: '#991b1b' }}>
          Não foi possível carregar esta página
        </h1>
        <p style={{ margin: '0 0 16px', color: '#64748b', lineHeight: 1.5, fontSize: 15 }}>
          Isto costuma acontecer logo após uma atualização, quando o cache do navegador ficou
          desactualizado. Limpe o cache e recarregue.
        </p>
        <button
          type="button"
          onClick={limparCacheERecarregarApp}
          style={{
            padding: '12px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#0d9488',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Limpar cache e recarregar
        </button>
      </div>
    </div>
  )
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
      try {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY)
      } catch {
        /* ignore */
      }
      return mod
    } catch (e) {
      if (isChunkOrImportFailure(e)) {
        if (reloadOnceForChunkDeploy()) {
          return { default: ChunkDeployReloadScreen as unknown as T }
        }
        return { default: ChunkDeployErrorScreen as unknown as T }
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
