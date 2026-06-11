import type { CSSProperties } from 'react'
import { createContext, useContext } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import {
  TreinamentoCardMeta,
  TreinamentoCelebracaoModal,
  TreinamentoConcluirModulo,
  TreinamentoConquistasGrid,
  TreinamentoFlowStepBadge,
  TreinamentoLojaBrindes,
  TreinamentoPainelXp,
  TreinamentoProximoModulo,
  TreinamentoTrilhaProgresso,
} from '../../components/treinamento/TreinamentoGamificacaoUi'
import { useTreinamentoProgresso } from '../../hooks/useTreinamentoProgresso'
import MainLayout from '../../layouts/MainLayout'
import {
  KB_ARTIGOS_ORDENADOS,
  KB_ARTIGO_FLUXO_SLUG,
  KB_FLUXO_ETAPAS,
  KB_SETORES_APOIO,
  KB_SETORES_FLUXO,
  kbArtigoPorSlug,
} from '../../lib/treinamentoKb/conteudo'
import type { KbArtigo, KbCaptura, KbSecao } from '../../lib/treinamentoKb/types'
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

function KbCardGrid({
  artigos,
  isConcluido,
}: {
  artigos: typeof KB_ARTIGOS_ORDENADOS
  isConcluido: (slug: string) => boolean
}) {
  return (
    <div className="treinamento-kb__grid">
      {artigos.map((art) => {
        const done = isConcluido(art.slug)
        return (
          <Link
            key={art.slug}
            to={`${BASE}/${art.slug}`}
            className={`treinamento-kb__card${done ? ' treinamento-kb__card--done' : ''}`}
            style={
              {
                '--kb-accent': art.accent,
                '--kb-accent-soft': art.accentSoft,
              } as CSSProperties
            }
          >
            <TreinamentoCardMeta slug={art.slug} concluido={done} />
            <span className="treinamento-kb__card-emoji" aria-hidden>
              {art.emoji}
            </span>
            <h3>{art.titulo}</h3>
            <p>{art.resumo}</p>
            <ul className="treinamento-kb__card-tags">
              {art.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <span className="treinamento-kb__card-link">
              {done ? 'Revisar guia →' : 'Iniciar missão →'}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function TreinamentoKbIndice() {
  const vis = rhVisual('treinamentos')
  const { stats, isConcluido, celebracao, fecharCelebracao } = useTreinamentoCtx()

  return (
    <div className="page-shell treinamento-kb treinamento-kb--gamified">
      {celebracao ? (
        <TreinamentoCelebracaoModal resultado={celebracao} onFechar={fecharCelebracao} />
      ) : null}

      <nav className="treinamento-kb__breadcrumb" aria-label="Navegação">
        <Link to={RH_HUB_PATH}>RH</Link>
        <span aria-hidden>/</span>
        <span>Treinamentos</span>
      </nav>

      <header
        className="treinamento-kb__hero treinamento-kb__hero--gamified"
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
            <p className="treinamento-kb__eyebrow">Academia RG · Gamificação</p>
            <h1 className="treinamento-kb__title">Treinamentos operacionais</h1>
            <p className="treinamento-kb__lead">
              Aprenda o fluxo da RG Ambiental, ganhe XP, suba de nível e acumule Pontos RG para
              trocar por brindes. Conteúdo visual, passo a passo, pensado para onboarding de
              qualidade.
            </p>
          </div>
        </div>
        <TreinamentoPainelXp stats={stats} />
      </header>

      <TreinamentoTrilhaProgresso percentual={stats.percentualTrilha} />

      <section className="treinamento-kb__flow" aria-labelledby="kb-flow-title">
        <div className="treinamento-kb__section-head">
          <h2 id="kb-flow-title">Trilha principal</h2>
          <p>Complete na ordem recomendada — cada etapa libera XP e aproxima você da certificação.</p>
        </div>
        <div className="treinamento-kb__flow-track">
          {KB_FLUXO_ETAPAS.map((etapa, i) => {
            const done = isConcluido(etapa.artigoSlug)
            return (
              <Link
                key={etapa.artigoSlug}
                to={`${BASE}/${etapa.artigoSlug}`}
                className={`treinamento-kb__flow-step${done ? ' treinamento-kb__flow-step--done' : ''}`}
              >
                <TreinamentoFlowStepBadge concluido={done} />
                <span className="treinamento-kb__flow-emoji" aria-hidden>
                  {etapa.emoji}
                </span>
                <span className="treinamento-kb__flow-num">Missão {etapa.ordem}</span>
                <strong>{etapa.titulo}</strong>
                <span className="treinamento-kb__flow-resumo">{etapa.resumo}</span>
                {i < KB_FLUXO_ETAPAS.length - 1 ? (
                  <span className="treinamento-kb__flow-arrow" aria-hidden>
                    →
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
        <Link to={`${BASE}/${KB_ARTIGO_FLUXO_SLUG}`} className="treinamento-kb__flow-cta">
          Visão geral do fluxo completo →
        </Link>
      </section>

      <section className="treinamento-kb__sectors" aria-labelledby="kb-sectors-title">
        <div className="treinamento-kb__section-head">
          <h2 id="kb-sectors-title">Módulos — fluxo operacional</h2>
          <p>Manuais detalhados com capturas reais do sistema.</p>
        </div>
        <KbCardGrid artigos={KB_SETORES_FLUXO} isConcluido={isConcluido} />
      </section>

      <section className="treinamento-kb__sectors" aria-labelledby="kb-apoio-title">
        <div className="treinamento-kb__section-head">
          <h2 id="kb-apoio-title">Setores de apoio</h2>
          <p>Cadastro, frota e conferência — missões complementares.</p>
        </div>
        <div className="treinamento-kb__flow-track treinamento-kb__flow-track--apoio">
          {KB_SETORES_APOIO.map((etapa) => {
            const done = isConcluido(etapa.artigoSlug)
            return (
              <Link
                key={etapa.artigoSlug}
                to={`${BASE}/${etapa.artigoSlug}`}
                className={`treinamento-kb__flow-step${done ? ' treinamento-kb__flow-step--done' : ''}`}
              >
                <TreinamentoFlowStepBadge concluido={done} />
                <span className="treinamento-kb__flow-emoji" aria-hidden>
                  {etapa.emoji}
                </span>
                <strong>{etapa.titulo}</strong>
                <span className="treinamento-kb__flow-resumo">{etapa.resumo}</span>
              </Link>
            )
          })}
        </div>
      </section>

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

function SecaoKb({ secao }: { secao: KbSecao }) {
  return (
    <section id={secao.id} className="treinamento-kb__article-section">
      <h2>{secao.titulo}</h2>
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

function TreinamentoKbArtigo({ artigo }: { artigo: KbArtigo }) {
  const { isConcluido, concluirModulo, celebracao, fecharCelebracao } = useTreinamentoCtx()
  const concluido = isConcluido(artigo.slug)

  return (
    <div className="page-shell treinamento-kb treinamento-kb--article treinamento-kb--gamified">
      {celebracao ? (
        <TreinamentoCelebracaoModal resultado={celebracao} onFechar={fecharCelebracao} />
      ) : null}

      <nav className="treinamento-kb__breadcrumb" aria-label="Navegação">
        <Link to={RH_HUB_PATH}>RH</Link>
        <span aria-hidden>/</span>
        <Link to={BASE}>Treinamentos</Link>
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
          <TreinamentoCardMeta slug={artigo.slug} concluido={concluido} />
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

      <div className="treinamento-kb__article-layout">
        <nav className="treinamento-kb__toc" aria-label="Índice do artigo">
          <h2>Neste guia</h2>
          <ul>
            {artigo.secoes.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.titulo}</a>
              </li>
            ))}
          </ul>
          <h2>Outros módulos</h2>
          <ul>
            {KB_ARTIGOS_ORDENADOS.filter((a) => a.slug !== artigo.slug).map((a) => (
              <li key={a.slug}>
                <Link to={`${BASE}/${a.slug}`}>
                  {a.emoji} {a.titulo}
                  {isConcluido(a.slug) ? ' ✓' : ''}
                </Link>
              </li>
            ))}
          </ul>
          <TreinamentoConcluirModulo
            slug={artigo.slug}
            titulo={artigo.titulo}
            concluido={concluido}
            onConcluir={() => concluirModulo(artigo.slug)}
          />
          <Link to={BASE} className="treinamento-kb__back">
            ← Academia RG
          </Link>
        </nav>

        <article className="treinamento-kb__article-body">
          {artigo.slug === KB_ARTIGO_FLUXO_SLUG ? (
            <div className="treinamento-kb__flow treinamento-kb__flow--inline">
              <div className="treinamento-kb__flow-track">
                {KB_FLUXO_ETAPAS.map((etapa, i) => (
                  <Link
                    key={etapa.artigoSlug}
                    to={`${BASE}/${etapa.artigoSlug}`}
                    className="treinamento-kb__flow-step treinamento-kb__flow-step--compact"
                  >
                    <span className="treinamento-kb__flow-emoji">{etapa.emoji}</span>
                    <strong>{etapa.titulo}</strong>
                    {i < KB_FLUXO_ETAPAS.length - 1 ? (
                      <span className="treinamento-kb__flow-arrow">→</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {artigo.secoes.map((sec) => (
            <SecaoKb key={sec.id} secao={sec} />
          ))}
          <TreinamentoConcluirModulo
            slug={artigo.slug}
            titulo={artigo.titulo}
            concluido={concluido}
            onConcluir={() => concluirModulo(artigo.slug)}
          />
          <TreinamentoProximoModulo
            artigoAtual={artigo}
            artigos={KB_ARTIGOS_ORDENADOS}
            base={BASE}
            isConcluido={isConcluido}
          />
        </article>
      </div>
    </div>
  )
}

function TreinamentoKbArtigoRoute() {
  const { artigoSlug } = useParams<{ artigoSlug: string }>()
  const artigo = kbArtigoPorSlug(artigoSlug)
  if (!artigo) return <Navigate to={BASE} replace />
  return <TreinamentoKbArtigo artigo={artigo} />
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

/** KB de treinamento operacional gamificada — montada em `/rh/treinamentos/*`. */
export default function RhTreinamentosArea() {
  const progresso = useTreinamentoProgresso()

  return (
    <MainLayout>
      <TreinamentoProgressoContext.Provider value={progresso}>
        <TreinamentoRoutes />
      </TreinamentoProgressoContext.Provider>
    </MainLayout>
  )
}
