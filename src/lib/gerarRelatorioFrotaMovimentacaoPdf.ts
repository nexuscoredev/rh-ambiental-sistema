import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FrotaMovimentacaoRow } from './frotaTypes'

export type FrotaMovimentacaoRelatorioLinha = {
  tipoLabel: string
  cliente: string
  equipamento: string
  veiculoPlaca: string | null
  km: number | null
  observacoes: string | null
  fotosCount: number
  assinaturaNome: string | null
  assinaturaCargo: string | null
  assinaturaEm: string | null
  createdAt: string
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

export function movimentacaoRowParaRelatorio(
  m: FrotaMovimentacaoRow,
  tipoLabel: string,
  veiculoPlaca?: string | null
): FrotaMovimentacaoRelatorioLinha {
  return {
    tipoLabel,
    cliente: m.cliente_nome ?? '—',
    equipamento: m.equipamento_descricao,
    veiculoPlaca: veiculoPlaca ?? null,
    km: m.km,
    observacoes: m.observacoes,
    fotosCount: m.fotos?.length ?? 0,
    assinaturaNome: m.assinatura_responsavel_nome,
    assinaturaCargo: m.assinatura_responsavel_cargo,
    assinaturaEm: m.assinatura_em,
    createdAt: m.created_at,
  }
}

function desenharAssinatura(doc: jsPDF, linha: FrotaMovimentacaoRelatorioLinha, yStart: number, margem: number): number {
  let y = yStart
  const pageH = doc.internal.pageSize.getHeight()
  if (y > pageH - 120) {
    doc.addPage()
    y = 40
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Assinatura do responsável', margem, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Nome: ${linha.assinaturaNome?.trim() || '—'}`, margem, y)
  y += 14
  doc.text(`Cargo / função: ${linha.assinaturaCargo?.trim() || '—'}`, margem, y)
  y += 14
  doc.text(
    `Data/hora: ${fmtDataHora(linha.assinaturaEm ?? linha.createdAt)}`,
    margem,
    y
  )
  y += 28
  doc.setDrawColor(15, 23, 42)
  doc.line(margem, y, margem + 280, y)
  y += 12
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Rubrica / confirmação', margem + 90, y)
  doc.setTextColor(0, 0, 0)
  return y + 16
}

function gerarPdfUnico(linha: FrotaMovimentacaoRelatorioLinha): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const margem = 48
  let y = 44

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Relatório — Movimentação de equipamentos', margem, y)
  y += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('RG Ambiental — Frota operacional · Documento para assinatura', margem, y)
  y += 18
  doc.text(`Gerado em: ${fmtDataHora(new Date().toISOString())}`, margem, y)
  y += 22

  const campos: [string, string][] = [
    ['Data do registo', fmtDataHora(linha.createdAt)],
    ['Tipo de movimentação', linha.tipoLabel],
    ['Cliente', linha.cliente],
    ['Equipamento', linha.equipamento],
    ['Veículo RG', linha.veiculoPlaca?.trim() || '—'],
    ['Quilometragem', linha.km != null ? `${linha.km.toLocaleString('pt-BR')} km` : '—'],
    ['Fotos anexadas', String(linha.fotosCount)],
  ]

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Dados da movimentação', margem, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  for (const [rotulo, valor] of campos) {
    doc.setFont('helvetica', 'bold')
    doc.text(`${rotulo}:`, margem, y)
    doc.setFont('helvetica', 'normal')
    const linhas = doc.splitTextToSize(valor, 380)
    doc.text(linhas, margem + 120, y)
    y += Math.max(14, linhas.length * 12)
  }

  if (linha.observacoes?.trim()) {
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Observações:', margem, y)
    y += 12
    doc.setFont('helvetica', 'normal')
    const obs = doc.splitTextToSize(linha.observacoes.trim(), 460)
    doc.text(obs, margem, y)
    y += obs.length * 12 + 8
  }

  y += 12
  desenharAssinatura(doc, linha, y, margem)

  const slug = linha.equipamento.slice(0, 24).replace(/[^\w\-]+/g, '_')
  doc.save(`movimentacao-frota_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

function gerarPdfMultiplo(linhas: FrotaMovimentacaoRelatorioLinha[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margem = 36
  let y = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Relatório — Movimentações de equipamentos', margem, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('RG Ambiental — Frota operacional · Documento para assinatura', margem, y)
  y += 14
  doc.text(`Gerado em: ${fmtDataHora(new Date().toISOString())} · Total: ${linhas.length}`, margem, y)
  y += 8

  autoTable(doc, {
    startY: y + 6,
    head: [['Data', 'Tipo', 'Cliente', 'Equipamento', 'Veículo', 'Km', 'Responsável']],
    body: linhas.map((l) => [
      fmtData(l.createdAt),
      l.tipoLabel,
      l.cliente,
      l.equipamento,
      l.veiculoPlaca ?? '—',
      l.km != null ? l.km.toLocaleString('pt-BR') : '—',
      l.assinaturaNome ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8 },
    margin: { left: margem, right: margem },
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40
  const ultima = linhas[0]
  if (ultima) {
    desenharAssinatura(doc, ultima, finalY + 24, margem)
  }

  doc.save(`movimentacoes-frota_${new Date().toISOString().slice(0, 10)}.pdf`)
}

/** Gera PDF para assinatura — um registo ou lista consolidada. */
export function gerarRelatorioFrotaMovimentacaoPdf(linhas: FrotaMovimentacaoRelatorioLinha[]): void {
  if (!linhas.length) return
  if (linhas.length === 1) {
    gerarPdfUnico(linhas[0]!)
    return
  }
  gerarPdfMultiplo(linhas)
}
