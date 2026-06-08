import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { CameraFeedPanel } from '../../components/presidente/CameraFeedPanel'
import { PRESIDENTE_HUB_PATH, presidenteSetorPorSlug } from '../../lib/presidenteModulos'
import { PresidentePageChrome } from './PresidentePageChrome'

export default function PresidenteSetor() {
  const { setorSlug = '' } = useParams()
  const setor = presidenteSetorPorSlug(setorSlug)
  const [camSelecionada, setCamSelecionada] = useState<string | null>(null)

  if (!setor) {
    return <Navigate to={`${PRESIDENTE_HUB_PATH}/sede`} replace />
  }

  const camDestaque = setor.cameras.find((c) => c.id === camSelecionada) ?? setor.cameras[0]

  return (
    <PresidentePageChrome
      titulo={setor.label}
      subtitulo={setor.descricao}
      breadcrumb={[
        { label: 'Instalações', path: '/presidente/sede' },
        { label: setor.label },
      ]}
    >
      <div className="presidente-monitor-layout">
        <section className="presidente-monitor-layout__main" aria-label="Câmara em destaque">
          {camDestaque ? <CameraFeedPanel camera={camDestaque} destaque /> : null}
        </section>
        <aside className="presidente-monitor-layout__side">
          <h2 className="presidente-monitor-layout__side-title">Todas as câmaras</h2>
          <div className="presidente-cam-grid presidente-cam-grid--compact">
            {setor.cameras.map((cam) => (
              <CameraFeedPanel
                key={cam.id}
                camera={cam}
                selecionada={cam.id === camDestaque?.id}
                onSelecionar={() => setCamSelecionada(cam.id)}
              />
            ))}
          </div>
        </aside>
      </div>
    </PresidentePageChrome>
  )
}
