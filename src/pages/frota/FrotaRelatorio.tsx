import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FrotaAssinaturaBloco } from '../../components/frota/FrotaAssinaturaBloco'
import { rgAlert } from '../../lib/RgDialogProvider'
import { fetchDadosRelatorioFrota } from '../../lib/frotaApi'
import { FROTA_HUB_LABEL, FROTA_HUB_PATH, FROTA_TIPOS_MOVIMENTACAO } from '../../lib/frotaModulos'
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

  const labelTipo = (id: string) => FROTA_TIPOS_MOVIMENTACAO.find((t) => t.id === id)?.label ?? id

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
              Imprimir
            </button>
          </div>
          {erroCarga ? (
            <p className="frota-relatorio-erro" role="alert">
              {erroCarga}
            </p>
          ) : null}
        </section>

        <article id="frota-relatorio-impressao" className="frota-relatorio-print print-area-frota">
          <header className="frota-relatorio-print__head">
            <h1>Relatório operacional — Frota RG Ambiental</h1>
            <p>Período: {formatarPeriodo(de, ate)}</p>
            <p className="frota-relatorio-print__meta">
              Movimentações: {mov.length} · Manutenções: {man.length} · Diários: {dia.length}
            </p>
          </header>

          <section>
            <h2>Movimentação de equipamentos</h2>
            {mov.length === 0 ? (
              <p className="frota-muted">Nenhum registo no período.</p>
            ) : (
              <div className="frota-table-wrap">
                <table className="frota-table frota-table--compact">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Cliente</th>
                      <th>Equipamento</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mov.map((m) => (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>{labelTipo(m.tipo_movimentacao)}</td>
                        <td>{m.cliente_nome}</td>
                        <td>{m.equipamento_descricao}</td>
                        <td>{m.assinatura_responsavel_nome ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2>Manutenção</h2>
            {man.length === 0 ? (
              <p className="frota-muted">Nenhum registo no período.</p>
            ) : (
              <div className="frota-table-wrap">
                <table className="frota-table frota-table--compact">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Veículo</th>
                      <th>Tipo</th>
                      <th>Serviço</th>
                      <th>Km</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {man.map((m) => (
                      <tr key={m.id}>
                        <td>{m.realizado_em}</td>
                        <td>{m.caminhao_placa ?? '—'}</td>
                        <td>{m.tipo_manutencao}</td>
                        <td>{m.titulo}</td>
                        <td>{m.km_atual?.toLocaleString('pt-BR') ?? '—'}</td>
                        <td>{m.assinatura_responsavel_nome ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2>Diário dos veículos</h2>
            {dia.length === 0 ? (
              <p className="frota-muted">Nenhum diário no período.</p>
            ) : (
              <div className="frota-table-wrap">
                <table className="frota-table frota-table--compact">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Placa</th>
                      <th>Km</th>
                      <th>Óleo (km)</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dia.map((d) => (
                      <tr key={d.id}>
                        <td>{d.data_diario}</td>
                        <td>{d.caminhao_placa ?? '—'}</td>
                        <td>{d.km_odometro?.toLocaleString('pt-BR') ?? '—'}</td>
                        <td>{d.ultima_troca_oleo_km?.toLocaleString('pt-BR') ?? '—'}</td>
                        <td>{d.assinatura_responsavel_nome ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="frota-relatorio-print__assinatura">
            {assinado ? (
              <>
                <p>
                  <strong>Assinado por:</strong> {assNome} — {assCargo}
                </p>
                <p>
                  <strong>Data/hora:</strong> {assinaturaEm}
                </p>
                <div className="frota-relatorio-print__linha-ass" />
              </>
            ) : (
              <p className="frota-muted">Assinatura pendente (preencha abaixo antes de imprimir).</p>
            )}
          </footer>
        </article>

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

      <style>{`
        @media print {
          .frota-page__head--print-hide,
          .layout-sidebar,
          .layout-header { display: none !important; }
          body * { visibility: hidden; }
          .print-area-frota, .print-area-frota * { visibility: visible; }
          .print-area-frota {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            padding: 12mm;
            background: #fff;
          }
        }
      `}</style>
    </MainLayout>
  )
}
