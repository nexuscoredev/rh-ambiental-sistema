import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useSenhaPessoalAcompanhamento } from '../../hooks/useSenhaPessoalAcompanhamento'
import type { UsuarioSenhaPessoalLinha } from '../../lib/senhaPessoalConfirmacao'

function formatarData(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

function TabelaUsuarios({
  titulo,
  linhas,
  mostrarConfirmadoEm,
  vazio,
}: {
  titulo: string
  linhas: UsuarioSenhaPessoalLinha[]
  mostrarConfirmadoEm?: boolean
  vazio: string
}) {
  return (
    <section className="senha-pessoal-admin__panel">
      <h2 className="senha-pessoal-admin__panel-title">{titulo}</h2>
      {linhas.length === 0 ? (
        <p className="senha-pessoal-admin__vazio">{vazio}</p>
      ) : (
        <div className="senha-pessoal-admin__table-wrap">
          <table className="senha-pessoal-admin__table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Cargo</th>
                {mostrarConfirmadoEm ? <th>Confirmado em</th> : null}
              </tr>
            </thead>
            <tbody>
              {linhas.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome?.trim() || '—'}</td>
                  <td>{u.email?.trim() || '—'}</td>
                  <td>{u.cargo?.trim() || '—'}</td>
                  {mostrarConfirmadoEm ? <td>{formatarData(u.confirmado_em)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function SenhaPessoalAcompanhamento() {
  const { stats, carregando, erro, recarregar } = useSenhaPessoalAcompanhamento()

  const pct =
    stats && stats.total_elegiveis > 0
      ? Math.round((stats.confirmados / stats.total_elegiveis) * 100)
      : 0

  return (
    <MainLayout>
      <div className="page-shell senha-pessoal-admin">
        <header className="solicitacoes-admin__hero">
          <div className="solicitacoes-admin__hero-copy">
            <p className="solicitacoes-admin__eyebrow">Sistema · Desenvolvedor</p>
            <h1 className="solicitacoes-admin__title">Senha pessoal — acompanhamento</h1>
            <p className="solicitacoes-admin__lead">
              Utilizadores activos que clicaram em «Já configurei» na boas-vindas versus quem ainda
              não confirmou. Desenvolvedores não entram na contagem.
            </p>
          </div>
          <div className="solicitacoes-admin__hero-actions">
            <button
              type="button"
              className="solicitacoes-admin__btn solicitacoes-admin__btn--ghost"
              disabled={carregando}
              onClick={() => void recarregar()}
            >
              {carregando ? 'A actualizar…' : 'Actualizar'}
            </button>
            <Link to="/bem-vindo" className="solicitacoes-admin__btn solicitacoes-admin__btn--ghost">
              Ver boas-vindas
            </Link>
          </div>
        </header>

        {erro ? (
          <p className="senha-pessoal-admin__erro" role="alert">
            {erro}
          </p>
        ) : null}

        {stats ? (
          <>
            <div className="senha-pessoal-admin__kpis">
              <article className="senha-pessoal-admin__kpi senha-pessoal-admin__kpi--ok">
                <span className="senha-pessoal-admin__kpi-valor">{stats.confirmados}</span>
                <span className="senha-pessoal-admin__kpi-label">Já confirmaram</span>
              </article>
              <article className="senha-pessoal-admin__kpi senha-pessoal-admin__kpi--pend">
                <span className="senha-pessoal-admin__kpi-valor">{stats.pendentes}</span>
                <span className="senha-pessoal-admin__kpi-label">Ainda pendentes</span>
              </article>
              <article className="senha-pessoal-admin__kpi">
                <span className="senha-pessoal-admin__kpi-valor">{stats.total_elegiveis}</span>
                <span className="senha-pessoal-admin__kpi-label">Total elegíveis</span>
              </article>
              <article className="senha-pessoal-admin__kpi senha-pessoal-admin__kpi--pct">
                <span className="senha-pessoal-admin__kpi-valor">{pct}%</span>
                <span className="senha-pessoal-admin__kpi-label">Taxa de confirmação</span>
              </article>
            </div>

            <TabelaUsuarios
              titulo={`Pendentes (${stats.pendentes})`}
              linhas={stats.usuarios_pendentes}
              vazio="Todos os utilizadores elegíveis já confirmaram."
            />
            <TabelaUsuarios
              titulo={`Confirmados (${stats.confirmados})`}
              linhas={stats.usuarios_confirmados}
              mostrarConfirmadoEm
              vazio="Nenhuma confirmação registada ainda."
            />
          </>
        ) : carregando ? (
          <p className="senha-pessoal-admin__vazio">A carregar estatísticas…</p>
        ) : null}
      </div>
    </MainLayout>
  )
}
