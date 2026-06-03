import { useCallback, useEffect, useState } from 'react'
import {
  fetchStatsSenhaPessoalAcompanhamento,
  type StatsSenhaPessoalAcompanhamento,
} from '../lib/senhaPessoalConfirmacao'

export function useSenhaPessoalAcompanhamento() {
  const [stats, setStats] = useState<StatsSenhaPessoalAcompanhamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const s = await fetchStatsSenhaPessoalAcompanhamento()
      setStats(s)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
      setStats(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { stats, carregando, erro, recarregar }
}
