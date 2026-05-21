import { createPortal } from 'react-dom'
import {
  FaturamentoRelatorioMedicaoPrintView,
  type FaturamentoRelatorioMedicaoPrintProps,
} from './FaturamentoRelatorioMedicaoPrint'

/** Documento de impressão/PDF no `body` (evita layout quebrado dentro do scroll da app). */
export function FaturamentoRelatorioMedicaoPrintRoot(props: FaturamentoRelatorioMedicaoPrintProps) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div id="faturamento-relatorio-medicao-print-root" className="medicao-print-root">
      <FaturamentoRelatorioMedicaoPrintView {...props} />
    </div>,
    document.body
  )
}
