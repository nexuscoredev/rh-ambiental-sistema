import { useTemaAplicacao } from '../../lib/TemaAplicacaoProvider'

function animarTransicaoTema() {
  const root = document.documentElement
  root.classList.add('theme-transition')
  window.setTimeout(() => root.classList.remove('theme-transition'), 320)
}

/** Alterna tema claro / escuro no cabeçalho. */
export function TemaToggle() {
  const { escuro, alternar } = useTemaAplicacao()

  return (
    <button
      type="button"
      className="tema-toggle"
      onClick={() => {
        animarTransicaoTema()
        alternar()
      }}
      aria-label={escuro ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={escuro ? 'Modo claro' : 'Modo escuro'}
    >
      <span className="tema-toggle__track" aria-hidden>
        <span className={`tema-toggle__thumb${escuro ? ' tema-toggle__thumb--dark' : ''}`}>
          {escuro ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          )}
        </span>
      </span>
      <span className="tema-toggle__label">{escuro ? 'Escuro' : 'Claro'}</span>
    </button>
  )
}
