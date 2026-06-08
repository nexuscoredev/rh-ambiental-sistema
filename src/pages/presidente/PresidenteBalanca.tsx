import { useState } from 'react'
import { CameraFeedPanel } from '../../components/presidente/CameraFeedPanel'
import { PRESIDENTE_CAMERAS_BALANCA } from '../../lib/presidenteModulos'
import { PresidentePageChrome } from './PresidentePageChrome'

export default function PresidenteBalanca() {
  const [destaqueId, setDestaqueId] = useState(PRESIDENTE_CAMERAS_BALANCA[0]?.id ?? '')
  const destaque = PRESIDENTE_CAMERAS_BALANCA.find((c) => c.id === destaqueId) ?? PRESIDENTE_CAMERAS_BALANCA[0]

  return (
    <PresidentePageChrome
      titulo="Balança e pesagem"
      subtitulo="Visão das plataformas, entrada de camiões e sala de monitorização do balanceiro."
      breadcrumb={[{ label: 'Balança' }]}
    >
      <div className="presidente-monitor-layout">
        <section className="presidente-monitor-layout__main">
          {destaque ? <CameraFeedPanel camera={destaque} destaque /> : null}
        </section>
        <aside className="presidente-monitor-layout__side">
          <h2 className="presidente-monitor-layout__side-title">Pontos de vídeo</h2>
          <div className="presidente-cam-grid presidente-cam-grid--compact">
            {PRESIDENTE_CAMERAS_BALANCA.map((cam) => (
              <CameraFeedPanel
                key={cam.id}
                camera={cam}
                selecionada={cam.id === destaque?.id}
                onSelecionar={() => setDestaqueId(cam.id)}
              />
            ))}
          </div>
        </aside>
      </div>
    </PresidentePageChrome>
  )
}
