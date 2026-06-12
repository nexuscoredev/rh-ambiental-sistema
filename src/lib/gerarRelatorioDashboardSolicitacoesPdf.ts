import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  DashboardSolicitacoesDados,
  PeriodoDashboardSolicitacoes,
} from './solicitacaoAjusteDashboard'

const ROTULO_PERIODO: Record<PeriodoDashboardSolicitacoes, string> = {
  dia: 'Dia',
  semana: 'Semana',
  mes: 'Mês',
  ano: 'Ano',
}

function dataHoraGeracao(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

function finalY(doc: jsPDF, fallback: number): number {
  const y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
  return typeof y === 'number' ? y : fallback
}

function desenharBarrasTemporais(
  doc: jsPDF,
  serie: { rotulo: string; quantidade: number }[],
  periodo: PeriodoDashboardSolicitacoes,
  yStart: number,
  margem: number,
  larguraUtil: number
): number {
  if (serie.length === 0) return yStart

  const maxQ = Math.max(...serie.map((i) => i.quantidade), 1)
  const rotuloW = 72
  const barArea = larguraUtil - rotuloW - 36
  let y = yStart

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Atendimentos por ${ROTULO_PERIODO[periodo].toLowerCase()}`, margem, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  for (const item of serie) {
    if (y > 760) {
      doc.addPage()
      y = 48
    }
    doc.setTextColor(51, 65, 85)
    doc.text(item.rotulo, margem, y)
    const barW = Math.max(2, (item.quantidade / maxQ) * barArea)
    doc.setFillColor(13, 148, 136)
    doc.roundedRect(margem + rotuloW, y - 8, barW, 10, 2, 2, 'F')
    doc.setTextColor(15, 23, 42)
    doc.text(String(item.quantidade), margem + rotuloW + barW + 8, y)
    y += 16
  }

  doc.setTextColor(0, 0, 0)
  return y + 8
}

export function rotuloPeriodoDashboardSolicitacoes(periodo: PeriodoDashboardSolicitacoes): string {
  return ROTULO_PERIODO[periodo]
}

export function gerarRelatorioDashboardSolicitacoesPdf(input: {
  dados: DashboardSolicitacoesDados
  periodo: PeriodoDashboardSolicitacoes
}): void {
  const { dados, periodo } = input
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margem = 40
  const larguraUtil = 515
  let y = 44

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Relatório operacional — Gestão de solicitações', margem, y)
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('RG Ambiental · Solicitações atendidas pela equipe de desenvolvimento', margem, y)
  y += 16
  doc.text(`Versão do sistema: ${dados.versaoSistema}`, margem, y)
  y += 14
  doc.text(`Agrupamento: ${ROTULO_PERIODO[periodo]} · Gerado em: ${dataHoraGeracao()}`, margem, y)
  y += 20

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Quantidade', 'Descrição']],
    body: [
      [
        'Solicitações atendidas',
        String(dados.totalAtendidas),
        'Eventos «Desenvolvedor enviou ajuste»',
      ],
      ['Melhorias', String(dados.melhorias), 'Novas funções ou módulos'],
      ['Atualizações / correções', String(dados.atualizacoes), 'Ajustes, bugs e padronizações'],
      ['Outros pedidos', String(dados.outros), 'Sem classificação automática'],
    ],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 140, fontStyle: 'bold' },
      1: { cellWidth: 56, halign: 'center' },
      2: { cellWidth: 'auto' },
    },
    margin: { left: margem, right: margem },
  })

  y = finalY(doc, y + 80) + 18

  if (dados.serieTemporal.length > 0) {
    y = desenharBarrasTemporais(doc, dados.serieTemporal, periodo, y, margem, larguraUtil)
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text('Sem atendimentos no histórico carregado para o gráfico temporal.', margem, y)
    doc.setTextColor(0, 0, 0)
    y += 20
  }

  if (y > 680) {
    doc.addPage()
    y = 48
  }

  autoTable(doc, {
    startY: y,
    head: [['Desenvolvedor', 'Atendimentos']],
    body:
      dados.porColaboradorDev.length > 0
        ? dados.porColaboradorDev.map((r) => [r.nome, String(r.quantidade)])
        : [['—', '0']],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    margin: { left: margem, right: margem },
    columnStyles: {
      0: { cellWidth: 320 },
      1: { cellWidth: 80, halign: 'center' },
    },
  })

  y = finalY(doc, y + 60) + 16

  if (y > 700) {
    doc.addPage()
    y = 48
  }

  autoTable(doc, {
    startY: y,
    head: [['Solicitante', 'Pedidos atendidos']],
    body:
      dados.porSolicitante.length > 0
        ? dados.porSolicitante.map((r) => [r.nome, String(r.quantidade)])
        : [['—', '0']],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    margin: { left: margem, right: margem },
    columnStyles: {
      0: { cellWidth: 320 },
      1: { cellWidth: 80, halign: 'center' },
    },
  })

  const iso = new Date().toISOString().slice(0, 10)
  doc.save(`relatorio-gestao-solicitacoes_${periodo}_${iso}.pdf`)
}
