/** Preferência de tema claro/escuro — persistida em localStorage. */

export type TemaAplicacao = 'light' | 'dark'

export const TEMA_STORAGE_KEY = 'rg-tema-aplicacao'

export function lerTemaSalvo(): TemaAplicacao {
  if (typeof window === 'undefined') return 'light'
  try {
    const v = localStorage.getItem(TEMA_STORAGE_KEY)
    return v === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function aplicarTemaNoDocumento(tema: TemaAplicacao): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (tema === 'dark') {
    root.setAttribute('data-theme', 'dark')
    root.style.colorScheme = 'dark'
  } else {
    root.removeAttribute('data-theme')
    root.style.colorScheme = 'light'
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', tema === 'dark' ? '#0c1220' : '#0f766e')
  }
}

export function salvarTema(tema: TemaAplicacao): void {
  try {
    localStorage.setItem(TEMA_STORAGE_KEY, tema)
  } catch {
    /* ignore quota / private mode */
  }
  aplicarTemaNoDocumento(tema)
}

export function alternarTema(atual: TemaAplicacao): TemaAplicacao {
  const next: TemaAplicacao = atual === 'dark' ? 'light' : 'dark'
  salvarTema(next)
  return next
}

/** Chamar antes do React montar (main.tsx + inline em index.html). */
export function initTemaAntesRender(): TemaAplicacao {
  const tema = lerTemaSalvo()
  aplicarTemaNoDocumento(tema)
  return tema
}
