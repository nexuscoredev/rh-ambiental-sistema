import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  alternarTema,
  aplicarTemaNoDocumento,
  initTemaAntesRender,
  lerTemaSalvo,
  salvarTema,
  type TemaAplicacao,
} from './temaAplicacao'

type TemaContextValue = {
  tema: TemaAplicacao
  escuro: boolean
  setTema: (t: TemaAplicacao) => void
  alternar: () => void
}

const TemaContext = createContext<TemaContextValue | null>(null)

export function TemaAplicacaoProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<TemaAplicacao>(() => initTemaAntesRender())

  const setTema = useCallback((t: TemaAplicacao) => {
    salvarTema(t)
    setTemaState(t)
  }, [])

  const alternar = useCallback(() => {
    setTemaState((atual) => alternarTema(atual))
  }, [])

  useEffect(() => {
    aplicarTemaNoDocumento(tema)
  }, [tema])

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== 'rg-tema-aplicacao' || !ev.newValue) return
      const t = ev.newValue === 'dark' ? 'dark' : 'light'
      setTemaState(t)
      aplicarTemaNoDocumento(t)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({
      tema,
      escuro: tema === 'dark',
      setTema,
      alternar,
    }),
    [tema, setTema, alternar]
  )

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>
}

export function useTemaAplicacao(): TemaContextValue {
  const ctx = useContext(TemaContext)
  if (!ctx) {
    return {
      tema: lerTemaSalvo(),
      escuro: lerTemaSalvo() === 'dark',
      setTema: salvarTema,
      alternar: () => alternarTema(lerTemaSalvo()),
    }
  }
  return ctx
}
