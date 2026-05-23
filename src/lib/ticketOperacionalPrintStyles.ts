/** Estilos partilhados para impressão do ticket operacional (browser print / PDF). */
export const TICKET_OPERACIONAL_PRINT_STYLES = `
  @media screen {
    .ticket-print-root { display: none !important; }
  }
  @media print {
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    html,
    body {
      width: 100% !important;
      min-height: auto !important;
      height: auto !important;
      overflow: visible !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0 !important;
      padding: 0 !important;
    }
  }
  @media print {
    /* Só o ticket no papel — sem visibility global (evita folha em branco). */
    body:has(.ticket-print-root) > *:not(.ticket-print-root) {
      display: none !important;
    }
    body:has(.ticket-print-root) .ticket-print-root {
      display: flex !important;
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 100vw !important;
      max-width: 100vw !important;
      min-height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 999999 !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      background: #ffffff !important;
    }
    body:has(.ticket-print-root) .ticket-print-col {
      width: 100% !important;
      max-width: 82mm !important;
      margin: 0 auto !important;
      flex-shrink: 0 !important;
    }
    .ticket-no-print {
      display: none !important;
    }
  }
`
