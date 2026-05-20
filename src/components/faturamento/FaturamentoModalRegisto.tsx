import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { payloadFaturamentoEmitidoEnviaAoFinanceiro } from '../../lib/coletaFluxoAtualizacao'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import { coletaElegivelParaFaturar, rotuloMotivoInelegivel } from '../../lib/faturamentoElegibilidade'
import { upsertContaReceber, sugerirDataVencimentoIso } from '../../services/financeiroReceber'
import {
  resolverPrecoSugerido,
  rotuloOrigemPreco,
  type RegraPrecoRow,
} from '../../services/pricing'
import { isMissingClienteContratoColumnsError } from '../../lib/clienteContratoCadastro'
import {
  calcularPrecoContratoColetaMtr,
  rotuloOrigemContrato,
  type ResultadoPrecoContrato,
} from '../../lib/faturamentoPrecoContrato'
import {
  aplicarSugestaoContratoNoResumoMtr,
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
  criarResumoFinanceiroConsolidado,
  emitirFaturamentoConsolidadoMtr,
} from '../../lib/faturamentoConsolidacaoMtr'
import {
  faturamentoRegistrosErroColunasOpcionais,
  faturamentoRegistrosErroResumoFinanceiro,
  montarPayloadsFaturamentoRegistro,
  persistirFaturamentoRegistro,
} from '../../lib/faturamentoRegistrosPersist'
import { encerrarTicketDefinitivoFaturamento } from '../../lib/faturamentoTicketFluxo'
import { FaturamentoResumoDesvinculado } from './FaturamentoResumoDesvinculado'
import { FaturamentoMtrRateioPanel } from './FaturamentoMtrRateioPanel'

function parseValor(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function montarParamsColeta(row: FaturamentoResumoViewRow) {
  const p = new URLSearchParams()
  p.set('coleta', row.coleta_id)
  if (row.mtr_id) p.set('mtr', row.mtr_id)
  if (row.programacao_id) p.set('programacao', row.programacao_id)
  if (row.cliente_id) p.set('cliente', row.cliente_id)
  return p
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
  navegarAposEmitir = true,
}: Props) {
  const podeConfirmarEmissao = podeConfirmarEmissaoProp ?? podeMutar ?? false
  const navigate = useNavigate()
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
  const carregarRegistoGenRef = useRef(0)

  const coletaIdModal = row?.coleta_id ?? null

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

  /** Sugestão de contrato: usa peso da coleta (não recalcula a cada tecla nos campos MTR). */
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
      pesoLiquidoKg: pesoColetaKg,
    }
    if (grupoConsolidado && grupoConsolidado.length > 1) {
      return calcularPrecoContratoMtrConsolidado(inputBase, grupoConsolidado)
    }
    const qtd =
      pesoColetaKg != null && pesoColetaKg > 0
        ? pesoColetaKg
        : parseValor(mtrQtdStr) ?? parseValor(mtrPesoLiquidoStr)
    return calcularPrecoContratoColetaMtr({
      ...inputBase,
      tipoResiduoColeta: row.tipo_residuo,
      pesoLiquidoKg: pesoColetaKg,
      quantidadeFaturada: qtd,
    })
  }, [row, contratoCliente, contextoMtr, pesoColetaKg, mtrQtdStr, mtrPesoLiquidoStr, grupoConsolidado])

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
      setStatus(st)
    } else {
      setRegistroId(null)
      setResumoFinanceiro(null)
      setObservacoes('')
      setStatus('emitido')
      resumoInicializadoColetaRef.current = null
    }
    if (gen === carregarRegistoGenRef.current) setCarregando(false)
  }, [])

  useEffect(() => {
    if (!open) {
      resumoInicializadoColetaRef.current = null
      carregarRegistoGenRef.current += 1
      return
    }
    if (!coletaIdModal) return
    resumoInicializadoColetaRef.current = null
    void carregarRegisto(coletaIdModal)
  }, [open, coletaIdModal, carregarRegisto])

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
    if (!open || !coletaIdModal || carregando) return
    if (resumoInicializadoColetaRef.current === coletaIdModal) return
    garantirResumoMontado()
  }, [open, coletaIdModal, carregando, garantirResumoMontado])

  const onResumoFinanceiroChange = useCallback((next: ResumoFinanceiroDesvinculado) => {
    setResumoFinanceiro(next)
  }, [])

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

    const confirmar = window.confirm(
      'Encerrar definitivamente o ticket neste faturamento? Os valores do resumo serão gravados e o ticket será aprovado na conferência. A pesagem operacional não é alterada.'
    )
    if (!confirmar) return

    setEncerrandoTicket(true)
    setErro('')
    setOkMsg('')

    const next = marcarTicketEncerradoDefinitivoResumo(resumoFinanceiro)
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

    if (status === 'emitido') {
      const alvo = grupoConsolidado && grupoConsolidado.length > 1 ? grupoConsolidado : [row]
      for (const c of alvo) {
        const el = coletaElegivelParaFaturar(c)
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
          `Faturamento consolidado (${grupoConsolidado.length} tickets, 1 conta). As coletas seguem para o Financeiro.`
        )
        onGravado()
        if (navegarAposEmitir && row) {
          navigate(`/financeiro?${montarParamsColeta(row).toString()}`)
        }
        onClose()
        setSalvando(false)
        return
      }

      const payloads = montarPayloadsFaturamentoRegistro({
        valor: valorTotal,
        valorAdicionais,
        resumoFinanceiro: resumoJson,
        observacoes,
        status,
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

      let idFaturamentoRegistro = resPersist.id ?? registroId
      if (resPersist.id && !registroId) {
        setRegistroId(resPersist.id)
      }

      if (status === 'emitido') {
        const { error: errColeta } = await supabase
          .from('coletas')
          .update(payloadFaturamentoEmitidoEnviaAoFinanceiro({ valorColeta: valorTotal }))
          .eq('id', coletaAtual.coleta_id)
        if (errColeta) {
          console.error(errColeta)
          setErro('Registro salvo, mas falhou ao atualizar a coleta. Entre em contato com o administrador.')
        } else {
          const hojeIso = new Date().toISOString().slice(0, 10)
          const { error: crErr } = await upsertContaReceber(supabase, {
            cliente_id: coletaAtual.cliente_id,
            valor: valorTotal!,
            data_emissao: hojeIso,
            data_vencimento: dataVencimentoIso.trim() || null,
            referencia_coleta_id: coletaAtual.coleta_id,
            faturamento_registro_id: idFaturamentoRegistro ?? undefined,
            observacoes: observacoes.trim() || null,
            origem: 'faturamento',
          })
          if (crErr) console.warn('Conta a receber:', crErr.message)

          setOkMsg('Faturamento realizado com sucesso. A coleta segue para o Financeiro.')
          onGravado()
          if (navegarAposEmitir) {
            navigate(`/financeiro?${montarParamsColeta(coletaAtual).toString()}`)
          }
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
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
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 id="fat-modal-titulo" style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
            {grupoConsolidado && grupoConsolidado.length > 1
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
              <button type="button" className="mini-btn" onClick={() => garantirResumoMontado()}>
                Montar resumo do operacional
              </button>
            </div>
          ) : (
            <>
              <FaturamentoResumoDesvinculado
                resumo={resumoFinanceiro}
                onChange={onResumoFinanceiroChange}
                podeEditarResumos={podeEditarResumosFinanceiros}
                podeEditarAjustes={podeEditarResumosFinanceiros}
                carregandoSugestao={carregandoContrato || carregandoRegras}
                onRecarregarTicket={() => {
                  const b = montarResumoOperacional()
                  if (b) setResumoFinanceiro((prev) => (prev ? { ...b, ticket: b.ticket, mtr: prev.mtr } : b))
                }}
                onRecarregarMtr={() => {
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

              {status === 'emitido' ? (
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

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
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
                  {salvando ? 'Salvando…' : status === 'emitido' ? 'Confirmar faturamento' : 'Salvar registro'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
