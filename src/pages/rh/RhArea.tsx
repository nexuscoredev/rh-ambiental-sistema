import { Navigate, Route, Routes } from 'react-router-dom'
import { RH_HUB_PATH, RH_MODULOS } from '../../lib/rhModulos'
import RhDepartamentoPessoal from './RhDepartamentoPessoal'
import RhHub from './RhHub'
import RhModuloPage from './RhModuloPage'
import RhTreinamentosArea from './RhTreinamentosArea'

/** Rotas internas da área RH — montada em `/rh/*` no App. */
export default function RhArea() {
  return (
    <Routes>
      <Route index element={<RhHub />} />
      <Route path="treinamentos/*" element={<RhTreinamentosArea />} />
      {RH_MODULOS.filter((m) => m.slug !== 'treinamentos').map((m) => (
        <Route
          key={m.slug}
          path={m.slug}
          element={
            m.slug === 'departamento-pessoal' ? <RhDepartamentoPessoal /> : <RhModuloPage />
          }
        />
      ))}
      <Route path="*" element={<Navigate to={RH_HUB_PATH} replace />} />
    </Routes>
  )
}
