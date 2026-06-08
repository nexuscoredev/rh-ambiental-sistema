import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  PRESIDENTE_MAPA_CENTRO,
  PRESIDENTE_MAPA_ZOOM,
  type PresidenteVeiculoMonitor,
} from '../../lib/presidenteModulos'

const STATUS_COR: Record<PresidenteVeiculoMonitor['status'], string> = {
  em_rota: '#0d9488',
  parado: '#d97706',
  manutencao: '#64748b',
  offline: '#94a3b8',
}

type Props = {
  veiculos: readonly PresidenteVeiculoMonitor[]
  veiculoSelecionadoId?: string | null
  onSelecionarVeiculo?: (id: string) => void
}

function FlyToVeiculo({
  veiculo,
  zoom = 15,
}: {
  veiculo: PresidenteVeiculoMonitor | null
  zoom?: number
}) {
  const map = useMap()
  useEffect(() => {
    if (!veiculo?.lat || veiculo.lng == null) return
    map.flyTo([veiculo.lat, veiculo.lng], zoom, { duration: 0.65 })
  }, [map, veiculo, zoom])
  return null
}

export function PresidenteRastreamentoMapa({
  veiculos,
  veiculoSelecionadoId,
  onSelecionarVeiculo,
}: Props) {
  const comGps = useMemo(
    () => veiculos.filter((v) => v.lat != null && v.lng != null),
    [veiculos]
  )

  const bounds = useMemo((): LatLngBoundsExpression | undefined => {
    if (comGps.length === 0) return undefined
    const lats = comGps.map((v) => v.lat!)
    const lngs = comGps.map((v) => v.lng!)
    return [
      [Math.min(...lats) - 0.012, Math.min(...lngs) - 0.018],
      [Math.max(...lats) + 0.012, Math.max(...lngs) + 0.018],
    ]
  }, [comGps])

  const selecionado = comGps.find((v) => v.id === veiculoSelecionadoId) ?? null

  return (
    <div className="presidente-rastreamento-map">
      <MapContainer
        {...(bounds
          ? { bounds, boundsOptions: { padding: [32, 32] } as const }
          : { center: PRESIDENTE_MAPA_CENTRO, zoom: PRESIDENTE_MAPA_ZOOM })}
        minZoom={11}
        maxZoom={17}
        zoomControl
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: '#f1f5f9' }}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <FlyToVeiculo veiculo={selecionado} />
        {comGps.map((v) => {
          const ativo = v.id === veiculoSelecionadoId
          const cor = STATUS_COR[v.status]
          return (
            <CircleMarker
              key={v.id}
              center={[v.lat!, v.lng!]}
              radius={ativo ? 11 : 9}
              pathOptions={{
                fillColor: cor,
                fillOpacity: ativo ? 0.95 : 0.82,
                color: ativo ? '#0f172a' : '#fff',
                weight: ativo ? 3 : 2,
                opacity: 1,
              }}
              eventHandlers={{
                click: () => onSelecionarVeiculo?.(v.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={0.96}>
                <span className="presidente-rastreamento-map__tip">
                  <strong>{v.placa}</strong>
                  <br />
                  {v.modelo}
                  {v.velocidadeKmh != null ? (
                    <>
                      <br />
                      {v.velocidadeKmh} km/h
                    </>
                  ) : null}
                </span>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
      <p className="presidente-mapa__aviso">
        Araçariguama/SP · posições demonstrativas até ligar a API GPS / telemática.
      </p>
    </div>
  )
}
