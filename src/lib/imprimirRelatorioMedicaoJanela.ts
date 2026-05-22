import { COLUNAS_RELATORIO_MEDICAO } from './faturamentoRelatorioMedicaoColunas'
import { rgAlert } from './RgDialogProvider'
import {
  formatarDataCurta,
  formatarMoedaMedicao,
  formatarPesoMedicao,
  formatarTaxaMedicao,
  rotuloPeriodoRelatorioMedicao,
  totaisRelatorioMedicao,
  vencimentoRelatorioMedicao,
  type LinhaRelatorioMedicao,
} from './faturamentoRelatorioMedicao'

export type ImprimirRelatorioMedicaoInput = {
  clienteNome: string
  linhas: LinhaRelatorioMedicao[]
  geradoEm?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linhaHtml(r: LinhaRelatorioMedicao): string {
  const cols = [
    formatarDataCurta(r.data),
    escapeHtml(r.mtr),
    escapeHtml(r.gerador),
    escapeHtml(r.tipoResiduo),
    escapeHtml(r.placa),
    String(r.quantViagens),
    r.valorFrete > 0 ? formatarMoedaMedicao(r.valorFrete) : '—',
    formatarPesoMedicao(r.pesoKg),
    formatarTaxaMedicao(r.valorTaxa),
    formatarMoedaMedicao(r.total),
  ]
  return `<tr>${cols.map((c, i) => `<td class="c${i}">${c}</td>`).join('')}</tr>`
}

function montarHtmlDocumento(input: ImprimirRelatorioMedicaoInput): string {
  const { clienteNome, linhas, geradoEm } = input
  const totais = totaisRelatorioMedicao(linhas)
  const periodo = rotuloPeriodoRelatorioMedicao(linhas)
  const vencimento = vencimentoRelatorioMedicao(linhas)
  const thead = COLUNAS_RELATORIO_MEDICAO.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório de medição — ${escapeHtml(clienteNome)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12mm 10mm;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9px;
    color: #0f172a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .marca { font-size: 16px; font-weight: 800; }
  .titulo { font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 6px 0 0; }
  .cliente { font-size: 11px; font-weight: 600; margin: 4px 0 0; }
  .gerado { font-size: 8px; color: #64748b; margin: 4px 0 0; }
  .periodo { font-size: 11px; font-weight: 700; text-align: right; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  th, td { border: 1px solid #64748b; padding: 5px 6px; vertical-align: middle; }
  th { background: #e2e8f0; font-weight: 700; font-size: 8px; text-align: center; white-space: nowrap; }
  td.c0, td.c4, td.c5 { text-align: center; }
  td.c1, td.c2, td.c3 { text-align: left; word-break: break-word; }
  td.c6, td.c7, td.c8, td.c9 { text-align: right; white-space: nowrap; }
  td.c9 { font-weight: 700; }
  tfoot td { font-weight: 700; background: #f8fafc; }
  tfoot .total-geral { background: #fef08a !important; font-size: 10px; }
  .foot { margin-top: 14px; display: flex; justify-content: space-between; font-size: 10px; }
  .nota { max-width: 95mm; font-size: 8px; color: #64748b; text-align: right; line-height: 1.4; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="marca">RG Ambiental</div>
      <div class="titulo">Relatório de medição</div>
      <div class="cliente">${escapeHtml(clienteNome)}</div>
      ${geradoEm ? `<div class="gerado">Gerado em ${escapeHtml(geradoEm)}</div>` : ''}
    </div>
    ${periodo ? `<div class="periodo">${escapeHtml(periodo)}</div>` : ''}
  </div>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${linhas.map(linhaHtml).join('')}</tbody>
    <tfoot>
      <tr>
        <td colspan="6" style="text-align:right">Totais</td>
        <td>${formatarMoedaMedicao(totais.valorFrete)}</td>
        <td>${formatarPesoMedicao(totais.pesoKg)}</td>
        <td></td>
        <td class="total-geral">${formatarMoedaMedicao(totais.total)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="foot">
    ${vencimento ? `<div><strong>Vencimento:</strong> ${formatarDataCurta(vencimento)}</div>` : '<div></div>'}
    <p class="nota">Valores conforme contrato (frete na 1.ª linha da MTR + peso × valor da taxa).</p>
  </div>
</body>
</html>`
}

/**
 * Impressão/PDF isolada em iframe — não depende do layout da página nem do CSS global.
 */
export function imprimirRelatorioMedicaoJanela(input: ImprimirRelatorioMedicaoInput): void {
  const html = montarHtmlDocumento(input)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Relatório de medição')
  iframe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument ?? win?.document
  if (!doc || !win) {
    iframe.remove()
    void rgAlert({
      title: 'Impressão',
      message: 'Não foi possível abrir a janela de impressão.',
      variant: 'danger',
    })
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const disparar = () => {
    try {
      win.focus()
      win.print()
    } finally {
      window.setTimeout(() => iframe.remove(), 1500)
    }
  }

  if (doc.readyState === 'complete') {
    window.setTimeout(disparar, 80)
  } else {
    iframe.onload = () => window.setTimeout(disparar, 80)
  }
}
