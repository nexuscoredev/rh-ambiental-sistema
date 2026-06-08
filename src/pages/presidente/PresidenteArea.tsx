import { Navigate, Route, Routes } from 'react-router-dom'
import { PRESIDENTE_HUB_PATH } from '../../lib/presidenteModulos'
import PresidenteBalanca from './PresidenteBalanca'
import PresidenteFrota from './PresidenteFrota'
import PresidenteHub from './PresidenteHub'
import PresidenteRastreamento from './PresidenteRastreamento'
import PresidenteSede from './PresidenteSede'
import PresidenteSetor from './PresidenteSetor'

export default function PresidenteArea() {
  return (
    <Routes>
      <Route index element={<PresidenteHub />} />
      <Route path="sede" element={<PresidenteSede />} />
      <Route path="sede/:setorSlug" element={<PresidenteSetor />} />
      <Route path="frota" element={<PresidenteFrota />} />
      <Route path="balanca" element={<PresidenteBalanca />} />
      <Route path="rastreamento" element={<PresidenteRastreamento />} />
      <Route path="*" element={<Navigate to={PRESIDENTE_HUB_PATH} replace />} />
    </Routes>
  )
}
