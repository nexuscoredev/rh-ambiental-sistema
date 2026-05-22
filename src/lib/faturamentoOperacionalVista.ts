import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import {
  fetchContagemHistoricoFaturamentoEmitido,
  fetchVwFaturamentoResumoPaginated,
  fetchVwFaturamentoResumoPorColetaIds,
  faturamentoResumoDesdeDias,
} from './faturamentoResumoFetch'
import {
  contarGruposHistoricoFaturamentoEmitido,
  somarValorHistoricoFaturamentoSemDuplicar,
} from './faturamentoConsolidacaoMtr'

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

  const incorporarLinhasNaVista = useCallback((novas: FaturamentoResumoViewRow[]) => {
    if (novas.length === 0) return
    setLinhasHistorico((prev) => {
      const map = new Map((prev ?? []).map((r) => [r.coleta_id, r]))
      for (const r of novas) map.set(r.coleta_id, r)
      return [...map.values()]
    })
    setLinhasExtras((prev) => {
      const map = new Map(prev.map((r) => [r.coleta_id, r]))
      for (const r of novas) {
        if (!map.has(r.coleta_id)) map.set(r.coleta_id, r)
      }
      return [...map.values()]
    })
  }, [])

  const recarregarTudo = useCallback(async () => {
    await Promise.all([carregarOperacional(), carregarHistorico()])
    const { count, error } = await fetchContagemHistoricoFaturamentoEmitido(supabase)
    if (!error) setContagemHistorico(count)
  }, [carregarOperacional, carregarHistorico])

  /** Após «Faturar»: traz a coleta emitida para a vista antes do reload completo (secção NF/boleto). */
  const recarregarAposEmitir = useCallback(
    async (coletaIds: string[]) => {
      const uniq = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
      if (uniq.length > 0) {
        const { data, error } = await fetchVwFaturamentoResumoPorColetaIds(supabase, uniq)
        if (!error && data.length > 0) incorporarLinhasNaVista(data)
      }
      await recarregarTudo()
    },
    [incorporarLinhasNaVista, recarregarTudo]
  )

  /** Após «Finalizar processo» (NF/boleto): atualiza vista e remove da fila 7. */
  const recarregarAposFinalizarNfBoleto = recarregarAposEmitir

  useEffect(() => {
    let cancelado = false
    queueMicrotask(() => {
      void (async () => {
        /**
         * Emitidas (etapa 7 — NF/boleto) não entram no escopo «operacional».
         * Carregar histórico sempre na abertura evita a secção «Mala Direta» só aparecer após outra ação.
         */
        await Promise.all([carregarOperacional(), carregarHistorico()])
        if (cancelado) return
        const { count, error } = await fetchContagemHistoricoFaturamentoEmitido(supabase)
        if (!error) setContagemHistorico(count)
      })()
    })
    return () => {
      cancelado = true
    }
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

  const historicoEmitidos = useMemo(() => linhasHistorico ?? [], [linhasHistorico])

  const qtdEmitidasCartao =
    linhasHistorico !== null
      ? contarGruposHistoricoFaturamentoEmitido(linhasHistorico)
      : (contagemHistorico ?? historicoEmitidos.length)

  const valorTotalEmitidoBase = useMemo(() => {
    if (linhasHistorico === null) return 0
    return somarValorHistoricoFaturamentoSemDuplicar(linhasHistorico)
  }, [linhasHistorico])

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
    recarregarAposEmitir,
    recarregarAposFinalizarNfBoleto,
    qtdEmitidasCartao,
    valorEmitidasCartao,
    diasJanela,
  }
}
