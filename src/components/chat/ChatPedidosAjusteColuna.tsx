import { ChatAvatar } from './ChatAvatar'
import type { PedidoAjusteFilaItem } from '../../lib/chatPedidoAjuste'
import type { ChatUsuarioLista } from '../../types/chat'
import { rgAlert } from '../../lib/RgDialogProvider'

type Props = {
  itens: PedidoAjusteFilaItem[]
  usuariosPorId: Map<string, ChatUsuarioLista>
  carregando: boolean
  marcandoId: string | null
  onAbrirConversa: (conversaId: string, outroId: string) => void
  onMarcarResolvido: (item: PedidoAjusteFilaItem) => Promise<void>
}

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

export function ChatPedidosAjusteColuna({
  itens,
  usuariosPorId,
  carregando,
  marcandoId,
  onAbrirConversa,
  onMarcarResolvido,
}: Props) {
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

  return (
    <aside className="chat-interno-pedidos-col" aria-label="Fila de solicitações de ajuste">
      <div className="chat-interno-pedidos-col__head">
        <h3 className="chat-interno-pedidos-col__title">Solicitações</h3>
        {itens.length > 0 ? (
          <span className="chat-interno-pedidos-col__count" aria-label={`${itens.length} pendentes`}>
            {itens.length}
          </span>
        ) : null}
      </div>
      <p className="chat-interno-pedidos-col__hint">
        Marque como resolvido para enviar a resposta automática ao utilizador.
      </p>

      <div className="chat-interno-pedidos-col__list">
        {carregando ? (
          <p className="chat-interno-muted">A carregar…</p>
        ) : itens.length === 0 ? (
          <p className="chat-interno-muted">Nenhuma solicitação pendente.</p>
        ) : (
          itens.map((item) => {
            const meta = usuariosPorId.get(item.remetenteId)
            const nome = meta?.nome || meta?.email || item.parseado?.solicitante || 'Utilizador'
            const descricao =
              item.parseado?.descricao ||
              item.conteudo.replace(/^\[Solicitação de ajuste no sistema\]\s*/i, '').trim().slice(0, 200)
            const marcando = marcandoId === item.mensagemId

            return (
              <article key={item.mensagemId} className="chat-interno-pedido-card">
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
                <button
                  type="button"
                  className="chat-interno-pedido-card__btn"
                  disabled={Boolean(marcandoId)}
                  onClick={() => void handleMarcar(item)}
                >
                  {marcando ? 'A enviar resposta…' : '✓ Marcar como resolvido'}
                </button>
              </article>
            )
          })
        )}
      </div>
    </aside>
  )
}
