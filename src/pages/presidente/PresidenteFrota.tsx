import { useState } from 'react'
import { CameraFeedPanel } from '../../components/presidente/CameraFeedPanel'
import { PRESIDENTE_VEICULOS_DEMO, type PresidenteVeiculoMonitor } from '../../lib/presidenteModulos'
import { PresidentePageChrome } from './PresidentePageChrome'

const STATUS_LABEL: Record<PresidenteVeiculoMonitor['status'], string> = {
  em_rota: 'Em rota',
  parado: 'Parado',
  manutencao: 'Manutenção',
  offline: 'Offline',
}

function VeiculoChip({
  veiculo,
  ativo,
  onClick,
}: {
  veiculo: PresidenteVeiculoMonitor
  ativo: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`presidente-veiculo-chip${ativo ? ' presidente-veiculo-chip--ativo' : ''}`}
      onClick={onClick}
    >
      <span className="presidente-veiculo-chip__placa">{veiculo.placa}</span>
      <span className="presidente-veiculo-chip__modelo">{veiculo.modelo}</span>
      <span className={`presidente-veiculo-chip__status presidente-veiculo-chip__status--${veiculo.status}`}>
        {STATUS_LABEL[veiculo.status]}
      </span>
    </button>
  )
}

export default function PresidenteFrota() {
  const [veiculoId, setVeiculoId] = useState(PRESIDENTE_VEICULOS_DEMO[0]?.id ?? '')
  const veiculo = PRESIDENTE_VEICULOS_DEMO.find((v) => v.id === veiculoId) ?? PRESIDENTE_VEICULOS_DEMO[0]

  return (
    <PresidentePageChrome
      titulo="Frota ao vivo"
      subtitulo="Câmaras embarcadas e estado operacional de cada veículo. Integração telemática em preparação."
      breadcrumb={[{ label: 'Frota' }]}
      acoes={
        <span className="presidente-pill presidente-pill--info">
          {PRESIDENTE_VEICULOS_DEMO.length} veículos · demo
        </span>
      }
    >
      <div className="presidente-veiculo-bar" role="tablist" aria-label="Veículos">
        {PRESIDENTE_VEICULOS_DEMO.map((v) => (
          <VeiculoChip
            key={v.id}
            veiculo={v}
            ativo={v.id === veiculo?.id}
            onClick={() => setVeiculoId(v.id)}
          />
        ))}
      </div>

      {veiculo ? (
        <div className="presidente-frota-painel">
          <header className="presidente-frota-painel__head">
            <div>
              <h2 className="presidente-frota-painel__placa">{veiculo.placa}</h2>
              <p className="presidente-frota-painel__meta">
                {veiculo.modelo}
                {veiculo.motorista ? ` · ${veiculo.motorista}` : ''}
              </p>
            </div>
            <dl className="presidente-frota-kpis">
              <div>
                <dt>Estado</dt>
                <dd>{STATUS_LABEL[veiculo.status]}</dd>
              </div>
              <div>
                <dt>Velocidade</dt>
                <dd>{veiculo.velocidadeKmh != null ? `${veiculo.velocidadeKmh} km/h` : '—'}</dd>
              </div>
              <div>
                <dt>Atualização</dt>
                <dd>{veiculo.ultimaAtualizacao ?? '—'}</dd>
              </div>
            </dl>
          </header>
          <div className="presidente-cam-grid">
            {veiculo.cameras.map((cam) => (
              <CameraFeedPanel key={cam.id} camera={cam} />
            ))}
          </div>
        </div>
      ) : null}
    </PresidentePageChrome>
  )
}
