import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { ChatPedidosAjusteColuna } from '../../components/chat/ChatPedidosAjusteColuna'
import { SolicitacoesAjusteDashboard } from '../../components/sistema/SolicitacoesAjusteDashboard'
import { usePedidosAjusteAdmin } from '../../hooks/usePedidosAjusteAdmin'
import { useChatFloat } from '../../contexts/ChatFloatContext'
import {
  CHAT_PEDIDO_AJUSTE_PREFIX,
  CHAT_RESPOSTA_AJUSTE_RESOLVIDO,
  montarRespostaPedidoAjusteResolvido,
  parsePedidoAjusteConteudo,
} from '../../lib/chatPedidoAjuste'
import { idDesenvolvedorAjustesConfig } from '../../lib/solicitacaoAjusteSistema'

type AbaAdmin = 'filas' | 'dashboard' | 'respostas'

const EXEMPLO_PEDIDO = `${CHAT_PEDIDO_AJUSTE_PREFIX}

Corrigir filtro na listagem

Página: /programacao
— Utilizador exemplo`

export default function SolicitacoesAjusteAdmin() {
  const { openChatWithUser } = useChatFloat()
  const [aba, setAba] = useState<AbaAdmin>('filas')
  const {
    usuarios,
    usuariosPorId,
    filaDev,
    filaThais,
    historico,
    resumo,
    carregando,
    carregandoHistorico,
    erro,
    marcandoId,
    enviandoThaisId,
    aprovandoThaisId,
    pedindoDetalhesId,
    recarregar,
    pedirDetalhes,
    marcarResolvido,
    enviarFilaThais,
    aprovarFilaThais,
  } = usePedidosAjusteAdmin()

  const abrirConversa = useCallback(
    (_conversaId: string, outroId: string) => {
      openChatWithUser(outroId)
    },
    [openChatWithUser]
  )

  const destinatarioConfig = idDesenvolvedorAjustesConfig()
  const respostaExemplo = montarRespostaPedidoAjusteResolvido(EXEMPLO_PEDIDO)
  const parseExemplo = parsePedidoAjusteConteudo(EXEMPLO_PEDIDO)

  return (
    <MainLayout>
      <div className="page-shell solicitacoes-admin">
        <header className="solicitacoes-admin__hero">
          <div className="solicitacoes-admin__hero-copy">
            <p className="solicitacoes-admin__eyebrow">Sistema · Desenvolvedor</p>
            <h1 className="solicitacoes-admin__title">Gestão de solicitações</h1>
            <p className="solicitacoes-admin__lead">
              Central de filas de ajuste, aprovações e respostas automáticas. O chat interno mantém
              o mesmo fluxo — esta página concentra a operação para a equipe de desenvolvimento.
            </p>
          </div>
          <div className="solicitacoes-admin__hero-actions">
            <Link
              to="/sistema/fila-exclusoes"
              className="solicitacoes-admin__btn solicitacoes-admin__btn--ghost"
            >
              Exclusões operacionais
            </Link>
            <button
              type="button"
              className="solicitacoes-admin__btn solicitacoes-admin__btn--ghost"
              disabled={carregando}
              onClick={() => void recarregar()}
            >
              {carregando ? 'Atualizando…' : 'Atualizar filas'}
            </button>
          </div>
        </header>

        {erro ? (
          <div className="solicitacoes-admin__alert" role="alert">
            {erro}
          </div>
        ) : null}

        <div className="solicitacoes-admin__stats" aria-label="Resumo das filas">
          <article className="solicitacoes-admin__stat">
            <span className="solicitacoes-admin__stat-value">{resumo.filaDev}</span>
            <span className="solicitacoes-admin__stat-label">Na fila dos devs</span>
            <span className="solicitacoes-admin__stat-hint">
              {resumo.novos} novos · {resumo.aguardandoDetalhes} aguard. detalhes · {resumo.reabertos}{' '}
              negados · {resumo.aprovadosThais} pós-Thais
            </span>
          </article>
          <article className="solicitacoes-admin__stat solicitacoes-admin__stat--thais">
            <span className="solicitacoes-admin__stat-value">{resumo.filaThais}</span>
            <span className="solicitacoes-admin__stat-label">Aguardando Thais</span>
            <span className="solicitacoes-admin__stat-hint">Escalados pelos desenvolvedores</span>
          </article>
          <article className="solicitacoes-admin__stat solicitacoes-admin__stat--hist">
            <span className="solicitacoes-admin__stat-value">{resumo.historico}</span>
            <span className="solicitacoes-admin__stat-label">Eventos recentes</span>
            <span className="solicitacoes-admin__stat-hint">Últimos 100 registros</span>
          </article>
        </div>

        <div className="solicitacoes-admin__tabs" role="tablist" aria-label="Secções da gestão">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'filas'}
            className={
              aba === 'filas'
                ? 'solicitacoes-admin__tab solicitacoes-admin__tab--on'
                : 'solicitacoes-admin__tab'
            }
            onClick={() => setAba('filas')}
          >
            Filas e histórico
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'dashboard'}
            className={
              aba === 'dashboard'
                ? 'solicitacoes-admin__tab solicitacoes-admin__tab--on'
                : 'solicitacoes-admin__tab'
            }
            onClick={() => setAba('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'respostas'}
            className={
              aba === 'respostas'
                ? 'solicitacoes-admin__tab solicitacoes-admin__tab--on'
                : 'solicitacoes-admin__tab'
            }
            onClick={() => setAba('respostas')}
          >
            Respostas automáticas
          </button>
        </div>

        {aba === 'dashboard' ? <SolicitacoesAjusteDashboard usuarios={usuarios} /> : null}

        {aba === 'filas' ? (
          <div className="solicitacoes-admin__grid" role="tabpanel">
            <section className="solicitacoes-admin__panel solicitacoes-admin__panel--principal">
              <div className="solicitacoes-admin__panel-head">
                <h2>Fila de desenvolvimento</h2>
                <p>
                  Novos pedidos chegam aqui primeiro. Use a aba <strong>Mais detalhes</strong> para
                  acompanhar os casos em que pediu complemento ao solicitante. Também pode enviar à
                  Thais ou marcar como resolvido.
                </p>
              </div>
              <div className="solicitacoes-admin__coluna-wrap">
                <ChatPedidosAjusteColuna
                  modo="dev"
                  itens={filaDev}
                  historico={historico}
                  usuariosPorId={usuariosPorId}
                  carregando={carregando}
                  carregandoHistorico={carregandoHistorico}
                  marcandoId={marcandoId}
                  podeEnviarFilaThais
                  enviandoThaisId={enviandoThaisId}
                  aprovandoId={aprovandoThaisId}
                  onAbrirConversa={abrirConversa}
                  onMarcarResolvido={marcarResolvido}
                  onPedirDetalhes={pedirDetalhes}
                  pedindoDetalhesId={pedindoDetalhesId}
                  onEnviarFilaThais={enviarFilaThais}
                  onAprovarFilaThais={aprovarFilaThais}
                />
              </div>
            </section>

            <section className="solicitacoes-admin__panel solicitacoes-admin__panel--lateral">
              <div className="solicitacoes-admin__panel-head">
                <h2>Fila da Thais</h2>
                <p>Pedidos à espera de aprovação (visão de supervisão).</p>
              </div>
              <div className="solicitacoes-admin__thais-list">
                {carregando ? (
                  <p className="solicitacoes-admin__empty">Carregando…</p>
                ) : filaThais.length === 0 ? (
                  <p className="solicitacoes-admin__empty">Nenhum pedido aguarda aprovação da Thais.</p>
                ) : (
                  filaThais.map((item) => {
                    const meta = usuariosPorId.get(item.remetenteId)
                    const nome = meta?.nome || meta?.email || item.parseado?.solicitante || 'Utilizador'
                    const descricao =
                      item.parseado?.descricao ||
                      item.conteudo.replace(/^\[Solicitação de ajuste no sistema\]\s*/i, '').slice(0, 160)
                    return (
                      <article key={item.mensagemId} className="solicitacoes-admin__thais-card">
                        <header>
                          <strong>{nome}</strong>
                          {item.parseado?.pagina ? (
                            <span className="solicitacoes-admin__thais-pagina">{item.parseado.pagina}</span>
                          ) : null}
                        </header>
                        <p>{descricao}</p>
                        <div className="solicitacoes-admin__thais-actions">
                          <button
                            type="button"
                            className="solicitacoes-admin__btn solicitacoes-admin__btn--sm"
                            onClick={() => abrirConversa(item.conversaId, item.remetenteId)}
                          >
                            Abrir chat
                          </button>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>

              <div className="solicitacoes-admin__nota">
                <h3>Chat interno</h3>
                <p>
                  A coluna «Solicitações» no chat flutuante continua ativa. Use esta página para
                  uma visão ampla; o chat para conversar com o solicitante.
                </p>
                <Link to="/bem-vindo" className="solicitacoes-admin__link">
                  Ir para início (abrir chat pelo ícone)
                </Link>
              </div>
            </section>
          </div>
        ) : null}

        {aba === 'respostas' ? (
          <section className="solicitacoes-admin__config" role="tabpanel">
            <div className="solicitacoes-admin__config-grid">
              <article className="solicitacoes-admin__config-card">
                <h2>Texto padrão ao resolver</h2>
                <p className="solicitacoes-admin__config-hint">
                  Usado quando o pedido não puder ser interpretado (sem descrição estruturada).
                </p>
                <pre className="solicitacoes-admin__pre">{CHAT_RESPOSTA_AJUSTE_RESOLVIDO}</pre>
                <p className="solicitacoes-admin__config-note">
                  Edição persistente em base de dados — próxima etapa. Por agora o texto vive em{' '}
                  <code>chatPedidoAjuste.ts</code>.
                </p>
              </article>

              <article className="solicitacoes-admin__config-card">
                <h2>Modelo dinâmico (com pedido parseado)</h2>
                <p className="solicitacoes-admin__config-hint">
                  Quando o pedido traz descrição, página e solicitante, a resposta automática cita
                  esses campos.
                </p>
                {parseExemplo ? (
                  <dl className="solicitacoes-admin__dl">
                    <div>
                      <dt>Descrição</dt>
                      <dd>{parseExemplo.descricao}</dd>
                    </div>
                    <div>
                      <dt>Página</dt>
                      <dd>{parseExemplo.pagina ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Solicitante</dt>
                      <dd>{parseExemplo.solicitante ?? '—'}</dd>
                    </div>
                  </dl>
                ) : null}
                <pre className="solicitacoes-admin__pre">{respostaExemplo}</pre>
              </article>

              <article className="solicitacoes-admin__config-card">
                <h2>Destino dos novos pedidos</h2>
                <p className="solicitacoes-admin__config-hint">
                  Utilizador que recebe a conversa quando alguém clica em «Solicitar ajuste».
                </p>
                <dl className="solicitacoes-admin__dl">
                  <div>
                    <dt>Variável de ambiente</dt>
                    <dd>
                      <code>VITE_AJUSTE_SISTEMA_USER_ID</code> ou <code>VITE_SUPORTE_USER_ID</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Valor configurado</dt>
                    <dd>{destinatarioConfig ?? 'Não definido — usa busca por nome no Supabase'}</dd>
                  </div>
                  <div>
                    <dt>Fallback</dt>
                    <dd>Rafael Cavalcante (desenvolvedor master)</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>
        ) : null}
      </div>
    </MainLayout>
  )
}
