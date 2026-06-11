import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { ConcluirModuloResultado } from '../../hooks/useTreinamentoProgresso'
import {
  KB_BRINDES,
  KB_CONQUISTAS,
  KB_TOTAL_ARTIGOS,
  kbMetaArtigo,
  type KbConquista,
  type KbNivelDificuldade,
} from '../../lib/treinamentoKb/gamificacao'
import type { KbArtigo } from '../../lib/treinamentoKb/types'

const NIVEL_CSS: Record<KbNivelDificuldade, string> = {
  Iniciante: 'iniciante',
  Intermediário: 'intermediario',
  Avançado: 'avancado',
}

type Stats = {
  nivel: { titulo: string; emoji: string; cor: string; corSuave: string; nivel: number }
  xpNoNivel: number
  xpParaProximo: number
  percentual: number
  modulosConcluidos: number
  percentualTrilha: number
  pontosResgate: number
  sequenciaDias: number
  conquistasDesbloqueadas: string[]
}

export function TreinamentoPainelXp({ stats }: { stats: Stats }) {
  return (
    <aside className="treinamento-kb__xp-panel" aria-label="Seu progresso">
      <div className="treinamento-kb__xp-panel-top">
        <div
          className="treinamento-kb__level-badge"
          style={
            {
              '--xp-cor': stats.nivel.cor,
              '--xp-cor-suave': stats.nivel.corSuave,
            } as CSSProperties
          }
        >
          <span className="treinamento-kb__level-emoji" aria-hidden>
            {stats.nivel.emoji}
          </span>
          <div>
            <span className="treinamento-kb__level-label">Nível {stats.nivel.nivel}</span>
            <strong className="treinamento-kb__level-title">{stats.nivel.titulo}</strong>
          </div>
        </div>
        {stats.sequenciaDias > 1 ? (
          <span className="treinamento-kb__streak" title="Dias seguidos estudando">
            🔥 {stats.sequenciaDias}d
          </span>
        ) : null}
      </div>

      <div className="treinamento-kb__xp-bar-wrap">
        <div className="treinamento-kb__xp-bar-labels">
          <span>{stats.xpNoNivel} XP neste nível</span>
          <span>{stats.percentual}%</span>
        </div>
        <div className="treinamento-kb__xp-bar" role="progressbar" aria-valuenow={stats.percentual}>
          <div
            className="treinamento-kb__xp-bar-fill"
            style={{ width: `${stats.percentual}%`, background: stats.nivel.cor }}
          />
        </div>
      </div>

      <div className="treinamento-kb__xp-stats">
        <div className="treinamento-kb__xp-stat">
          <span className="treinamento-kb__xp-stat-value">{stats.pontosResgate}</span>
          <span className="treinamento-kb__xp-stat-label">Pontos RG</span>
        </div>
        <div className="treinamento-kb__xp-stat">
          <span className="treinamento-kb__xp-stat-value">
            {stats.modulosConcluidos}/{KB_TOTAL_ARTIGOS}
          </span>
          <span className="treinamento-kb__xp-stat-label">Módulos</span>
        </div>
        <div className="treinamento-kb__xp-stat">
          <span className="treinamento-kb__xp-stat-value">{stats.percentualTrilha}%</span>
          <span className="treinamento-kb__xp-stat-label">Trilha</span>
        </div>
      </div>
    </aside>
  )
}

export function TreinamentoTrilhaProgresso({ percentual }: { percentual: number }) {
  return (
    <div className="treinamento-kb__trilha-progresso">
      <div className="treinamento-kb__trilha-progresso-head">
        <strong>Sua jornada operacional</strong>
        <span>{percentual}% concluído</span>
      </div>
      <div className="treinamento-kb__trilha-progresso-bar" role="progressbar" aria-valuenow={percentual}>
        <div className="treinamento-kb__trilha-progresso-fill" style={{ width: `${percentual}%` }} />
      </div>
    </div>
  )
}

export function TreinamentoLojaBrindes({ pontos }: { pontos: number }) {
  return (
    <section className="treinamento-kb__loja" aria-labelledby="kb-loja-title">
      <div className="treinamento-kb__section-head treinamento-kb__section-head--row">
        <div>
          <h2 id="kb-loja-title">Loja de brindes RG</h2>
          <p>Troque seus Pontos RG por recompensas — catálogo em breve com o RH.</p>
        </div>
        <span className="treinamento-kb__loja-saldo">
          Saldo: <strong>{pontos}</strong> pts
        </span>
      </div>
      <div className="treinamento-kb__loja-grid">
        {KB_BRINDES.map((b) => {
          const podeResgatar = pontos >= b.pontosNecessarios
          return (
            <div
              key={b.id}
              className={`treinamento-kb__loja-item${podeResgatar ? ' treinamento-kb__loja-item--ready' : ''}`}
            >
              <span className="treinamento-kb__loja-emoji" aria-hidden>
                {b.emoji}
              </span>
              <h3>{b.titulo}</h3>
              <p>{b.descricao}</p>
              <span className="treinamento-kb__loja-preco">{b.pontosNecessarios} pts</span>
              <span className="treinamento-kb__loja-status">
                {b.disponivel ? 'Resgatar' : 'Em breve'}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function TreinamentoConquistasGrid({
  desbloqueadas,
}: {
  desbloqueadas: string[]
}) {
  return (
    <section className="treinamento-kb__conquistas" aria-labelledby="kb-conquistas-title">
      <div className="treinamento-kb__section-head">
        <h2 id="kb-conquistas-title">Conquistas</h2>
        <p>Desbloqueie medalhas ao avançar na trilha e manter constância.</p>
      </div>
      <div className="treinamento-kb__conquistas-grid">
        {KB_CONQUISTAS.map((c) => (
          <ConquistaCard key={c.id} conquista={c} desbloqueada={desbloqueadas.includes(c.id)} />
        ))}
      </div>
    </section>
  )
}

function ConquistaCard({
  conquista,
  desbloqueada,
}: {
  conquista: KbConquista
  desbloqueada: boolean
}) {
  return (
    <div
      className={`treinamento-kb__conquista${desbloqueada ? ' treinamento-kb__conquista--ok' : ''}`}
      title={conquista.descricao}
    >
      <span className="treinamento-kb__conquista-emoji" aria-hidden>
        {desbloqueada ? conquista.emoji : '🔒'}
      </span>
      <strong>{conquista.titulo}</strong>
      <span className="treinamento-kb__conquista-xp">+{conquista.xpBonus} XP</span>
    </div>
  )
}

export function TreinamentoCardMeta({
  slug,
  concluido,
}: {
  slug: string
  concluido: boolean
}) {
  const meta = kbMetaArtigo(slug)
  return (
    <div className="treinamento-kb__card-meta">
      <span className="treinamento-kb__card-xp">+{meta.xpRecompensa} XP</span>
      <span className="treinamento-kb__card-duracao">{meta.duracaoMin} min</span>
      <span className={`treinamento-kb__card-nivel treinamento-kb__card-nivel--${NIVEL_CSS[meta.nivel]}`}>
        {meta.nivel}
      </span>
      {concluido ? (
        <span className="treinamento-kb__card-done" aria-label="Módulo concluído">
          ✓
        </span>
      ) : null}
    </div>
  )
}

export function TreinamentoFlowStepBadge({ concluido }: { concluido: boolean }) {
  if (!concluido) return null
  return <span className="treinamento-kb__flow-done" aria-label="Concluído">✓</span>
}

export function TreinamentoConcluirModulo({
  slug,
  titulo,
  concluido,
  onConcluir,
}: {
  slug: string
  titulo: string
  concluido: boolean
  onConcluir: () => void
}) {
  const meta = kbMetaArtigo(slug)

  if (concluido) {
    return (
      <div className="treinamento-kb__complete treinamento-kb__complete--done" role="status">
        <span className="treinamento-kb__complete-icon" aria-hidden>
          🎉
        </span>
        <div>
          <strong>Módulo concluído!</strong>
          <p>Você dominou «{titulo}» e já recebeu os pontos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="treinamento-kb__complete">
      <div className="treinamento-kb__complete-copy">
        <strong>Finalizou a leitura?</strong>
        <p>
          Marque como concluído para ganhar <strong>+{meta.xpRecompensa} XP</strong> e avançar na
          trilha.
        </p>
      </div>
      <button type="button" className="treinamento-kb__complete-btn" onClick={onConcluir}>
        Concluir módulo · +{meta.xpRecompensa} XP
      </button>
    </div>
  )
}

export function TreinamentoCelebracaoModal({
  resultado,
  onFechar,
}: {
  resultado: ConcluirModuloResultado
  onFechar: () => void
}) {
  if (resultado.jaConcluido) return null

  return (
    <div className="treinamento-kb__celebracao-backdrop" role="presentation" onClick={onFechar}>
      <div
        className="treinamento-kb__celebracao"
        role="dialog"
        aria-labelledby="kb-celebracao-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="treinamento-kb__celebracao-burst" aria-hidden />
        <span className="treinamento-kb__celebracao-emoji" aria-hidden>
          ⭐
        </span>
        <h2 id="kb-celebracao-title">Parabéns!</h2>
        <p className="treinamento-kb__celebracao-xp">+{resultado.xpGanho} XP</p>
        <p className="treinamento-kb__celebracao-msg">Módulo concluído com sucesso.</p>
        {resultado.novasConquistas.length > 0 ? (
          <ul className="treinamento-kb__celebracao-conquistas">
            {resultado.novasConquistas.map((c) => (
              <li key={c.id}>
                {c.emoji} Nova conquista: <strong>{c.titulo}</strong> (+{c.xpBonus} XP)
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="treinamento-kb__celebracao-btn" onClick={onFechar}>
          Continuar jornada
        </button>
      </div>
    </div>
  )
}

export function TreinamentoProximoModulo({
  artigoAtual,
  artigos,
  base,
  isConcluido,
}: {
  artigoAtual: KbArtigo
  artigos: KbArtigo[]
  base: string
  isConcluido: (slug: string) => boolean
}) {
  const proximo = artigos.find((a) => a.slug !== artigoAtual.slug && !isConcluido(a.slug))
  if (!proximo) return null

  return (
    <Link to={`${base}/${proximo.slug}`} className="treinamento-kb__next-module">
      <span className="treinamento-kb__next-label">Próximo módulo recomendado</span>
      <span className="treinamento-kb__next-title">
        {proximo.emoji} {proximo.titulo} →
      </span>
    </Link>
  )
}
