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
          background: linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%);
          border-color: #fdba74;
        }

        .mtr-list-item.mtr-status-baixada:hover {
          border-color: #fb923c;
          box-shadow: 0 10px 24px rgba(234, 88, 12, 0.1);
        }

        .mtr-list-item.mtr-status-baixada.selected {
          border-color: #ea580c;
          background: linear-gradient(180deg, #ffedd5 0%, #fff7ed 100%);
          box-shadow: 0 10px 28px rgba(234, 88, 12, 0.14);
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

        .mtr-lista-filtros {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 16px;
          margin-top: 12px;
          align-items: flex-end;
        }

        .mtr-lista-busca {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 10px;
          flex: 2;
          min-width: 220px;
        }

        .mtr-lista-busca--lancador {
          flex: 1;
          min-width: 180px;
        }

        .mtr-lista-busca__select {
          flex: 1;
          min-width: 160px;
          height: 40px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          font-size: 14px;
          background: #fff;
          color: #0f172a;
        }

        .mtr-lista-busca__select:focus {
          outline: none;
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
        }

        .mtr-lista-busca__label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }

        .mtr-lista-busca__input {
          flex: 1;
          min-width: 180px;
          height: 40px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          font-size: 14px;
        }

        .mtr-lista-busca__input:focus {
          outline: none;
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
        }

        .mtr-lista-busca__limpar {
          border: none;
          background: transparent;
          color: #0f766e;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          padding: 6px 8px;
        }

        .mtr-lista-busca__hint {
          margin: 6px 0 0;
          font-size: 12px;
          color: #94a3b8;
        }
`
