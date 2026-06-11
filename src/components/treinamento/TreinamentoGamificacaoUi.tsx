import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { ConcluirModuloResultado } from '../../hooks/useTreinamentoProgresso'
import {
  KB_BRINDES,
  KB_CONQUISTAS,
  kbMetaArtigo,
  type KbConquista,
  type KbNivelDificuldade,
} from '../../lib/treinamentoKb/gamificacao'
import { kbNotaQuiz, kbQuizPorSlug } from '../../lib/treinamentoKb/quizzes'
import type { KbModuloStatus } from '../../lib/treinamentoKb/treinamentoAcesso'
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
  totalModulos: number
  percentualTrilha: number
  pontosResgate: number
  sequenciaDias: number
  conquistasDesbloqueadas: string[]
  cargo: string | null
  nome: string | null
}

export function TreinamentoPainelXp({ stats }: { stats: Stats }) {
  return (
    <aside className="treinamento-kb__xp-panel" aria-label="Seu progresso">
      <div className="treinamento-kb__xp-panel-brand">
        <span className="treinamento-kb__xp-panel-logo" aria-hidden>
          RG
        </span>
        <div>
          <span className="treinamento-kb__xp-panel-course">Curso RG Ambiental</span>
          <span className="treinamento-kb__xp-panel-user">
            {stats.nome?.split(' ')[0] ?? 'Colaborador'}
            {stats.cargo ? ` · ${stats.cargo}` : ''}
          </span>
        </div>
      </div>

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
            {stats.modulosConcluidos}/{stats.totalModulos}
          </span>
          <span className="treinamento-kb__xp-stat-label">Certificados</span>
        </div>
        <div className="treinamento-kb__xp-stat">
          <span className="treinamento-kb__xp-stat-value">{stats.percentualTrilha}%</span>
          <span className="treinamento-kb__xp-stat-label">Seu perfil</span>
        </div>
      </div>

      <p className="treinamento-kb__xp-hint">
        Trilha personalizada pelo seu cargo. XP exige leitura completa + avaliação aprovada.
      </p>
    </aside>
  )
}

export function TreinamentoTrilhaProgresso({
  percentual,
  modulosConcluidos,
  totalModulos,
}: {
  percentual: number
  modulosConcluidos: number
  totalModulos: number
}) {
  return (
    <div className="treinamento-kb__trilha-progresso">
      <div className="treinamento-kb__trilha-progresso-head">
        <div>
          <strong>Certificação do seu perfil</strong>
          <p className="treinamento-kb__trilha-sub">
            {modulosConcluidos} de {totalModulos} módulos certificados para o seu cargo
          </p>
        </div>
        <span className="treinamento-kb__trilha-pct">{percentual}%</span>
      </div>
      <div className="treinamento-kb__trilha-progresso-bar" role="progressbar" aria-valuenow={percentual}>
        <div className="treinamento-kb__trilha-progresso-fill" style={{ width: `${percentual}%` }} />
      </div>
    </div>
  )
}

export function TreinamentoCurriculum({
  artigos,
  base,
  statusModulo,
  progressoLeitura,
}: {
  artigos: KbArtigo[]
  base: string
  statusModulo: (slug: string) => KbModuloStatus
  progressoLeitura: (slug: string) => { percentual: number }
}) {
  return (
    <section className="treinamento-kb__curriculum" aria-labelledby="kb-curriculum-title">
      <div className="treinamento-kb__section-head">
        <h2 id="kb-curriculum-title">Trilha de desenvolvimento</h2>
        <p>
          Módulos na ordem pedagógica. Desbloqueie o próximo certificando o anterior. Módulos fora
          do seu cargo não aparecem aqui.
        </p>
      </div>
      <ol className="treinamento-kb__curriculum-list">
        {artigos.map((art, index) => {
          const status = statusModulo(art.slug)
          const meta = kbMetaArtigo(art.slug)
          const href = status === 'bloqueado_prereq' || status === 'sem_acesso' ? undefined : `${base}/${art.slug}`

          return (
            <li
              key={art.slug}
              className={`treinamento-kb__curriculum-item treinamento-kb__curriculum-item--${status}`}
            >
              <span className="treinamento-kb__curriculum-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="treinamento-kb__curriculum-body">
                <div className="treinamento-kb__curriculum-head">
                  <span className="treinamento-kb__curriculum-emoji" aria-hidden>
                    {status === 'bloqueado_prereq' ? '🔒' : art.emoji}
                  </span>
                  <div>
                    <span className="treinamento-kb__curriculum-fase">Fase {meta.fase}</span>
                    <strong>{art.titulo}</strong>
                  </div>
                </div>
                <p>{art.resumo}</p>
                <div className="treinamento-kb__curriculum-meta">
                  <span>+{meta.xpCertificacao} XP cert.</span>
                  <span>{meta.duracaoMin} min</span>
                  <span className={`treinamento-kb__card-nivel treinamento-kb__card-nivel--${NIVEL_CSS[meta.nivel]}`}>
                    {meta.nivel}
                  </span>
                </div>
                {status === 'bloqueado_prereq' ? (
                  <p className="treinamento-kb__curriculum-lock-msg">
                    Certifique o módulo anterior para desbloquear.
                  </p>
                ) : null}
                {status === 'concluido' ? (
                  <span className="treinamento-kb__curriculum-badge treinamento-kb__curriculum-badge--ok">
                    ✓ Certificado
                  </span>
                ) : null}
                {status === 'disponivel' && progressoLeitura(art.slug).percentual > 0 ? (
                  <span className="treinamento-kb__curriculum-badge treinamento-kb__curriculum-badge--prog">
                    Em andamento · {progressoLeitura(art.slug).percentual}%
                  </span>
                ) : null}
              </div>
              {href ? (
                <Link to={href} className="treinamento-kb__curriculum-cta">
                  {status === 'concluido' ? 'Revisar' : 'Estudar →'}
                </Link>
              ) : (
                <span className="treinamento-kb__curriculum-cta treinamento-kb__curriculum-cta--disabled">
                  Bloqueado
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
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
      <span className="treinamento-kb__card-xp">+{meta.xpCertificacao} XP</span>
      <span className="treinamento-kb__card-duracao">{meta.duracaoMin} min</span>
      <span className={`treinamento-kb__card-nivel treinamento-kb__card-nivel--${NIVEL_CSS[meta.nivel]}`}>
        Fase {meta.fase}
      </span>
      {concluido ? (
        <span className="treinamento-kb__card-done" aria-label="Certificado">
          ✓
        </span>
      ) : null}
    </div>
  )
}

export function TreinamentoLeituraProgresso({
  lidas,
  total,
  percentual,
}: {
  lidas: number
  total: number
  percentual: number
}) {
  return (
    <div className="treinamento-kb__leitura">
      <div className="treinamento-kb__leitura-head">
        <strong>Progresso de leitura</strong>
        <span>
          {lidas}/{total} seções · {percentual}%
        </span>
      </div>
      <div className="treinamento-kb__leitura-bar">
        <div className="treinamento-kb__leitura-fill" style={{ width: `${percentual}%` }} />
      </div>
      {percentual < 100 ? (
        <p className="treinamento-kb__leitura-hint">
          Role até o fim de cada seção para liberar a avaliação final.
        </p>
      ) : null}
    </div>
  )
}

export function TreinamentoQuiz({
  slug,
  leituraCompleta,
  concluido,
  onCertificar,
}: {
  slug: string
  leituraCompleta: boolean
  concluido: boolean
  onCertificar: (respostas: number[]) => ConcluirModuloResultado
}) {
  const quiz = kbQuizPorSlug(slug)
  const [respostas, setRespostas] = useState<number[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [notaUltima, setNotaUltima] = useState<number | null>(null)

  const notaPreview = useMemo(() => {
    if (!quiz || respostas.length < quiz.questoes.length) return null
    return kbNotaQuiz(quiz.questoes, respostas)
  }, [quiz, respostas])

  if (concluido) {
    return (
      <div className="treinamento-kb__quiz treinamento-kb__quiz--done">
        <span aria-hidden>🎓</span>
        <div>
          <strong>Módulo certificado</strong>
          <p>Você aprovou a avaliação e recebeu os pontos deste módulo.</p>
        </div>
      </div>
    )
  }

  if (!quiz) return null

  if (!leituraCompleta) {
    return (
      <div className="treinamento-kb__quiz treinamento-kb__quiz--locked">
        <span aria-hidden>🔒</span>
        <div>
          <strong>Avaliação bloqueada</strong>
          <p>Conclua a leitura de todas as seções para liberar o quiz de certificação.</p>
        </div>
      </div>
    )
  }

  function enviar() {
    if (respostas.length < quiz!.questoes.length) {
      setFeedback('Responda todas as questões.')
      return
    }
    const r = onCertificar(respostas)
    if (r.notaQuiz != null && r.notaQuiz < quiz!.notaMinima) {
      setNotaUltima(r.notaQuiz)
      setFeedback(`Nota ${r.notaQuiz}% — mínimo ${quiz!.notaMinima}%. Revise o conteúdo e tente de novo.`)
      return
    }
    setFeedback(null)
  }

  return (
    <section className="treinamento-kb__quiz" aria-labelledby="kb-quiz-title">
      <header className="treinamento-kb__quiz-head">
        <h2 id="kb-quiz-title">{quiz.titulo}</h2>
        <p>
          Nota mínima: <strong>{quiz.notaMinima}%</strong> · Certificação:{' '}
          <strong>+{kbMetaArtigo(slug).xpCertificacao} XP</strong>
        </p>
      </header>
      <ol className="treinamento-kb__quiz-list">
        {quiz.questoes.map((q, qi) => (
          <li key={q.id} className="treinamento-kb__quiz-q">
            <p className="treinamento-kb__quiz-pergunta">
              {qi + 1}. {q.pergunta}
            </p>
            <div className="treinamento-kb__quiz-opcoes">
              {q.opcoes.map((op, oi) => (
                <label key={op} className="treinamento-kb__quiz-opcao">
                  <input
                    type="radio"
                    name={`quiz-${slug}-${q.id}`}
                    checked={respostas[qi] === oi}
                    onChange={() => {
                      const next = [...respostas]
                      next[qi] = oi
                      setRespostas(next)
                      setFeedback(null)
                    }}
                  />
                  <span>{op}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {feedback ? <p className="treinamento-kb__quiz-feedback">{feedback}</p> : null}
      {notaUltima != null && notaUltima < quiz.notaMinima ? (
        <p className="treinamento-kb__quiz-retry">Última tentativa: {notaUltima}%</p>
      ) : null}
      {notaPreview === 100 ? (
        <p className="treinamento-kb__quiz-preview">Pronto para certificar — todas corretas!</p>
      ) : null}
      <button type="button" className="treinamento-kb__complete-btn" onClick={enviar}>
        Enviar avaliação e certificar módulo
      </button>
    </section>
  )
}

export function TreinamentoLojaBrindes({ pontos }: { pontos: number }) {
  return (
    <section className="treinamento-kb__loja" aria-labelledby="kb-loja-title">
      <div className="treinamento-kb__section-head treinamento-kb__section-head--row">
        <div>
          <h2 id="kb-loja-title">Loja de brindes RG</h2>
          <p>Pontos acumulados com certificações e constância — resgate em breve com o RH.</p>
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
              <span className="treinamento-kb__loja-status">{b.disponivel ? 'Resgatar' : 'Em breve'}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function TreinamentoConquistasGrid({ desbloqueadas }: { desbloqueadas: string[] }) {
  return (
    <section className="treinamento-kb__conquistas" aria-labelledby="kb-conquistas-title">
      <div className="treinamento-kb__section-head">
        <h2 id="kb-conquistas-title">Conquistas</h2>
        <p>Medalhas por certificação, trilha completa do perfil e constância.</p>
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
          🎓
        </span>
        <h2 id="kb-celebracao-title">Certificação aprovada!</h2>
        {resultado.notaQuiz != null ? (
          <p className="treinamento-kb__celebracao-nota">Nota {resultado.notaQuiz}%</p>
        ) : null}
        <p className="treinamento-kb__celebracao-xp">+{resultado.xpGanho} XP</p>
        {resultado.novasConquistas.length > 0 ? (
          <ul className="treinamento-kb__celebracao-conquistas">
            {resultado.novasConquistas.map((c) => (
              <li key={c.id}>
                {c.emoji} {c.titulo} (+{c.xpBonus} XP)
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="treinamento-kb__celebracao-btn" onClick={onFechar}>
          Continuar trilha
        </button>
      </div>
    </div>
  )
}

export function TreinamentoModuloBloqueado({
  titulo,
  motivo,
  base,
}: {
  titulo: string
  motivo: 'sem_acesso' | 'prerequisito'
  base: string
}) {
  return (
    <div className="page-shell treinamento-kb treinamento-kb--blocked">
      <div className="treinamento-kb__blocked">
        <span className="treinamento-kb__blocked-icon" aria-hidden>
          🔒
        </span>
        <h1>{titulo}</h1>
        <p>
          {motivo === 'sem_acesso'
            ? 'Este módulo não faz parte da trilha do seu cargo no sistema RG Ambiental.'
            : 'Conclua e certifique o módulo anterior na trilha para desbloquear este conteúdo.'}
        </p>
        <Link to={base} className="treinamento-kb__complete-btn treinamento-kb__complete-btn--link">
          ← Voltar à Academia RG
        </Link>
      </div>
    </div>
  )
}
