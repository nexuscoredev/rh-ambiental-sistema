import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export type LinhaRelatorioContasReceber = {
  coleta_numero: string
  cliente_nome: string
  valor: number
  valor_pago: number
  status_pagamento: string
  data_vencimento: string | null
  data_emissao: string
  valor_travado: boolean | null
  vencido: boolean
}

export type ResumoRelatorioContasReceber = {
  qtd: number
  saldoAberto: number
  saldoVencido: number
}

export type FiltrosRelatorioContasReceber = {
  busca: string
  status: string
  envelhecimento: 'todos' | 'vencido' | '7d' | 'sem_venc'
}

function formatCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, da] = iso.slice(0, 10).split('-')
  if (!y || !m || !da) return iso
  return `${da}/${m}/${y}`
}

function rotuloEnvelhecimento(f: FiltrosRelatorioContasReceber['envelhecimento']): string {
  switch (f) {
    case 'vencido':
      return 'Vencidos (com saldo)'
    case '7d':
      return 'A vencer em 7 dias'
    case 'sem_venc':
      return 'Sem data de vencimento'
    default:
      return 'Todos (com saldo)'
  }
}

function montarTextoFiltros(f: FiltrosRelatorioContasReceber): string {
  const partes = [
    `Busca: ${f.busca.trim() || '—'}`,
    `Status: ${f.status.trim() || 'Todos'}`,
    `Envelhecimento: ${rotuloEnvelhecimento(f.envelhecimento)}`,
  ]
  return partes.join(' · ')
}

function finalYAutotable(doc: jsPDF): number {
  const d = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  return d.lastAutoTable?.finalY ?? 40
}

export function gerarRelatorioContasReceberPdf(input: {
  resumo: ResumoRelatorioContasReceber
  linhas: LinhaRelatorioContasReceber[]
  filtros: FiltrosRelatorioContasReceber
}): void {
  const { resumo, linhas, filtros } = input
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const margem = 40
  const larguraTexto = 515
  let y = 44

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Relatório — Contas a receber', margem, y)
  y += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Títulos, vencimentos e saldos', margem, y)
  y += 18

  const agora = new Date()
  const dataHora = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(agora)
  doc.text(`Gerado em: ${dataHora}`, margem, y)
  y += 16

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  const filtrosTxt = doc.splitTextToSize(`Filtros: ${montarTextoFiltros(filtros)}`, larguraTexto)
  doc.text(filtrosTxt, margem, y)
  doc.setTextColor(0, 0, 0)
  y += filtrosTxt.length * 11 + 14

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Títulos no relatório', String(linhas.length)],
      ['Títulos carregados (total)', String(resumo.qtd)],
      ['Saldo em aberto', formatCurrency(resumo.saldoAberto)],
      ['Saldo vencido (aberto)', formatCurrency(resumo.saldoVencido)],
    ],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: margem, right: margem },
  })

  y = finalYAutotable(doc) + 22
  if (y > 680) {
    doc.addPage()
    y = 44
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Detalhe dos títulos (${linhas.length} linha${linhas.length === 1 ? '' : 's'})`, margem, y)
  y += 16

  const corpo =
    linhas.length > 0
      ? linhas.map((r) => {
          const saldo = r.valor - r.valor_pago
          return [
            r.coleta_numero,
            (r.cliente_nome || '—').slice(0, 48),
            formatCurrency(r.valor),
            formatCurrency(r.valor_pago),
            formatCurrency(saldo),
            r.status_pagamento,
            formatDate(r.data_vencimento) + (r.vencido ? ' *' : ''),
            formatDate(r.data_emissao),
            r.valor_travado ? 'sim' : '—',
          ]
        })
      : [['—', '—', '—', '—', '—', '—', '—', '—', 'Nenhum título com os filtros atuais.']]

  autoTable(doc, {
    startY: y,
    head: [['Coleta', 'Cliente', 'Valor', 'Pago', 'Saldo', 'Status', 'Venc.', 'Emissão', 'Trav.']],
    body: corpo,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    margin: { left: margem, right: margem },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 95 },
      2: { cellWidth: 58 },
      3: { cellWidth: 58 },
      4: { cellWidth: 58 },
      5: { cellWidth: 48 },
      6: { cellWidth: 48 },
      7: { cellWidth: 48 },
      8: { cellWidth: 32 },
    },
  })

  y = finalYAutotable(doc) + 14
  if (y < 780) {
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('* Vencimento em atraso (saldo em aberto).', margem, y)
  }

  const iso = agora.toISOString().slice(0, 10)
  doc.save(`relatorio-contas-receber_${iso}.pdf`)
}
