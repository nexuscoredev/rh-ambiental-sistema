import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import {
  fetchContagemHistoricoFaturamentoEmitido,
  fetchVwFaturamentoResumoPaginated,
  fetchVwFaturamentoResumoPorColetaIds,
  faturamentoResumoDesdeDias,
} from './faturamentoResumoFetch'
import { coletaHistoricoFaturamentoEmitido } from './faturamentoOperacionalFila'

function mergeLinhasPorColetaId(
  operacional: FaturamentoResumoViewRow[],
  historico: FaturamentoResumoViewRow[] | null,
  extras: FaturamentoResumoViewRow[]
): FaturamentoResumoViewRow[] {
  const map = new Map<string, FaturamentoResumoViewRow>()
  for (const r of operacional) map.set(r.coleta_id, r)
  for (const r of historico ?? []) map.set(r.coleta_id, r)
  for (const r of extras) map.set(r.coleta_id, r)
  return [...map.values()]
}

export function useFaturamentoOperacionalVista(coletaIdUrl?: string | null) {
  const [linhasOperacional, setLinhasOperacional] = useState<FaturamentoResumoViewRow[]>([])
  const [linhasHistorico, setLinhasHistorico] = useState<FaturamentoResumoViewRow[] | null>(null)
  const [linhasExtras, setLinhasExtras] = useState<FaturamentoResumoViewRow[]>([])
  const [contagemHistorico, setContagemHistorico] = useState<number | null>(null)
  const [carregandoOperacional, setCarregandoOperacional] = useState(true)
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [erroVista, setErroVista] = useState('')
  const [ticketAprovacaoAtivo, setTicketAprovacaoAtivo] = useState(true)
  const [esteiraMedicaoAtiva, setEsteiraMedicaoAtiva] = useState(true)

  const linhasView = useMemo(
    () => mergeLinhasPorColetaId(linhasOperacional, linhasHistorico, linhasExtras),
    [linhasOperacional, linhasHistorico, linhasExtras]
  )

  const carregarOperacional = useCallback(async () => {
    setCarregandoOperacional(true)
    setErroVista('')
    const { data, error, ticketAprovacaoAtivo: ticketCols, esteiraMedicaoAtiva: esteiraCols } =
      await fetchVwFaturamentoResumoPaginated(supabase, { escopo: 'operacional' })

    if (error) {
      console.error(error)
      setErroVista(
        error.message.includes('vw_faturamento_resumo')
          ? error.message
          : 'Não foi possível carregar a consolidação de faturamento. Verifique se a view vw_faturamento_resumo existe e está publicada no Supabase.'
      )
      setLinhasOperacional([])
      setTicketAprovacaoAtivo(false)
      setEsteiraMedicaoAtiva(false)
      setCarregandoOperacional(false)
      return
    }

    setTicketAprovacaoAtivo(ticketCols)
    setEsteiraMedicaoAtiva(esteiraCols)
    setLinhasOperacional(data)
    setCarregandoOperacional(false)
  }, [])

  const carregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true)
    const { data, error, ticketAprovacaoAtivo: ticketCols, esteiraMedicaoAtiva: esteiraCols } =
      await fetchVwFaturamentoResumoPaginated(supabase, { escopo: 'historico' })
    setCarregandoHistorico(false)
    if (error) {
      console.warn('[faturamento] histórico emitidas:', error.message)
      setLinhasHistorico([])
      return
    }
    setTicketAprovacaoAtivo(ticketCols)
    setEsteiraMedicaoAtiva(esteiraCols)
    setLinhasHistorico(data)
  }, [])

  const recarregarTudo = useCallback(async () => {
    await carregarOperacional()
    void fetchContagemHistoricoFaturamentoEmitido(supabase).then(({ count, error }) => {
      if (!error) setContagemHistorico(count)
    })
    if (linhasHistorico !== null) {
      await carregarHistorico()
    }
  }, [carregarOperacional, carregarHistorico, linhasHistorico])

  useEffect(() => {
    queueMicrotask(() => {
      void carregarOperacional()
      void carregarHistorico()
      void fetchContagemHistoricoFaturamentoEmitido(supabase).then(({ count, error }) => {
        if (!error) setContagemHistorico(count)
      })
    })
  }, [carregarOperacional, carregarHistorico])

  useEffect(() => {
    const id = (coletaIdUrl ?? '').trim()
    if (!id) return
    const jaTem =
      linhasOperacional.some((r) => r.coleta_id === id) ||
      (linhasHistorico?.some((r) => r.coleta_id === id) ?? false) ||
      linhasExtras.some((r) => r.coleta_id === id)
    if (jaTem) return

    let cancel = false
    void fetchVwFaturamentoResumoPorColetaIds(supabase, [id]).then(({ data, error }) => {
      if (cancel || error || data.length === 0) return
      setLinhasExtras((prev) => {
        const ids = new Set(prev.map((r) => r.coleta_id))
        return [...prev, ...data.filter((r) => !ids.has(r.coleta_id))]
      })
    })
    return () => {
      cancel = true
    }
  }, [coletaIdUrl, linhasOperacional, linhasHistorico, linhasExtras])

  const historicoEmitidos = useMemo(() => {
    const base = linhasHistorico ?? []
    return base.filter((r) => coletaHistoricoFaturamentoEmitido(r))
  }, [linhasHistorico])

  const qtdEmitidasCartao = contagemHistorico ?? historicoEmitidos.length

  const valorTotalEmitidoBase = useMemo(() => {
    let s = 0
    for (const r of historicoEmitidos) {
      const v = r.faturamento_registro_valor ?? r.valor_coleta
      if (v != null && Number.isFinite(Number(v))) s += Number(v)
    }
    return s
  }, [historicoEmitidos])

  const valorEmitidasCartao =
    valorTotalEmitidoBase > 0
      ? valorTotalEmitidoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : linhasHistorico === null
        ? '—'
        : '—'

  const diasJanela = faturamentoResumoDesdeDias()

  return {
    linhasView,
    linhasOperacional,
    linhasHistorico,
    historicoEmitidos,
    historicoCarregado: linhasHistorico !== null,
    carregandoOperacional,
    carregandoHistorico,
    carregandoVista: carregandoOperacional,
    erroVista,
    ticketAprovacaoAtivo,
    esteiraMedicaoAtiva,
    carregarOperacional,
    carregarHistorico,
    recarregarTudo,
    qtdEmitidasCartao,
    valorEmitidasCartao,
    diasJanela,
  }
}
