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
import { usuarioEhAprovadorExclusaoOperacionalThais } from '../../lib/workflowPermissions'

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

export default function FilaExclusaoOperacional() {
  const { usuario } = usePerfilUsuario()
  const { confirm, alert, prompt } = useRgDialog()
  const [fila, setFila] = useState<SolicitacaoExclusaoOperacionalRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [processandoId, setProcessandoId] = useState<string | null>(null)

  const podeAprovar = usuarioEhAprovadorExclusaoOperacionalThais(usuario?.nome, usuario?.cargo)

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
    if (!podeAprovar) return
    const tipo = rotuloTipoEntidadeExclusao(item.tipo_entidade)
    const ok = await confirm({
      title: 'Aprovar exclusão',
      message: `Aprovar exclusão de ${tipo} «${item.entidade_rotulo}»?\n\nMotivo informado: ${item.motivo}`,
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
      title: 'Exclusão aprovada',
      message: `${tipo} excluída com sucesso.`,
      variant: 'success',
    })
    await carregar()
  }

  async function handleRejeitar(item: SolicitacaoExclusaoOperacionalRow) {
    if (!podeAprovar) return
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
      <div className="page-shell solicitacoes-admin">
        <header className="solicitacoes-admin__hero">
          <div className="solicitacoes-admin__hero-copy">
            <p className="solicitacoes-admin__eyebrow">Sistema · Aprovação</p>
            <h1 className="solicitacoes-admin__title">Fila de exclusões</h1>
            <p className="solicitacoes-admin__lead">
              Solicitações de exclusão de programações e MTRs enviadas pela equipe comercial e
              operacional. Ao aprovar, a exclusão é executada automaticamente.
            </p>
          </div>
          <div className="solicitacoes-admin__hero-actions">
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
            <span className="solicitacoes-admin__stat-label">Aguardando aprovação</span>
          </article>
        </div>

        <section className="solicitacoes-admin__panel">
          <h2>Pendentes</h2>
          {carregando ? (
            <p>Carregando solicitações…</p>
          ) : fila.length === 0 ? (
            <p>Nenhuma solicitação pendente na fila.</p>
          ) : (
            <div className="solicitacoes-admin__lista">
              {fila.map((item) => {
                const ocupado = processandoId === item.id
                const tipo = rotuloTipoEntidadeExclusao(item.tipo_entidade)
                const linkEntidade =
                  item.tipo_entidade === 'programacao'
                    ? `/programacao?programacao=${item.entidade_id}`
                    : `/mtr?mtr=${item.entidade_id}`

                return (
                  <article key={item.id} className="solicitacoes-admin__card">
                    <div className="solicitacoes-admin__card-head">
                      <span className="solicitacoes-admin__badge">{tipo}</span>
                      <strong>{item.entidade_rotulo}</strong>
                      <span className="solicitacoes-admin__meta">{item.entidade_detalhe}</span>
                    </div>
                    <p className="solicitacoes-admin__card-motivo">
                      <strong>Motivo:</strong> {item.motivo}
                    </p>
                    <p className="solicitacoes-admin__card-meta">
                      Solicitado por <strong>{item.solicitante_nome}</strong> em{' '}
                      {formatarDataHora(item.criado_em)}
                      {item.excluir_serie_inteira ? ' · série completa' : ''}
                    </p>
                    <div className="solicitacoes-admin__card-actions">
                      <Link to={linkEntidade} className="solicitacoes-admin__btn solicitacoes-admin__btn--ghost">
                        Ver registro
                      </Link>
                      <button
                        type="button"
                        className="solicitacoes-admin__btn solicitacoes-admin__btn--danger"
                        disabled={!podeAprovar || ocupado}
                        onClick={() => void handleRejeitar(item)}
                      >
                        {ocupado ? 'Processando…' : 'Rejeitar'}
                      </button>
                      <button
                        type="button"
                        className="solicitacoes-admin__btn solicitacoes-admin__btn--primary"
                        disabled={!podeAprovar || ocupado}
                        onClick={() => void handleAprovar(item)}
                      >
                        {ocupado ? 'Processando…' : 'Aprovar e excluir'}
                      </button>
                    </div>
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
