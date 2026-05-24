import type { jsPDF } from 'jspdf'
import type { UserOptions } from 'jspdf-autotable'
import { autoTable as autoTableNamed } from 'jspdf-autotable'

type AutoTableFn = (doc: jsPDF, options: UserOptions) => void

function resolveAutoTable(): AutoTableFn {
  const candidate = autoTableNamed as AutoTableFn | { default: AutoTableFn }
  if (typeof candidate === 'function') return candidate
  if (typeof candidate.default === 'function') return candidate.default
  throw new Error('Plugin jspdf-autotable não carregou. Recarregue a página e tente de novo.')
}

/** Texto seguro para fonte padrão do jsPDF (evita falha silenciosa com alguns Unicode). */
export function textoPdfSeguro(text: string): string {
  return text
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u00B7/g, ' - ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function invokeAutoTable(doc: jsPDF, options: UserOptions): void {
  resolveAutoTable()(doc, options)
}

export function salvarPdfJsDoc(doc: jsPDF, filename: string): void {
  try {
    doc.save(filename)
    return
  } catch {
    /* tenta download manual */
  }

  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
