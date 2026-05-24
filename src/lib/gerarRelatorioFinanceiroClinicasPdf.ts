import { jsPDF } from 'jspdf'
import { invokeAutoTable, salvarPdfJsDoc, textoPdfSeguro } from './clinicasPdfSalvar'

export type LinhaRelatorioFinanceiroClinicas = {
  numero_os: string
  razao_social: string
  valor: number
  valor_pago: number
  status_pagamento: string
  data_vencimento: string | null
  data_pagamento: string | null
  vencido: boolean
}

export type ResumoRelatorioFinanceiroClinicas = {
  qtd: number
  saldoAberto: number
  saldoVencido: number
}

export type FiltrosRelatorioFinanceiroClinicas = {
  busca: string
  status: string
  envelhecimento: string
}

function formatCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string | null) {
  if (!iso) return '-'
  const [y, m, da] = iso.slice(0, 10).split('-')
  if (!y || !m || !da) return iso
  return `${da}/${m}/${y}`
}

export function gerarRelatorioFinanceiroClinicasPdf(input: {
  resumo: ResumoRelatorioFinanceiroClinicas
  linhas: LinhaRelatorioFinanceiroClinicas[]
  filtros: FiltrosRelatorioFinanceiroClinicas
}): void {
  const { resumo, linhas, filtros } = input
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margem = 40
  let y = 44

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(t('Relatorio - Contas a receber (Clinicas)'), margem, y)
  y += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(t('Fila de titulos enviados pelo faturamento de clinicas'), margem, y)
  y += 18
  doc.text(`Gerado em: ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`, margem, y)
  y += 14
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(
    t(
      `Filtros: busca="${filtros.busca || '—'}" | status=${filtros.status || 'Todos'} | envelhecimento=${filtros.envelhecimento}`
    ),
    margem,
    y
  )
  doc.setTextColor(0, 0, 0)
  y += 20

  invokeAutoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Titulos na fila', String(resumo.qtd)],
      ['Saldo em aberto', formatCurrency(resumo.saldoAberto)],
      ['Saldo vencido (aberto)', formatCurrency(resumo.saldoVencido)],
    ],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: margem, right: margem },
  })

  y =
    ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 22

  const corpo =
    linhas.length > 0
      ? linhas.map((r) => {
          const saldo = r.valor - r.valor_pago
          return [
            r.numero_os,
            r.razao_social.slice(0, 36),
            formatCurrency(r.valor),
            formatCurrency(r.valor_pago),
            formatCurrency(saldo),
            r.status_pagamento,
            formatDate(r.data_vencimento) + (r.vencido ? ' *' : ''),
            formatDate(r.data_pagamento),
          ]
        })
      : [['—', '—', '—', '—', '—', '—', '—', 'Nenhum titulo com os filtros atuais.']]

  invokeAutoTable(doc, {
    startY: y,
    head: [['O.S.', 'Unidade', 'Valor', 'Pago', 'Saldo', 'Status', 'Venc.', 'Data pag.']],
    body: corpo,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
    margin: { left: margem, right: margem },
  })

  salvarPdfJsDoc(doc, `relatorio-contas-receber-clinicas_${new Date().toISOString().slice(0, 10)}.pdf`)
}

function t(text: string): string {
  return textoPdfSeguro(text)
}
