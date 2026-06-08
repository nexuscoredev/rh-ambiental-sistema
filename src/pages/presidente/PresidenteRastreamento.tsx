import { useState } from 'react'
import { PresidenteRastreamentoMapa } from '../../components/presidente/PresidenteRastreamentoMapa'
import { PRESIDENTE_VEICULOS_DEMO } from '../../lib/presidenteModulos'
import { PresidentePageChrome } from './PresidentePageChrome'

const STATUS_COR: Record<string, string> = {
  em_rota: '#0d9488',
  parado: '#d97706',
  manutencao: '#64748b',
  offline: '#94a3b8',
}

export default function PresidenteRastreamento() {
  const [veiculoId, setVeiculoId] = useState<string | null>(PRESIDENTE_VEICULOS_DEMO[0]?.id ?? null)

  return (
    <PresidentePageChrome
      titulo="Rastreamento unificado"
      subtitulo="Mapa da cidade (Araçariguama) com posição da frota. Marcadores demonstrativos até ligar a API GPS."
      breadcrumb={[{ label: 'Rastreamento' }]}
    >
      <div className="presidente-mapa-wrap">
        <PresidenteRastreamentoMapa
          veiculos={PRESIDENTE_VEICULOS_DEMO}
          veiculoSelecionadoId={veiculoId}
          onSelecionarVeiculo={setVeiculoId}
        />

        <aside className="presidente-mapa-lista">
          <h2 className="presidente-mapa-lista__title">Frota no mapa</h2>
          <ul className="presidente-mapa-lista__items">
            {PRESIDENTE_VEICULOS_DEMO.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={`presidente-mapa-lista__item${veiculoId === v.id ? ' presidente-mapa-lista__item--ativo' : ''}`}
                  onClick={() => setVeiculoId(v.id)}
                >
                  <span
                    className="presidente-mapa-lista__dot"
                    style={{ background: STATUS_COR[v.status] }}
                    aria-hidden
                  />
                  <div>
                    <strong>{v.placa}</strong>
                    <span>{v.modelo}</span>
                    {v.velocidadeKmh != null ? (
                      <span className="presidente-mapa-lista__vel">{v.velocidadeKmh} km/h</span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PresidentePageChrome>
  )
}
