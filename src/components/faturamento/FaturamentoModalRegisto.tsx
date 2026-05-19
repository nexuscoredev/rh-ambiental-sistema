import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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
  calcularPrecoContratoCliente,
  rotuloOrigemContrato,
  rotuloUnidadeMedida,
  type ResultadoPrecoContrato,
} from '../../lib/faturamentoPrecoContrato'

function parseValor(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Projeto remoto sem migração `valor_adicionais` / `observacoes` → PostgREST 400 (PGRST204). */
function faturamentoRegistrosErroColunasOpcionais(err: PostgrestError | null): boolean {
  if (!err) return false
  if (err.code === 'PGRST204') return true
  const t = `${err.message || ''} ${err.details || ''}`.toLowerCase()
  return (
    t.includes('valor_adicionais') ||
    t.includes('observacoes') ||
    t.includes('schema cache')
  )
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
  podeMutar: boolean
  onClose: () => void
  onGravado: () => void
  /** Se false, após emitir mantém-se na página atual (ex.: Financeiro unificado). Padrão: navega para Financeiro com contexto da coleta. */
  navegarAposEmitir?: boolean
}

export function FaturamentoModalRegisto({
  open,
  row,
  podeMutar,
  onClose,
  onGravado,
  navegarAposEmitir = true,
}: Props) {
  const navigate = useNavigate()
  const [registroId, setRegistroId] = useState<string | null>(null)
  const [valorServicoStr, setValorServicoStr] = useState('')
  const [valorAdicionaisStr, setValorAdicionaisStr] = useState('')
  const [referenciaNf, setReferenciaNf] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [status, setStatus] = useState<StatusFat>('emitido')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [regrasPreco, setRegrasPreco] = useState<RegraPrecoRow[]>([])
  const [carregandoRegras, setCarregandoRegras] = useState(false)
  const [tinhaRegistoPersistido, setTinhaRegistoPersistido] = useState(false)
  const [manualValor, setManualValor] = useState(false)
  const [dataVencimentoIso, setDataVencimentoIso] = useState('')
  const [contratoCliente, setContratoCliente] = useState<{
    residuos_contrato: unknown
    tipo_residuo_legado: string | null
  } | null>(null)
  const [carregandoContrato, setCarregandoContrato] = useState(false)
  const [quantidadeFaturamentoStr, setQuantidadeFaturamentoStr] = useState('')

  const pesoColetaKg = row?.peso_liquido != null ? Number(row.peso_liquido) : null

  const totalNumero = useMemo(() => {
    const s = parseValor(valorServicoStr) ?? 0
    const a = parseValor(valorAdicionaisStr) ?? 0
    return s + a
  }, [valorServicoStr, valorAdicionaisStr])

  const totalFmt = useMemo(
    () =>
      totalNumero > 0
        ? totalNumero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—',
    [totalNumero]
  )

  const sugestaoRegras = useMemo(() => {
    if (!row) return null
    const qtd = parseValor(quantidadeFaturamentoStr)
    const pesoParaRegra =
      qtd != null && qtd > 0
        ? qtd
        : pesoColetaKg
    return resolverPrecoSugerido(
      regrasPreco,
      row.cliente_id,
      row.tipo_residuo,
      pesoParaRegra,
      'COLETA'
    )
  }, [regrasPreco, row, quantidadeFaturamentoStr, pesoColetaKg])

  const sugestaoContrato: ResultadoPrecoContrato | null = useMemo(() => {
    if (!row || !contratoCliente) return null
    const qtd = parseValor(quantidadeFaturamentoStr)
    return calcularPrecoContratoCliente({
      residuosContratoRaw: contratoCliente.residuos_contrato,
      legadoTipoResiduo: contratoCliente.tipo_residuo_legado,
      tipoResiduoColeta: row.tipo_residuo,
      pesoLiquidoKg: pesoColetaKg,
      quantidadeFaturada: qtd,
    })
  }, [row, contratoCliente, quantidadeFaturamentoStr, pesoColetaKg])

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

  const sugestaoFmt = useMemo(() => {
    if (!sugestaoAtiva || sugestaoAtiva.total <= 0) return '—'
    return sugestaoAtiva.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }, [sugestaoAtiva])

  const unidadeFaturamento = sugestaoContrato?.unidadeMedida ?? 'kg'

  const valorAlinhaSugestao = useMemo(() => {
    if (!sugestaoAtiva || sugestaoAtiva.total <= 0) return false
    const v = parseValor(valorServicoStr) ?? 0
    const a = parseValor(valorAdicionaisStr) ?? 0
    return Math.abs(v + a - sugestaoAtiva.total) < 0.02
  }, [sugestaoAtiva, valorServicoStr, valorAdicionaisStr])

  const diferencaConta = useMemo(() => {
    if (!sugestaoAtiva || sugestaoAtiva.total <= 0) return null
    const informado = totalNumero
    return Math.round((informado - sugestaoAtiva.total) * 100) / 100
  }, [sugestaoAtiva, totalNumero])

  const carregarRegisto = useCallback(async (coletaId: string) => {
    setCarregando(true)
    setErro('')
    setOkMsg('')
    const selectCandidates = [
      'id, valor, valor_adicionais, referencia_nf, status, observacoes, updated_at',
      'id, valor, referencia_nf, status, updated_at',
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
      if (!faturamentoRegistrosErroColunasOpcionais(error)) break
    }

    if (error) {
      console.error(error)
      setErro('Não foi possível carregar o registro de faturamento.')
      setRegistroId(null)
      setTinhaRegistoPersistido(false)
      setValorServicoStr('')
      setValorAdicionaisStr('')
      setReferenciaNf('')
      setObservacoes('')
      setStatus('emitido')
      setCarregando(false)
      return
    }

    if (data) {
      const rec = data as {
        id: string
        valor: number | null
        valor_adicionais?: number | null
        referencia_nf: string | null
        status: string
        observacoes?: string | null
      }
      setTinhaRegistoPersistido(true)
      setRegistroId(rec.id)
      const adic = rec.valor_adicionais != null ? Number(rec.valor_adicionais) : 0
      const tot = rec.valor != null ? Number(rec.valor) : 0
      const base = tot > 0 && adic > 0 ? tot - adic : tot
      setValorServicoStr(base > 0 ? String(base) : tot > 0 ? String(tot) : '')
      setValorAdicionaisStr(adic > 0 ? String(adic) : '')
      setReferenciaNf(rec.referencia_nf ?? '')
      setObservacoes(rec.observacoes ?? '')
      const st = rec.status === 'emitido' || rec.status === 'cancelado' ? rec.status : 'pendente'
      setStatus(st)
    } else {
      setTinhaRegistoPersistido(false)
      setRegistroId(null)
      setValorServicoStr('')
      setValorAdicionaisStr('')
      setReferenciaNf('')
      setObservacoes('')
      setStatus('emitido')
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    if (!open || !row) return
    queueMicrotask(() => {
      void carregarRegisto(row.coleta_id)
    })
  }, [open, row, carregarRegisto])

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
      setManualValor(false)
      setDataVencimentoIso(sugerirDataVencimentoIso(7))
    })
  }, [open, row])

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
        'id, residuos_contrato, tipo_residuo, classificacao, unidade_medida, frequencia_coleta'
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
          tipo_residuo_legado: typeof d.tipo_residuo === 'string' ? d.tipo_residuo : null,
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
      queueMicrotask(() => setQuantidadeFaturamentoStr(''))
      return
    }
  }, [open, row?.coleta_id])

  useEffect(() => {
    if (!open || !row || carregandoContrato) return
    if (quantidadeFaturamentoStr.trim()) return
    const u = rotuloUnidadeMedida(unidadeFaturamento).toLowerCase()
    let def = ''
    if (pesoColetaKg != null && Number.isFinite(pesoColetaKg)) {
      if (u === 'ton') def = String(pesoColetaKg / 1000)
      else if (u === 'kg') def = String(pesoColetaKg)
    }
    queueMicrotask(() => setQuantidadeFaturamentoStr(def))
  }, [open, row?.coleta_id, pesoColetaKg, unidadeFaturamento, carregandoContrato, quantidadeFaturamentoStr])

  useEffect(() => {
    if (!open || !row || carregando || carregandoRegras || carregandoContrato) return
    if (tinhaRegistoPersistido) return
    if (manualValor) return
    const s = sugestaoAtiva
    if (s && s.total > 0) {
      queueMicrotask(() => {
        setValorServicoStr(String(s.total))
        setValorAdicionaisStr('')
      })
      return
    }
    const v = row.valor_coleta
    if (v != null && Number(v) > 0) {
      queueMicrotask(() => setValorServicoStr(String(v)))
    }
  }, [
    open,
    row,
    carregando,
    carregandoRegras,
    carregandoContrato,
    tinhaRegistoPersistido,
    manualValor,
    sugestaoAtiva,
  ])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!row || !podeMutar) return

    if (status === 'emitido') {
      const el = coletaElegivelParaFaturar(row)
      if (!el.ok) {
        const msg = el.motivos.map(rotuloMotivoInelegivel).join(' ')
        setErro(`Não é possível faturar esta coleta ainda. ${msg}`)
        return
      }
    }

    if (status === 'emitido' && totalNumero <= 0) {
      setErro('Preencha o valor antes de continuar.')
      return
    }

    setSalvando(true)
    setErro('')
    setOkMsg('')
    const coletaAtual = row
    const agora = new Date().toISOString()
    const valorTotal = totalNumero > 0 ? totalNumero : null
    const adic = parseValor(valorAdicionaisStr)

    try {
      const payloadExtras: Record<string, unknown> = {
        valor: valorTotal,
        valor_adicionais: adic != null && adic > 0 ? adic : null,
        referencia_nf: referenciaNf.trim() || null,
        observacoes: observacoes.trim() || null,
        status,
        updated_at: agora,
      }
      const payloadMinimo: Record<string, unknown> = {
        valor: valorTotal,
        referencia_nf: referenciaNf.trim() || null,
        status,
        updated_at: agora,
      }

      async function gravarRegistro(payload: Record<string, unknown>) {
        if (registroId) {
          return supabase.from('faturamento_registros').update(payload).eq('id', registroId)
        }
        return supabase
          .from('faturamento_registros')
          .insert({ coleta_id: coletaAtual.coleta_id, ...payload })
          .select('id')
          .single()
      }

      let res = await gravarRegistro(payloadExtras)
      if (res.error && faturamentoRegistrosErroColunasOpcionais(res.error)) {
        res = await gravarRegistro(payloadMinimo)
      }
      if (res.error) throw res.error

      const idInserido = (res.data as { id?: string } | null | undefined)?.id
      let idFaturamentoRegistro = registroId
      if (typeof idInserido === 'string') {
        idFaturamentoRegistro = idInserido
        if (!registroId) setRegistroId(idInserido)
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
          maxWidth: '620px',
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
            Faturamento da coleta
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b' }}>
            <strong>{row.numero_coleta ?? row.numero}</strong> — {row.cliente_nome || 'Cliente'} · MTR{' '}
            {row.mtr_numero || '—'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
          {!podeMutar ? (
            <p style={{ color: '#92400e', fontSize: '14px' }}>Seu perfil permite apenas consulta.</p>
          ) : null}

          <div style={{ display: 'grid', gap: '10px', marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
            <div>
              <strong>Resíduo:</strong> {row.tipo_residuo || '—'}
            </div>
            <div>
              <strong>Peso líquido (pesagem):</strong>{' '}
              {pesoColetaKg != null
                ? `${pesoColetaKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`
                : '—'}
            </div>
            {sugestaoContrato?.residuoContrato ? (
              <div style={{ fontSize: '12px', color: '#0f766e', lineHeight: 1.45 }}>
                <strong>Contrato cliente:</strong> {sugestaoContrato.residuoContrato.tipo_residuo.trim()}
                {sugestaoContrato.valorUnitario > 0 ? (
                  <>
                    {' '}
                    · R${' '}
                    {sugestaoContrato.valorUnitario.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    /{unidadeFaturamento}
                  </>
                ) : null}
                {sugestaoContrato.faturamentoMinimo > 0 ? (
                  <>
                    {' '}
                    · mín. R${' '}
                    {sugestaoContrato.faturamentoMinimo.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </>
                ) : null}
              </div>
            ) : carregandoContrato ? (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>A carregar contrato do cliente…</div>
            ) : row.cliente_id ? (
              <div style={{ fontSize: '12px', color: '#b45309' }}>
                Resíduo sem preço no cadastro do cliente — confira em Clientes ou use regra de preço / valor manual.
              </div>
            ) : null}
          </div>

          {carregando ? (
            <p style={{ color: '#64748b' }}>Carregando…</p>
          ) : (
            <>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Peso / quantidade real para faturamento ({unidadeFaturamento})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={quantidadeFaturamentoStr}
                onChange={(e) => {
                  setManualValor(false)
                  setQuantidadeFaturamentoStr(e.target.value)
                }}
                disabled={!podeMutar}
                placeholder={unidadeFaturamento === 'ton' ? 'Ex.: 0,8' : 'Ex.: 800'}
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
              <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
                {unidadeFaturamento === 'ton'
                  ? 'Toneladas: quantidade em ton (pesagem em kg ÷ 1000).'
                  : unidadeFaturamento === 'kg'
                    ? 'Por defeito usa o peso líquido da pesagem.'
                    : 'Quantidade na unidade do contrato (m³ ou litros).'}
              </p>

              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' }}>
                      VALOR CALCULADO (CADASTRO / REGRA)
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{sugestaoFmt}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {carregandoRegras || carregandoContrato
                        ? 'A carregar preços…'
                        : sugestaoAtiva && sugestaoAtiva.total > 0
                          ? `${sugestaoAtiva.origemLabel} · pode editar os campos abaixo`
                          : 'Sem preço no contrato do cliente nem regra — use valor manual.'}
                    </div>
                  </div>
                  {sugestaoAtiva && sugestaoAtiva.total > 0 && podeMutar ? (
                    <button
                      type="button"
                      onClick={() => {
                        setManualValor(false)
                        setValorServicoStr(String(sugestaoAtiva.total))
                        setValorAdicionaisStr('')
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: '1px solid #0d9488',
                        background: '#fff',
                        color: '#0f766e',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Aplicar sugerido
                    </button>
                  ) : null}
                </div>
                {sugestaoAtiva && sugestaoAtiva.linhas.length > 0 ? (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                      Composição (referência)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155' }}>
                      {sugestaoAtiva.linhas.map((ln) => (
                        <li key={ln.chave}>
                          {ln.rotulo}:{' '}
                          {ln.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Valor do serviço (R$){' '}
                {valorAlinhaSugestao && !manualValor && sugestaoAtiva && sugestaoAtiva.total > 0 ? (
                  <span style={{ color: '#0d9488', fontWeight: 800 }}>· automático</span>
                ) : (
                  <span style={{ color: '#64748b', fontWeight: 600 }}>· manual</span>
                )}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={valorServicoStr}
                onChange={(e) => {
                  setManualValor(true)
                  setValorServicoStr(e.target.value)
                }}
                disabled={!podeMutar}
                placeholder="0,00"
                style={{
                  width: '100%',
                  marginBottom: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border:
                    !manualValor && valorAlinhaSugestao && sugestaoAtiva && sugestaoAtiva.total > 0
                      ? '2px solid #0d9488'
                      : '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Adicionais (opcional, R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={valorAdicionaisStr}
                onChange={(e) => {
                  setManualValor(true)
                  setValorAdicionaisStr(e.target.value)
                }}
                disabled={!podeMutar}
                placeholder="0,00"
                style={{
                  width: '100%',
                  marginBottom: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />

              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#065f46',
                }}
              >
                Total a faturar: {totalFmt}
              </div>

              {sugestaoAtiva && sugestaoAtiva.total > 0 ? (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: diferencaConta != null && Math.abs(diferencaConta) < 0.02 ? '#ecfdf5' : '#fffbeb',
                    border:
                      diferencaConta != null && Math.abs(diferencaConta) < 0.02
                        ? '1px solid #6ee7b7'
                        : '1px solid #fcd34d',
                    fontSize: '13px',
                    color: '#334155',
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: '6px', color: '#0f172a' }}>Conferência da conta</div>
                  <div>
                    Calculado ({sugestaoAtiva.origemLabel}):{' '}
                    <strong>
                      {sugestaoAtiva.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    Informado (serviço + adicionais): <strong>{totalFmt}</strong>
                  </div>
                  {diferencaConta != null ? (
                    <div
                      style={{
                        marginTop: '8px',
                        fontWeight: 800,
                        color: Math.abs(diferencaConta) < 0.02 ? '#047857' : '#b45309',
                      }}
                    >
                      {Math.abs(diferencaConta) < 0.02
                        ? 'A conta confere com o cadastro/regra.'
                        : `Diferença: ${diferencaConta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                    </div>
                  ) : null}
                </div>
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
                    disabled={!podeMutar}
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

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Referência NF (opcional)
              </label>
              <input
                type="text"
                value={referenciaNf}
                onChange={(e) => setReferenciaNf(e.target.value)}
                disabled={!podeMutar}
                style={{
                  width: '100%',
                  marginBottom: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Observações (opcional)
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={!podeMutar}
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
                disabled={!podeMutar}
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
                  disabled={!podeMutar || salvando}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: podeMutar ? '#0d9488' : '#94a3b8',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: podeMutar && !salvando ? 'pointer' : 'not-allowed',
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
