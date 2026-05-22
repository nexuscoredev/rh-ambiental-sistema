import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSessionObjectDraft } from '../lib/usePageSessionPersistence'
import { Link, useSearchParams } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import { supabase } from '../lib/supabase'
import {
  buildUrlEnvioNfMedicao,
  idsContextoFromSearchParams,
  resolverClienteIdParaEnvioNf,
  resolverColetaPorContextoUrl,
} from '../lib/coletaContextoUrl'
import { formatarEtapaParaUI, normalizarEtapaColeta, type EtapaFluxo } from '../lib/fluxoEtapas'
import {
  cargoPodeAprovarTicketConferenciaFaturamento,
  cargoPodeEditarPesoConferenciaTicket,
  cargoPodeConfirmarEmissaoFaturamento,
  cargoPodeEditarResumosFinanceirosFaturamento,
  cargoPodeEncerrarTicketDefinitivoFaturamento,
  cargoPodeEnviarNfEmail,
} from '../lib/workflowPermissions'
import type { FaturamentoResumoViewRow } from '../lib/faturamentoResumo'
import { useFaturamentoOperacionalVista } from '../lib/faturamentoOperacionalVista'
import {
  coletaConferenciaPendente,
  coletaProntaNaVistaExcluindoFluxoTicket,
  coletaAguardandoImpressaoTicketFaturamento,
  coletaNaFilaFaturamento,
  coletaNaFilaAprovacaoTicketFaturamento,
} from '../lib/faturamentoOperacionalFila'
import { FaturamentoResumoCards } from '../components/faturamento/FaturamentoResumoCards'
import { FaturamentoFilaAguardandoImpressao } from '../components/faturamento/FaturamentoFilaAguardandoImpressao'
import { FaturamentoFilaAprovacaoTicket } from '../components/faturamento/FaturamentoFilaAprovacaoTicket'
import { FaturamentoFilaColetas } from '../components/faturamento/FaturamentoFilaColetas'
import { FaturamentoHistoricoColetas } from '../components/faturamento/FaturamentoHistoricoColetas'
import { FaturamentoRelatoriosPanel } from '../components/faturamento/FaturamentoRelatoriosPanel'
import { FaturamentoFilaAjusteValores } from '../components/faturamento/FaturamentoFilaAjusteValores'
import { FaturamentoFilaMedicao } from '../components/faturamento/FaturamentoFilaMedicao'
import { FaturamentoFilaPosFaturamento } from '../components/faturamento/FaturamentoFilaPosFaturamento'
import { FaturamentoEsteiraFluxo } from '../components/faturamento/FaturamentoEsteiraFluxo'
import {
  MENSAGEM_MIGRACAO_ESTEIRA,
  coletaAguardandoConfirmacaoNfBoleto,
  coletaNaFilaAjusteValoresMedicao,
  coletaNaFilaMedicaoAprovacaoCliente,
  coletaNaFilaMedicaoEmail,
  coletaNaFilaRelatorioMedicao,
  passoUiEsteiraDaColeta,
  type PassoUiEsteiraFaturamento,
} from '../lib/faturamentoEsteira'
import { FaturamentoModalRegisto } from '../components/faturamento/FaturamentoModalRegisto'
import {
  escolherColetaLiderFaturamento,
  resolverGrupoFaturamentoNaFila,
} from '../lib/faturamentoConsolidacaoMtr'
import {
  emitirFaturamentoPelaEsteira,
  mensagemConfirmacaoEmitirEsteira,
} from '../lib/emitirFaturamentoEsteira'

type ColetaResumo = {
  id: string
  numero: string
  cliente: string
  etapaFluxo: EtapaFluxo
  mtr_id: string | null
  programacao_id: string | null
  cliente_id: string | null
  placa: string
  motorista: string
}

function montarParamsColeta(c: ColetaResumo) {
  const p = new URLSearchParams()
  p.set('coleta', c.id)
  if (c.mtr_id) p.set('mtr', c.mtr_id)
  if (c.programacao_id) p.set('programacao', c.programacao_id)
  if (c.cliente_id) p.set('cliente', c.cliente_id)
  return p
}

function viewRowToColetaResumo(r: FaturamentoResumoViewRow): ColetaResumo {
  const etapaFluxo = normalizarEtapaColeta({
    fluxo_status: r.fluxo_status,
    etapa_operacional: r.etapa_operacional,
  })
  return {
    id: r.coleta_id,
    numero: String(r.numero_coleta ?? r.numero ?? r.coleta_id),
    cliente: r.cliente_nome || '—',
    etapaFluxo,
    mtr_id: r.mtr_id,
    programacao_id: r.programacao_id,
    cliente_id: r.cliente_id,
    placa: r.placa ?? '',
    motorista: r.motorista ?? '',
  }
}

const ACCENT = '#0d9488'

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px 22px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
  marginBottom: '18px',
}

export default function FaturamentoOperacional() {
  const [searchParams, setSearchParams] = useSearchParams()
  const idsCtx = useMemo(() => idsContextoFromSearchParams(searchParams), [searchParams])

  const [cargo, setCargo] = useState<string | null>(null)

  const {
    linhasView,
    linhasOperacional,
    linhasHistorico,
    historicoCarregado,
    carregandoVista,
    carregandoHistorico,
    erroVista,
    ticketAprovacaoAtivo,
    esteiraMedicaoAtiva,
    recarregarTudo,
    recarregarAposEmitir,
    recarregarAposFinalizarNfBoleto,
    carregarHistorico,
    qtdEmitidasCartao,
    valorEmitidasCartao,
    diasJanela,
  } = useFaturamentoOperacionalVista(idsCtx.coleta)

  const listaIdsColetaCtx = useMemo(
    () =>
      linhasOperacional.map((r) => ({
        id: r.coleta_id,
        mtr_id: r.mtr_id,
        programacao_id: r.programacao_id,
        cliente_id: r.cliente_id,
      })),
    [linhasOperacional]
  )

  const clienteIdContextoMedicao = useMemo(
    () => resolverClienteIdParaEnvioNf(listaIdsColetaCtx, idsCtx),
    [listaIdsColetaCtx, idsCtx]
  )

  const coletaIdContextoMedicao = (idsCtx.coleta ?? '').trim() || null

  const urlMalaDiretaMedicaoPagina = useMemo(
    () =>
      buildUrlEnvioNfMedicao({
        clienteId: clienteIdContextoMedicao,
        coletaId: coletaIdContextoMedicao,
      }),
    [clienteIdContextoMedicao, coletaIdContextoMedicao]
  )

  const [modalAberto, setModalAberto] = useState(false)
  const [modalColetaId, setModalColetaId] = useState<string | null>(null)
  const [modalPreparacaoMedicao, setModalPreparacaoMedicao] = useState(false)
  const [modalGrupoConsolidado, setModalGrupoConsolidado] = useState<FaturamentoResumoViewRow[] | undefined>(
    undefined
  )
  const [emitindoFaturamentoId, setEmitindoFaturamentoId] = useState<string | null>(null)

  const faturamentoOperDraft = useMemo(
    () => ({
      modalAberto,
      modalColetaId,
      sp: searchParams.toString(),
    }),
    [modalAberto, modalColetaId, searchParams]
  )

  useSessionObjectDraft({
    cacheKey: 'faturamento-operacional',
    data: faturamentoOperDraft,
    onRestore: (d) => {
      setModalAberto(d.modalAberto)
      setModalColetaId(d.modalColetaId)
      setSearchParams(new URLSearchParams(d.sp), { replace: true })
    },
  })

  const podeConfirmarEmissao = cargoPodeConfirmarEmissaoFaturamento(cargo)
  const podeEditarResumos = cargoPodeEditarResumosFinanceirosFaturamento(cargo)
  const podeEncerrarTicket = cargoPodeEncerrarTicketDefinitivoFaturamento(cargo)
  const podeAprovarTicketFila = cargoPodeAprovarTicketConferenciaFaturamento(cargo)
  const podeEditarPesoTicketFila = cargoPodeEditarPesoConferenciaTicket(cargo)
  const podeConfirmarNfBoleto = cargoPodeEnviarNfEmail(cargo)

  useEffect(() => {
    async function carregarCargo() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setCargo(null)
        return
      }
      const { data } = await supabase.from('usuarios').select('cargo').eq('id', user.id).maybeSingle()
      setCargo(data?.cargo ?? null)
    }
    void carregarCargo()
  }, [])

  const coletasResumo = useMemo(() => linhasView.map(viewRowToColetaResumo), [linhasView])

  const coletaAtiva = useMemo(
    () => resolverColetaPorContextoUrl(coletasResumo, idsCtx),
    [coletasResumo, idsCtx]
  )

  const filaAprovacao = useMemo(() => {
    const f = linhasOperacional.filter((r) => coletaNaFilaAprovacaoTicketFaturamento(r))
    return f.sort((a, b) => {
      const ta = new Date(a.ticket_impresso_em ?? a.created_at).getTime()
      const tb = new Date(b.ticket_impresso_em ?? b.created_at).getTime()
      return tb - ta
    })
  }, [linhasOperacional])

  const filaAguardandoImpressao = useMemo(
    () => linhasOperacional.filter((r) => coletaAguardandoImpressaoTicketFaturamento(r)),
    [linhasOperacional]
  )

  const fila = useMemo(() => {
    const f = linhasOperacional.filter((r) => coletaNaFilaFaturamento(r, linhasOperacional))
    return f.sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return tb - ta
    })
  }, [linhasOperacional])

  const qtdProntoConferencia = useMemo(
    () => linhasOperacional.filter((r) => coletaProntaNaVistaExcluindoFluxoTicket(r)).length,
    [linhasOperacional]
  )

  const qtdPendenteConferencia = useMemo(
    () => linhasOperacional.filter((r) => coletaConferenciaPendente(r)).length,
    [linhasOperacional]
  )

  const valorSomaProntoConferencia = useMemo(() => {
    let s = 0
    for (const r of linhasOperacional) {
      if (!coletaProntaNaVistaExcluindoFluxoTicket(r)) continue
      const v = r.valor_coleta
      if (v != null && Number.isFinite(Number(v))) s += Number(v)
    }
    return s > 0
      ? s.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—'
  }, [linhasOperacional])

  const valorEstimadoFila = useMemo(() => {
    let s = 0
    for (const r of fila) {
      const v = r.valor_coleta ?? r.faturamento_registro_valor
      if (v != null && Number.isFinite(Number(v))) s += Number(v)
    }
    return s > 0
      ? s.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—'
  }, [fila])

  const modalGrupo = useMemo(() => {
    if (!modalColetaId) return []
    if (modalPreparacaoMedicao && modalGrupoConsolidado && modalGrupoConsolidado.length > 1) {
      return modalGrupoConsolidado
    }
    if (modalPreparacaoMedicao) {
      return linhasView.filter((r) => r.coleta_id === modalColetaId)
    }
    return resolverGrupoFaturamentoNaFila(modalColetaId, fila)
  }, [modalColetaId, fila, modalPreparacaoMedicao, modalGrupoConsolidado, linhasView])

  const modalRow = useMemo(() => {
    if (!modalColetaId) return null
    if (modalGrupo.length > 1) return escolherColetaLiderFaturamento(modalGrupo)
    return linhasView.find((r) => r.coleta_id === modalColetaId) ?? null
  }, [linhasView, modalColetaId, modalGrupo])

  const linhaContextoEsteira = useMemo((): FaturamentoResumoViewRow | null => {
    if (modalColetaId) {
      return (
        linhasOperacional.find((r) => r.coleta_id === modalColetaId) ??
        linhasView.find((r) => r.coleta_id === modalColetaId) ??
        null
      )
    }
    const idColeta = (idsCtx.coleta ?? '').trim()
    if (idColeta) {
      return (
        linhasOperacional.find((r) => r.coleta_id === idColeta) ??
        linhasView.find((r) => r.coleta_id === idColeta) ??
        null
      )
    }
    const mid = (idsCtx.mtr ?? '').trim()
    if (mid) {
      return linhasOperacional.find((r) => (r.mtr_id ?? '').trim() === mid) ?? null
    }
    const cid = (idsCtx.cliente ?? '').trim()
    if (cid) {
      return linhasOperacional.find((r) => r.cliente_id === cid) ?? null
    }
    return null
  }, [modalColetaId, idsCtx, linhasOperacional, linhasView])

  const passoAtivoEsteira = useMemo((): PassoUiEsteiraFaturamento | undefined => {
    if (modalAberto && modalPreparacaoMedicao) return 2
    if (modalAberto && modalColetaId) return 6

    if (linhaContextoEsteira) {
      return passoUiEsteiraDaColeta(linhaContextoEsteira, linhasOperacional) ?? undefined
    }

    if (linhasOperacional.some(coletaNaFilaMedicaoAprovacaoCliente)) return 5
    if (linhasOperacional.some(coletaNaFilaMedicaoEmail)) return 4
    if (linhasOperacional.some(coletaNaFilaRelatorioMedicao)) return 3
    if (linhasOperacional.some(coletaNaFilaAjusteValoresMedicao)) return 2
    if (filaAprovacao.length > 0 || filaAguardandoImpressao.length > 0) return 1
    if (fila.length > 0) return 6
    if (linhasView.some(coletaAguardandoConfirmacaoNfBoleto)) return 7
    return undefined
  }, [
    modalAberto,
    modalPreparacaoMedicao,
    modalColetaId,
    linhaContextoEsteira,
    linhasOperacional,
    filaAprovacao.length,
    filaAguardandoImpressao.length,
    fila.length,
    linhasView,
  ])

  function aoEscolherColetaUrl(id: string) {
    const p = new URLSearchParams(searchParams)
    if (id) p.set('coleta', id)
    else p.delete('coleta')
    setSearchParams(p, { replace: true })
  }

  async function confirmarFaturarEsteira(coletaId: string) {
    if (!podeConfirmarEmissao) return
    const msg = mensagemConfirmacaoEmitirEsteira(coletaId, fila)
    if (!window.confirm(msg)) return

    const grupoEmitir = resolverGrupoFaturamentoNaFila(coletaId, fila)
    const idsEmitir = grupoEmitir.map((c) => c.coleta_id)

    setEmitindoFaturamentoId(coletaId)
    const res = await emitirFaturamentoPelaEsteira(coletaId, fila)
    setEmitindoFaturamentoId(null)

    if (!res.ok) {
      window.alert(res.message)
      return
    }

    await recarregarAposEmitir(idsEmitir)

    requestAnimationFrame(() => {
      document.getElementById('fila-nf-boleto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function abrirModalAjusteValores(row: FaturamentoResumoViewRow, grupo?: FaturamentoResumoViewRow[]) {
    const pendentesAjuste = linhasView.filter(coletaNaFilaAjusteValoresMedicao)
    const grupoMtr =
      grupo && grupo.length > 1 ? grupo : resolverGrupoFaturamentoNaFila(row.coleta_id, pendentesAjuste)
    setModalPreparacaoMedicao(true)
    setModalGrupoConsolidado(grupoMtr.length > 1 ? grupoMtr : undefined)
    aoEscolherColetaUrl(row.coleta_id)
    setModalColetaId(row.coleta_id)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setModalColetaId(null)
    setModalPreparacaoMedicao(false)
    setModalGrupoConsolidado(undefined)
  }

  return (
    <MainLayout>
      <div className="page-shell">
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Consolidação e emissão por coleta
        </h1>
        <p className="page-header__lead" style={{ margin: '10px 0 0', maxWidth: 760, lineHeight: 1.65 }}>
          Esteira: <strong>conferência do ticket</strong> → <strong>ajuste de valores</strong> →{' '}
          <strong>relatório de medição</strong> →{' '}
          <Link to={urlMalaDiretaMedicaoPagina}>Mala Direta (medição)</Link> → <strong>aprovação do cliente</strong> →{' '}
          <strong>confirmar faturamento</strong> → <strong>registar n.º NF / boleto</strong> →{' '}
          <strong>Financeiro → Contas a Receber</strong> (envio por e-mail opcional em{' '}
          <Link to="/envio-nf">Mala Direta</Link>).
        </p>

        <FaturamentoEsteiraFluxo passoAtivo={passoAtivoEsteira} />

        {!carregandoVista && !esteiraMedicaoAtiva ? (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '13px',
            }}
          >
            <strong>Esteira de medição ainda não ativa no Supabase.</strong> {MENSAGEM_MIGRACAO_ESTEIRA}
          </div>
        ) : null}

        {erroVista ? (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '14px',
            }}
          >
            <span style={{ whiteSpace: 'pre-wrap', display: 'block' }}>{erroVista}</span>
            <button
              type="button"
              onClick={() => void recarregarTudo()}
              style={{
                marginTop: '12px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #991b1b',
                background: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Tentar de novo
            </button>
          </div>
        ) : null}

        {!carregandoVista && !erroVista && !ticketAprovacaoAtivo ? (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            <strong>Fila de aprovação do ticket ainda não está ativa neste Supabase.</strong> Execute no SQL
            Editor a migração{' '}
            <code style={{ fontSize: '12px' }}>20260518130000_coletas_ticket_aprovacao_faturamento.sql</code>{' '}
            (ou <code style={{ fontSize: '12px' }}>npm run db:apply:ticket-aprovacao</code>). Até lá, coletas
            «prontas na vista» podem ir direto para faturar se cumprirem os outros requisitos.
          </div>
        ) : null}

        <div style={{ marginTop: '22px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void recarregarTudo()}
            disabled={carregandoVista}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontWeight: 700,
              fontSize: '13px',
              cursor: carregandoVista ? 'wait' : 'pointer',
            }}
          >
            {carregandoVista ? 'Atualizando…' : 'Atualizar dados'}
          </button>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Janela de dados: <strong style={{ color: '#0f172a' }}>{diasJanela != null ? `${diasJanela} dias` : 'completa'}</strong>
            {' · '}
            Perfil: <strong style={{ color: '#0f172a' }}>{cargo ?? '—'}</strong>
            {!podeConfirmarEmissao
              ? ' · somente leitura'
              : podeEditarResumos
                ? ' · Operacional (Time T): acesso administrador + valores editáveis no faturamento'
                : ' · pode aprovar tickets e emitir ao Financeiro (resumos somente leitura)'}
          </span>
        </div>

        <div style={{ marginTop: '22px' }}>
          <FaturamentoResumoCards
            qtdAguardandoAprovacaoTicket={filaAprovacao.length}
            qtdProntoConferencia={qtdProntoConferencia}
            valorSomaProntoConferencia={valorSomaProntoConferencia}
            qtdPodeEmitir={fila.length}
            valorEstimadoEmitir={valorEstimadoFila}
            qtdEmitidasFinanceiro={qtdEmitidasCartao}
            valorEmitidas={valorEmitidasCartao}
            qtdPendenteConferencia={qtdPendenteConferencia}
          />
        </div>

        <FaturamentoFilaAguardandoImpressao linhas={filaAguardandoImpressao} carregando={carregandoVista} />

        <FaturamentoFilaAprovacaoTicket
          key={filaAprovacao.map((r) => r.coleta_id).join(',')}
          linhas={filaAprovacao}
          carregando={carregandoVista}
          podeAprovar={podeAprovarTicketFila}
          podeEditarPeso={podeEditarPesoTicketFila}
          onAprovado={() => recarregarTudo()}
        />

        <FaturamentoFilaAjusteValores
          linhas={linhasOperacional}
          carregando={carregandoVista}
          esteiraAtiva={esteiraMedicaoAtiva}
          podeRevisar={podeConfirmarEmissao}
          onRevisarValores={abrirModalAjusteValores}
        />

        <FaturamentoFilaMedicao
          linhas={linhasOperacional}
          carregando={carregandoVista}
          esteiraAtiva={esteiraMedicaoAtiva}
          onAtualizar={() => void recarregarTudo()}
          clienteIdContexto={clienteIdContextoMedicao}
          coletaIdContexto={coletaIdContextoMedicao}
        />

        <FaturamentoFilaColetas
          linhas={fila}
          carregando={carregandoVista}
          onFaturar={confirmarFaturarEsteira}
          emitindoColetaId={emitindoFaturamentoId}
          onDevolvidoConferencia={() => void recarregarTudo()}
          podeDevolverConferencia={podeAprovarTicketFila && ticketAprovacaoAtivo}
        />

        <FaturamentoFilaPosFaturamento
          linhas={linhasView}
          carregando={carregandoVista || carregandoHistorico}
          historicoCarregado={historicoCarregado}
          podeConfirmar={podeConfirmarNfBoleto}
          onFinalizado={(ids) => void recarregarAposFinalizarNfBoleto(ids)}
        />

        {coletaAtiva ? (
          <div style={cardStyle}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Contexto (URL)</div>
            <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.55 }}>
              Coleta <strong>{coletaAtiva.numero}</strong> · {coletaAtiva.cliente} · etapa{' '}
              <strong>{formatarEtapaParaUI(coletaAtiva.etapaFluxo)}</strong>
            </p>
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Link
                to={`/controle-massa?${montarParamsColeta(coletaAtiva).toString()}`}
                style={{ color: ACCENT, fontWeight: 700, fontSize: '14px' }}
              >
                Pesagem e Ticket →
              </Link>
              {podeConfirmarEmissao && fila.some((r) => r.coleta_id === coletaAtiva.id) ? (
                <button
                  type="button"
                  disabled={!!emitindoFaturamentoId}
                  onClick={() => void confirmarFaturarEsteira(coletaAtiva.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: ACCENT,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: emitindoFaturamentoId ? 'wait' : 'pointer',
                  }}
                >
                  {emitindoFaturamentoId === coletaAtiva.id
                    ? 'A confirmar…'
                    : 'Confirmar faturamento'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <FaturamentoHistoricoColetas
          linhas={linhasHistorico ?? []}
          naoCarregado={!historicoCarregado}
          carregando={carregandoHistorico}
        />
        <FaturamentoRelatoriosPanel
          linhasOperacional={linhasOperacional}
          linhasHistorico={linhasHistorico}
          naoCarregadoHistorico={!historicoCarregado}
          carregandoHistorico={carregandoHistorico}
          onCarregarHistorico={() => void carregarHistorico()}
        />
      </div>

      <FaturamentoModalRegisto
        open={modalAberto && modalPreparacaoMedicao}
        row={modalRow}
        coletasConsolidadas={modalGrupo.length > 1 ? modalGrupo : undefined}
        modoPreparacaoMedicao={modalPreparacaoMedicao}
        podeConfirmarEmissao={podeConfirmarEmissao}
        podeEditarResumosFinanceiros={podeEditarResumos}
        podeEncerrarTicketDefinitivo={podeEncerrarTicket}
        usuarioCargo={cargo}
        onClose={fecharModal}
        onGravado={() => {
          const ids =
            modalGrupo.length > 0
              ? modalGrupo.map((c) => c.coleta_id)
              : modalColetaId?.trim()
                ? [modalColetaId.trim()]
                : []
          void recarregarAposEmitir(ids)
        }}
      />
    </MainLayout>
  )
}
