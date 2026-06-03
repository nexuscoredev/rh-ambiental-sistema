import { useMemo, useState } from 'react'
import { ChatAvatar } from './ChatAvatar'
import {
  chatListarSolicitacoesAjusteParaRelatorio,
  etiquetaEventoPedidoAjusteHistorico,
  nomeSolicitantePedidoAjuste,
  type FiltroSituacaoRelatorioSolicitacoes,
  type PedidoAjusteFilaItem,
  type PedidoAjusteHistoricoItem,
} from '../../lib/chatPedidoAjuste'
import {
  exportarCsvSolicitacoesAjuste,
  gerarRelatorioSolicitacoesPdf,
} from '../../lib/gerarRelatorioSolicitacoesPdf'
import type { ChatUsuarioLista } from '../../types/chat'
import { rgAlert, useRgDialog } from '../../lib/RgDialogProvider'
import { CHAT_PEDIDO_DETALHES_PADRAO_DEV } from '../../lib/chatPedidoAjuste'

type Props = {
  modo: 'dev' | 'thais'
  itens: PedidoAjusteFilaItem[]
  historico: PedidoAjusteHistoricoItem[]
  usuariosPorId: Map<string, ChatUsuarioLista>
  carregando: boolean
  carregandoHistorico: boolean
  marcandoId: string | null
  podeEnviarFilaThais?: boolean
  enviandoThaisId?: string | null
  aprovandoId?: string | null
  onAbrirConversa: (conversaId: string, outroId: string) => void
  onMarcarResolvido: (item: PedidoAjusteFilaItem) => Promise<void>
  onPedirDetalhes?: (item: PedidoAjusteFilaItem, mensagem: string) => Promise<void>
  onEnviarFilaThais?: (item: PedidoAjusteFilaItem) => Promise<void>
  onAprovarFilaThais?: (item: PedidoAjusteFilaItem) => Promise<void>
  pedindoDetalhesId?: string | null
}

type AbaPedidos = 'fila' | 'negados' | 'historico'

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hoje = new Date()
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear()
  if (mesmoDia) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function inicioMesIso(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-01`
}

function nomeSolicitanteHistorico(
  h: PedidoAjusteHistoricoItem,
  usuariosPorId: Map<string, ChatUsuarioLista>
): string {
  return nomeSolicitantePedidoAjuste(h.solicitanteId, h.parseado, usuariosPorId)
}

function SolicitacoesRelatorioModal({
  usuariosPorId,
  onFechar,
}: {
  usuariosPorId: Map<string, ChatUsuarioLista>
  onFechar: () => void
}) {
  const [dataDe, setDataDe] = useState(inicioMesIso())
  const [dataAte, setDataAte] = useState(hojeIso())
  const [situacao, setSituacao] = useState<FiltroSituacaoRelatorioSolicitacoes>('todas')
  const [gerando, setGerando] = useState(false)

  async function carregarLinhas() {
    return chatListarSolicitacoesAjusteParaRelatorio(
      { dataDe, dataAte, situacao, limite: 500 },
      usuariosPorId
    )
  }

  async function handlePdf() {
    setGerando(true)
    try {
      const linhas = await carregarLinhas()
      if (linhas.length === 0) {
        void rgAlert({
          title: 'Relatório de solicitações',
          message: 'Nenhuma solicitação encontrada com os filtros seleccionados.',
          variant: 'warning',
        })
        return
      }
      gerarRelatorioSolicitacoesPdf({
        linhas,
        filtros: {
          dataDe,
          dataAte,
          situacao:
            situacao === 'todas'
              ? 'Todas'
              : situacao === 'novo'
                ? 'Novo (na fila)'
                : situacao === 'negado'
                  ? 'Negado'
                  : situacao === 'aguardando'
                    ? 'Aguardando confirmação'
                    : 'Aprovado',
        },
      })
      onFechar()
    } catch (e) {
      void rgAlert({
        title: 'Relatório de solicitações',
        message: e instanceof Error ? e.message : 'Não foi possível gerar o relatório.',
        variant: 'warning',
      })
    } finally {
      setGerando(false)
    }
  }

  async function handleCsv() {
    setGerando(true)
    try {
      const linhas = await carregarLinhas()
      if (linhas.length === 0) {
        void rgAlert({
          title: 'Relatório de solicitações',
          message: 'Nenhuma solicitação encontrada com os filtros seleccionados.',
          variant: 'warning',
        })
        return
      }
      exportarCsvSolicitacoesAjuste(linhas)
      onFechar()
    } catch (e) {
      void rgAlert({
        title: 'Relatório de solicitações',
        message: e instanceof Error ? e.message : 'Não foi possível exportar o CSV.',
        variant: 'warning',
      })
    } finally {
      setGerando(false)
    }
  }

  return (
    <div
      className="chat-interno-pedidos-historico-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-solicitacoes-relatorio-titulo"
      onClick={onFechar}
    >
      <div
        className="chat-interno-pedidos-historico-modal__card chat-interno-pedidos-relatorio-modal__card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chat-interno-pedidos-historico-modal__head">
          <h4 id="chat-solicitacoes-relatorio-titulo" className="chat-interno-pedidos-historico-modal__title">
            Relatório de solicitações
          </h4>
          <button
            type="button"
            className="chat-interno-pedidos-historico-modal__close"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="chat-interno-pedidos-relatorio-modal__body">
          <p className="chat-interno-pedidos-relatorio-modal__hint">
            Exporte pedidos de ajuste enviados pelos utilizadores (PDF ou CSV).
          </p>
          <label className="chat-interno-pedidos-relatorio-modal__field">
            <span>Data inicial</span>
            <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          </label>
          <label className="chat-interno-pedidos-relatorio-modal__field">
            <span>Data final</span>
            <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
          </label>
          <label className="chat-interno-pedidos-relatorio-modal__field">
            <span>Situação</span>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as FiltroSituacaoRelatorioSolicitacoes)}
            >
              <option value="todas">Todas</option>
              <option value="novo">Novo (na fila)</option>
              <option value="negado">Negado — reaberto</option>
              <option value="aguardando">Aguardando confirmação</option>
              <option value="aprovado">Aprovado</option>
            </select>
          </label>
        </div>

        <footer className="chat-interno-pedidos-historico-modal__foot chat-interno-pedidos-relatorio-modal__foot">
          <button
            type="button"
            className="chat-interno-pedidos-historico-modal__btn"
            disabled={gerando}
            onClick={() => void handlePdf()}
          >
            {gerando ? 'A gerar…' : 'PDF'}
          </button>
          <button
            type="button"
            className="chat-interno-pedidos-historico-modal__btn chat-interno-pedidos-relatorio-modal__btn-csv"
            disabled={gerando}
            onClick={() => void handleCsv()}
          >
            CSV
          </button>
          <button
            type="button"
            className="chat-interno-pedidos-historico-modal__btn chat-interno-pedidos-historico-modal__btn--ghost"
            disabled={gerando}
            onClick={onFechar}
          >
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  )
}

function formatarData(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatarHorario(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function HistoricoDetalheModal({
  item,
  usuariosPorId,
  onFechar,
  onAbrirConversa,
}: {
  item: PedidoAjusteHistoricoItem
  usuariosPorId: Map<string, ChatUsuarioLista>
  onFechar: () => void
  onAbrirConversa: (conversaId: string, outroId: string) => void
}) {
  const solicitante = nomeSolicitanteHistorico(item, usuariosPorId)
  const actor = usuariosPorId.get(item.actorId)
  const actorNome = actor?.nome || actor?.email || 'Utilizador'
  const pedidoData = item.pedidoCreatedAt ? formatarData(item.pedidoCreatedAt) : '—'
  const pedidoHora = item.pedidoCreatedAt ? formatarHorario(item.pedidoCreatedAt) : '—'
  const eventoData = formatarData(item.createdAt)
  const eventoHora = formatarHorario(item.createdAt)
  const descricao =
    item.parseado?.descricao ||
    item.texto?.trim() ||
    'Sem descrição registada.'

  function abrirConversa() {
    const outroId = item.solicitanteId || item.actorId
    onAbrirConversa(item.conversaId, outroId)
    onFechar()
  }

  return (
    <div
      className="chat-interno-pedidos-historico-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-pedido-historico-titulo"
      onClick={onFechar}
    >
      <div
        className="chat-interno-pedidos-historico-modal__card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chat-interno-pedidos-historico-modal__head">
          <h4 id="chat-pedido-historico-titulo" className="chat-interno-pedidos-historico-modal__title">
            Detalhe da solicitação
          </h4>
          <button
            type="button"
            className="chat-interno-pedidos-historico-modal__close"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <dl className="chat-interno-pedidos-historico-modal__dl">
          <div>
            <dt>Solicitante</dt>
            <dd>{solicitante}</dd>
          </div>
          <div>
            <dt>Data do pedido</dt>
            <dd>{pedidoData}</dd>
          </div>
          <div>
            <dt>Horário do pedido</dt>
            <dd>{pedidoHora}</dd>
          </div>
          {item.parseado?.pagina ? (
            <div>
              <dt>Página</dt>
              <dd>{item.parseado.pagina}</dd>
            </div>
          ) : null}
          <div>
            <dt>Descrição</dt>
            <dd className="chat-interno-pedidos-historico-modal__descricao">{descricao}</dd>
          </div>
          <div className="chat-interno-pedidos-historico-modal__sep" aria-hidden />
          <div>
            <dt>Evento</dt>
            <dd>{etiquetaEventoPedidoAjusteHistorico(item.evento)}</dd>
          </div>
          <div>
            <dt>Registado por</dt>
            <dd>{actorNome}</dd>
          </div>
          <div>
            <dt>Data do evento</dt>
            <dd>{eventoData}</dd>
          </div>
          <div>
            <dt>Horário do evento</dt>
            <dd>{eventoHora}</dd>
          </div>
          {item.ciclo > 1 ? (
            <div>
              <dt>Ciclo</dt>
              <dd>{item.ciclo}</dd>
            </div>
          ) : null}
        </dl>

        <footer className="chat-interno-pedidos-historico-modal__foot">
          <button type="button" className="chat-interno-pedidos-historico-modal__btn" onClick={abrirConversa}>
            Abrir conversa
          </button>
          <button
            type="button"
            className="chat-interno-pedidos-historico-modal__btn chat-interno-pedidos-historico-modal__btn--ghost"
            onClick={onFechar}
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}

function resumoHistorico(h: PedidoAjusteHistoricoItem): string | null {
  if (h.evento === 'resolvido_dev') return 'Resposta automática enviada ao solicitante.'
  if (h.evento === 'aprovado_solicitante') return 'Pedido encerrado com aprovação.'
  if (h.evento === 'enviado_fila_thais') return 'Enviado para aprovação da Thais (pelo desenvolvedor).'
  if (h.evento === 'aprovado_fila_thais') return 'Thais aprovou — aguarda tratamento do desenvolvedor.'
  if (h.evento === 'detalhes_solicitados_dev') return 'Desenvolvedor pediu mais detalhes ao solicitante.'
  if (h.evento === 'detalhes_respondidos_solicitante') return 'Solicitante enviou complemento — pedido reaberto.'
  return null
}

function PedidoCard({
  item,
  modo,
  usuariosPorId,
  marcandoId,
  podeEnviarFilaThais,
  enviandoThaisId,
  aprovandoId,
  onAbrirConversa,
  onMarcar,
  onPedirDetalhes,
  onEnviarFilaThais,
  onAprovarFilaThais,
  pedindoDetalhesId,
}: {
  item: PedidoAjusteFilaItem
  modo: 'dev' | 'thais'
  usuariosPorId: Map<string, ChatUsuarioLista>
  marcandoId: string | null
  podeEnviarFilaThais?: boolean
  enviandoThaisId?: string | null
  aprovandoId?: string | null
  pedindoDetalhesId?: string | null
  onAbrirConversa: (conversaId: string, outroId: string) => void
  onMarcar: (item: PedidoAjusteFilaItem) => void
  onPedirDetalhes?: (item: PedidoAjusteFilaItem) => void
  onEnviarFilaThais?: (item: PedidoAjusteFilaItem) => void
  onAprovarFilaThais?: (item: PedidoAjusteFilaItem) => void
}) {
  const meta = usuariosPorId.get(item.remetenteId)
  const nome = meta?.nome || meta?.email || item.parseado?.solicitante || 'Utilizador'
  const descricao =
    item.parseado?.descricao ||
    item.conteudo.replace(/^\[Solicitação de ajuste no sistema\]\s*/i, '').trim().slice(0, 200)
  const marcando = marcandoId === item.mensagemId
  const enviandoThais = enviandoThaisId === item.mensagemId
  const aprovando = aprovandoId === item.mensagemId
  const pedindoDetalhes = pedindoDetalhesId === item.mensagemId
  const reaberto = item.situacao === 'reaberto'
  const complemento = reaberto && item.tipoReabertura === 'complemento'
  const aprovadoThais = item.situacao === 'aprovado_thais'
  const acaoBloqueada = Boolean(marcandoId || enviandoThaisId || aprovandoId || pedindoDetalhesId)
  const podeEscalar =
    modo === 'dev' &&
    Boolean(podeEnviarFilaThais && onEnviarFilaThais) &&
    (item.situacao === 'novo' || item.situacao === 'reaberto')

  return (
    <article
      className={
        reaberto
          ? 'chat-interno-pedido-card chat-interno-pedido-card--reaberto'
          : aprovadoThais
            ? 'chat-interno-pedido-card chat-interno-pedido-card--aprovado-thais'
            : 'chat-interno-pedido-card'
      }
    >
      {reaberto ? (
        <p className="chat-interno-pedido-card__badge-reaberto" role="status">
          {complemento ? 'Complemento do solicitante' : 'Negado pelo solicitante'}
          {item.ciclo > 1 ? ` · ciclo ${item.ciclo}` : ''}
        </p>
      ) : null}
      {aprovadoThais ? (
        <p className="chat-interno-pedido-card__badge-aprovado-thais" role="status">
          Aprovado pela Thais — tratar o caso
        </p>
      ) : null}
      <button
        type="button"
        className="chat-interno-pedido-card__top"
        onClick={() => onAbrirConversa(item.conversaId, item.remetenteId)}
        title="Abrir conversa"
      >
        <ChatAvatar nome={nome} fotoUrl={meta?.foto_url ?? null} size={36} />
        <div className="chat-interno-pedido-card__meta">
          <span className="chat-interno-pedido-card__nome">{nome}</span>
          <time className="chat-interno-pedido-card__hora" dateTime={item.createdAt}>
            {formatarDataHora(item.createdAt)}
          </time>
        </div>
      </button>
      <p className="chat-interno-pedido-card__texto">{descricao}</p>
      {item.parseado?.pagina ? (
        <p className="chat-interno-pedido-card__pagina">Página: {item.parseado.pagina}</p>
      ) : null}
      {item.justificativaSolicitante ? (
        <blockquote className="chat-interno-pedido-card__justificativa">
          <strong>{complemento ? 'Complemento:' : 'Motivo da negativa:'}</strong>
          <p>{item.justificativaSolicitante}</p>
        </blockquote>
      ) : null}
      <div className="chat-interno-pedido-card__acoes">
        {modo === 'thais' ? (
          <button
            type="button"
            className="chat-interno-pedido-card__btn"
            disabled={acaoBloqueada}
            onClick={() => onAprovarFilaThais?.(item)}
          >
            {aprovando ? 'A aprovar…' : 'Aprovar pedido'}
          </button>
        ) : (
          <>
            {podeEscalar ? (
              <button
                type="button"
                className="chat-interno-pedido-card__btn chat-interno-pedido-card__btn--secundario"
                disabled={acaoBloqueada}
                onClick={() => onEnviarFilaThais?.(item)}
              >
                {enviandoThais ? 'A enviar…' : 'Enviar p/ fila Thais'}
              </button>
            ) : null}
            {onPedirDetalhes ? (
              <button
                type="button"
                className="chat-interno-pedido-card__btn chat-interno-pedido-card__btn--secundario"
                disabled={acaoBloqueada}
                onClick={() => onPedirDetalhes(item)}
                title="Devolve ao solicitante pedindo mais informações (sem marcar como resolvido)"
              >
                {pedindoDetalhes ? 'A enviar…' : 'Pedir mais detalhes'}
              </button>
            ) : null}
            <button
              type="button"
              className="chat-interno-pedido-card__btn"
              disabled={acaoBloqueada}
              onClick={() => onMarcar(item)}
            >
              {marcando ? 'A enviar resposta…' : 'Marcar como resolvido'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export function ChatPedidosAjusteColuna({
  modo,
  itens,
  historico,
  usuariosPorId,
  carregando,
  carregandoHistorico,
  marcandoId,
  podeEnviarFilaThais,
  enviandoThaisId,
  aprovandoId,
  onAbrirConversa,
  onMarcarResolvido,
  onPedirDetalhes,
  onEnviarFilaThais,
  onAprovarFilaThais,
  pedindoDetalhesId,
}: Props) {
  const { prompt } = useRgDialog()
  const filaNovos = useMemo(
    () => itens.filter((i) => i.situacao === 'novo' || i.situacao === 'aprovado_thais'),
    [itens]
  )
  const negados = useMemo(() => itens.filter((i) => i.situacao === 'reaberto'), [itens])
  const filaExibida = modo === 'thais' ? itens : filaNovos
  const historicoLimpo = useMemo(
    () =>
      historico.filter(
        (h) =>
          h.evento === 'resolvido_dev' ||
          h.evento === 'aprovado_solicitante' ||
          h.evento === 'enviado_fila_thais' ||
          h.evento === 'aprovado_fila_thais' ||
          h.evento === 'detalhes_solicitados_dev' ||
          h.evento === 'detalhes_respondidos_solicitante'
      ),
    [historico]
  )

  const [aba, setAba] = useState<AbaPedidos>('fila')
  const [historicoSelecionado, setHistoricoSelecionado] = useState<PedidoAjusteHistoricoItem | null>(
    null
  )
  const [relatorioAberto, setRelatorioAberto] = useState(false)

  async function handleMarcar(item: PedidoAjusteFilaItem) {
    try {
      await onMarcarResolvido(item)
    } catch (e) {
      void rgAlert({
        title: 'Pedido de ajuste',
        message: e instanceof Error ? e.message : 'Não foi possível marcar como resolvido.',
        variant: 'warning',
      })
    }
  }

  async function handlePedirDetalhes(item: PedidoAjusteFilaItem) {
    if (!onPedirDetalhes) return
    const texto = await prompt({
      title: 'Pedir mais detalhes',
      message:
        'A mensagem será enviada ao solicitante na conversa. O pedido volta à fila quando ele responder.',
      defaultValue: CHAT_PEDIDO_DETALHES_PADRAO_DEV,
      placeholder: 'O que precisa saber para tratar o pedido?',
      confirmLabel: 'Enviar ao solicitante',
      cancelLabel: 'Cancelar',
    })
    if (texto == null || !texto.trim()) return
    try {
      await onPedirDetalhes(item, texto.trim())
    } catch (e) {
      void rgAlert({
        title: 'Pedido de ajuste',
        message: e instanceof Error ? e.message : 'Não foi possível pedir mais detalhes.',
        variant: 'warning',
      })
    }
  }

  async function handleEnviarFilaThais(item: PedidoAjusteFilaItem) {
    if (!onEnviarFilaThais) return
    try {
      await onEnviarFilaThais(item)
    } catch (e) {
      void rgAlert({
        title: 'Pedido de ajuste',
        message: e instanceof Error ? e.message : 'Não foi possível enviar para a fila da Thais.',
        variant: 'warning',
      })
    }
  }

  async function handleAprovarFilaThais(item: PedidoAjusteFilaItem) {
    if (!onAprovarFilaThais) return
    try {
      await onAprovarFilaThais(item)
    } catch (e) {
      void rgAlert({
        title: 'Pedido de ajuste',
        message: e instanceof Error ? e.message : 'Não foi possível aprovar o pedido.',
        variant: 'warning',
      })
    }
  }

  const hintPorAba: Record<AbaPedidos, string> =
    modo === 'thais'
      ? {
          fila: 'Pedidos escalados pelos desenvolvedores à espera da sua aprovação.',
          negados: '',
          historico: 'Registo de escalamentos e aprovações.',
        }
      : {
          fila: 'Pedidos novos à espera da sua resposta.',
          negados:
            'Pedidos reabertos (negativa ou complemento após pedido de detalhes). Leia a resposta e trate o caso.',
          historico: 'Registo de respostas enviadas e pedidos aprovados.',
        }

  const totalFila = modo === 'thais' ? filaExibida.length : filaNovos.length + negados.length

  return (
    <aside className="chat-interno-pedidos-col" aria-label="Fila de solicitações de ajuste">
      <div className="chat-interno-pedidos-col__head">
        <h3 className="chat-interno-pedidos-col__title">
          {modo === 'thais' ? 'Aprovações' : 'Solicitações'}
        </h3>
        {totalFila > 0 ? (
          <span className="chat-interno-pedidos-col__count" aria-label={`${totalFila} na fila`}>
            {totalFila}
          </span>
        ) : null}
        <button
          type="button"
          className="chat-interno-pedidos-col__relatorio-btn"
          onClick={() => setRelatorioAberto(true)}
          title="Gerar relatório das solicitações"
          aria-label="Gerar relatório das solicitações"
        >
          Relatório
        </button>
      </div>

      <div className="chat-interno-pedidos-col__tabs" role="tablist" aria-label="Secções de solicitações">
        <div className="chat-interno-pedidos-col__tabs-track">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'fila'}
            className={
              aba === 'fila'
                ? 'chat-interno-pedidos-tab chat-interno-pedidos-tab--on'
                : 'chat-interno-pedidos-tab'
            }
            onClick={() => setAba('fila')}
          >
            <span className="chat-interno-pedidos-tab__label">Fila</span>
            {filaExibida.length > 0 ? (
              <span className="chat-interno-pedidos-tab__badge">{filaExibida.length}</span>
            ) : null}
          </button>
          {modo === 'dev' ? (
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'negados'}
              className={
                aba === 'negados'
                  ? 'chat-interno-pedidos-tab chat-interno-pedidos-tab--on chat-interno-pedidos-tab--negados'
                  : 'chat-interno-pedidos-tab'
              }
              onClick={() => setAba('negados')}
            >
              <span className="chat-interno-pedidos-tab__label">Negados</span>
              {negados.length > 0 ? (
                <span className="chat-interno-pedidos-tab__badge chat-interno-pedidos-tab__badge--neg">
                  {negados.length}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'historico'}
            className={
              aba === 'historico'
                ? 'chat-interno-pedidos-tab chat-interno-pedidos-tab--on chat-interno-pedidos-tab--historico'
                : 'chat-interno-pedidos-tab'
            }
            onClick={() => setAba('historico')}
          >
            <span className="chat-interno-pedidos-tab__label">Histórico</span>
          </button>
        </div>
      </div>

      <p className="chat-interno-pedidos-col__hint">{hintPorAba[aba]}</p>

      <div className="chat-interno-pedidos-col__list" role="tabpanel">
        {aba === 'fila' ? (
          carregando ? (
            <p className="chat-interno-pedidos-col__empty">A carregar…</p>
          ) : filaExibida.length === 0 ? (
            <p className="chat-interno-pedidos-col__empty">
              {modo === 'thais' ? 'Nenhum pedido aguarda a sua aprovação.' : 'Nenhum pedido novo na fila.'}
            </p>
          ) : (
            filaExibida.map((item) => (
              <PedidoCard
                key={item.mensagemId}
                item={item}
                modo={modo}
                usuariosPorId={usuariosPorId}
                marcandoId={marcandoId}
                podeEnviarFilaThais={podeEnviarFilaThais}
                enviandoThaisId={enviandoThaisId}
                aprovandoId={aprovandoId}
                onAbrirConversa={onAbrirConversa}
                onMarcar={(i) => void handleMarcar(i)}
                onPedirDetalhes={
                  modo === 'dev' && onPedirDetalhes ? (i) => void handlePedirDetalhes(i) : undefined
                }
                pedindoDetalhesId={pedindoDetalhesId}
                onEnviarFilaThais={(i) => void handleEnviarFilaThais(i)}
                onAprovarFilaThais={(i) => void handleAprovarFilaThais(i)}
              />
            ))
          )
        ) : null}

        {aba === 'negados' && modo === 'dev' ? (
          carregando ? (
            <p className="chat-interno-pedidos-col__empty">A carregar…</p>
          ) : negados.length === 0 ? (
            <p className="chat-interno-pedidos-col__empty">Nenhum pedido negado no momento.</p>
          ) : (
            negados.map((item) => (
              <PedidoCard
                key={item.mensagemId}
                item={item}
                modo={modo}
                usuariosPorId={usuariosPorId}
                marcandoId={marcandoId}
                podeEnviarFilaThais={podeEnviarFilaThais}
                enviandoThaisId={enviandoThaisId}
                aprovandoId={aprovandoId}
                onAbrirConversa={onAbrirConversa}
                onMarcar={(i) => void handleMarcar(i)}
                onPedirDetalhes={
                  modo === 'dev' && onPedirDetalhes ? (i) => void handlePedirDetalhes(i) : undefined
                }
                pedindoDetalhesId={pedindoDetalhesId}
                onEnviarFilaThais={(i) => void handleEnviarFilaThais(i)}
                onAprovarFilaThais={(i) => void handleAprovarFilaThais(i)}
              />
            ))
          )
        ) : null}

        {aba === 'historico' ? (
          carregandoHistorico ? (
            <p className="chat-interno-pedidos-col__empty">A carregar histórico…</p>
          ) : historicoLimpo.length === 0 ? (
            <p className="chat-interno-pedidos-col__empty">Sem registos ainda.</p>
          ) : (
            <ul className="chat-interno-pedidos-col__historico-list">
              {historicoLimpo.map((h) => {
                const actor = usuariosPorId.get(h.actorId)
                const actorNome = actor?.nome || actor?.email || 'Utilizador'
                const solicitante = nomeSolicitanteHistorico(h, usuariosPorId)
                const resumo = resumoHistorico(h)
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="chat-interno-pedidos-historico-item"
                      onClick={() => setHistoricoSelecionado(h)}
                      title="Ver detalhes da solicitação"
                    >
                      <div className="chat-interno-pedidos-historico-item__evento">
                        {etiquetaEventoPedidoAjusteHistorico(h.evento)}
                      </div>
                      <div className="chat-interno-pedidos-historico-item__meta">
                        <span>{actorNome}</span>
                        <span aria-hidden> · </span>
                        <time dateTime={h.createdAt}>{formatarDataHora(h.createdAt)}</time>
                        {h.ciclo > 1 ? <span>{` · ciclo ${h.ciclo}`}</span> : null}
                      </div>
                      <p className="chat-interno-pedidos-historico-item__solicitante">
                        Solicitante: {solicitante}
                        {h.pedidoCreatedAt ? (
                          <>
                            {' · '}
                            <time dateTime={h.pedidoCreatedAt}>
                              {formatarData(h.pedidoCreatedAt)} às {formatarHorario(h.pedidoCreatedAt)}
                            </time>
                          </>
                        ) : null}
                      </p>
                      {resumo ? (
                        <p className="chat-interno-pedidos-historico-item__texto">{resumo}</p>
                      ) : null}
                      <span className="chat-interno-pedidos-historico-item__hint">Toque para ver detalhes</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : null}
      </div>

      {historicoSelecionado ? (
        <HistoricoDetalheModal
          item={historicoSelecionado}
          usuariosPorId={usuariosPorId}
          onFechar={() => setHistoricoSelecionado(null)}
          onAbrirConversa={onAbrirConversa}
        />
      ) : null}

      {relatorioAberto ? (
        <SolicitacoesRelatorioModal
          usuariosPorId={usuariosPorId}
          onFechar={() => setRelatorioAberto(false)}
        />
      ) : null}
    </aside>
  )
}
