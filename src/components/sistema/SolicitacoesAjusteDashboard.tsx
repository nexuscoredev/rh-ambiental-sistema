import { useEffect, useId, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  carregarDashboardSolicitacoes,
  coresDonutSolicitacoes,
  type DashboardSolicitacoesDados,
  type PeriodoDashboardSolicitacoes,
} from '../../lib/solicitacaoAjusteDashboard'
import { gerarRelatorioDashboardSolicitacoesPdf } from '../../lib/gerarRelatorioDashboardSolicitacoesPdf'
import type { ChatUsuarioLista } from '../../types/chat'
import { useVersaoRgExibir } from '../../lib/appDisplayVersion'
import { RgReportPdfIcon } from '../ui/RgReportPdfIcon'

type Props = {
  usuarios: ChatUsuarioLista[]
}

const PERIODOS: { id: PeriodoDashboardSolicitacoes; label: string }[] = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'ano', label: 'Ano' },
]

export function SolicitacoesAjusteDashboard({ usuarios }: Props) {
  const chartUid = useId().replace(/:/g, '')
  const versaoExibir = useVersaoRgExibir()
  const [periodo, setPeriodo] = useState<PeriodoDashboardSolicitacoes>('mes')
  const [dados, setDados] = useState<DashboardSolicitacoesDados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const usuariosPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios])

  useEffect(() => {
    let cancel = false
    setCarregando(true)
    setErro('')
    void (async () => {
      try {
        const d = await carregarDashboardSolicitacoes(usuariosPorId, periodo, versaoExibir)
        if (!cancel) setDados(d)
      } catch (e) {
        if (!cancel) {
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar o dashboard.')
          setDados(null)
        }
      } finally {
        if (!cancel) setCarregando(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [usuariosPorId, periodo, versaoExibir])

  const donutDev = dados?.porColaboradorDev ?? []
  const donutSol = dados?.porSolicitante ?? []
  const cores = coresDonutSolicitacoes()

  function exportarPdfGestao() {
    if (!dados || gerandoPdf) return
    setGerandoPdf(true)
    void (async () => {
      try {
        await gerarRelatorioDashboardSolicitacoesPdf({ dados, periodo })
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.')
      } finally {
        setGerandoPdf(false)
      }
    })()
  }

  return (
    <section className="solicitacoes-admin__dashboard" role="tabpanel" aria-label="Dashboard de solicitações">
      <div className="solicitacoes-admin__dashboard-toolbar">
        <div>
          <h2>Relatório operacional</h2>
          <p>
            Solicitações marcadas como resolvidas pela equipe de desenvolvimento. Versão atual:{' '}
            <strong>{versaoExibir}</strong>
          </p>
        </div>
        <div className="solicitacoes-admin__dashboard-toolbar-actions">
          <div className="solicitacoes-admin__dashboard-periodos" role="group" aria-label="Agrupar por período">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={
                  periodo === p.id
                    ? 'solicitacoes-admin__dashboard-periodo solicitacoes-admin__dashboard-periodo--on'
                    : 'solicitacoes-admin__dashboard-periodo'
                }
                onClick={() => setPeriodo(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rg-btn rg-btn--outline solicitacoes-admin__dashboard-pdf"
            disabled={carregando || !dados || gerandoPdf}
            title="Gerar PDF para apresentação à gestão"
            onClick={() => exportarPdfGestao()}
          >
            <RgReportPdfIcon className="rg-btn__icon" />
            {gerandoPdf ? 'A gerar…' : 'PDF gestão'}
          </button>
        </div>
      </div>

      {erro ? (
        <div className="solicitacoes-admin__alert" role="alert">
          {erro}
        </div>
      ) : null}

      {carregando ? (
        <p className="solicitacoes-admin__empty">A carregar indicadores…</p>
      ) : dados ? (
        <>
          <div className="solicitacoes-admin__dashboard-kpis">
            <article className="solicitacoes-admin__dashboard-kpi">
              <span className="solicitacoes-admin__dashboard-kpi-value">{dados.totalAtendidas}</span>
              <span className="solicitacoes-admin__dashboard-kpi-label">Solicitações atendidas</span>
              <span className="solicitacoes-admin__dashboard-kpi-hint">Eventos «Desenvolvedor enviou ajuste»</span>
            </article>
            <article className="solicitacoes-admin__dashboard-kpi solicitacoes-admin__dashboard-kpi--melhoria">
              <span className="solicitacoes-admin__dashboard-kpi-value">{dados.melhorias}</span>
              <span className="solicitacoes-admin__dashboard-kpi-label">Melhorias</span>
              <span className="solicitacoes-admin__dashboard-kpi-hint">Novas funções ou módulos</span>
            </article>
            <article className="solicitacoes-admin__dashboard-kpi solicitacoes-admin__dashboard-kpi--atualizacao">
              <span className="solicitacoes-admin__dashboard-kpi-value">{dados.atualizacoes}</span>
              <span className="solicitacoes-admin__dashboard-kpi-label">Atualizações / correções</span>
              <span className="solicitacoes-admin__dashboard-kpi-hint">Ajustes, bugs e padronizações</span>
            </article>
            <article className="solicitacoes-admin__dashboard-kpi solicitacoes-admin__dashboard-kpi--outro">
              <span className="solicitacoes-admin__dashboard-kpi-value">{dados.outros}</span>
              <span className="solicitacoes-admin__dashboard-kpi-label">Outros pedidos</span>
              <span className="solicitacoes-admin__dashboard-kpi-hint">Sem classificação automática</span>
            </article>
          </div>

          <div className="solicitacoes-admin__dashboard-charts">
            <article className="solicitacoes-admin__dashboard-chart solicitacoes-admin__dashboard-chart--wide">
              <h3>Atendimentos por {PERIODOS.find((p) => p.id === periodo)?.label.toLowerCase()}</h3>
              {dados.serieTemporal.length === 0 ? (
                <p className="solicitacoes-admin__empty">Sem atendimentos no histórico carregado.</p>
              ) : (
                <div className="solicitacoes-admin__dashboard-chart-slot">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dados.serieTemporal} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip
                        formatter={(value) => [String(value), 'Atendidas']}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="quantidade" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>

            <article className="solicitacoes-admin__dashboard-chart">
              <h3>Atendidas por desenvolvedor</h3>
              {donutDev.length === 0 ? (
                <p className="solicitacoes-admin__empty">Sem dados.</p>
              ) : (
                <>
                  <div className="solicitacoes-admin__dashboard-chart-slot solicitacoes-admin__dashboard-chart-slot--donut">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutDev}
                          dataKey="quantidade"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius="52%"
                          outerRadius="78%"
                          paddingAngle={2}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {donutDev.map((_, i) => (
                            <Cell key={i} fill={cores[i % cores.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [String(v), String(n)]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="solicitacoes-admin__dashboard-donut-center" aria-hidden>
                      {dados.totalAtendidas}
                    </div>
                  </div>
                  <ul className="solicitacoes-admin__dashboard-legend">
                    {donutDev.map((item, i) => (
                      <li key={item.nome}>
                        <span style={{ backgroundColor: cores[i % cores.length] }} aria-hidden />
                        {item.nome} ({item.quantidade})
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>

            <article className="solicitacoes-admin__dashboard-chart">
              <h3>Pedidos por solicitante</h3>
              {donutSol.length === 0 ? (
                <p className="solicitacoes-admin__empty">Sem dados.</p>
              ) : (
                <>
                  <div className="solicitacoes-admin__dashboard-chart-slot solicitacoes-admin__dashboard-chart-slot--donut">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutSol}
                          dataKey="quantidade"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius="52%"
                          outerRadius="78%"
                          paddingAngle={2}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {donutSol.map((_, i) => (
                            <Cell key={`${chartUid}-sol-${i}`} fill={cores[(i + 2) % cores.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [String(v), String(n)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="solicitacoes-admin__dashboard-legend">
                    {donutSol.map((item, i) => (
                      <li key={item.nome}>
                        <span style={{ backgroundColor: cores[(i + 2) % cores.length] }} aria-hidden />
                        {item.nome} ({item.quantidade})
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          </div>
        </>
      ) : null}
    </section>
  )
}
