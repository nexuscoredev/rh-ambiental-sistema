import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { usePerfilUsuario } from '../../contexts/PerfilUsuarioContext'
import { useRgDialog } from '../../lib/RgDialogProvider'
import {
  aprovarSolicitacaoExclusaoOperacional,
  listarSolicitacoesExclusaoOperacional,
  rejeitarSolicitacaoExclusaoOperacional,
  rotuloTipoEntidadeExclusao,
  type SolicitacaoExclusaoOperacionalRow,
} from '../../lib/solicitacaoExclusaoOperacional'
import {
  cargoEhDesenvolvedor,
  usuarioPodeDecidirFilaExclusaoOperacional,
} from '../../lib/workflowPermissions'

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function badgeTipoClasse(tipo: string): string {
  return tipo === 'programacao'
    ? 'fila-exclusao__badge fila-exclusao__badge--prog'
    : 'fila-exclusao__badge fila-exclusao__badge--mtr'
}

export default function FilaExclusaoOperacional() {
  const { usuario } = usePerfilUsuario()
  const { confirm, alert, prompt } = useRgDialog()
  const [fila, setFila] = useState<SolicitacaoExclusaoOperacionalRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [processandoId, setProcessandoId] = useState<string | null>(null)

  const podeDecidir = usuarioPodeDecidirFilaExclusaoOperacional(
    usuario?.nome,
    usuario?.cargo,
    usuario?.email
  )
  const ehDesenvolvedor = cargoEhDesenvolvedor(usuario?.cargo)

  const carregar = useCallback(async () => {
    try {
      setCarregando(true)
      setErro('')
      const rows = await listarSolicitacoesExclusaoOperacional('aguardando')
      setFila(rows)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a fila.')
      setFila([])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function handleAprovar(item: SolicitacaoExclusaoOperacionalRow) {
    if (!podeDecidir) return
    const tipo = rotuloTipoEntidadeExclusao(item.tipo_entidade)
    const ok = await confirm({
      title: 'Aprovar e excluir',
      message: `Confirma a exclusão de ${tipo} «${item.entidade_rotulo}»?\n\nMotivo do solicitante: ${item.motivo}`,
      confirmLabel: 'Aprovar e excluir',
      variant: 'danger',
    })
    if (!ok) return

    setProcessandoId(item.id)
    const res = await aprovarSolicitacaoExclusaoOperacional(item.id)
    setProcessandoId(null)

    if (!res.ok) {
      await alert({ title: 'Erro', message: res.message, variant: 'danger' })
      return
    }

    await alert({
      title: 'Exclusão concluída',
      message: `${tipo} excluída com sucesso.`,
      variant: 'success',
    })
    await carregar()
  }

  async function handleRejeitar(item: SolicitacaoExclusaoOperacionalRow) {
    if (!podeDecidir) return
    const motivoRejeicao = await prompt({
      title: 'Rejeitar solicitação',
      message: 'Opcional: informe o motivo da rejeição para o solicitante.',
      placeholder: 'Motivo da rejeição (opcional)',
      confirmLabel: 'Rejeitar',
    })
    if (motivoRejeicao === null) return

    setProcessandoId(item.id)
    const res = await rejeitarSolicitacaoExclusaoOperacional(item.id, motivoRejeicao)
    setProcessandoId(null)

    if (!res.ok) {
      await alert({ title: 'Erro', message: res.message, variant: 'danger' })
      return
    }

    await alert({
      title: 'Solicitação rejeitada',
      message: 'O solicitante pode enviar nova solicitação se necessário.',
      variant: 'success',
    })
    await carregar()
  }

  return (
    <MainLayout>
      <div className="page-shell solicitacoes-admin fila-exclusao">
        <header className="solicitacoes-admin__hero">
          <div className="solicitacoes-admin__hero-copy">
            <p className="solicitacoes-admin__eyebrow">Sistema · Gestão de solicitações</p>
            <h1 className="solicitacoes-admin__title">Exclusões operacionais</h1>
            <p className="solicitacoes-admin__lead">
              Solicitações de exclusão de programações e MTRs enviadas pela equipe comercial e
              operacional. Ao aprovar, o registro é excluído automaticamente.
              {ehDesenvolvedor ? ' Desenvolvedores podem rejeitar, aprovar ou excluir.' : ''}
            </p>
          </div>
          <div className="solicitacoes-admin__hero-actions">
            <Link
              to="/sistema/solicitacoes-ajuste"
              className="solicitacoes-admin__btn solicitacoes-admin__btn--ghost"
            >
              ← Gestão de solicitações
            </Link>
            <button
              type="button"
              className="solicitacoes-admin__btn solicitacoes-admin__btn--ghost"
              disabled={carregando}
              onClick={() => void carregar()}
            >
              {carregando ? 'Atualizando…' : 'Atualizar fila'}
            </button>
          </div>
        </header>

        {erro ? (
          <div className="solicitacoes-admin__alert" role="alert">
            {erro}
          </div>
        ) : null}

        <div className="solicitacoes-admin__stats" aria-label="Resumo">
          <article className="solicitacoes-admin__stat solicitacoes-admin__stat--thais">
            <span className="solicitacoes-admin__stat-value">{fila.length}</span>
            <span className="solicitacoes-admin__stat-label">Aguardando decisão</span>
          </article>
        </div>

        <section className="solicitacoes-admin__panel fila-exclusao__panel">
          <div className="solicitacoes-admin__panel-head">
            <h2>Pendentes</h2>
            <p>Revise o motivo antes de rejeitar ou aprovar a exclusão.</p>
          </div>

          {carregando ? (
            <p className="fila-exclusao__empty">Carregando solicitações…</p>
          ) : fila.length === 0 ? (
            <p className="fila-exclusao__empty">Nenhuma solicitação pendente na fila.</p>
          ) : (
            <div className="fila-exclusao__lista">
              {fila.map((item) => {
                const ocupado = processandoId === item.id
                const tipo = rotuloTipoEntidadeExclusao(item.tipo_entidade)
                const linkEntidade =
                  item.tipo_entidade === 'programacao'
                    ? `/programacao?programacao=${item.entidade_id}`
                    : `/mtr?mtr=${item.entidade_id}`

                return (
                  <article key={item.id} className="fila-exclusao__card">
                    <header className="fila-exclusao__card-top">
                      <span className={badgeTipoClasse(item.tipo_entidade)}>{tipo}</span>
                      <h3 className="fila-exclusao__card-titulo">{item.entidade_rotulo}</h3>
                      {item.entidade_detalhe ? (
                        <p className="fila-exclusao__card-detalhe">{item.entidade_detalhe}</p>
                      ) : null}
                    </header>

                    <div className="fila-exclusao__motivo">
                      <span className="fila-exclusao__motivo-label">Motivo da exclusão</span>
                      <p className="fila-exclusao__motivo-texto">{item.motivo}</p>
                    </div>

                    <p className="fila-exclusao__meta">
                      Solicitado por <strong>{item.solicitante_nome}</strong> em{' '}
                      {formatarDataHora(item.criado_em)}
                    </p>

                    <footer className="fila-exclusao__acoes">
                      <Link
                        to={linkEntidade}
                        className="solicitacoes-admin__btn solicitacoes-admin__btn--ghost fila-exclusao__btn"
                      >
                        Ver registro
                      </Link>
                      <button
                        type="button"
                        className="solicitacoes-admin__btn solicitacoes-admin__btn--danger fila-exclusao__btn"
                        disabled={!podeDecidir || ocupado}
                        onClick={() => void handleRejeitar(item)}
                      >
                        {ocupado ? 'Processando…' : 'Rejeitar'}
                      </button>
                      <button
                        type="button"
                        className="solicitacoes-admin__btn solicitacoes-admin__btn--primary fila-exclusao__btn"
                        disabled={!podeDecidir || ocupado}
                        onClick={() => void handleAprovar(item)}
                      >
                        {ocupado ? 'Processando…' : 'Aprovar e excluir'}
                      </button>
                    </footer>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  )
}
