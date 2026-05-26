import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { registrarTicketImpressoColeta } from '../lib/faturamentoTicketFluxo'
import {
  etapaTicketJaRegistradoNoFluxo,
  formatarEtapaParaUI,
  formatarFaseFluxoOficialParaUI,
  type EtapaFluxo,
} from '../lib/fluxoEtapas'
import {
  cargoPerfilSomenteLancamentoTicketPadrao,
  cargoPodeCustomizarTicketOperacional,
  cargoPodeEditarTicketOperacional,
  cargoPodeReeditarTicketOperacionalAposGerado,
} from '../lib/workflowPermissions'
import { mensagemErroSupabase as mensagemErroSupabaseBase } from '../lib/supabaseErrors'
import { empresaTicketImpressaoRg } from '../lib/rgAmbientalDadosCorporativos'
import { obterProximoNumeroTicketOperacional } from '../lib/nextTicketOperacionalNumero'
import { numeroTicketFromMtr } from '../lib/numeroTicketMtr'
import { resolverDataExibicaoTicket } from '../lib/ticketOperacionalData'
import { TICKET_OPERACIONAL_PRINT_STYLES } from '../lib/ticketOperacionalPrintStyles'
import { TicketOperacionalPrintView } from './TicketOperacionalPrintView'

export type TicketColetaSnapshot = {
  id: string
  numero: string
  cliente: string
  etapaFluxo: EtapaFluxo
  mtr_id: string | null
  programacao_id: string | null
  cliente_id: string | null
  placa: string
  motorista: string
  tipo_residuo: string
  peso_tara: number | null
  peso_bruto: number | null
  peso_liquido: number | null
  /** Preenchido pela lista quando existir `tickets_operacionais.numero` para a coleta. */
  ticketOperacionalNumero?: string | null
}

export type TipoTicketOperacional = 'entrada' | 'saida' | 'frete'

function normalizarTipoTicket(raw: string | null | undefined): TipoTicketOperacional {
  if (raw === 'frete') return 'frete'
  if (raw === 'entrada') return 'entrada'
  return 'saida'
}

function montarParamsColeta(c: TicketColetaSnapshot) {
  const p = new URLSearchParams()
  p.set('coleta', c.id)
  if (c.mtr_id) p.set('mtr', c.mtr_id)
  if (c.programacao_id) p.set('programacao', c.programacao_id)
  if (c.cliente_id) p.set('cliente', c.cliente_id)
  return p
}

function rotuloOpcaoColetaTicket(c: TicketColetaSnapshot): string {
  const ticket = (c.ticketOperacionalNumero ?? '').trim()
  const fase = `${formatarFaseFluxoOficialParaUI(c.etapaFluxo)} (${formatarEtapaParaUI(c.etapaFluxo)})`
  const base = `${c.numero} — ${c.cliente || 'Cliente'} · ${fase}`
  return ticket ? `Ticket ${ticket} · ${base}` : base
}

function mensagemErroSupabase(err: unknown): string {
  return mensagemErroSupabaseBase(err, 'Erro desconhecido ao salvar.')
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '18px',
  padding: '22px 24px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  marginBottom: '18px',
}

function formatPesoBr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n)) || Number(n) === 0) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n))
}

function valorCampoTicketImpressao(
  pesagem: string | null | undefined,
  controleMassa: string,
  coleta: string | null | undefined
): string {
  const p = (pesagem ?? '').trim()
  if (p) return p
  const cm = controleMassa.trim()
  if (cm && cm !== '—') return cm
  const col = (coleta ?? '').trim()
  return col || '—'
}

function formatDataHoraBr(iso: string | null | undefined): { data: string; hora: string } {
  if (!iso) return { data: '—', hora: '—' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { data: '—', hora: '—' }
  return {
    data: d.toLocaleDateString('pt-BR'),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

export type TicketOperacionalPanelProps = {
  variant: 'page' | 'embedded'
  coletaAtiva: TicketColetaSnapshot | null
  cargo: string | null
  coletasOpcoes?: TicketColetaSnapshot[]
  carregandoColetas?: boolean
  onTrocarColeta?: (id: string) => void
  onEtapaColetaAlterada?: () => void
  /** Esconde o select de coleta (fluxo integrado ao formulário de pesagem). */
  ocultarSeletorColeta?: boolean
  /** Em Controle de Massa: omite faixa «Ticket gerado» e título duplicados (dados já estão no passo 3). */
  simplifyEmbedded?: boolean
  /** Data do passo Pesagem (formulário) — prevalece sobre data de gravação do ticket. */
  dataPesagemAtual?: string | null
  /** Número do ticket vindo do formulário de pesagem (antes do painel carregar `tickets_operacionais`). */
  numeroTicketExterno?: string | null
  /** Coleta cuja impressão foi pedida — força recarregar o ticket antes de `window.print()`. */
  impressaoPendenteColetaId?: string | null
  /** Placa/motorista da pesagem (controle_massa), preenchidos antes de imprimir no Controle de Massa. */
  camposImpressaoPesagem?: { motorista: string; placa: string } | null
}

export function TicketOperacionalPanel({
  variant,
  coletaAtiva,
  cargo,
  coletasOpcoes = [],
  carregandoColetas = false,
  onTrocarColeta,
  onEtapaColetaAlterada,
  ocultarSeletorColeta = false,
  simplifyEmbedded = false,
  dataPesagemAtual = null,
  numeroTicketExterno = null,
  impressaoPendenteColetaId = null,
  camposImpressaoPesagem = null,
}: TicketOperacionalPanelProps) {
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [numero, setNumero] = useState('')
  const [tipoTicket, setTipoTicket] = useState<TipoTicketOperacional>('saida')
  const [criadoEm, setCriadoEm] = useState<string | null>(null)

  const [carregandoTicket, setCarregandoTicket] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editandoTicketGerado, setEditandoTicketGerado] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const [mtrNumeroImpressao, setMtrNumeroImpressao] = useState('')
  const empresaTransporteImpressao = empresaTicketImpressaoRg()
  const [balanceiroImpressao, setBalanceiroImpressao] = useState('—')
  const [motoristaImpressao, setMotoristaImpressao] = useState('')
  const [placaImpressao, setPlacaImpressao] = useState('')
  const [horaEntradaImpressao, setHoraEntradaImpressao] = useState('—')
  const [horaSaidaImpressao, setHoraSaidaImpressao] = useState('—')
  const [dataPesagemImpressao, setDataPesagemImpressao] = useState<string | null>(null)
  const [dataExecucaoColeta, setDataExecucaoColeta] = useState<string | null>(null)
  const [dataAgendadaColeta, setDataAgendadaColeta] = useState<string | null>(null)
  const [preReqPesagem, setPreReqPesagem] = useState(false)
  const [carregandoPreReq, setCarregandoPreReq] = useState(false)
  const [ticketDescricao, setTicketDescricao] = useState('')

  const somenteTicketPadrao = cargoPerfilSomenteLancamentoTicketPadrao(cargo)
  const podeMutar = cargoPodeEditarTicketOperacional(cargo)
  const podeCustomizarTicket = cargoPodeCustomizarTicketOperacional(cargo)


  const fluxoAlemDoTicket =
    coletaAtiva && etapaTicketJaRegistradoNoFluxo(coletaAtiva.etapaFluxo)

  const reeditarNaEtapaTicketGerado = Boolean(
    coletaAtiva?.etapaFluxo === 'TICKET_GERADO' &&
      editandoTicketGerado &&
      cargoPodeReeditarTicketOperacionalAposGerado(cargo)
  )

  const podeEditarFormulario = Boolean(coletaAtiva && podeCustomizarTicket)
  const podeGravarTicket = Boolean(coletaAtiva && podeMutar)

  useEffect(() => {
    if (!somenteTicketPadrao) return
    queueMicrotask(() => {
      setTipoTicket((t) => (t === 'saida' ? t : 'saida'))
    })
  }, [somenteTicketPadrao, coletaAtiva?.id])

  const carregarDadosImpressao = useCallback(async (coleta: TicketColetaSnapshot) => {
    setMtrNumeroImpressao('')
    setBalanceiroImpressao('—')
    setMotoristaImpressao('')
    setPlacaImpressao('')
    setHoraEntradaImpressao('—')
    setHoraSaidaImpressao('—')
    setDataPesagemImpressao(null)
    setDataExecucaoColeta(null)
    setDataAgendadaColeta(null)

    if (coleta.mtr_id) {
      const { data } = await supabase.from('mtrs').select('numero').eq('id', coleta.mtr_id).maybeSingle()
      if (data?.numero) setMtrNumeroImpressao(String(data.numero))
    }

    const { data: colRow } = await supabase
      .from('coletas')
      .select('data_execucao, data_agendada')
      .eq('id', coleta.id)
      .maybeSingle()
    if (colRow && typeof colRow === 'object') {
      const c = colRow as { data_execucao?: string | null; data_agendada?: string | null }
      const de = typeof c.data_execucao === 'string' ? c.data_execucao.trim().slice(0, 10) : ''
      const da = typeof c.data_agendada === 'string' ? c.data_agendada.trim().slice(0, 10) : ''
      setDataExecucaoColeta(de || null)
      setDataAgendadaColeta(da || null)
    }

    const { data: reg } = await supabase
      .from('controle_massa')
      .select(
        'id, coleta_id, data, empresa, cliente, balanceiro, balanceiro_nome, usuario_balanceiro, hora_entrada, hora_saida, peso_tara, peso_bruto, peso_liquido, placa, motorista, ajudante, created_at, updated_at'
      )
      .eq('coleta_id', coleta.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (reg && typeof reg === 'object') {
      const r = reg as Record<string, unknown>
      const dataCm = typeof r.data === 'string' ? r.data.trim().slice(0, 10) : ''
      if (dataCm) setDataPesagemImpressao(dataCm)
      const bal = r.balanceiro ?? r.balanceiro_nome ?? r.usuario_balanceiro
      if (typeof bal === 'string' && bal.trim()) setBalanceiroImpressao(bal.trim())
      const he = r.hora_entrada
      const hs = r.hora_saida
      if (typeof he === 'string' && he.trim()) {
        setHoraEntradaImpressao(he.trim())
      } else {
        const dh = (r.created_at ?? r.data ?? r.updated_at) as string | undefined
        const { hora: hStr } = formatDataHoraBr(dh)
        if (hStr !== '—') setHoraEntradaImpressao(hStr)
      }
      if (typeof hs === 'string' && hs.trim()) {
        setHoraSaidaImpressao(hs.trim())
      } else {
        const dh = (r.updated_at ?? r.created_at ?? r.data) as string | undefined
        const { hora: hStr } = formatDataHoraBr(dh)
        if (hStr !== '—') setHoraSaidaImpressao(hStr)
      }
      const mot = r.motorista
      if (typeof mot === 'string' && mot.trim()) setMotoristaImpressao(mot.trim())
      const pl = r.placa
      if (typeof pl === 'string' && pl.trim()) setPlacaImpressao(pl.trim())
    }
  }, [])

  useEffect(() => {
    if (coletaAtiva) {
      queueMicrotask(() => {
        void carregarDadosImpressao(coletaAtiva)
      })
    }
  }, [coletaAtiva, carregarDadosImpressao])

  useEffect(() => {
    if (
      !coletaAtiva ||
      !impressaoPendenteColetaId ||
      impressaoPendenteColetaId !== coletaAtiva.id
    ) {
      return
    }
    queueMicrotask(() => {
      void carregarDadosImpressao(coletaAtiva)
    })
  }, [impressaoPendenteColetaId, coletaAtiva, carregarDadosImpressao])

  useEffect(() => {
    if (!coletaAtiva) {
      queueMicrotask(() => setPreReqPesagem(false))
      return
    }
    let cancel = false
    queueMicrotask(() => setCarregandoPreReq(true))
    void Promise.resolve(
      supabase
        .from('controle_massa')
        .select('id')
        .eq('coleta_id', coletaAtiva.id)
        .limit(1)
        .maybeSingle()
    )
      .then((cmRes) => {
        if (cancel) return
        if (cmRes.error) console.error(cmRes.error)
        setPreReqPesagem(Boolean(cmRes.data?.id))
      })
      .finally(() => {
        if (!cancel) setCarregandoPreReq(false)
      })
    return () => {
      cancel = true
    }
  }, [coletaAtiva])

  const carregarTicket = useCallback(async (coleta: TicketColetaSnapshot) => {
    const coletaId = coleta.id
    setCarregandoTicket(true)
    setErro('')
    setMensagem('')

    type LinhaTicketDb = {
      id: string
      numero: string | null
      tipo_ticket?: string | null
      created_at?: string | null
      descricao?: string | null
    }

    const aplicarLinha = (data: LinhaTicketDb) => {
      setTicketId(data.id)
      setNumero(data.numero ?? '')
      setTipoTicket(normalizarTipoTicket(data.tipo_ticket as string | null))
      setCriadoEm(data.created_at ?? null)
      setTicketDescricao((data.descricao ?? '').trim())
    }

    let rows: LinhaTicketDb[] | null = null
    let error: { message?: string } | null = null

    const q1 = await supabase
      .from('tickets_operacionais')
      .select('id, numero, tipo_ticket, created_at, descricao')
      .eq('coleta_id', coletaId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (q1.error) {
      const q2 = await supabase
        .from('tickets_operacionais')
        .select('id, numero, tipo_ticket, created_at, descricao')
        .eq('coleta_id', coletaId)
        .limit(1)
      rows = (q2.data as LinhaTicketDb[] | undefined) ?? null
      error = q2.error
    } else {
      rows = (q1.data as LinhaTicketDb[] | undefined) ?? null
      error = q1.error
    }

    if (error) {
      console.error(error)
      setErro('Não foi possível carregar o ticket.')
      setTicketId(null)
      setNumero('')
      setTipoTicket('saida')
      setCriadoEm(null)
      setTicketDescricao('')
      setCarregandoTicket(false)
      return
    }

    const data = rows?.[0]

    if (data) {
      aplicarLinha(data)
      if (!(data.numero ?? '').trim() && coleta.mtr_id) {
        const { data: mtrRow } = await supabase
          .from('mtrs')
          .select('numero')
          .eq('id', coleta.mtr_id)
          .maybeSingle()
        const auto = numeroTicketFromMtr(String(mtrRow?.numero ?? ''))
        if (auto) setNumero(auto)
      }
    } else {
      setTicketId(null)
      let autoNum = ''
      if (coleta.mtr_id) {
        const { data: mtrRow } = await supabase
          .from('mtrs')
          .select('numero')
          .eq('id', coleta.mtr_id)
          .maybeSingle()
        autoNum = numeroTicketFromMtr(String(mtrRow?.numero ?? ''))
      }
      setNumero(autoNum)
      setTipoTicket('saida')
      setCriadoEm(null)
      setTicketDescricao('')
    }
    setCarregandoTicket(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => setEditandoTicketGerado(false))
  }, [coletaAtiva?.id])

  useEffect(() => {
    if (coletaAtiva) {
      queueMicrotask(() => {
        void carregarTicket(coletaAtiva)
      })
    } else {
      queueMicrotask(() => {
        setTicketId(null)
        setNumero('')
        setTipoTicket('saida')
        setCriadoEm(null)
        setTicketDescricao('')
      })
    }
  }, [coletaAtiva, carregarTicket])

  useEffect(() => {
    if (
      !coletaAtiva ||
      !impressaoPendenteColetaId ||
      impressaoPendenteColetaId !== coletaAtiva.id
    ) {
      return
    }
    queueMicrotask(() => {
      void carregarTicket(coletaAtiva)
    })
  }, [impressaoPendenteColetaId, coletaAtiva, carregarTicket])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!coletaAtiva || !podeGravarTicket) return

    const tipoGravar: TipoTicketOperacional = somenteTicketPadrao ? 'saida' : tipoTicket

    const nTrim = numero.trim()
    let n = nTrim
    if (!n && coletaAtiva.mtr_id) {
      const { data: mtrRow } = await supabase
        .from('mtrs')
        .select('numero')
        .eq('id', coletaAtiva.mtr_id)
        .maybeSingle()
      const fromMtr = numeroTicketFromMtr(String(mtrRow?.numero ?? ''))
      if (fromMtr) {
        n = fromMtr
        setNumero(n)
      }
    }
    if (!n) {
      const gerado = await obterProximoNumeroTicketOperacional(supabase)
      if (!gerado.ok) {
        setErro(gerado.message)
        setSalvando(false)
        return
      }
      n = gerado.numero
      setNumero(n)
    }

    setSalvando(true)
    setErro('')
    setMensagem('')

    const notificarErecarregar = async () => {
      try {
        onEtapaColetaAlterada?.()
      } catch (e) {
        console.error(e)
      }
      await carregarTicket(coletaAtiva).catch((e) => console.error(e))
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const jaEmTicketGerado = coletaAtiva.etapaFluxo === 'TICKET_GERADO'

      const { data: jaExiste, error: errBusca } = await supabase
        .from('tickets_operacionais')
        .select('id')
        .eq('coleta_id', coletaAtiva.id)
        .limit(1)

      if (errBusca) throw errBusca

      const idExistente = ticketId || jaExiste?.[0]?.id

      const payloadTicket = {
        numero: n || null,
        tipo_ticket: tipoGravar,
        created_by: user?.id ?? null,
        descricao: ticketDescricao.trim() || null,
      }

      if (idExistente) {
        const { error } = await supabase
          .from('tickets_operacionais')
          .update(payloadTicket)
          .eq('id', idExistente)
        if (error) throw error
        setTicketId(idExistente)
      } else {
        const { data: inseridos, error: errIns } = await supabase
          .from('tickets_operacionais')
          .insert({
            coleta_id: coletaAtiva.id,
            ...payloadTicket,
          })
          .select('id')

        if (errIns) throw errIns

        const novoId = inseridos?.[0]?.id
        if (novoId) {
          setTicketId(novoId)
        } else {
          const { data: deNovo, error: errFetch } = await supabase
            .from('tickets_operacionais')
            .select('id')
            .eq('coleta_id', coletaAtiva.id)
            .limit(1)
          if (errFetch) throw errFetch
          if (deNovo?.[0]?.id) setTicketId(deNovo[0].id)
        }
      }

      const resFila = await registrarTicketImpressoColeta(coletaAtiva.id)

      if (jaEmTicketGerado) {
        setEditandoTicketGerado(false)
        if (!resFila.ok) {
          setErro(resFila.message)
        } else {
          setMensagem('Ticket atualizado. Coleta na fila de conferência do Faturamento.')
        }
        await notificarErecarregar()
      } else {
        const { error: errColeta } = await supabase
          .from('coletas')
          .update({
            fluxo_status: 'TICKET_GERADO',
            etapa_operacional: 'TICKET_GERADO',
          })
          .eq('id', coletaAtiva.id)

        if (errColeta) {
          console.error(errColeta)
          setErro(
            `Ticket gravado, mas a etapa da coleta não atualizou: ${mensagemErroSupabase(errColeta)}`
          )
          await notificarErecarregar()
        } else if (!resFila.ok) {
          setErro(
            `Ticket registado, mas não entrou na fila do Faturamento: ${resFila.message}`
          )
          await notificarErecarregar()
        } else {
          setMensagem(
            'Ticket registado. A coleta entrou na fila de conferência do Faturamento.'
          )
          await notificarErecarregar()
        }
      }
    } catch (err: unknown) {
      console.error(err)
      setErro(mensagemErroSupabase(err))
    } finally {
      setSalvando(false)
    }
  }

  const opcoesSelect = useMemo(() => {
    const sorted = [...coletasOpcoes].sort((a, b) =>
      String(b.numero).localeCompare(String(a.numero), undefined, { numeric: true })
    )
    if (coletaAtiva && !sorted.some((c) => c.id === coletaAtiva.id)) return [coletaAtiva, ...sorted]
    return sorted
  }, [coletasOpcoes, coletaAtiva])

  const mostrarResumoTicket =
    Boolean(coletaAtiva) &&
    Boolean(ticketId) &&
    !editandoTicketGerado &&
    !carregandoTicket &&
    variant === 'page'

  const dataTicketBr = useMemo(
    () =>
      resolverDataExibicaoTicket({
        dataPesagem: (dataPesagemAtual ?? '').trim() || dataPesagemImpressao,
        dataExecucao: dataExecucaoColeta,
        dataAgendada: dataAgendadaColeta,
        ticketCriadoEm: criadoEm,
      }),
    [dataPesagemAtual, dataPesagemImpressao, dataExecucaoColeta, dataAgendadaColeta, criadoEm]
  )

  const tituloImpressao =
    tipoTicket === 'frete' ? 'FRETE' : tipoTicket === 'entrada' ? 'ENTRADA' : 'SAÍDA'

  const numeroImpressao = (
    numero.trim() ||
    (numeroTicketExterno ?? '').trim() ||
    (coletaAtiva?.ticketOperacionalNumero ?? '').trim() ||
    ''
  ).trim()

  const podePortalImpressao = Boolean(
    coletaAtiva && (preReqPesagem || ticketId || numeroImpressao)
  )

  const motoristaParaImpressao = useMemo(
    () =>
      valorCampoTicketImpressao(
        camposImpressaoPesagem?.motorista,
        motoristaImpressao,
        coletaAtiva?.motorista
      ),
    [camposImpressaoPesagem?.motorista, motoristaImpressao, coletaAtiva?.motorista]
  )

  const placaParaImpressao = useMemo(
    () =>
      valorCampoTicketImpressao(
        camposImpressaoPesagem?.placa,
        placaImpressao,
        coletaAtiva?.placa
      ),
    [camposImpressaoPesagem?.placa, placaImpressao, coletaAtiva?.placa]
  )

  const labelTipoTicket: Record<TipoTicketOperacional, string> = {
    entrada: 'Entrada',
    saida: 'Saída',
    frete: 'Frete',
  }

  return (
    <>
      <style>{TICKET_OPERACIONAL_PRINT_STYLES}</style>

      <div className="ticket-no-print">
        {variant === 'embedded' && coletaAtiva && ticketId && !simplifyEmbedded ? (
          <div
            style={{
              marginBottom: '18px',
              padding: '18px 20px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 55%, #ecfdf5 100%)',
              border: '1px solid #6ee7b7',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '16px',
            }}
          >
            <div style={{ minWidth: 0, flex: '1 1 220px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#047857',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '6px',
                }}
              >
                Ticket gerado
              </div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                {numero.trim() ? `N.º ${numero.trim()}` : `Coleta ${coletaAtiva.numero}`}
                <span style={{ color: '#64748b', fontWeight: 600 }}> · </span>
                {coletaAtiva.cliente || '—'}
              </div>
              <div style={{ fontSize: '12px', color: '#047857', marginTop: '6px', fontWeight: 600 }}>
                {labelTipoTicket[tipoTicket]} · Consulte os dados abaixo se precisar
              </div>
            </div>
          </div>
        ) : null}

        {variant === 'page' ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '8px',
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
                Registo e impressão do ticket interno
              </h1>
              <p className="page-header__lead" style={{ margin: '8px 0 0', maxWidth: 720 }}>
                <strong>Seguimento:</strong> após a pesagem no módulo Pesagem e Ticket — registo do{' '}
                <strong>ticket interno</strong> (distinto da MTR). Depois siga para faturamento/financeiro no menu.
              </p>
            </div>
          </div>
        ) : simplifyEmbedded && ocultarSeletorColeta ? null : (
          <div style={{ marginBottom: '14px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              {ocultarSeletorColeta ? 'Ticket desta pesagem' : 'Ticket operacional'}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
              {ocultarSeletorColeta ? (
                <>
                  Após salvar a pesagem, o ticket é gerado automaticamente. Ajuste <strong>tipo</strong> ou{' '}
                  <strong>número</strong> se precisar e use <strong>Gravar ticket</strong> para concluir.
                </>
              ) : (
                <>
                  Escolha a coleta abaixo, defina o <strong>tipo</strong> (<strong>saída</strong> ou{' '}
                  <strong>frete</strong>), preencha os dados e grave — gera o ticket e segue o
                  fluxo até aprovação e faturamento.
                </>
              )}
            </p>
          </div>
        )}

        {variant === 'page' ? (
          <div style={cardStyle}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>Coleta</div>
            <select
              value={coletaAtiva?.id ?? ''}
              onChange={(e) => onTrocarColeta?.(e.target.value)}
              disabled={carregandoColetas}
              style={{
                width: '100%',
                maxWidth: 480,
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            >
              <option value="">
                {carregandoColetas ? 'Carregando…' : 'Selecione a coleta (ou use ?coleta= na URL)'}
              </option>
              {opcoesSelect.map((c) => (
                <option key={c.id} value={c.id}>
                  {rotuloOpcaoColetaTicket(c)}
                </option>
              ))}
            </select>

            {coletaAtiva ? (
              <div style={{ marginTop: '16px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                <div>
                  <strong>Fase:</strong> {formatarFaseFluxoOficialParaUI(coletaAtiva.etapaFluxo)}{' '}
                  <span style={{ color: '#94a3b8' }}>({formatarEtapaParaUI(coletaAtiva.etapaFluxo)})</span>
                </div>
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>Referência rápida</div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    <strong>Pesagem:</strong>{' '}
                    {carregandoPreReq ? '…' : preReqPesagem ? 'há registo' : 'sem registo'} ·{' '}
                    <Link to={`/controle-massa?${montarParamsColeta(coletaAtiva).toString()}`} style={{ fontWeight: 700 }}>
                      Controle de Massa
                    </Link>
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <Link
                    to={`/faturamento?${montarParamsColeta(coletaAtiva).toString()}`}
                    style={{ color: '#2563eb', fontWeight: 700 }}
                  >
                    Ir para Faturamento (conferência do ticket) →
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        ) : ocultarSeletorColeta && coletaAtiva ? (
          <div
            style={{
              ...cardStyle,
              padding: '14px 18px',
              background: '#f8fafc',
              borderStyle: 'dashed',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
              Coleta ativa
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              {coletaAtiva.numero} · {coletaAtiva.cliente || '—'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569' }}>
              <strong>Fase:</strong> {formatarFaseFluxoOficialParaUI(coletaAtiva.etapaFluxo)}{' '}
              <span style={{ color: '#94a3b8' }}>({formatarEtapaParaUI(coletaAtiva.etapaFluxo)})</span>
              {' · '}
              <strong>Pesagem:</strong>{' '}
              {carregandoPreReq ? '…' : preReqPesagem ? 'registrada' : 'sem registo'}
            </div>
          </div>
        ) : (
          <div style={{ ...cardStyle, padding: '16px 18px' }}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>Coleta para o ticket</div>
            <select
              value={coletaAtiva?.id ?? ''}
              onChange={(e) => onTrocarColeta?.(e.target.value)}
              disabled={carregandoColetas || !onTrocarColeta}
              style={{
                width: '100%',
                maxWidth: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            >
              <option value="">
                {carregandoColetas
                  ? 'A carregar coletas…'
                  : 'Escolha a coleta para gerar o ticket (ou use o formulário de pesagem acima)'}
              </option>
              {opcoesSelect.map((c) => (
                <option key={c.id} value={c.id}>
                  {rotuloOpcaoColetaTicket(c)}
                </option>
              ))}
            </select>
            {coletaAtiva ? (
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                <div>
                  <strong>Fase:</strong> {formatarFaseFluxoOficialParaUI(coletaAtiva.etapaFluxo)}{' '}
                  <span style={{ color: '#94a3b8' }}>({formatarEtapaParaUI(coletaAtiva.etapaFluxo)})</span>
                </div>
                <div style={{ marginTop: '6px', color: '#64748b' }}>
                  <strong>Pesagem no sistema:</strong>{' '}
                  {carregandoPreReq ? '…' : preReqPesagem ? 'há registo — pode gravar o ticket' : 'sem registo — pode gravar o ticket na mesma ou lançar pesagem acima'}
                </div>
              </div>
            ) : (
              <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                Depois de escolher a coleta, defina <strong>tipo</strong> (saída / frete), o{' '}
                <strong>número</strong> e use <strong>Gravar ticket</strong>.
              </p>
            )}
          </div>
        )}

        {coletaAtiva ? (
          <>
            {mostrarResumoTicket ? (
              <div style={{ ...cardStyle, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>Ticket</div>
                <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
                  <strong>Tipo:</strong> {labelTipoTicket[tipoTicket]}
                </p>
                {numero ? (
                  <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#334155' }}>
                    <strong>Número:</strong> {numero}
                  </p>
                ) : null}
                {criadoEm ? (
                  <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Registo: {new Date(criadoEm).toLocaleString('pt-BR')}
                  </p>
                ) : null}
                {fluxoAlemDoTicket && coletaAtiva.etapaFluxo !== 'TICKET_GERADO' ? (
                  <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#64748b' }}>
                    O fluxo já avançou (aprovação / faturamento).
                  </p>
                ) : null}

                {coletaAtiva.etapaFluxo === 'TICKET_GERADO' ? (
                  <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    {!podeMutar ? (
                      <p style={{ color: '#92400e', fontSize: '14px', width: '100%', margin: 0 }}>
                        O seu perfil só pode consultar.
                      </p>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditandoTicketGerado(true)}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: 'pointer',
                          }}
                        >
                          Editar ticket
                        </button>
                        <Link
                          to={`/faturamento?${montarParamsColeta(coletaAtiva).toString()}`}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#0d9488',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '14px',
                            textDecoration: 'none',
                          }}
                        >
                          Conferir no Faturamento →
                        </Link>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} style={cardStyle}>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>Dados do ticket</div>

              {reeditarNaEtapaTicketGerado ? (
                <button
                  type="button"
                  onClick={() => setEditandoTicketGerado(false)}
                  style={{
                    marginBottom: '12px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar edição
                </button>
              ) : null}

              {carregandoTicket ? (
                <p style={{ color: '#64748b' }}>A carregar…</p>
              ) : (
                <>
                  {!podeMutar ? (
                    <p style={{ color: '#92400e', fontSize: '14px', marginBottom: '12px' }}>
                      O seu perfil só pode consultar.
                    </p>
                  ) : somenteTicketPadrao ? (
                    <p style={{ color: '#0f766e', fontSize: '14px', marginBottom: '12px' }}>
                      Perfil com ticket em formato padrão (saída, número da MTR).
                    </p>
                  ) : null}

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                      Tipo de ticket
                    </div>
                    <select
                      value={tipoTicket}
                      onChange={(e) =>
                        podeEditarFormulario
                          ? setTipoTicket(normalizarTipoTicket(e.target.value))
                          : undefined
                      }
                      disabled={!podeEditarFormulario}
                      style={{
                        width: '100%',
                        maxWidth: 320,
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        opacity: podeEditarFormulario ? 1 : 0.85,
                      }}
                    >
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                      <option value="frete">Frete</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                      Número
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={numero}
                        onChange={(e) => (podeEditarFormulario ? setNumero(e.target.value) : undefined)}
                        readOnly={!podeEditarFormulario}
                        placeholder="Deixe vazio para gerar automaticamente (≥ 1340)"
                        style={{
                          flex: '1 1 200px',
                          minWidth: 160,
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          opacity: podeEditarFormulario ? 1 : 0.85,
                        }}
                      />
                      {podeEditarFormulario ? (
                        <button
                          type="button"
                          className="rg-btn rg-btn--outline"
                          onClick={() => {
                            void (async () => {
                              setErro('')
                              const r = await obterProximoNumeroTicketOperacional(supabase)
                              if (!r.ok) {
                                setErro(r.message)
                                return
                              }
                              setNumero(r.numero)
                            })()
                          }}
                        >
                          Próximo n.º
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                      OBS (impressão)
                    </div>
                    <textarea
                      value={ticketDescricao}
                      onChange={(e) =>
                        podeEditarFormulario ? setTicketDescricao(e.target.value) : undefined
                      }
                      readOnly={!podeEditarFormulario}
                      rows={2}
                      placeholder="Observações no ticket térmico"
                      style={{
                        width: '100%',
                        maxWidth: 520,
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        resize: 'vertical',
                        opacity: podeEditarFormulario ? 1 : 0.85,
                      }}
                    />
                  </div>

                  {erro ? (
                    <p style={{ color: '#dc2626', fontSize: '14px', marginTop: '12px' }}>{erro}</p>
                  ) : null}
                  {mensagem ? (
                    <p style={{ color: '#15803d', fontSize: '14px', marginTop: '12px', fontWeight: 600 }}>
                      {mensagem}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={!podeGravarTicket || salvando}
                    style={{
                      marginTop: '18px',
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: podeGravarTicket ? '#2563eb' : '#94a3b8',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: podeGravarTicket && !salvando ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {salvando
                      ? 'A gravar…'
                      : ticketId && coletaAtiva?.etapaFluxo === 'TICKET_GERADO'
                        ? 'Guardar alterações'
                        : ticketId
                          ? 'Atualizar e avançar etapa'
                          : 'Gravar ticket'}
                  </button>
                </>
              )}
            </form>
          </>
        ) : variant === 'page' ? (
          <div style={{ ...cardStyle, color: '#64748b' }}>
            Escolha uma coleta ou abra a página a partir do Controle de Massa com os parâmetros na URL.
          </div>
        ) : null}
      </div>

      {podePortalImpressao && coletaAtiva && typeof document !== 'undefined'
        ? createPortal(
            <TicketOperacionalPrintView
              numero={numeroImpressao || coletaAtiva.numero}
              titulo={tituloImpressao}
              dataTicketBr={dataTicketBr}
              mtrNumero={mtrNumeroImpressao}
              cliente={coletaAtiva.cliente}
              tipoResiduo={coletaAtiva.tipo_residuo}
              pesoBruto={formatPesoBr(coletaAtiva.peso_bruto)}
              pesoTara={formatPesoBr(coletaAtiva.peso_tara)}
              pesoLiquido={formatPesoBr(coletaAtiva.peso_liquido)}
              balanceiro={balanceiroImpressao}
              motorista={motoristaParaImpressao}
              placa={placaParaImpressao}
              empresaTransporte={empresaTransporteImpressao}
              obs={ticketDescricao.trim() || '—'}
              horaEntrada={horaEntradaImpressao}
              horaSaida={horaSaidaImpressao}
            />,
            document.body
          )
        : null}
    </>
  )
}
