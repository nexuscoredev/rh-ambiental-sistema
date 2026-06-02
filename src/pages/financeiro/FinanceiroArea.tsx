import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { FINANCEIRO_HUB_PATH } from '../../lib/financeiroModulos'
import Financeiro from '../Financeiro'
import FinanceiroContasPagar from '../FinanceiroContasPagar'
import FinanceiroContasReceber from '../FinanceiroContasReceber'
import FinanceiroHub from './FinanceiroHub'

/** Hub em `/financeiro`; query string antiga redireciona para cobrança. */
function FinanceiroIndex() {
  const { search } = useLocation()
  if (search) {
    return <Navigate to={`/financeiro/cobranca${search}`} replace />
  }
  return <FinanceiroHub />
}

export default function FinanceiroArea() {
  return (
    <Routes>
      <Route index element={<FinanceiroIndex />} />
      <Route path="cobranca" element={<Financeiro />} />
      <Route path="contas-receber" element={<FinanceiroContasReceber />} />
      <Route path="contas-pagar" element={<FinanceiroContasPagar />} />
      <Route path="*" element={<Navigate to={FINANCEIRO_HUB_PATH} replace />} />
    </Routes>
  )
}
