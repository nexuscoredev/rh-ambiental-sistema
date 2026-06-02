import { Navigate, Route, Routes } from 'react-router-dom'
import { FROTA_HUB_PATH } from '../../lib/frotaModulos'
import FrotaHub from './FrotaHub'
import FrotaManutencao from './FrotaManutencao'
import FrotaRelatorio from './FrotaRelatorio'
import FrotaTransportes from './FrotaTransportes'

export default function FrotaArea() {
  return (
    <Routes>
      <Route index element={<FrotaHub />} />
      <Route path="transportes" element={<FrotaTransportes />} />
      <Route path="manutencao" element={<FrotaManutencao />} />
      <Route path="relatorio" element={<FrotaRelatorio />} />
      <Route path="*" element={<Navigate to={FROTA_HUB_PATH} replace />} />
    </Routes>
  )
}
