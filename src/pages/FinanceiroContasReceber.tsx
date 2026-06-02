import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSessionPersistedState } from '../lib/usePageSessionPersistence'
import { Link, useSearchParams } from 'react-router-dom'
import {
  FinanceiroFilaClinicas,
  type FinanceiroFilaClinicasHandle,
} from '../components/financeiro/FinanceiroFilaClinicas'
import MainLayout from '../layouts/MainLayout'
import { rgConfirm } from '../lib/RgDialogProvider'
import { supabase } from '../lib/supabase'
import { CONTAS_RECEBER_LISTA_MAX_LINHAS, REST_PAGE_SIZE } from '../lib/supabaseCargaLimites'
import { cargoPodeEditarCobranca } from '../lib/workflowPermissions'
import { mensagemErroSupabase } from '../lib/supabaseErrors'
import { RgReportPdfIcon } from '../components/ui/RgReportPdfIcon'
import { gerarRelatorioContasReceberPdf } from '../lib/gerarRelatorioContasReceberPdf'
import {
  devolverColetaContasReceberParaFilaFaturamento,
  registrarBaixaContaReceber,
} from '../services/financeiroReceber'

type ContaRow = {
  id: string
  valor: number
  valor_pago: number
  valor_travado: boolean | null
  status_pagamento: string
  data_vencimento: string | null
  data_emissao: string
  nf_enviada_em: string | null
  referencia_coleta_id: string
  referencia_clinica_os_id: string | null
  origem_clinica: boolean
  cliente_id: string | null
  coleta_numero: string
  cliente_nome: string
}

function inicioDiaMs(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function formatCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, da] = iso.slice(0, 10).split('-')
  if (!y || !m || !da) return iso
  return `${da}/${m}/${y}`
}

/** Oculta títulos duplicados de MTR consolidada (mesma MTR, cliente e valor). */
function filtrarTitulosDuplicadosMtrConsolidada(
  linhas: (ContaRow & { _numero_coleta: number | null; _mtr_id: string | null })[]
): ContaRow[] {
  const grupos = new Map<string, typeof linhas>()
  for (const l of linhas) {
    const mid = (l._mtr_id ?? '').trim()
    if (!mid) continue
    const key = `${mid}|${l.cliente_id ?? ''}|${Math.round(l.valor * 100)}`
    const g = grupos.get(key) ?? []
    g.push(l)
    grupos.set(key, g)
  }

  const omitirIds = new Set<string>()
  for (const g of grupos.values()) {
    if (g.length < 2) continue
    g.sort((a, b) => {
      const na = a._numero_coleta ?? (Number(a.coleta_numero) || 0)
      const nb = b._numero_coleta ?? (Number(b.coleta_numero) || 0)
      return na - nb
    })
    for (let i = 1; i < g.length; i++) omitirIds.add(g[i]!.id)
  }

  return linhas
    .filter((l) => !omitirIds.has(l.id))
    .map((linha) => {
      const { _numero_coleta, _mtr_id, ...row } = linha
      void _numero_coleta
      void _mtr_id
      return row
    })
}

type AbaContasReceber = 'todos' | 'clinicas'

export default function FinanceiroContasReceber() {
  const [searchParams, setSearchParams] = useSearchParams()
  const abaInicial: AbaContasReceber =
    searchParams.get('aba') === 'clinicas' ? 'clinicas' : 'todos'
  const [aba, setAba] = useState<AbaContasReceber>(abaInicial)
  const [linhas, setLinhas] = useState<ContaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [cargo, setCargo] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useSessionPersistedState<'' | 'Pendente' | 'Parcial' | 'Pago'>(
    'filtro-status',
    ''
  )
  const [filtroFaixa, setFiltroFaixa] = useSessionPersistedState<
    'todos' | 'vencido' | '7d' | 'sem_venc'
  >('filtro-faixa', 'todos')
  const [busca, setBusca] = useSessionPersistedState('busca', '')
  const [marcandoPagoId, setMarcandoPagoId] = useState<string | null>(null)
  const [devolvendoColetaId, setDevolvendoColetaId] = useState<string | null>(null)
  const clinicasRef = useRef<FinanceiroFilaClinicasHandle>(null)
  const [resumoClinicas, setResumoClinicas] = useState({
    qtd: 0,
    saldoAberto: 0,
    saldoVencido: 0,
  })
  const [toolbarClinicas, setToolbarClinicas] = useState({ loading: true, qtdFiltradas: 0 })

  const podeMutar = cargoPodeEditarCobranca(cargo)

  useEffect(() => {
    if (searchParams.get('aba') === 'clinicas') setAba('clinicas')
  }, [searchParams])

  function mudarAba(nova: AbaContasReceber) {
    setAba(nova)
    if (nova === 'clinicas') {
      setSearchParams({ aba: 'clinicas' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const selectCr =
        'id, valor, valor_pago, valor_travado, status_pagamento, data_vencimento, data_emissao, nf_enviada_em, referencia_coleta_id, referencia_clinica_os_id, cliente_id'

      const PAGE_SIZE = REST_PAGE_SIZE
      const maxPages = Math.max(1, Math.ceil(CONTAS_RECEBER_LISTA_MAX_LINHAS / PAGE_SIZE))
      const list: Record<string, unknown>[] = []

      for (let page = 0; page < maxPages; page++) {
        const from = page * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        const { data: chunk, error: e1 } = await supabase
          .from('contas_receber')
          .select(selectCr)
          .order('data_vencimento', { ascending: true, nullsFirst: false })
          .range(from, to)

        if (e1) throw e1
        const rows = (chunk || []) as Record<string, unknown>[]
        if (rows.length === 0) break
        list.push(...rows)
        if (rows.length < PAGE_SIZE) break
      }

      if (list.length >= PAGE_SIZE * maxPages) {
        console.warn(
          `[FinanceiroContasReceber] Cap de ${PAGE_SIZE * maxPages} linhas atingido; resultados podem estar truncados.`
        )
      }

      const refIds = [
        ...new Set(list.map((r) => String(r.referencia_coleta_id || '')).filter(Boolean)),
      ]
      const clinOsIds = [
        ...new Set(list.map((r) => String(r.referencia_clinica_os_id || '')).filter(Boolean)),
      ]
      const cliIds = [
        ...new Set(list.map((r) => r.cliente_id as string | null).filter(Boolean) as string[]),
      ]

      const cmap = new Map<
        string,
        { numero: string; numero_coleta: number | null; mtr_id: string | null }
      >()
      const IN_CHUNK = 300
      if (refIds.length > 0) {
        const fatias: string[][] = []
        for (let i = 0; i < refIds.length; i += IN_CHUNK) {
          fatias.push(refIds.slice(i, i + IN_CHUNK))
        }
        const colunas = await Promise.all(
          fatias.map((slice) =>
            supabase.from('coletas').select('id, numero, numero_coleta, mtr_id').in('id', slice)
          )
        )
        for (const { data: cols, error: e2 } of colunas) {
          if (!e2 && cols) {
            for (const c of cols as {
              id: string
              numero: string
              numero_coleta: number | null
              mtr_id: string | null
            }[]) {
              cmap.set(c.id, {
                numero: c.numero,
                numero_coleta: c.numero_coleta,
                mtr_id: c.mtr_id,
              })
            }
          }
        }
      }

      const osmap = new Map<string, { numero_os: string; razao_social: string }>()
      if (clinOsIds.length > 0) {
        const fatiasOs: string[][] = []
        for (let i = 0; i < clinOsIds.length; i += IN_CHUNK) {
          fatiasOs.push(clinOsIds.slice(i, i + IN_CHUNK))
        }
        const osRes = await Promise.all(
          fatiasOs.map((slice) =>
            supabase
              .from('clinicas_ordens_servico')
              .select('id, numero_os, unidade:clinicas_unidades(razao_social)')
              .in('id', slice)
          )
        )
        for (const { data: rows, error: eOs } of osRes) {
          if (!eOs && rows) {
            for (const row of rows as {
              id: string
              numero_os: string
              unidade: { razao_social: string } | { razao_social: string }[] | null
            }[]) {
              const u = row.unidade
              const razao = Array.isArray(u) ? u[0]?.razao_social : u?.razao_social
              osmap.set(row.id, { numero_os: row.numero_os, razao_social: razao ?? 'Clínica' })
            }
          }
        }
      }

      const clmap = new Map<string, string>()
      if (cliIds.length > 0) {
        const fatiasCli: string[][] = []
        for (let i = 0; i < cliIds.length; i += IN_CHUNK) {
          fatiasCli.push(cliIds.slice(i, i + IN_CHUNK))
        }
        const clientesRes = await Promise.all(
          fatiasCli.map((slice) =>
            supabase.from('clientes').select('id, nome').in('id', slice)
          )
        )
        for (const { data: cls, error: e3 } of clientesRes) {
          if (!e3 && cls) {
            for (const c of cls as { id: string; nome: string }[]) {
              clmap.set(c.id, c.nome)
            }
          }
        }
      }

      let out: ContaRow[] = list.map((r) => {
        const ref = String(r.referencia_coleta_id || '')
        const osRef = String(r.referencia_clinica_os_id || '')
        const cid = (r.cliente_id as string | null) || null
        const meta = cmap.get(ref)
        const osMeta = osmap.get(osRef)
        const origemClinica = !!osRef
        return {
          id: String(r.id),
          valor: Number(r.valor) || 0,
          valor_pago: Number(r.valor_pago) || 0,
          valor_travado: r.valor_travado === true,
          status_pagamento: String(r.status_pagamento || 'Pendente'),
          data_vencimento: (r.data_vencimento as string | null) || null,
          data_emissao: String(r.data_emissao || '').slice(0, 10),
          nf_enviada_em: (r.nf_enviada_em as string | null) || null,
          referencia_coleta_id: ref,
          referencia_clinica_os_id: osRef || null,
          origem_clinica: origemClinica,
          cliente_id: cid,
          coleta_numero: origemClinica
            ? osMeta?.numero_os ?? osRef.slice(0, 8)
            : meta?.numero ?? ref.slice(0, 8),
          cliente_nome: origemClinica
            ? osMeta?.razao_social ?? 'Clínica'
            : cid
              ? clmap.get(cid) ?? '—'
              : '—',
          _numero_coleta: meta?.numero_coleta ?? null,
          _mtr_id: meta?.mtr_id ?? null,
        } as ContaRow & { _numero_coleta: number | null; _mtr_id: string | null }
      })

      out = filtrarTitulosDuplicadosMtrConsolidada(
        out as (ContaRow & { _numero_coleta: number | null; _mtr_id: string | null })[]
      )

      setLinhas(out)
    } catch (e) {
      setErro(mensagemErroSupabase(e, 'Erro ao carregar contas a receber.'))
      setLinhas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void carregar()
    })
  }, [carregar])

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setCargo(null)
        return
      }
      const { data } = await supabase.from('usuarios').select('cargo').eq('id', user.id).maybeSingle()
      setCargo(data?.cargo ?? null)
    })()
  }, [])

  const hojeMs = useMemo(() => inicioDiaMs(new Date().toISOString()), [])

  const filtradas = useMemo(() => {
    let list = linhas
    const t = busca.trim().toLowerCase()
    if (t) {
      list = list.filter(
        (r) =>
          r.coleta_numero.toLowerCase().includes(t) ||
          r.cliente_nome.toLowerCase().includes(t) ||
          r.referencia_coleta_id.toLowerCase().includes(t) ||
          (r.referencia_clinica_os_id ?? '').toLowerCase().includes(t)
      )
    }
    if (filtroStatus) {
      list = list.filter((r) => r.status_pagamento === filtroStatus)
    }
    if (filtroFaixa !== 'todos') {
      list = list.filter((r) => {
        const saldo = r.valor - r.valor_pago
        if (saldo <= 0 || r.status_pagamento === 'Pago') return false
        const v = r.data_vencimento
        if (filtroFaixa === 'sem_venc') return !v
        if (!v) return false
        const vm = inicioDiaMs(v)
        if (filtroFaixa === 'vencido') return vm < hojeMs
        const alvo = hojeMs + 7 * 86400000
        return vm >= hojeMs && vm <= alvo
      })
    }
    return list
  }, [linhas, busca, filtroStatus, filtroFaixa, hojeMs])

  const loadingAtivo = aba === 'clinicas' ? toolbarClinicas.loading : loading
  const qtdExportAtiva = aba === 'clinicas' ? toolbarClinicas.qtdFiltradas : filtradas.length

  const resumo = useMemo(() => {
    let saldoAberto = 0
    let saldoVencido = 0
    for (const r of linhas) {
      if (r.status_pagamento === 'Pago' || r.status_pagamento === 'Cancelado') continue
      const saldo = r.valor - r.valor_pago
      if (saldo <= 0) continue
      saldoAberto += saldo
      const v = r.data_vencimento
      if (v && inicioDiaMs(v) < hojeMs) saldoVencido += saldo
    }
    return { saldoAberto, saldoVencido, qtd: linhas.length }
  }, [linhas, hojeMs])

  function podeDevolverParaFilaFaturamento(row: ContaRow): boolean {
    if (row.origem_clinica) return false
    if (row.status_pagamento === 'Pago' || row.status_pagamento === 'Cancelado') return false
    if (row.valor_pago > 0) return false
    return true
  }

  async function devolverParaFilaFaturamento(row: ContaRow) {
    if (!podeMutar || !podeDevolverParaFilaFaturamento(row)) return

    const ok = await rgConfirm({
      title: 'Voltar para fila do faturamento',
      message: `Devolver a coleta ${row.coleta_numero} (${row.cliente_nome}) da fila Financeiro para a esteira de faturamento?`,
      details: [
        'O título a receber será cancelado (sem baixas registadas).',
        'A coleta volta ao passo «Registo de NF / boleto» em Faturamento operacional; o faturamento emitido mantém-se.',
        'Tickets da mesma MTR em aberto na mesma situação são incluídos.',
      ],
      confirmLabel: 'Devolver ao faturamento',
      variant: 'danger',
    })
    if (!ok) return

    setDevolvendoColetaId(row.referencia_coleta_id)
    setErro('')
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const res = await devolverColetaContasReceberParaFilaFaturamento(supabase, {
        referencia_coleta_id: row.referencia_coleta_id,
        usuario_id: user?.id ?? null,
        observacao: `Devolvido pelo título ${row.coleta_numero} em Contas a Receber.`,
      })
      if (!res.ok) throw new Error(res.message)
      await carregar()
    } catch (e) {
      setErro(mensagemErroSupabase(e, 'Erro ao devolver coleta para a fila do faturamento.'))
    } finally {
      setDevolvendoColetaId(null)
    }
  }

  async function marcarTituloComoPago(row: ContaRow) {
    if (!podeMutar) return
    const saldo = row.valor - row.valor_pago
    if (saldo <= 0 || row.status_pagamento === 'Pago') return

    const ok = await rgConfirm({
      title: 'Marcar como pago',
      message: `Marcar ${row.origem_clinica ? 'a O.S.' : 'a coleta'} ${row.coleta_numero} (${row.cliente_nome}) como Pago?`,
      details: [`Saldo: ${formatCurrency(saldo)}`],
      confirmLabel: 'Marcar pago',
      variant: 'success',
    })
    if (!ok) return

    setMarcandoPagoId(row.id)
    setErro('')
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error } = await registrarBaixaContaReceber(supabase, {
        conta_receber_id: row.origem_clinica ? row.id : undefined,
        referencia_coleta_id: row.origem_clinica ? undefined : row.referencia_coleta_id,
        valor_baixa: saldo,
        observacao: 'Marcado como Pago na lista de títulos (Contas a Receber).',
        usuario_id: user?.id ?? null,
      })
      if (error) throw error
      await carregar()
    } catch (e) {
      setErro(mensagemErroSupabase(e, 'Erro ao marcar título como pago.'))
    } finally {
      setMarcandoPagoId(null)
    }
  }

  function gerarRelatorioPdf() {
    if (loading) return
    const linhasPdf = filtradas.map((r) => {
      const saldo = r.valor - r.valor_pago
      const vencMs = r.data_vencimento ? inicioDiaMs(r.data_vencimento) : null
      const vencido = vencMs != null && saldo > 0 && vencMs < hojeMs
      return {
        coleta_numero: r.coleta_numero,
        cliente_nome: r.cliente_nome,
        valor: r.valor,
        valor_pago: r.valor_pago,
        status_pagamento: r.status_pagamento,
        data_vencimento: r.data_vencimento,
        data_emissao: r.data_emissao,
        valor_travado: r.valor_travado,
        vencido,
      }
    })
    gerarRelatorioContasReceberPdf({
      resumo,
      linhas: linhasPdf,
      filtros: {
        busca,
        status: filtroStatus,
        envelhecimento: filtroFaixa,
      },
    })
  }

  function exportarCsv() {
    const header = [
      'coleta',
      'cliente',
      'valor',
      'valor_pago',
      'saldo',
      'status',
      'vencimento',
      'emissao',
      'travado',
      'nf_enviada',
    ]
    const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
    const body = filtradas
      .map((r) => {
        const saldo = r.valor - r.valor_pago
        return [
          esc(r.coleta_numero),
          esc(r.cliente_nome),
          esc(r.valor),
          esc(r.valor_pago),
          esc(saldo),
          esc(r.status_pagamento),
          esc(r.data_vencimento || ''),
          esc(r.data_emissao),
          esc(r.valor_travado ? 'sim' : 'não'),
          esc(r.nf_enviada_em || ''),
        ].join(';')
      })
      .join('\r\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + header.join(';') + '\r\n' + body], {
      type: 'text/csv;charset=utf-8;',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `contas-receber-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <MainLayout>
      <div className="page-shell">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
              Títulos, vencimentos e saldos
            </h1>
            <p className="page-header__lead" style={{ margin: '8px 0 0', maxWidth: 720 }}>
              {aba === 'clinicas' ? (
                <>
                  Fila de títulos enviados pelo faturamento de clínicas. Marque pagamento, data de
                  recebimento e exporte relatórios — mesma visão dos demais títulos.
                </>
              ) : (
                <>
                  Relatório por título: saldos em aberto, vencidos e faixa de vencimento. Use a{' '}
                  <Link to="/financeiro/cobranca">cobrança por coleta</Link> para alterar vencimento, NF e baixas.
                </>
              )}
            </p>
            {podeMutar ? null : (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
                Seu perfil: consulta. Alterações em cobrança exigem Financeiro ou Administrador.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                if (aba === 'clinicas') void clinicasRef.current?.recarregar()
                else void carregar()
              }}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Atualizar
            </button>
            <button
              type="button"
              className="rg-btn rg-btn--report"
              onClick={() => {
                if (aba === 'clinicas') clinicasRef.current?.gerarRelatorioPdf()
                else gerarRelatorioPdf()
              }}
              disabled={loadingAtivo}
              title={loadingAtivo ? 'Aguarde o carregamento dos títulos' : 'Gerar PDF com resumo e tabela filtrada'}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid #0d9488',
                background: '#fff',
                color: '#0f766e',
                fontWeight: 700,
                cursor: loadingAtivo ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                opacity: loadingAtivo ? 0.65 : 1,
              }}
            >
              <RgReportPdfIcon className="rg-btn__icon" />
              Gerar relatório
            </button>
            <button
              type="button"
              onClick={() => {
                if (aba === 'clinicas') clinicasRef.current?.exportarCsv()
                else exportarCsv()
              }}
              disabled={loadingAtivo || qtdExportAtiva === 0}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid #0f172a',
                background: '#0f172a',
                color: '#fff',
                fontWeight: 700,
                cursor: loadingAtivo || qtdExportAtiva === 0 ? 'not-allowed' : 'pointer',
                opacity: loadingAtivo || qtdExportAtiva === 0 ? 0.6 : 1,
              }}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            padding: '6px',
            borderRadius: '14px',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
          }}
          role="tablist"
          aria-label="Visão de contas a receber"
        >
          {(
            [
              {
                id: 'todos' as const,
                label: 'Todos os títulos',
                hint: 'Coletas e demais origens',
                qtd: resumo.qtd,
                ativoCor: '#fff',
              },
              {
                id: 'clinicas' as const,
                label: 'Fila — Clínicas',
                hint: 'O.S. do módulo clínicas',
                qtd: resumoClinicas.qtd,
                ativoCor: '#ecfdf5',
              },
            ] as const
          ).map((tab) => {
            const ativo = aba === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => mudarAba(tab.id)}
                style={{
                  padding: '10px 16px',
                  border: ativo ? '1px solid #cbd5e1' : '1px solid transparent',
                  borderRadius: '10px',
                  background: ativo ? tab.ativoCor : 'transparent',
                  color: ativo ? (tab.id === 'clinicas' ? '#0f766e' : '#0f172a') : '#64748b',
                  fontWeight: ativo ? 800 : 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: ativo ? '0 1px 4px rgba(15, 23, 42, 0.08)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                  <span>{tab.label}</span>
                  {ativo ? (
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748b' }}>{tab.hint}</span>
                  ) : null}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: ativo
                      ? tab.id === 'clinicas'
                        ? '#ccfbf1'
                        : '#e2e8f0'
                      : '#e2e8f0',
                    color: ativo ? '#334155' : '#64748b',
                  }}
                >
                  {tab.qtd}
                </span>
              </button>
            )
          })}
        </div>

        <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#64748b' }}>
          {aba === 'clinicas'
            ? 'Visão dedicada às clínicas — títulos enviados após faturamento (sem pesagem/ticket).'
            : 'Visão geral de todos os títulos a receber do sistema.'}
        </p>

        <div
          style={{
            display: aba === 'clinicas' ? 'block' : 'none',
            marginTop: '16px',
            padding: '4px 4px 0',
            borderRadius: '16px',
            border: '2px solid #99f6e4',
            background: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 48%)',
          }}
          role="tabpanel"
          aria-hidden={aba !== 'clinicas'}
        >
          <FinanceiroFilaClinicas
            ref={clinicasRef}
            podeMutar={podeMutar}
            onResumoChange={setResumoClinicas}
            onToolbarStateChange={setToolbarClinicas}
          />
        </div>

        {aba === 'todos' && erro ? (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
            }}
          >
            {erro}
          </div>
        ) : null}

        {aba === 'todos' ? (
        <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginTop: '22px',
          }}
        >
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              background: '#fff',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Títulos carregados</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{resumo.qtd}</div>
          </div>
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '14px',
              border: '1px solid #fde68a',
              background: '#fffbeb',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e' }}>Saldo em aberto</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#b45309' }}>
              {formatCurrency(resumo.saldoAberto)}
            </div>
          </div>
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '14px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>Saldo vencido (aberto)</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#b91c1c' }}>
              {formatCurrency(resumo.saldoVencido)}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Busca</div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, nº coleta…"
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                minWidth: '220px',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Status</div>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            >
              <option value="">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Parcial">Parcial</option>
              <option value="Pago">Pago</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
              Envelhecimento
            </div>
            <select
              value={filtroFaixa}
              onChange={(e) => setFiltroFaixa(e.target.value as typeof filtroFaixa)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            >
              <option value="todos">Todos (com saldo)</option>
              <option value="vencido">Vencidos</option>
              <option value="7d">A vencer em 7 dias</option>
              <option value="sem_venc">Sem data vencimento</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginTop: '18px' }}>
          {loading ? (
            <p style={{ color: '#64748b' }}>A carregar…</p>
          ) : (
            <table
              style={{
                width: '100%',
                minWidth: '920px',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>Coleta</th>
                  <th style={{ padding: '10px 8px' }}>Cliente</th>
                  <th style={{ padding: '10px 8px' }}>Valor</th>
                  <th style={{ padding: '10px 8px' }}>Pago</th>
                  <th style={{ padding: '10px 8px' }}>Saldo</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Venc.</th>
                  <th style={{ padding: '10px 8px' }}>Trav.</th>
                  <th style={{ padding: '10px 8px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '24px', color: '#64748b' }}>
                      Nenhuma linha com estes filtros.
                    </td>
                  </tr>
                ) : (
                  filtradas.map((r) => {
                    const saldo = r.valor - r.valor_pago
                    const vencMs = r.data_vencimento ? inicioDiaMs(r.data_vencimento) : null
                    const vencido = vencMs != null && saldo > 0 && vencMs < hojeMs
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>{r.coleta_numero}</td>
                        <td style={{ padding: '10px 8px' }}>{r.cliente_nome}</td>
                        <td style={{ padding: '10px 8px' }}>{formatCurrency(r.valor)}</td>
                        <td style={{ padding: '10px 8px' }}>{formatCurrency(r.valor_pago)}</td>
                        <td
                          style={{
                            padding: '10px 8px',
                            fontWeight: 700,
                            color: saldo > 0 ? '#b45309' : '#15803d',
                          }}
                        >
                          {formatCurrency(saldo)}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{r.status_pagamento}</td>
                        <td style={{ padding: '10px 8px', color: vencido ? '#b91c1c' : undefined }}>
                          {formatDate(r.data_vencimento)}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{r.valor_travado ? 'sim' : '—'}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: '10px 14px',
                            }}
                          >
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor:
                                  podeMutar && saldo > 0 && marcandoPagoId !== r.id
                                    ? 'pointer'
                                    : 'default',
                                userSelect: 'none',
                              }}
                              title={
                                !podeMutar
                                  ? 'Sem permissão para alterar cobrança'
                                  : saldo <= 0
                                    ? 'Título já quitado'
                                    : 'Registar baixa do saldo em aberto'
                              }
                            >
                              <input
                                type="checkbox"
                                checked={r.status_pagamento === 'Pago' || saldo <= 0}
                                disabled={
                                  !podeMutar || marcandoPagoId === r.id || saldo <= 0
                                }
                                onChange={(e) => {
                                  if (e.target.checked) void marcarTituloComoPago(r)
                                }}
                                style={{ width: '18px', height: '18px', accentColor: '#15803d' }}
                              />
                              Pago
                            </label>
                            {r.origem_clinica ? (
                              <Link
                                to="/financeiro/contas-receber?aba=clinicas"
                                style={{ fontWeight: 700, color: '#0d9488' }}
                              >
                                Fila clínicas
                              </Link>
                            ) : (
                              <>
                                <Link
                                  to={`/financeiro/cobranca?coleta=${encodeURIComponent(r.referencia_coleta_id)}`}
                                  style={{ fontWeight: 700, color: '#0d9488' }}
                                >
                                  Cobrança
                                </Link>
                                {podeDevolverParaFilaFaturamento(r) ? (
                                  <button
                                    type="button"
                                    disabled={
                                      !podeMutar || devolvendoColetaId === r.referencia_coleta_id
                                    }
                                    onClick={() => void devolverParaFilaFaturamento(r)}
                                    title="Cancela o título e devolve a coleta ao passo de registo NF/boleto no Faturamento operacional"
                                    style={{
                                      padding: 0,
                                      border: 'none',
                                      background: 'transparent',
                                      fontWeight: 700,
                                      fontSize: '13px',
                                      color:
                                        podeMutar && devolvendoColetaId !== r.referencia_coleta_id
                                          ? '#b45309'
                                          : '#94a3b8',
                                      cursor:
                                        podeMutar && devolvendoColetaId !== r.referencia_coleta_id
                                          ? 'pointer'
                                          : 'not-allowed',
                                      textDecoration: 'underline',
                                      textUnderlineOffset: '2px',
                                    }}
                                  >
                                    {devolvendoColetaId === r.referencia_coleta_id
                                      ? 'A devolver…'
                                      : 'Voltar para fila do faturamento'}
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
        </>
        ) : null}
      </div>
    </MainLayout>
  )
}
