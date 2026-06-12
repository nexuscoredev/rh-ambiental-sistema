import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchResumoFrotaDashboard } from '../../lib/frotaApi'
import { FROTA_HUB_PATH } from '../../lib/frotaModulos'
import type { FrotaResumoDashboard } from '../../lib/frotaTypes'

export function FrotaDashboardResumo() {
  const [resumo, setResumo] = useState<FrotaResumoDashboard | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const r = await fetchResumoFrotaDashboard()
        if (!cancel) setResumo(r)
      } catch (e) {
        if (!cancel) {
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar a frota.')
          setResumo(null)
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  if (erro) {
    return (
      <div className="exec-viz-surface frota-exec-panel">
        <p style={{ margin: 0, color: "var(--text-secondary, #64748b)", fontSize: 13 }}>
          Frota: {erro} Aplique a migration <code>20260602193000_operacional_frota</code> se ainda não estiver na BD.
        </p>
      </div>
    )
  }

  if (!resumo) {
    return (
      <div className="exec-viz-surface frota-exec-panel">
        <p style={{ margin: 0, color: "var(--text-secondary, #64748b)" }}>A carregar visão da frota…</p>
      </div>
    )
  }

  return (
    <div className="exec-viz-surface frota-exec-panel">
      <div className="frota-exec-panel__head">
        <div>
          <span className="exec-viz-title">Frota RG Ambiental</span>
          <span className="exec-viz-sub">Transportes, manutenção e diário dos veículos</span>
        </div>
        <Link to={FROTA_HUB_PATH} className="frota-btn frota-btn--primary">
          Abrir módulo frota
        </Link>
      </div>
      <div className="frota-exec-kpis">
        <div className="frota-exec-kpi">
          <span className="frota-exec-kpi__val">{resumo.totalVeiculos}</span>
          <span className="frota-exec-kpi__lbl">Veículos cadastrados</span>
        </div>
        <div className="frota-exec-kpi">
          <span className="frota-exec-kpi__val">{resumo.diariosHoje}</span>
          <span className="frota-exec-kpi__lbl">Diários hoje</span>
        </div>
        <div className="frota-exec-kpi">
          <span className="frota-exec-kpi__val">{resumo.movimentacoes7d}</span>
          <span className="frota-exec-kpi__lbl">Movimentações (7 dias)</span>
        </div>
        <div className="frota-exec-kpi">
          <span className="frota-exec-kpi__val">{resumo.manutencoesAbertas}</span>
          <span className="frota-exec-kpi__lbl">Manutenções abertas</span>
        </div>
      </div>
      {resumo.alertasOleo.length > 0 ? (
        <div className="frota-exec-alertas">
          <strong>Atenção — troca de óleo próxima</strong>
          <ul>
            {resumo.alertasOleo.map((a) => (
              <li key={a.placa}>
                {a.placa}: {a.km_atual?.toLocaleString('pt-BR')} km (meta ~{a.proxima_km?.toLocaleString('pt-BR')} km)
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="frota-exec-ok">Nenhum alerta crítico de óleo nos últimos diários.</p>
      )}
    </div>
  )
}
