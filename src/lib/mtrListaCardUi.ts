import { isMtrStatusCancelado } from './mtrCicloVida'

export type MtrListaCardStatusClasse =
  | 'mtr-status-cancelado'
  | 'mtr-status-baixada'
  | 'mtr-status-emitido'
  | 'mtr-status-rascunho'
  | null

/** Classe de fundo do card conforme status da MTR (cancelado tem prioridade). */
export function classeMtrListaCardStatus(status: string | null | undefined): MtrListaCardStatusClasse {
  if (isMtrStatusCancelado(status)) return 'mtr-status-cancelado'
  const s = String(status ?? '')
    .trim()
    .toLowerCase()
  if (s === 'baixada') return 'mtr-status-baixada'
  if (s === 'emitido') return 'mtr-status-emitido'
  if (s === 'rascunho') return 'mtr-status-rascunho'
  return null
}

export function classeMtrListaCard(
  status: string | null | undefined,
  opts?: { selected?: boolean }
): string {
  const parts = ['mtr-list-item']
  const statusClasse = classeMtrListaCardStatus(status)
  if (statusClasse) parts.push(statusClasse)
  if (opts?.selected) parts.push('selected')
  return parts.join(' ')
}

/** CSS partilhado — injetar no `<style>` das páginas MTR / MTR-NEXUS. */
export const MTR_LISTA_CARD_UI_CSS = `
        .mtr-list-item.mtr-status-cancelado {
          background: linear-gradient(180deg, #fef2f2 0%, #fff5f5 100%);
          border-color: #fecaca;
        }

        .mtr-list-item.mtr-status-cancelado:hover {
          border-color: #f87171;
          box-shadow: 0 10px 24px rgba(185, 28, 28, 0.08);
        }

        .mtr-list-item.mtr-status-cancelado.selected {
          border-color: #dc2626;
          background: linear-gradient(180deg, #fee2e2 0%, #fef2f2 100%);
          box-shadow: 0 10px 28px rgba(220, 38, 38, 0.12);
        }

        .mtr-list-item.mtr-status-baixada {
          background: linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%);
          border-color: #bbf7d0;
        }

        .mtr-list-item.mtr-status-baixada:hover {
          border-color: #86efac;
          box-shadow: 0 10px 24px rgba(22, 163, 74, 0.06);
        }

        .mtr-list-item.mtr-status-baixada.selected {
          border-color: #059669;
          background: linear-gradient(180deg, #d1fae5 0%, #ecfdf5 100%);
          box-shadow: 0 10px 28px rgba(5, 150, 105, 0.12);
        }

        .mtr-list-item.mtr-status-emitido {
          background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
          border-color: #bfdbfe;
        }

        .mtr-list-item.mtr-status-emitido:hover {
          border-color: #93c5fd;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.06);
        }

        .mtr-list-item.mtr-status-emitido.selected {
          border-color: #2563eb;
          background: linear-gradient(180deg, #dbeafe 0%, #eff6ff 100%);
          box-shadow: 0 10px 28px rgba(37, 99, 235, 0.1);
        }

        .mtr-list-item.mtr-status-rascunho {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border-color: #e2e8f0;
        }

        .mtr-list-item.mtr-status-rascunho:hover {
          border-color: #cbd5e1;
          box-shadow: 0 10px 24px rgba(100, 116, 139, 0.06);
        }

        .mtr-list-item.mtr-status-rascunho.selected {
          border-color: #64748b;
          background: linear-gradient(180deg, #e2e8f0 0%, #f1f5f9 100%);
          box-shadow: 0 10px 28px rgba(100, 116, 139, 0.1);
        }
`
