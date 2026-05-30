import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SolicitacaoAjusteRelatorioLinha } from './chatPedidoAjuste'

export type FiltrosRelatorioSolicitacoes = {
  dataDe: string
  dataAte: string
  situacao: string
}

function formatarDataHoraRelatorio(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function montarTextoFiltros(f: FiltrosRelatorioSolicitacoes): string {
  const de = f.dataDe ? f.dataDe.split('-').reverse().join('/') : '—'
  const ate = f.dataAte ? f.dataAte.split('-').reverse().join('/') : '—'
  const sit = f.situacao.trim() || 'Todas'
  return `Período: ${de} a ${ate} · Situação: ${sit}`
}

export function exportarCsvSolicitacoesAjuste(
  linhas: SolicitacaoAjusteRelatorioLinha[],
  nomeBase = 'relatorio-solicitacoes'
): void {
  const esc = (s: string | number) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return `"${t}"`
  }
  const header = [
    'Solicitante',
    'Data pedido',
    'Horário pedido',
    'Página',
    'Descrição',
    'Situação',
    'Ciclo',
    'Última atualização',
  ]
    .map(esc)
    .join(';')
  const body = linhas
    .map((l) =>
      [
        esc(l.solicitante),
        esc(l.dataPedido),
        esc(l.horaPedido),
        esc(l.pagina),
        esc(l.descricao),
        esc(l.situacao),
        esc(l.ciclo),
        esc(l.ultimaAtualizacao ? formatarDataHoraRelatorio(l.ultimaAtualizacao) : '—'),
      ].join(';')
    )
    .join('\r\n')
  const bom = '\uFEFF'
  const blob = new Blob([bom + header + '\r\n' + body], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${nomeBase}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function gerarRelatorioSolicitacoesPdf(input: {
  linhas: SolicitacaoAjusteRelatorioLinha[]
  filtros: FiltrosRelatorioSolicitacoes
}): void {
  const { linhas, filtros } = input
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margem = 36
  const larguraTexto = 770
  let y = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Relatório — Solicitações de ajuste', margem, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Pedidos enviados pelos utilizadores via chat interno', margem, y)
  y += 16

  const agora = formatarDataHoraRelatorio(new Date().toISOString())
  doc.text(`Gerado em: ${agora}`, margem, y)
  y += 14

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(doc.splitTextToSize(montarTextoFiltros(filtros), larguraTexto), margem, y)
  doc.setTextColor(0, 0, 0)
  y += 22

  doc.setFontSize(10)
  doc.text(`Total de solicitações: ${linhas.length}`, margem, y)
  y += 10

  autoTable(doc, {
    startY: y + 4,
    head: [
      [
        'Solicitante',
        'Data',
        'Horário',
        'Página',
        'Descrição',
        'Situação',
        'Ciclo',
        'Última atualização',
      ],
    ],
    body: linhas.map((l) => [
      l.solicitante,
      l.dataPedido,
      l.horaPedido,
      l.pagina || '—',
      l.descricao,
      l.situacao,
      String(l.ciclo),
      l.ultimaAtualizacao ? formatarDataHoraRelatorio(l.ultimaAtualizacao) : '—',
    ]),
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 7 },
    margin: { left: margem, right: margem },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 48 },
      2: { cellWidth: 40 },
      3: { cellWidth: 56 },
      4: { cellWidth: 180 },
      5: { cellWidth: 72 },
      6: { cellWidth: 28 },
      7: { cellWidth: 72 },
    },
  })

  const iso = new Date().toISOString().slice(0, 10)
  doc.save(`relatorio-solicitacoes_${iso}.pdf`)
}
