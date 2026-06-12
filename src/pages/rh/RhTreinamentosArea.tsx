import type { CSSProperties } from 'react'
import { createContext, useContext, useEffect, useRef } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import {
  TreinamentoCelebracaoModal,
  TreinamentoConquistasGrid,
  TreinamentoCurriculum,
  TreinamentoLeituraProgresso,
  TreinamentoLojaBrindes,
  TreinamentoModuloBloqueado,
  TreinamentoPainelXp,
  TreinamentoQuiz,
  TreinamentoTrilhaProgresso,
} from '../../components/treinamento/TreinamentoGamificacaoUi'
import { TreinamentoPlantaProgresso } from '../../components/treinamento/TreinamentoPlantaProgresso'
import { useTreinamentoProgresso } from '../../hooks/useTreinamentoProgresso'
import MainLayout from '../../layouts/MainLayout'
import { kbArtigoPorSlug } from '../../lib/treinamentoKb/conteudo'
import { kbUsuarioPodeVerArtigo } from '../../lib/treinamentoKb/treinamentoAcesso'
import type { KbCaptura, KbSecao } from '../../lib/treinamentoKb/types'
import { RH_HUB_PATH } from '../../lib/rhModulos'
import { RhModuloIcon } from './RhModuloIcon'
import { rhVisual } from './rhModuloVisual'

const BASE = '/rh/treinamentos'

type TreinamentoCtx = ReturnType<typeof useTreinamentoProgresso>

const TreinamentoProgressoContext = createContext<TreinamentoCtx | null>(null)

function useTreinamentoCtx() {
  const ctx = useContext(TreinamentoProgressoContext)
  if (!ctx) throw new Error('TreinamentoProgressoContext ausente')
  return ctx
}

function TreinamentoKbIndice() {
  const vis = rhVisual('treinamentos')
  const {
    stats,
    curriculum,
    celebracao,
    fecharCelebracao,
    statusModulo,
    progressoLeitura,
  } = useTreinamentoCtx()

  return (
    <div className="page-shell treinamento-kb treinamento-kb--gamified treinamento-kb--course">
      {celebracao ? (
        <TreinamentoCelebracaoModal resultado={celebracao} onFechar={fecharCelebracao} />
      ) : null}

      <nav className="treinamento-kb__breadcrumb" aria-label="Navegação">
        <Link to={RH_HUB_PATH}>RH</Link>
        <span aria-hidden>/</span>
        <span>Academia RG</span>
      </nav>

      <header
        className="treinamento-kb__hero treinamento-kb__hero--gamified treinamento-kb__hero--course"
        style={
          {
            '--kb-accent': vis.accent,
            '--kb-accent-soft': vis.accentSoft,
          } as CSSProperties
        }
      >
        <div className="treinamento-kb__hero-main">
          <div className="treinamento-kb__hero-icon">
            <RhModuloIcon slug="treinamentos" />
          </div>
          <div className="treinamento-kb__hero-copy">
            <p className="treinamento-kb__eyebrow">Curso corporativo · Certificação RG</p>
            <h1 className="treinamento-kb__title">Academia RG Ambiental</h1>
            <p className="treinamento-kb__lead">
              Trilha de desenvolvimento personalizada pelo seu cargo. Cada módulo exige leitura
              completa, avaliação aprovada e desbloqueio sequencial — como um curso profissional,
              com Pontos RG para brindes futuros.
            </p>
          </div>
        </div>
        <TreinamentoPainelXp stats={stats} />
      </header>

      <TreinamentoTrilhaProgresso
        percentual={stats.percentualTrilha}
        modulosConcluidos={stats.modulosConcluidos}
        totalModulos={stats.totalModulos}
      />

      <TreinamentoCurriculum
        artigos={curriculum}
        base={BASE}
        statusModulo={statusModulo}
        progressoLeitura={progressoLeitura}
      />

      <TreinamentoConquistasGrid desbloqueadas={stats.conquistasDesbloqueadas} />
      <TreinamentoLojaBrindes pontos={stats.pontosResgate} />
    </div>
  )
}

function CapturasKb({ capturas }: { capturas: KbCaptura[] }) {
  if (capturas.length === 0) return null
  return (
    <div className="treinamento-kb__capturas">
      {capturas.map((cap) => (
        <figure key={cap.src} className="treinamento-kb__figure">
          <img src={cap.src} alt={cap.alt} loading="lazy" decoding="async" />
          {cap.legenda ? <figcaption>{cap.legenda}</figcaption> : null}
        </figure>
      ))}
    </div>
  )
}

function SecaoKb({
  secao,
  lida,
  onVisible,
}: {
  secao: KbSecao
  lida: boolean
  onVisible: (secaoId: string) => void
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || lida) return

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.6)) {
          onVisible(secao.id)
        }
      },
      { threshold: [0.6] },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [secao.id, lida, onVisible])

  return (
    <section
      ref={ref}
      id={secao.id}
      className={`treinamento-kb__article-section${lida ? ' treinamento-kb__article-section--read' : ''}`}
    >
      <div className="treinamento-kb__section-title-row">
        <h2>{secao.titulo}</h2>
        {lida ? <span className="treinamento-kb__section-read">✓ Lida</span> : null}
      </div>
      {secao.paragrafos?.map((p) => (
        <p key={p.slice(0, 40)} className="treinamento-kb__p">
          {p}
        </p>
      ))}
      {secao.passos && secao.passos.length > 0 ? (
        <ol className="treinamento-kb__steps">
          {secao.passos.map((passo) => (
            <li key={passo.titulo}>
              <strong>{passo.titulo}</strong>
              <p>{passo.descricao}</p>
              {passo.dica ? <p className="treinamento-kb__tip-inline">💡 {passo.dica}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {secao.campos && secao.campos.length > 0 ? (
        <div className="treinamento-kb__table-wrap">
          <table className="treinamento-kb__table">
            <thead>
              <tr>
                <th>Campo</th>
                <th>O que significa</th>
              </tr>
            </thead>
            <tbody>
              {secao.campos.map((c) => (
                <tr key={c.nome}>
                  <td>{c.nome}</td>
                  <td>{c.significado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {secao.capturas && secao.capturas.length > 0 ? (
        <CapturasKb capturas={secao.capturas} />
      ) : null}
      {secao.dicas && secao.dicas.length > 0 ? (
        <ul className="treinamento-kb__tips">
          {secao.dicas.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      {secao.aviso ? (
        <p className="treinamento-kb__warn" role="note">
          ⚠️ {secao.aviso}
        </p>
      ) : null}
    </section>
  )
}

function TreinamentoKbArtigoRoute() {
  const { artigoSlug } = useParams<{ artigoSlug: string }>()
  const artigo = kbArtigoPorSlug(artigoSlug)
  const ctx = useTreinamentoCtx()
  const {
    usuario,
    isConcluido,
    statusModulo,
    marcarSecaoLida,
    secoesLidasDoModulo,
    leituraCompleta,
    progressoLeitura,
    certificarModuloQuiz,
    celebracao,
    fecharCelebracao,
    curriculum,
  } = ctx

  if (!artigo) return <Navigate to={BASE} replace />

  if (!kbUsuarioPodeVerArtigo(artigo.slug, usuario)) {
    return <TreinamentoModuloBloqueado titulo={artigo.titulo} motivo="sem_acesso" base={BASE} />
  }

  const status = statusModulo(artigo.slug)
  if (status === 'bloqueado_prereq') {
    return <TreinamentoModuloBloqueado titulo={artigo.titulo} motivo="prerequisito" base={BASE} />
  }

  const concluido = isConcluido(artigo.slug)
  const lidas = secoesLidasDoModulo(artigo.slug)
  const prog = progressoLeitura(artigo.slug)

  return (
    <div className="page-shell treinamento-kb treinamento-kb--article treinamento-kb--gamified">
      {celebracao ? (
        <TreinamentoCelebracaoModal resultado={celebracao} onFechar={fecharCelebracao} />
      ) : null}

      <nav className="treinamento-kb__breadcrumb" aria-label="Navegação">
        <Link to={RH_HUB_PATH}>RH</Link>
        <span aria-hidden>/</span>
        <Link to={BASE}>Academia RG</Link>
        <span aria-hidden>/</span>
        <span>{artigo.titulo}</span>
      </nav>

      <header
        className="treinamento-kb__article-hero"
        style={
          {
            '--kb-accent': artigo.accent,
            '--kb-accent-soft': artigo.accentSoft,
          } as CSSProperties
        }
      >
        <span className="treinamento-kb__article-emoji" aria-hidden>
          {artigo.emoji}
        </span>
        <div>
          <h1>{artigo.titulo}</h1>
          <p className="treinamento-kb__article-lead">{artigo.resumo}</p>
          <ul className="treinamento-kb__card-tags">
            {artigo.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        {artigo.rotaSistema ? (
          <Link to={artigo.rotaSistema.path} className="treinamento-kb__system-link">
            {artigo.rotaSistema.label} ↗
          </Link>
        ) : null}
      </header>

      <TreinamentoLeituraProgresso lidas={prog.lidas} total={prog.total} percentual={prog.percentual} />

      <div className="treinamento-kb__article-layout">
        <nav className="treinamento-kb__toc" aria-label="Índice do artigo">
          <h2>Neste módulo</h2>
          <ul>
            {artigo.secoes.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  {lidas.includes(s.id) ? '✓ ' : ''}
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
          <h2>Sua trilha</h2>
          <ul>
            {curriculum.map((a) => (
              <li key={a.slug}>
                <Link to={`${BASE}/${a.slug}`}>
                  {a.emoji} {a.titulo}
                  {isConcluido(a.slug) ? ' ✓' : ''}
                </Link>
              </li>
            ))}
          </ul>
          <Link to={BASE} className="treinamento-kb__back">
            ← Academia RG
          </Link>
        </nav>

        <article className="treinamento-kb__article-body">
          {artigo.secoes.map((sec) => (
            <SecaoKb
              key={sec.id}
              secao={sec}
              lida={lidas.includes(sec.id)}
              onVisible={(id) => marcarSecaoLida(artigo.slug, id)}
            />
          ))}

          <TreinamentoQuiz
            slug={artigo.slug}
            leituraCompleta={leituraCompleta(artigo.slug)}
            concluido={concluido}
            onCertificar={(respostas) => certificarModuloQuiz(artigo.slug, respostas)}
          />
        </article>
      </div>
    </div>
  )
}

function TreinamentoRoutes() {
  return (
    <Routes>
      <Route index element={<TreinamentoKbIndice />} />
      <Route path=":artigoSlug" element={<TreinamentoKbArtigoRoute />} />
      <Route path="*" element={<Navigate to={BASE} replace />} />
    </Routes>
  )
}

/** Academia RG — curso gamificado por cargo em `/rh/treinamentos/*`. */
export default function RhTreinamentosArea() {
  const progresso = useTreinamentoProgresso()

  return (
    <MainLayout>
      <TreinamentoProgressoContext.Provider value={progresso}>
        <TreinamentoPlantaProgresso percentual={progresso.stats.percentualTrilha} />
        <TreinamentoRoutes />
      </TreinamentoProgressoContext.Provider>
    </MainLayout>
  )
}
