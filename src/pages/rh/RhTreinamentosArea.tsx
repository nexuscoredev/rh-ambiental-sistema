import type { CSSProperties } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
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
import { rhVisual } from './rhModuloVisual'
import { RhModuloIcon } from './RhModuloIcon'

const BASE = '/rh/treinamentos'

function KbCardGrid({ artigos }: { artigos: typeof KB_ARTIGOS_ORDENADOS }) {
  return (
    <div className="treinamento-kb__grid">
      {artigos.map((art) => (
        <Link
          key={art.slug}
          to={`${BASE}/${art.slug}`}
          className="treinamento-kb__card"
          style={
            {
              '--kb-accent': art.accent,
              '--kb-accent-soft': art.accentSoft,
            } as CSSProperties
          }
        >
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
          <span className="treinamento-kb__card-link">Abrir guia →</span>
        </Link>
      ))}
    </div>
  )
}

function TreinamentoKbIndice() {
  const vis = rhVisual('treinamentos')

  return (
    <div className="page-shell treinamento-kb">
      <nav className="treinamento-kb__breadcrumb" aria-label="Navegação">
        <Link to={RH_HUB_PATH}>RH</Link>
        <span aria-hidden>/</span>
        <span>Treinamentos</span>
      </nav>

      <header
        className="treinamento-kb__hero"
        style={
          {
            '--kb-accent': vis.accent,
            '--kb-accent-soft': vis.accentSoft,
          } as CSSProperties
        }
      >
        <div className="treinamento-kb__hero-icon">
          <RhModuloIcon slug="treinamentos" />
        </div>
        <div className="treinamento-kb__hero-copy">
          <p className="treinamento-kb__eyebrow">Base de conhecimento · Onboarding</p>
          <h1 className="treinamento-kb__title">Treinamentos operacionais</h1>
          <p className="treinamento-kb__lead">
            Aprenda o fluxo completo da RG Ambiental — da programação da coleta até o financeiro.
            Conteúdo por setor, passo a passo, com linguagem simples para novos colaboradores.
          </p>
        </div>
      </header>

      <section className="treinamento-kb__flow" aria-labelledby="kb-flow-title">
        <div className="treinamento-kb__section-head">
          <h2 id="kb-flow-title">Fluxo completo</h2>
          <p>Clique em cada etapa para abrir o guia detalhado.</p>
        </div>
        <div className="treinamento-kb__flow-track">
          {KB_FLUXO_ETAPAS.map((etapa, i) => (
            <Link
              key={etapa.artigoSlug}
              to={`${BASE}/${etapa.artigoSlug}`}
              className="treinamento-kb__flow-step"
            >
              <span className="treinamento-kb__flow-emoji" aria-hidden>
                {etapa.emoji}
              </span>
              <span className="treinamento-kb__flow-num">{etapa.ordem}</span>
              <strong>{etapa.titulo}</strong>
              <span className="treinamento-kb__flow-resumo">{etapa.resumo}</span>
              {i < KB_FLUXO_ETAPAS.length - 1 ? (
                <span className="treinamento-kb__flow-arrow" aria-hidden>
                  →
                </span>
              ) : null}
            </Link>
          ))}
        </div>
        <Link to={`${BASE}/${KB_ARTIGO_FLUXO_SLUG}`} className="treinamento-kb__flow-cta">
          Ler guia do fluxo completo →
        </Link>
      </section>

      <section className="treinamento-kb__sectors" aria-labelledby="kb-sectors-title">
        <div className="treinamento-kb__section-head">
          <h2 id="kb-sectors-title">Por setor — fluxo operacional</h2>
          <p>Manuais detalhados: o que é, como fazer, campos e dicas.</p>
        </div>
        <KbCardGrid artigos={KB_SETORES_FLUXO} />
      </section>

      <section className="treinamento-kb__sectors" aria-labelledby="kb-apoio-title">
        <div className="treinamento-kb__section-head">
          <h2 id="kb-apoio-title">Setores de apoio</h2>
          <p>Cadastro, frota e conferência — suportam o fluxo principal.</p>
        </div>
        <div className="treinamento-kb__flow-track treinamento-kb__flow-track--apoio">
          {KB_SETORES_APOIO.map((etapa) => (
            <Link
              key={etapa.artigoSlug}
              to={`${BASE}/${etapa.artigoSlug}`}
              className="treinamento-kb__flow-step"
            >
              <span className="treinamento-kb__flow-emoji" aria-hidden>
                {etapa.emoji}
              </span>
              <strong>{etapa.titulo}</strong>
              <span className="treinamento-kb__flow-resumo">{etapa.resumo}</span>
            </Link>
          ))}
        </div>
      </section>
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
  return (
    <div className="page-shell treinamento-kb treinamento-kb--article">
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
          <h2>Outros setores</h2>
          <ul>
            {KB_ARTIGOS_ORDENADOS.filter((a) => a.slug !== artigo.slug).map((a) => (
              <li key={a.slug}>
                <Link to={`${BASE}/${a.slug}`}>
                  {a.emoji} {a.titulo}
                </Link>
              </li>
            ))}
          </ul>
          <Link to={BASE} className="treinamento-kb__back">
            ← Índice
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

/** KB de treinamento operacional — montada em `/rh/treinamentos/*`. */
export default function RhTreinamentosArea() {
  return (
    <MainLayout>
      <Routes>
        <Route index element={<TreinamentoKbIndice />} />
        <Route path=":artigoSlug" element={<TreinamentoKbArtigoRoute />} />
        <Route path="*" element={<Navigate to={BASE} replace />} />
      </Routes>
    </MainLayout>
  )
}
