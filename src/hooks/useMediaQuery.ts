import { useEffect, useState } from 'react'

/** `matchMedia` com listener — evita re-render em todo resize desnecessário. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Layout principal: telefone / tablet estreito (menu drawer). */
export function useLayoutMobile(): boolean {
  return useMediaQuery('(max-width: 900px)')
}
