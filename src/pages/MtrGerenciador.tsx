import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClienteGerenciadorHistoricoMtr } from '../components/clientes/ClienteGerenciadorHistoricoMtr'
import { MtrGerenciadorRelatorio } from '../components/mtr/MtrGerenciadorRelatorio'
import { lerMtrsNaoEncontradasEnvio } from '../lib/gerenciadorMtrEnvio'
import MainLayout from '../layouts/MainLayout'

function scrollParaHistoricoMtr() {
  const el = document.getElementById('historico-mtr-baixadas')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function MtrGerenciador() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [relatorioKey, setRelatorioKey] = useState(0)

  const mostrarHistorico = searchParams.get('historico') === '1'
  const baixarMtrId = searchParams.get('baixarMtr')
  const focusMtrId = searchParams.get('focusMtr')
  const baixarMtrNumero = searchParams.get('mtrNumero') ?? ''
  const focusMtrNumeros = useMemo(() => {
    const daUrl = (searchParams.get('mtrPendentes') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const doStorage = lerMtrsNaoEncontradasEnvio()
    return [...new Set([...daUrl, ...doStorage])]
  }, [searchParams])
  const historicoScrollFeito = useRef(false)

  useEffect(() => {
    if (searchParams.get('historico') === '1' || searchParams.get('baixarMtr') || searchParams.get('focusMtr')) return
    setSearchParams({ historico: '1' }, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!mostrarHistorico && !baixarMtrId) return
    if (historicoScrollFeito.current) return
    historicoScrollFeito.current = true
    const t = window.setTimeout(scrollParaHistoricoMtr, 120)
    return () => window.clearTimeout(t)
  }, [mostrarHistorico, baixarMtrId])

  const limparParamsBaixa = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('baixarMtr')
    next.delete('focusMtr')
    next.delete('mtrNumero')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  return (
    <MainLayout>
      <div
        className="rg-page"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0 }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: "var(--text-primary, #0f172a)" }}>
              MTR Gerenciador
            </h1>
            <p className="page-header__lead" style={{ margin: '6px 0 0' }}>
              Relatório das MTRs baixadas e encaminhamento para faturamento, mala direta e financeiro.
            </p>
          </div>
          <Link
            to="/clientes/gerenciador"
            className="rg-btn rg-btn--outline"
            style={{ textDecoration: 'none', flexShrink: 0 }}
          >
            Cadastro Gerenciador
          </Link>
        </div>

        {(mostrarHistorico || baixarMtrId) ? (
          <div
            className="panel"
            style={{
              margin: 0,
              width: '100%',
              background: "var(--bg-card, #ffffff)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            <div className="panel-header" style={{ padding: '14px 18px' }}>
              <h2 style={{ margin: 0, fontSize: '16px' }}>Confirmar baixa de MTR</h2>
            </div>
            <div className="panel-body" style={{ padding: '16px 18px' }}>
              <ClienteGerenciadorHistoricoMtr
                baixarMtrId={baixarMtrId}
                baixarMtrNumero={baixarMtrNumero}
                onBaixaConcluida={() => {
                  limparParamsBaixa()
                  setRelatorioKey((k) => k + 1)
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          className="panel"
          style={{
            margin: 0,
            width: '100%',
            background: "var(--bg-card, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <div className="panel-header" style={{ padding: '14px 18px' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>Relatório — MTRs baixadas</h2>
          </div>
          <div className="panel-body" style={{ padding: '16px 18px' }}>
            <MtrGerenciadorRelatorio
              key={relatorioKey}
              focusMtrId={focusMtrId}
              focusMtrNumeros={focusMtrNumeros}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
