import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FrotaAssinaturaBloco } from '../../components/frota/FrotaAssinaturaBloco'
import {
  FrotaRelatorioPrintDocument,
  type FrotaRelatorioPrintDocumentProps,
} from '../../components/frota/FrotaRelatorioPrintDocument'
import { rgAlert } from '../../lib/RgDialogProvider'
import { fetchDadosRelatorioFrota } from '../../lib/frotaApi'
import { FROTA_HUB_LABEL, FROTA_HUB_PATH } from '../../lib/frotaModulos'
import type { FrotaDiarioRow, FrotaManutencaoRow, FrotaMovimentacaoRow } from '../../lib/frotaTypes'
import { supabase } from '../../lib/supabase'
import { isBenignSupabaseFetchError, mensagemErroSupabase } from '../../lib/supabaseErrors'
import { FrotaPermissaoAviso } from '../../components/frota/FrotaPermissaoAviso'
import { useFrotaPermissoes } from '../../hooks/useFrotaPermissoes'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function inicioMesIso() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatarPeriodo(de: string, ate: string) {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  return `${fmt(de)} a ${fmt(ate)}`
}

export default function FrotaRelatorio() {
  const { podeRelatorio } = useFrotaPermissoes()
  const [de, setDe] = useState(() => inicioMesIso())
  const [ate, setAte] = useState(() => hojeIso())
  const [mov, setMov] = useState<FrotaMovimentacaoRow[]>([])
  const [man, setMan] = useState<FrotaManutencaoRow[]>([])
  const [dia, setDia] = useState<FrotaDiarioRow[]>([])
  const [loading, setLoading] = useState(false)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [carregado, setCarregado] = useState(false)
  const [geradoEm, setGeradoEm] = useState('')
  const [assNome, setAssNome] = useState('')
  const [assCargo, setAssCargo] = useState('')
  const [assinado, setAssinado] = useState(false)
  const [assinaturaEm, setAssinaturaEm] = useState('')

  const gerar = useCallback(async () => {
    setLoading(true)
    setErroCarga(null)
    setAssinado(false)
    try {
      const d = await fetchDadosRelatorioFrota(de, ate)
      setMov(d.movimentacoes)
      setMan(d.manutencoes)
      setDia(d.diarios)
      setGeradoEm(
        new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date())
      )
      setCarregado(true)
    } catch (e) {
      if (isBenignSupabaseFetchError(e as { message?: string; name?: string })) {
        return
      }
      const msg = mensagemErroSupabase(e, 'Falha ao carregar dados.')
      setErroCarga(msg)
      setMov([])
      setMan([])
      setDia([])
      setCarregado(false)
      setGeradoEm('')
      await rgAlert({ title: 'Erro', message: msg, variant: 'danger' })
    } finally {
      setLoading(false)
    }
  }, [de, ate])

  useEffect(() => {
    void gerar()
  }, [gerar])

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('nome, cargo').eq('id', user.id).maybeSingle()
      setAssNome(String(data?.nome ?? user.email ?? '').trim())
      setAssCargo(String(data?.cargo ?? '').trim())
    })()
  }, [])

  function confirmarAssinatura() {
    if (!podeRelatorio) return
    if (!assNome.trim()) {
      void rgAlert({ title: 'Assinatura', message: 'Informe o nome do responsável RG.' })
      return
    }
    setAssinado(true)
    setAssinaturaEm(new Date().toLocaleString('pt-BR'))
  }

  const relatorioDocumentProps = useMemo((): FrotaRelatorioPrintDocumentProps => {
    return {
      periodoLabel: formatarPeriodo(de, ate),
      geradoEm: geradoEm || '—',
      movimentacoes: mov,
      manutencoes: man,
      diarios: dia,
      assinado,
      assNome,
      assCargo,
      assinaturaEm,
    }
  }, [de, ate, geradoEm, mov, man, dia, assinado, assNome, assCargo, assinaturaEm])

  return (
    <MainLayout>
      <div className="page-shell frota-page">
        <nav className="rh-modulo__breadcrumb frota-page__head--print-hide" aria-label="Navegação">
          <Link to={FROTA_HUB_PATH}>{FROTA_HUB_LABEL}</Link>
          <span className="rh-modulo__breadcrumb-sep" aria-hidden>
            /
          </span>
          <span>Relatório da frota</span>
        </nav>

        <header className="frota-page__head frota-page__head--row frota-page__head--print-hide">
          <div>
            <p className="frota-page__eyebrow">{FROTA_HUB_LABEL}</p>
            <h1>Relatório da frota</h1>
            <p className="frota-page__lead">Consolidação para conferência e impressão com assinatura.</p>
          </div>
        </header>

        <FrotaPermissaoAviso somenteLeitura={!podeRelatorio} />

        <section className="frota-card frota-relatorio-toolbar frota-page__head--print-hide">
          <div className="frota-form-grid frota-relatorio-toolbar__grid">
            <label>
              <span>De</span>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </label>
            <label>
              <span>Até</span>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </label>
          </div>
          <div className="frota-form-actions frota-relatorio-toolbar__actions">
            <button
              type="button"
              className="frota-btn frota-btn--primary"
              onClick={() => void gerar()}
              disabled={loading}
            >
              {loading ? 'A carregar…' : 'Atualizar relatório'}
            </button>
            <button
              type="button"
              className="frota-btn frota-btn--ghost"
              onClick={() => window.print()}
              disabled={!podeRelatorio || loading || !carregado}
            >
              Imprimir / PDF
            </button>
          </div>
          {erroCarga ? (
            <p className="frota-relatorio-erro" role="alert">
              {erroCarga}
            </p>
          ) : null}
        </section>

        {carregado ? (
          <div className="frota-relatorio-preview frota-page__head--print-hide" aria-label="Pré-visualização do relatório">
            <FrotaRelatorioPrintDocument {...relatorioDocumentProps} />
          </div>
        ) : null}

        <section className="frota-card frota-page__head--print-hide">
          <h2>Assinatura do relatório</h2>
          <FrotaAssinaturaBloco
            nome={assNome}
            cargo={assCargo}
            onNome={setAssNome}
            onCargo={setAssCargo}
            disabled={!podeRelatorio}
          />
          <div className="frota-form-actions">
            <button
              type="button"
              className="frota-btn frota-btn--primary"
              disabled={!podeRelatorio}
              onClick={confirmarAssinatura}
            >
              Confirmar assinatura no relatório
            </button>
          </div>
        </section>
      </div>

      {carregado
        ? createPortal(<FrotaRelatorioPrintDocument {...relatorioDocumentProps} />, document.body)
        : null}
    </MainLayout>
  )
}
