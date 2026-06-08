import type { CSSProperties } from 'react'
import { PRESIDENTE_VEICULOS_DEMO } from '../../lib/presidenteModulos'
import { PresidentePageChrome } from './PresidentePageChrome'

const STATUS_COR: Record<string, string> = {
  em_rota: '#0d9488',
  parado: '#d97706',
  manutencao: '#64748b',
  offline: '#94a3b8',
}

export default function PresidenteRastreamento() {
  const comGps = PRESIDENTE_VEICULOS_DEMO.filter((v) => v.lat != null && v.lng != null)

  return (
    <PresidentePageChrome
      titulo="Rastreamento unificado"
      subtitulo="Mapa com posição da frota em tempo real. Os marcadores abaixo são demonstrativos até ligar a API GPS."
      breadcrumb={[{ label: 'Rastreamento' }]}
    >
      <div className="presidente-mapa-wrap">
        <div className="presidente-mapa" role="img" aria-label="Mapa demonstrativo da frota">
          <div className="presidente-mapa__grid" aria-hidden />
          <div className="presidente-mapa__fade" aria-hidden />
          {comGps.map((v, i) => {
            const left = 18 + ((i * 17) % 58)
            const top = 22 + ((i * 23) % 48)
            return (
              <div
                key={v.id}
                className="presidente-mapa__pin"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  '--pin-color': STATUS_COR[v.status] ?? '#0d9488',
                } as CSSProperties}
                title={`${v.placa} — ${v.modelo}`}
              >
                <span className="presidente-mapa__pin-dot" aria-hidden />
                <span className="presidente-mapa__pin-label">{v.placa}</span>
              </div>
            )
          })}
          <p className="presidente-mapa__aviso">
            Integração GPS / telemática — em breve. Layout pronto para receber coordenadas reais.
          </p>
        </div>

        <aside className="presidente-mapa-lista">
          <h2 className="presidente-mapa-lista__title">Frota no mapa</h2>
          <ul className="presidente-mapa-lista__items">
            {PRESIDENTE_VEICULOS_DEMO.map((v) => (
              <li key={v.id} className="presidente-mapa-lista__item">
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
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PresidentePageChrome>
  )
}
