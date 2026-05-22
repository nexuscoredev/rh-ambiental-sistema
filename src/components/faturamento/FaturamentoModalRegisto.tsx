import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { payloadFaturamentoEmitidoAguardaFinalizacaoEsteira } from '../../lib/coletaFluxoAtualizacao'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import { coletaElegivelParaFaturar, rotuloMotivoInelegivel } from '../../lib/faturamentoElegibilidade'
import { sugerirDataVencimentoIso } from '../../services/financeiroReceber'
import {
  resolverPrecoSugerido,
  rotuloOrigemPreco,
  type RegraPrecoRow,
} from '../../services/pricing'
import { isMissingClienteContratoColumnsError } from '../../lib/clienteContratoCadastro'
import {
  marcarEsteiraPosFaturamentoEmitido,
  marcarValoresMedicaoRevisados,
} from '../../lib/faturamentoEsteira'
import {
  calcularPrecoContratoColetaMtr,
  rotuloOrigemContrato,
  type ResultadoPrecoContrato,
} from '../../lib/faturamentoPrecoContrato'
import {
  aplicarSugestaoContratoNoResumoMtr,
  resumoMtrPrecosVazios,
  criarResumoFinanceiroDoOperacional,
  marcarTicketEncerradoDefinitivoResumo,
  parseNumeroCampo,
  parseResumoFinanceiroJson,
  resumoFinanceiroParaJsonb,
  totalResumoFinanceiro,
  type ResumoFinanceiroDesvinculado,
} from '../../lib/faturamentoDesvinculacao'
import {
  calcularPrecoContratoMtrConsolidado,
  coletasPesoParaContratoFromResumo,
  criarResumoFinanceiroConsolidado,
  emitirFaturamentoConsolidadoMtr,
  escolherColetaLiderFaturamento,
} from '../../lib/faturamentoConsolidacaoMtr'
import {
  faturamentoRegistrosErroColunasOpcionais,
  faturamentoRegistrosErroResumoFinanceiro,
  montarPayloadsFaturamentoRegistro,
  persistirFaturamentoRegistro,
} from '../../lib/faturamentoRegistrosPersist'
import { encerrarTicketDefinitivoFaturamento } from '../../lib/faturamentoTicketFluxo'
import {
  aplicarResumoFinanceiroNaOperacional,
  persistirResumoPendenteGrupoMtr,
  recalcularResumoDesdeOperacional,
} from '../../lib/faturamentoOperacionalSync'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useRgDialog } from '../../lib/RgDialogProvider'
import { FaturamentoResumoDesvinculado } from './FaturamentoResumoDesvinculado'
import { FaturamentoMtrRateioPanel } from './FaturamentoMtrRateioPanel'

function parseValor(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type StatusFat = 'pendente' | 'emitido' | 'cancelado'

type Props = {
  open: boolean
  row: FaturamentoResumoViewRow | null
  /** Coletas da mesma MTR faturadas num único registro (2+ tickets). */
  coletasConsolidadas?: FaturamentoResumoViewRow[]
  /** Confirmar emissão / salvar registro (Faturamento, Financeiro, Operacional (Time T), etc.). */
  podeConfirmarEmissao: boolean
  /** Resumos ticket/MTR editáveis — exclusivo Operacional (Time T) (+ admin). */
  podeEditarResumosFinanceiros?: boolean
  /** Encerramento definitivo do ticket nesta tela — exclusivo Operacional (Time T) (+ admin). */
  podeEncerrarTicketDefinitivo?: boolean
  /** @deprecated Use `podeConfirmarEmissao`. */
  podeMutar?: boolean
  usuarioCargo?: string | null
  onClose: () => void
  onGravado: () => void
  /** Se false, após emitir mantém-se na página atual (ex.: Financeiro unificado). Padrão: navega para Financeiro com contexto da coleta. */
  navegarAposEmitir?: boolean
  /** Revisão de valores antes do relatório de medição (não emite faturamento). */
  modoPreparacaoMedicao?: boolean
}

export function FaturamentoModalRegisto({
  open,
  row,
  coletasConsolidadas,
  podeConfirmarEmissao: podeConfirmarEmissaoProp,
  podeEditarResumosFinanceiros = false,
  podeEncerrarTicketDefinitivo = false,
  podeMutar,
  usuarioCargo = null,
  onClose,
  onGravado,
  modoPreparacaoMedicao = false,
}: Props) {
  const { confirm } = useRgDialog()
  const podeConfirmarEmissao = podeConfirmarEmissaoProp ?? podeMutar ?? false
  const [registroId, setRegistroId] = useState<string | null>(null)
  const [resumoFinanceiro, setResumoFinanceiro] = useState<ResumoFinanceiroDesvinculado | null>(null)
  const [observacoes, setObservacoes] = useState('')
  const [status, setStatus] = useState<StatusFat>('emitido')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [encerrandoTicket, setEncerrandoTicket] = useState(false)
  const [erro, setErro] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [regrasPreco, setRegrasPreco] = useState<RegraPrecoRow[]>([])
  const [carregandoRegras, setCarregandoRegras] = useState(false)
  const [dataVencimentoIso, setDataVencimentoIso] = useState('')
  const [contratoCliente, setContratoCliente] = useState<{
    residuos_contrato: unknown
    veiculos_contrato: unknown
    equipamentos_contrato: unknown
    tipo_residuo_legado: string | null
    descricao_veiculo_legado: string | null
    equipamentos_texto_legado: string | null
  } | null>(null)
  const [contextoMtr, setContextoMtr] = useState<{
    tipoCaminhao: string | null
    acondicionamento: string | null
  } | null>(null)
  const [carregandoContrato, setCarregandoContrato] = useState(false)
  /** Evita reinicializar o resumo a cada tecla (loop que congelava o formulário MTR). */
  const resumoInicializadoColetaRef = useRef<string | null>(null)
  /** Evita reaplicar preços do contrato em loop quando o resumo já foi preenchido. */
  const contratoAutoAplicadoRef = useRef<string | null>(null)
  const carregarRegistoGenRef = useRef(0)
  /** Evita sync na MTR/ticket ao abrir o modal (só após edição do utilizador). */
  const skipSyncOperacionalRef = useRef(true)

  const coletaIdModal = row?.coleta_id ?? null
  const resumoDebounced = useDebouncedValue(resumoFinanceiro, 1200)

  const grupoConsolidado = useMemo(() => {
    if (!coletasConsolidadas || coletasConsolidadas.length <= 1) return null
    return coletasConsolidadas
  }, [coletasConsolidadas])

  const pesoColetaKg = row?.peso_liquido != null ? Number(row.peso_liquido) : null
  const mtrPesoLiquidoStr = resumoFinanceiro?.mtr.peso_liquido_kg ?? ''
  const mtrQtdStr = resumoFinanceiro?.mtr.residuo_quantidade ?? ''
  const pesoFaturamentoMtrKg = useMemo(() => {
    const s = mtrPesoLiquidoStr.trim() || mtrQtdStr.trim()
    if (s) {
      const n = parseValor(s)
      if (n != null && n > 0) return n
    }
    return pesoColetaKg
  }, [mtrPesoLiquidoStr, mtrQtdStr, pesoColetaKg])

  const totalNumero = useMemo(
    () => (resumoFinanceiro ? totalResumoFinanceiro(resumoFinanceiro) : 0),
    [resumoFinanceiro]
  )

  const sugestaoRegras = useMemo(() => {
    if (!row) return null
    const pesoParaRegra = pesoFaturamentoMtrKg
    return resolverPrecoSugerido(
      regrasPreco,
      row.cliente_id,
      row.tipo_residuo,
      pesoParaRegra,
      'COLETA'
    )
  }, [regrasPreco, row, pesoFaturamentoMtrKg])

  const coletasPesoContrato = useMemo(() => {
    if (!grupoConsolidado || grupoConsolidado.length <= 1) return null
    return coletasPesoParaContratoFromResumo(grupoConsolidado, resumoFinanceiro)
  }, [grupoConsolidado, resumoFinanceiro])

  /** Referência do contrato usa peso do resumo MTR (inclui edição em kg). */
  const sugestaoContrato: ResultadoPrecoContrato | null = useMemo(() => {
    if (!row || !contratoCliente) return null
    const inputBase = {
      veiculosContratoRaw: contratoCliente.veiculos_contrato,
      equipamentosContratoRaw: contratoCliente.equipamentos_contrato,
      residuosContratoRaw: contratoCliente.residuos_contrato,
      legadoTipoResiduo: contratoCliente.tipo_residuo_legado,
      descricaoVeiculoLegado: contratoCliente.descricao_veiculo_legado,
      equipamentosTextoLegado: contratoCliente.equipamentos_texto_legado,
      tipoCaminhaoMtr: contextoMtr?.tipoCaminhao ?? null,
      acondicionamentoMtr: contextoMtr?.acondicionamento ?? null,
      tipoResiduoColeta: row.tipo_residuo,
      pesoLiquidoKg: pesoFaturamentoMtrKg ?? pesoColetaKg,
    }
    if (coletasPesoContrato && coletasPesoContrato.length > 1) {
      return calcularPrecoContratoMtrConsolidado(inputBase, coletasPesoContrato)
    }
    const qtd = pesoFaturamentoMtrKg ?? pesoColetaKg
    return calcularPrecoContratoColetaMtr({
      ...inputBase,
      tipoResiduoColeta: row.tipo_residuo,
      pesoLiquidoKg: pesoFaturamentoMtrKg ?? pesoColetaKg,
      quantidadeFaturada: qtd,
    })
  }, [
    row,
    contratoCliente,
    contextoMtr,
    pesoColetaKg,
    pesoFaturamentoMtrKg,
    coletasPesoContrato,
  ])

  const calcularSugestaoContratoParaResumo = useCallback(
    (resumo: ResumoFinanceiroDesvinculado): ResultadoPrecoContrato | null => {
      if (!row || !contratoCliente) return null
      const pesoMtr = parseNumeroCampo(resumo.mtr.peso_liquido_kg || resumo.mtr.residuo_quantidade)
      const pesoKg = pesoMtr > 0 ? pesoMtr : pesoColetaKg
      const inputBase = {
        veiculosContratoRaw: contratoCliente.veiculos_contrato,
        equipamentosContratoRaw: contratoCliente.equipamentos_contrato,
        residuosContratoRaw: contratoCliente.residuos_contrato,
        legadoTipoResiduo: contratoCliente.tipo_residuo_legado,
        descricaoVeiculoLegado: contratoCliente.descricao_veiculo_legado,
        equipamentosTextoLegado: contratoCliente.equipamentos_texto_legado,
        tipoCaminhaoMtr: contextoMtr?.tipoCaminhao ?? null,
        acondicionamentoMtr: contextoMtr?.acondicionamento ?? null,
        tipoResiduoColeta: row.tipo_residuo,
        pesoLiquidoKg: pesoKg,
      }
      if (grupoConsolidado && grupoConsolidado.length > 1) {
        const coletas = coletasPesoParaContratoFromResumo(grupoConsolidado, resumo)
        if (coletas.length > 1) {
          return calcularPrecoContratoMtrConsolidado(inputBase, coletas)
        }
      }
      return calcularPrecoContratoColetaMtr({
        ...inputBase,
        tipoResiduoColeta: row.tipo_residuo,
        pesoLiquidoKg: pesoKg,
        quantidadeFaturada: pesoKg,
      })
    },
    [row, contratoCliente, contextoMtr, grupoConsolidado, pesoColetaKg]
  )

  const reaplicarContratoNoResumo = useCallback(
    (resumo: ResumoFinanceiroDesvinculado) => {
      const sugestao = calcularSugestaoContratoParaResumo(resumo)
      if (!sugestao || sugestao.total <= 0) return resumo
      return aplicarSugestaoContratoNoResumoMtr(resumo, sugestao, {
        tipoCaminhao: contextoMtr?.tipoCaminhao,
        acondicionamento: contextoMtr?.acondicionamento,
      })
    },
    [calcularSugestaoContratoParaResumo, contextoMtr?.tipoCaminhao, contextoMtr?.acondicionamento]
  )

  const sugestaoAtiva = useMemo(() => {
    if (sugestaoContrato && sugestaoContrato.total > 0) {
      return {
        total: sugestaoContrato.total,
        linhas: sugestaoContrato.linhas,
        origemLabel: rotuloOrigemContrato(sugestaoContrato.origem),
        fonte: 'contrato' as const,
      }
    }
    if (sugestaoRegras && sugestaoRegras.total > 0) {
      return {
        total: sugestaoRegras.total,
        linhas: sugestaoRegras.linhas,
        origemLabel: rotuloOrigemPreco(sugestaoRegras.origem),
        fonte: 'regras' as const,
      }
    }
    return null
  }, [sugestaoContrato, sugestaoRegras])

  const diferencaConta = useMemo(() => {
    if (!sugestaoAtiva || sugestaoAtiva.total <= 0) return null
    const informado = totalNumero
    return Math.round((informado - sugestaoAtiva.total) * 100) / 100
  }, [sugestaoAtiva, totalNumero])

  const carregarRegisto = useCallback(async (coletaId: string) => {
    const gen = ++carregarRegistoGenRef.current
    setCarregando(true)
    setErro('')
    setOkMsg('')
    const selectCandidates = [
      'id, valor, valor_adicionais, resumo_financeiro, status, observacoes, updated_at',
      'id, valor, resumo_financeiro, status, observacoes, updated_at',
      'id, valor, valor_adicionais, status, observacoes, updated_at',
      'id, valor, status, updated_at',
    ] as const

    let data: unknown = null
    let error: PostgrestError | null = null
    for (const sel of selectCandidates) {
      const res = await supabase
        .from('faturamento_registros')
        .select(sel)
        .eq('coleta_id', coletaId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      data = res.data
      error = res.error
      if (!error) break
      if (
        !faturamentoRegistrosErroColunasOpcionais(error) &&
        !faturamentoRegistrosErroResumoFinanceiro(error)
      ) {
        break
      }
    }

    if (gen !== carregarRegistoGenRef.current) return

    if (error) {
      console.error(error)
      setErro('Não foi possível carregar o registro de faturamento.')
      setRegistroId(null)
      setResumoFinanceiro(null)
      setObservacoes('')
      setStatus('emitido')
      resumoInicializadoColetaRef.current = null
      setCarregando(false)
      return
    }

    if (data) {
      const rec = data as {
        id: string
        valor: number | null
        valor_adicionais?: number | null
        resumo_financeiro?: unknown
        status: string
        observacoes?: string | null
      }
      setRegistroId(rec.id)
      const parsed = parseResumoFinanceiroJson(rec.resumo_financeiro)
      if (parsed) {
        setResumoFinanceiro(parsed)
        resumoInicializadoColetaRef.current = coletaId
      } else {
        setResumoFinanceiro(null)
        resumoInicializadoColetaRef.current = null
      }
      setObservacoes(rec.observacoes ?? '')
      const st = rec.status === 'emitido' || rec.status === 'cancelado' ? rec.status : 'pendente'
      setStatus(modoPreparacaoMedicao ? 'pendente' : st)
    } else {
      setRegistroId(null)
      setResumoFinanceiro(null)
      setObservacoes('')
      setStatus(modoPreparacaoMedicao ? 'pendente' : 'emitido')
      resumoInicializadoColetaRef.current = null
    }
    if (gen === carregarRegistoGenRef.current) setCarregando(false)
  }, [modoPreparacaoMedicao])

  useEffect(() => {
    if (!open) {
      resumoInicializadoColetaRef.current = null
      contratoAutoAplicadoRef.current = null
      carregarRegistoGenRef.current += 1
      return
    }
    if (!coletaIdModal) return
    resumoInicializadoColetaRef.current = null
    contratoAutoAplicadoRef.current = null
    void carregarRegisto(coletaIdModal)
  }, [open, coletaIdModal, carregarRegisto])

  useEffect(() => {
    if (!open || !modoPreparacaoMedicao) return
    setStatus('pendente')
  }, [open, modoPreparacaoMedicao])

  useEffect(() => {
    if (!open) return
    let cancel = false
    queueMicrotask(() => setCarregandoRegras(true))
    void (async () => {
      const { data, error } = await supabase
        .from('faturamento_precos_regras')
        .select(
          'id, cliente_id, tipo_residuo, tipo_servico, valor_por_kg, valor_minimo, valor_fixo, valor_transporte_por_kg, valor_tratamento_por_kg, taxa_adicional_fixa, ativo, updated_at'
        )
        .eq('ativo', true)
        .limit(500)
      if (cancel) return
      if (error) {
        setRegrasPreco([])
      } else {
        setRegrasPreco((data ?? []) as RegraPrecoRow[])
      }
      setCarregandoRegras(false)
    })()
    return () => {
      cancel = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !row) return
    queueMicrotask(() => {
      setDataVencimentoIso(sugerirDataVencimentoIso(7))
    })
  }, [open, row])

  const montarResumoOperacional = useCallback((): ResumoFinanceiroDesvinculado | null => {
    if (!row) return null
    if (grupoConsolidado && grupoConsolidado.length > 1) {
      return criarResumoFinanceiroConsolidado(row, grupoConsolidado, sugestaoContrato, {
        tipoCaminhao: contextoMtr?.tipoCaminhao,
        acondicionamento: contextoMtr?.acondicionamento,
      })
    }
    return criarResumoFinanceiroDoOperacional(row, sugestaoContrato, {
      tipoCaminhao: contextoMtr?.tipoCaminhao,
      acondicionamento: contextoMtr?.acondicionamento,
    })
  }, [row, sugestaoContrato, contextoMtr, grupoConsolidado])

  const garantirResumoMontado = useCallback(() => {
    if (!row) return
    const base =
      montarResumoOperacional() ??
      criarResumoFinanceiroDoOperacional(row, null, {
        tipoCaminhao: contextoMtr?.tipoCaminhao ?? null,
        acondicionamento: contextoMtr?.acondicionamento ?? null,
      })
    if (base) {
      setResumoFinanceiro(base)
      resumoInicializadoColetaRef.current = row.coleta_id
    }
  }, [row, montarResumoOperacional, contextoMtr])

  useEffect(() => {
    if (!open || !coletaIdModal || carregando || carregandoContrato) return
    if (resumoInicializadoColetaRef.current === coletaIdModal) return
    garantirResumoMontado()
  }, [open, coletaIdModal, carregando, carregandoContrato, garantirResumoMontado])

  /** Após o contrato carregar, preenche caminhão/equipamento/resíduo se o resumo ainda estiver sem valores. */
  useEffect(() => {
    if (!open || !coletaIdModal || carregandoContrato || !resumoFinanceiro || !sugestaoContrato) return
    const temPrecoContrato =
      sugestaoContrato.valorCaminhao > 0 ||
      sugestaoContrato.valorEquipamentos > 0 ||
      sugestaoContrato.valorResiduo > 0 ||
      sugestaoContrato.valorUnitario > 0
    if (!temPrecoContrato || !resumoMtrPrecosVazios(resumoFinanceiro.mtr)) return

    const chaveAuto = `${coletaIdModal}|${sugestaoContrato.total}|${sugestaoContrato.valorResiduo}|${contextoMtr?.tipoCaminhao ?? ''}`
    if (contratoAutoAplicadoRef.current === chaveAuto) return
    contratoAutoAplicadoRef.current = chaveAuto

    setResumoFinanceiro((prev) =>
      prev
        ? aplicarSugestaoContratoNoResumoMtr(prev, sugestaoContrato, {
            tipoCaminhao: contextoMtr?.tipoCaminhao,
            acondicionamento: contextoMtr?.acondicionamento,
          })
        : prev
    )
  }, [
    open,
    coletaIdModal,
    carregandoContrato,
    resumoFinanceiro,
    sugestaoContrato,
    contextoMtr?.tipoCaminhao,
    contextoMtr?.acondicionamento,
  ])

  const onResumoFinanceiroChange = useCallback((next: ResumoFinanceiroDesvinculado) => {
    skipSyncOperacionalRef.current = false
    setResumoFinanceiro(next)
  }, [])

  useEffect(() => {
    if (open) skipSyncOperacionalRef.current = true
  }, [open, coletaIdModal])

  useEffect(() => {
    if (!open || !coletaIdModal || !resumoDebounced || !podeEditarResumosFinanceiros) return
    if (skipSyncOperacionalRef.current) return
    void aplicarResumoFinanceiroNaOperacional(coletaIdModal, resumoDebounced).then((res) => {
      if (!res.ok) console.warn('[faturamento] sync MTR/ticket:', res.message)
    })
  }, [resumoDebounced, open, coletaIdModal, podeEditarResumosFinanceiros])

  async function sincronizarResumoComOperacional(
    resumo: ResumoFinanceiroDesvinculado
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const refId =
      grupoConsolidado && grupoConsolidado.length > 1
        ? escolherColetaLiderFaturamento(grupoConsolidado).coleta_id
        : (row?.coleta_id ?? '').trim()
    if (!refId) return { ok: false, message: 'Coleta inválida.' }
    return aplicarResumoFinanceiroNaOperacional(refId, resumo)
  }

  function recalcularTudoDoOperacional() {
    if (!row) return
    const grupo =
      grupoConsolidado && grupoConsolidado.length > 1 ? grupoConsolidado : undefined
    let next = recalcularResumoDesdeOperacional(row, grupo, sugestaoContrato, {
      tipoCaminhao: contextoMtr?.tipoCaminhao,
      acondicionamento: contextoMtr?.acondicionamento,
    })
    if (sugestaoContrato && resumoMtrPrecosVazios(next.mtr)) {
      next = aplicarSugestaoContratoNoResumoMtr(next, sugestaoContrato, {
        tipoCaminhao: contextoMtr?.tipoCaminhao,
        acondicionamento: contextoMtr?.acondicionamento,
      })
    }
    skipSyncOperacionalRef.current = true
    setResumoFinanceiro(next)
    setOkMsg(
      'Recalculado a partir do ticket, MTR e contrato do cliente (pesos, resíduos, veículos e equipamentos).'
    )
    setErro('')
  }

  useEffect(() => {
    if (!open || !row?.cliente_id) {
      queueMicrotask(() => {
        setContratoCliente(null)
        setCarregandoContrato(false)
      })
      return
    }
    let cancel = false
    queueMicrotask(() => setCarregandoContrato(true))
    void (async () => {
      const selComContrato =
        'id, residuos_contrato, veiculos_contrato, equipamentos_contrato, tipo_residuo, classificacao, unidade_medida, frequencia_coleta, descricao_veiculo, equipamentos'
      let res = await supabase.from('clientes').select(selComContrato).eq('id', row.cliente_id).maybeSingle()
      if (cancel) return
      if (res.error && isMissingClienteContratoColumnsError(res.error)) {
        res = await supabase
          .from('clientes')
          .select('id, tipo_residuo, classificacao, unidade_medida, frequencia_coleta')
          .eq('id', row.cliente_id)
          .maybeSingle()
      }
      if (cancel) return
      if (res.error || !res.data) {
        setContratoCliente(null)
      } else {
        const d = res.data as Record<string, unknown>
        setContratoCliente({
          residuos_contrato: d.residuos_contrato ?? null,
          veiculos_contrato: d.veiculos_contrato ?? null,
          equipamentos_contrato: d.equipamentos_contrato ?? null,
          tipo_residuo_legado: typeof d.tipo_residuo === 'string' ? d.tipo_residuo : null,
          descricao_veiculo_legado:
            typeof d.descricao_veiculo === 'string' ? d.descricao_veiculo : null,
          equipamentos_texto_legado: typeof d.equipamentos === 'string' ? d.equipamentos : null,
        })
      }
      setCarregandoContrato(false)
    })()
    return () => {
      cancel = true
    }
  }, [open, row?.cliente_id])

  useEffect(() => {
    if (!open || !row) {
      queueMicrotask(() => setContextoMtr(null))
      return
    }
    let cancel = false
    void (async () => {
      let tipoCaminhao: string | null = null
      let acondicionamento: string | null = null

      if (row.programacao_id) {
        const { data } = await supabase
          .from('programacoes')
          .select('tipo_caminhao')
          .eq('id', row.programacao_id)
          .maybeSingle()
        if (!cancel && data && typeof data === 'object') {
          const tc = (data as { tipo_caminhao?: string | null }).tipo_caminhao
          tipoCaminhao = typeof tc === 'string' && tc.trim() ? tc.trim() : null
        }
      }

      if (row.mtr_id) {
        const { data } = await supabase.from('mtrs').select('detalhes').eq('id', row.mtr_id).maybeSingle()
        if (!cancel && data && typeof data === 'object') {
          const det = (data as { detalhes?: unknown }).detalhes
          if (det && typeof det === 'object') {
            const res = (det as { residuo?: { acondicionamento?: string } }).residuo
            const ac = res?.acondicionamento
            acondicionamento = typeof ac === 'string' && ac.trim() ? ac.trim() : null
          }
        }
      }

      if (!cancel) setContextoMtr({ tipoCaminhao, acondicionamento })
    })()
    return () => {
      cancel = true
    }
  }, [open, row?.programacao_id, row?.mtr_id])

  async function handleEncerrarTicketDefinitivo() {
    if (!row || !podeEncerrarTicketDefinitivo || !resumoFinanceiro) return
    if (resumoFinanceiro.ticket_encerrado_definitivo) return

    const confirmar = await confirm({
      title: 'Encerrar ticket definitivamente',
      message:
        'Encerrar definitivamente o ticket neste faturamento? Os valores do resumo serão gravados e o ticket será aprovado na conferência.',
      details: ['A pesagem operacional não é alterada.'],
      confirmLabel: 'Encerrar ticket',
      variant: 'warning',
    })
    if (!confirmar) return

    setEncerrandoTicket(true)
    setErro('')
    setOkMsg('')

    const next = marcarTicketEncerradoDefinitivoResumo(resumoFinanceiro)
    const syncOp = await sincronizarResumoComOperacional(resumoFinanceiro)
    if (!syncOp.ok) {
      setEncerrandoTicket(false)
      setErro(syncOp.message)
      return
    }

    const res = await encerrarTicketDefinitivoFaturamento(
      row.coleta_id,
      resumoFinanceiroParaJsonb(next)
    )

    setEncerrandoTicket(false)

    if (!res.ok) {
      setErro(res.message)
      return
    }

    setResumoFinanceiro(next)
    setOkMsg('Ticket encerrado definitivamente no faturamento.')
    onGravado()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!row || !podeConfirmarEmissao) return

    if (modoPreparacaoMedicao) {
      if (totalNumero <= 0) {
        setErro('Preencha os valores nos resumos (ticket e/ou MTR) antes de liberar a medição.')
        return
      }
      if (!resumoFinanceiro) {
        setErro('Aguarde o carregamento dos resumos ou recarregue a página.')
        return
      }
    }

    if (!modoPreparacaoMedicao && status === 'emitido') {
      const alvo = grupoConsolidado && grupoConsolidado.length > 1 ? grupoConsolidado : [row]
      for (const c of alvo) {
        const el = coletaElegivelParaFaturar(c, alvo)
        if (!el.ok) {
          const msg = el.motivos.map(rotuloMotivoInelegivel).join(' ')
          setErro(
            `Não é possível faturar${alvo.length > 1 ? ' este grupo' : ' esta coleta'} ainda. Coleta ${c.numero_coleta ?? c.numero}: ${msg}`
          )
          return
        }
      }
    }

    if (!resumoFinanceiro) {
      setErro('Aguarde o carregamento dos resumos ou recarregue a página.')
      return
    }

    if (status === 'emitido' && totalNumero <= 0) {
      setErro('Preencha os valores nos resumos (ticket e/ou MTR) antes de continuar.')
      return
    }

    setSalvando(true)
    setErro('')
    setOkMsg('')
    const coletaAtual = row
    const agora = new Date().toISOString()
    const valorTotal = totalNumero > 0 ? totalNumero : null
    const resumoJson = resumoFinanceiro ? resumoFinanceiroParaJsonb(resumoFinanceiro) : null
    const acrescimo = resumoFinanceiro
      ? parseNumeroCampo(resumoFinanceiro.ajustes?.acrescimo ?? '')
      : 0
    const valorAdicionais = acrescimo > 0 ? acrescimo : null

    try {
      const syncOp = await sincronizarResumoComOperacional(resumoFinanceiro)
      if (!syncOp.ok) {
        setErro(syncOp.message)
        setSalvando(false)
        return
      }

      if (status === 'emitido' && grupoConsolidado && grupoConsolidado.length > 1) {
        const resCons = await emitirFaturamentoConsolidadoMtr(supabase, {
          coletas: grupoConsolidado,
          valorTotal: valorTotal!,
          resumoFinanceiro: resumoFinanceiro!,
          observacoes,
          dataVencimentoIso,
          registroIdLider: registroId,
          valorAdicionais,
        })
        if (!resCons.ok) {
          setErro(resCons.message)
          setSalvando(false)
          return
        }
        setOkMsg(
          `Faturamento consolidado (${grupoConsolidado.length} tickets). Conclua o relatório pós-faturamento e o envio de NF; após Finalizado, a cobrança entra em Contas a Receber.`
        )
        onGravado()
        onClose()
        setSalvando(false)
        return
      }

      const statusGravar = modoPreparacaoMedicao ? 'pendente' : status
      const payloads = montarPayloadsFaturamentoRegistro({
        valor: valorTotal,
        valorAdicionais,
        resumoFinanceiro: resumoJson,
        observacoes,
        status: statusGravar,
        updatedAt: agora,
      })

      const resPersist = await persistirFaturamentoRegistro(supabase, {
        coletaId: coletaAtual.coleta_id,
        registroId,
        payloads,
      })
      if (!resPersist.ok) {
        throw new Error(resPersist.message)
      }

      if (resPersist.id && !registroId) {
        setRegistroId(resPersist.id)
      }

      if (modoPreparacaoMedicao) {
        if (grupoConsolidado && grupoConsolidado.length > 1 && resumoFinanceiro) {
          const lider = escolherColetaLiderFaturamento(grupoConsolidado)
          const pers = await persistirResumoPendenteGrupoMtr(lider, grupoConsolidado, resumoFinanceiro)
          if (!pers.ok) {
            setErro(pers.message)
            setSalvando(false)
            return
          }
        }

        const ids =
          grupoConsolidado && grupoConsolidado.length > 1
            ? grupoConsolidado.map((c) => c.coleta_id)
            : [coletaAtual.coleta_id]
        const est = await marcarValoresMedicaoRevisados(ids)
        if (!est.ok) {
          setErro(est.message)
          setSalvando(false)
          return
        }
        setOkMsg(
          'Valores guardados. Pode gerar o relatório de medição e enviar ao cliente pela mala direta.'
        )
        onGravado()
        onClose()
        setSalvando(false)
        return
      }

      if (status === 'emitido') {
        const vencIso = dataVencimentoIso.trim() || null
        const { error: errColeta } = await supabase
          .from('coletas')
          .update({
            ...payloadFaturamentoEmitidoAguardaFinalizacaoEsteira({ valorColeta: valorTotal }),
            data_vencimento: vencIso,
          })
          .eq('id', coletaAtual.coleta_id)
        if (errColeta) {
          console.error(errColeta)
          setErro('Registro salvo, mas falhou ao atualizar a coleta. Entre em contato com o administrador.')
        } else {
          await marcarEsteiraPosFaturamentoEmitido(coletaAtual.coleta_id)

          setOkMsg(
            'Faturamento emitido. Conclua o relatório pós-faturamento e registre o envio de NF; após status Finalizado, a cobrança entra em Financeiro → Contas a Receber.'
          )
          onGravado()
          onClose()
        }
      } else {
        setOkMsg(
          status === 'cancelado'
            ? 'Registro salvo como cancelado.'
            : 'Registro salvo em pendente (coleta ainda não enviada ao Financeiro).'
        )
        onGravado()
        void carregarRegisto(coletaAtual.coleta_id)
      }
    } catch (err: unknown) {
      console.error(err)
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  if (!open || !row) return null

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="fat-modal-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12040,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: 'min(92vh, 720px)',
          overflow: 'auto',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.2)',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '22px 24px 16px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <h2 id="fat-modal-titulo" style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
            {modoPreparacaoMedicao
              ? grupoConsolidado && grupoConsolidado.length > 1
                ? 'Ajuste de valores — MTR consolidada'
                : 'Ajuste de valores — preparação para medição'
              : grupoConsolidado && grupoConsolidado.length > 1
                ? 'Faturamento consolidado (1 por MTR)'
                : 'Faturamento da coleta'}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
            {grupoConsolidado && grupoConsolidado.length > 1 ? (
              <>
                <strong>{grupoConsolidado.length} tickets</strong> na MTR{' '}
                <strong>{row.mtr_numero || '—'}</strong> — {row.cliente_nome || 'Cliente'}
                <br />
                Coleta líder: <strong>{row.numero_coleta ?? row.numero}</strong> · caminhão/equipamento
                cobrados uma vez; resíduos somados.
              </>
            ) : (
              <>
                <strong>{row.numero_coleta ?? row.numero}</strong> — {row.cliente_nome || 'Cliente'} · MTR{' '}
                {row.mtr_numero || '—'}
              </>
            )}
          </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              width: '36px',
              height: '36px',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#475569',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
          {!podeConfirmarEmissao ? (
            <p style={{ color: '#92400e', fontSize: '14px' }}>Seu perfil permite apenas consulta.</p>
          ) : null}

          {carregando ? (
            <p style={{ color: '#64748b', marginBottom: '14px' }}>Carregando resumos…</p>
          ) : !resumoFinanceiro ? (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ color: '#b45309', fontSize: '14px', margin: '0 0 10px' }}>
                Não foi possível montar o resumo desta coleta (registo antigo sem snapshot ou dados
                incompletos).
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button type="button" className="mini-btn" onClick={() => garantirResumoMontado()}>
                  Montar resumo do operacional
                </button>
                <button type="button" className="mini-btn" onClick={recalcularTudoDoOperacional}>
                  Recalcular tudo (ticket + MTR + contrato)
                </button>
              </div>
            </div>
          ) : (
            <>
              {modoPreparacaoMedicao ? (
                <div
                  style={{
                    marginBottom: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <button
                    type="button"
                    className="rg-btn rg-btn--outline"
                    style={{ fontSize: '12px' }}
                    onClick={recalcularTudoDoOperacional}
                    disabled={carregandoContrato}
                  >
                    Recalcular do operacional
                  </button>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Atualiza pesos, resíduos, veículos e valores do contrato nas linhas do resumo.
                  </span>
                </div>
              ) : null}
              <FaturamentoResumoDesvinculado
                resumo={resumoFinanceiro}
                onChange={onResumoFinanceiroChange}
                onAposPesoMtrAlterado={
                  podeEditarResumosFinanceiros ? reaplicarContratoNoResumo : undefined
                }
                podeEditarResumos={podeEditarResumosFinanceiros}
                podeEditarAjustes={podeEditarResumosFinanceiros}
                carregandoSugestao={carregandoContrato || carregandoRegras}
                onRecarregarTicket={() => {
                  skipSyncOperacionalRef.current = true
                  const b = montarResumoOperacional()
                  if (b) setResumoFinanceiro((prev) => (prev ? { ...b, ticket: b.ticket, mtr: prev.mtr } : b))
                }}
                onRecarregarMtr={() => {
                  skipSyncOperacionalRef.current = true
                  const b = montarResumoOperacional()
                  if (b) setResumoFinanceiro((prev) => (prev ? { ...prev, mtr: b.mtr } : b))
                }}
                onAplicarContratoMtr={() => {
                  if (!resumoFinanceiro) return
                  setResumoFinanceiro(
                    aplicarSugestaoContratoNoResumoMtr(resumoFinanceiro, sugestaoContrato, {
                      tipoCaminhao: contextoMtr?.tipoCaminhao,
                      acondicionamento: contextoMtr?.acondicionamento,
                    })
                  )
                }}
                referenciaConta={
                  sugestaoAtiva && sugestaoAtiva.total > 0
                    ? {
                        total: sugestaoAtiva.total,
                        origemLabel: sugestaoAtiva.origemLabel,
                        linhas: sugestaoAtiva.linhas,
                      }
                    : null
                }
                diferencaConta={diferencaConta}
              />

              <FaturamentoMtrRateioPanel
                mtrId={row?.mtr_id}
                mtrBaixaComplexa={row?.mtr_baixa_cenario_complexo}
                usuarioCargo={usuarioCargo}
              />

              {row?.mtr_status === 'Cancelado' && row.mtr_cancelamento_cobrar_frete ? (
                <p style={{ fontSize: '13px', color: '#b45309', margin: '0 0 12px' }}>
                  MTR cancelada com cobrança de frete
                  {row.mtr_cancelamento_valor_frete != null
                    ? `: ${Number(row.mtr_cancelamento_valor_frete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    : ''}
                  . Confira o registo pendente FRETE-MTR-CANCELADA.
                </p>
              ) : null}

              {carregandoContrato ? (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px' }}>
                  A carregar contrato do cliente…
                </p>
              ) : sugestaoContrato && sugestaoContrato.total <= 0 && row.cliente_id ? (
                <p style={{ fontSize: '12px', color: '#b45309', margin: '0 0 12px' }}>
                  Sem preços no contrato para esta coleta — preencha os valores manualmente nos resumos.
                </p>
              ) : null}

              {modoPreparacaoMedicao ? (
                <p
                  style={{
                    margin: '0 0 14px',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    fontSize: 13,
                    color: '#065f46',
                    lineHeight: 1.5,
                  }}
                >
                  Modo <strong>preparação para medição</strong>: os valores ficam em registo pendente. Não
                  envia ao Financeiro — após guardar, gere o relatório de medição na esteira seguinte.
                </p>
              ) : null}

              {!modoPreparacaoMedicao && status === 'emitido' ? (
                <>
                  <label
                    style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}
                  >
                    Data de vencimento (conta a receber)
                  </label>
                  <input
                    type="date"
                    value={dataVencimentoIso}
                    onChange={(e) => setDataVencimentoIso(e.target.value)}
                    disabled={!podeConfirmarEmissao}
                    style={{
                      width: '100%',
                      marginBottom: '6px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#94a3b8' }}>
                    Sugestão inicial +7 dias (editável). Usada ao confirmar o faturamento.
                  </p>
                </>
              ) : null}

              {podeEncerrarTicketDefinitivo && !resumoFinanceiro.ticket_encerrado_definitivo ? (
                <div style={{ marginBottom: '14px' }}>
                  <button
                    type="button"
                    disabled={encerrandoTicket || salvando}
                    onClick={() => void handleEncerrarTicketDefinitivo()}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #b45309',
                      background: '#fffbeb',
                      color: '#92400e',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: encerrandoTicket || salvando ? 'wait' : 'pointer',
                    }}
                  >
                    {encerrandoTicket
                      ? 'A encerrar ticket…'
                      : 'Encerrar ticket definitivamente (Operacional (Time T))'}
                  </button>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                    Grava o resumo financeiro e aprova o ticket na conferência, sem alterar a pesagem
                    operacional.
                  </p>
                </div>
              ) : null}

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Observações (opcional)
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={!podeConfirmarEmissao}
                rows={3}
                style={{
                  width: '100%',
                  marginBottom: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />

              {!modoPreparacaoMedicao ? (
                <>
                  <label
                    style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}
                  >
                    Estado do registro
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusFat)}
                    disabled={!podeConfirmarEmissao}
                    style={{
                      width: '100%',
                      marginBottom: '14px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    }}
                  >
                    <option value="emitido">Emitido — envia ao Financeiro</option>
                    <option value="pendente">Pendente — apenas salva o registro (não envia ao Financeiro)</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </>
              ) : null}

              {erro ? <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '10px' }}>{erro}</p> : null}
              {okMsg ? <p style={{ color: '#15803d', fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>{okMsg}</p> : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={!podeConfirmarEmissao || salvando}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: podeConfirmarEmissao ? '#0d9488' : '#94a3b8',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: podeConfirmarEmissao && !salvando ? 'pointer' : 'not-allowed',
                  }}
                >
                  {salvando
                    ? 'Salvando…'
                    : modoPreparacaoMedicao
                      ? 'Guardar valores e liberar medição'
                      : status === 'emitido'
                        ? 'Confirmar faturamento'
                        : 'Salvar registro'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
