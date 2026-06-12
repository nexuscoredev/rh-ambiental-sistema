import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BRAND_LOGO_MARK } from './brandLogo'
import type {
  DashboardSolicitacoesDados,
  PeriodoDashboardSolicitacoes,
} from './solicitacaoAjusteDashboard'
import { coresDonutSolicitacoes } from './solicitacaoAjusteDashboard'

const ROTULO_PERIODO: Record<PeriodoDashboardSolicitacoes, string> = {
  dia: 'Dia',
  semana: 'Semana',
  mes: 'Mês',
  ano: 'Ano',
}

type Rgb = [number, number, number]

const COR = {
  teal: [13, 148, 136] as Rgb,
  tealLight: [20, 184, 166] as Rgb,
  tealDark: [15, 118, 110] as Rgb,
  slate900: [15, 23, 42] as Rgb,
  slate700: [51, 65, 85] as Rgb,
  slate500: [100, 116, 139] as Rgb,
  slate200: [226, 232, 240] as Rgb,
  slate100: [241, 245, 249] as Rgb,
  white: [255, 255, 255] as Rgb,
  melhoria: [16, 185, 129] as Rgb,
  melhoriaBg: [240, 253, 244] as Rgb,
  melhoriaBorder: [167, 243, 208] as Rgb,
  atualizacao: [14, 165, 233] as Rgb,
  atualizacaoBg: [240, 249, 255] as Rgb,
  atualizacaoBorder: [186, 230, 253] as Rgb,
  outro: [148, 163, 184] as Rgb,
  outroBg: [248, 250, 252] as Rgb,
}

const MARGEM = 40
const LARGURA_PAGINA = 595
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2

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

function hexParaRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function setFill(doc: jsPDF, cor: Rgb): void {
  doc.setFillColor(cor[0], cor[1], cor[2])
}

function setDraw(doc: jsPDF, cor: Rgb): void {
  doc.setDrawColor(cor[0], cor[1], cor[2])
}

function setText(doc: jsPDF, cor: Rgb): void {
  doc.setTextColor(cor[0], cor[1], cor[2])
}

function garantirEspaco(doc: jsPDF, y: number, necessario: number): number {
  if (y + necessario > 780) {
    doc.addPage()
    return 48
  }
  return y
}

async function carregarLogoDataUrl(): Promise<string | null> {
  try {
    const url = BRAND_LOGO_MARK.startsWith('http')
      ? BRAND_LOGO_MARK
      : `${window.location.origin}${BRAND_LOGO_MARK}`
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function desenharCabecalho(
  doc: jsPDF,
  input: { periodo: PeriodoDashboardSolicitacoes; versaoSistema: string; logoDataUrl: string | null }
): number {
  const altura = 96
  setFill(doc, COR.tealDark)
  doc.rect(0, 0, LARGURA_PAGINA, altura, 'F')
  setFill(doc, COR.tealLight)
  doc.rect(0, altura - 28, LARGURA_PAGINA, 28, 'F')

  let xTexto = MARGEM
  if (input.logoDataUrl) {
    try {
      doc.addImage(input.logoDataUrl, 'PNG', MARGEM, 18, 88, 22)
      xTexto = MARGEM + 98
    } catch {
      /* ignora logo inválido */
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  setText(doc, COR.white)
  doc.text('Relatório operacional', xTexto, 32)
  doc.setFontSize(12)
  doc.text('Gestão de solicitações', xTexto, 50)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setText(doc, [236, 253, 245])
  doc.text('RG Ambiental · Solicitações atendidas pela equipe de desenvolvimento', xTexto, 66)

  const badgeY = 78
  const badges = [
    `Versão ${input.versaoSistema}`,
    `Agrupamento: ${ROTULO_PERIODO[input.periodo]}`,
    `Gerado: ${dataHoraGeracao()}`,
  ]
  let bx = MARGEM
  doc.setFontSize(8)
  for (const rotulo of badges) {
    const tw = doc.getTextWidth(rotulo) + 14
    setFill(doc, [255, 255, 255])
    doc.roundedRect(bx, badgeY - 10, tw, 16, 4, 4, 'F')
    setText(doc, COR.tealDark)
    doc.text(rotulo, bx + 7, badgeY + 1)
    bx += tw + 8
  }

  setText(doc, COR.slate900)
  return altura + 16
}

function desenharTituloSecao(doc: jsPDF, titulo: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  setText(doc, COR.slate900)
  doc.text(titulo, MARGEM, y)
  setDraw(doc, COR.teal)
  doc.setLineWidth(2)
  doc.line(MARGEM, y + 5, MARGEM + 42, y + 5)
  doc.setLineWidth(0.5)
  return y + 22
}

function desenharKpiCards(doc: jsPDF, dados: DashboardSolicitacoesDados, yStart: number): number {
  const cards: {
    valor: number
    rotulo: string
    hint: string
    bg: Rgb
    border: Rgb
    accent: Rgb
  }[] = [
    {
      valor: dados.totalAtendidas,
      rotulo: 'Solicitações atendidas',
      hint: 'Eventos «Desenvolvedor enviou ajuste»',
      bg: COR.white,
      border: COR.teal,
      accent: COR.teal,
    },
    {
      valor: dados.melhorias,
      rotulo: 'Melhorias',
      hint: 'Novas funções ou módulos',
      bg: COR.melhoriaBg,
      border: COR.melhoriaBorder,
      accent: COR.melhoria,
    },
    {
      valor: dados.atualizacoes,
      rotulo: 'Atualizações / correções',
      hint: 'Ajustes, bugs e padronizações',
      bg: COR.atualizacaoBg,
      border: COR.atualizacaoBorder,
      accent: COR.atualizacao,
    },
    {
      valor: dados.outros,
      rotulo: 'Outros pedidos',
      hint: 'Sem classificação automática',
      bg: COR.outroBg,
      border: COR.slate200,
      accent: COR.outro,
    },
  ]

  const gap = 10
  const cardW = (LARGURA_UTIL - gap * 3) / 4
  const cardH = 74
  let y = yStart

  y = desenharTituloSecao(doc, 'Indicadores principais', y)

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]
    const x = MARGEM + i * (cardW + gap)

    setFill(doc, c.bg)
    setDraw(doc, c.border)
    doc.setLineWidth(0.8)
    doc.roundedRect(x, y, cardW, cardH, 8, 8, 'FD')

    setFill(doc, c.accent)
    doc.roundedRect(x, y, cardW, 5, 8, 8, 'F')
    doc.rect(x, y + 3, cardW, 2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    setText(doc, COR.slate900)
    doc.text(String(c.valor), x + 12, y + 34)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setText(doc, COR.slate700)
    const rotuloLinhas = doc.splitTextToSize(c.rotulo, cardW - 20)
    doc.text(rotuloLinhas, x + 12, y + 50)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setText(doc, COR.slate500)
    const hintLinhas = doc.splitTextToSize(c.hint, cardW - 20)
    doc.text(hintLinhas, x + 12, y + 58 + (rotuloLinhas.length - 1) * 9)
  }

  setText(doc, COR.slate900)
  return y + cardH + 20
}

function desenharFatiaPizza(
  doc: jsPDF,
  cx: number,
  cy: number,
  raio: number,
  angInicio: number,
  angFim: number,
  cor: Rgb
): void {
  if (angFim <= angInicio) return
  const segmentos = Math.max(6, Math.ceil(((angFim - angInicio) / (2 * Math.PI)) * 48))
  const passo = (angFim - angInicio) / segmentos
  setFill(doc, cor)
  for (let i = 0; i < segmentos; i++) {
    const a1 = angInicio + i * passo
    const a2 = angInicio + (i + 1) * passo
    const x1 = cx + raio * Math.cos(a1)
    const y1 = cy + raio * Math.sin(a1)
    const x2 = cx + raio * Math.cos(a2)
    const y2 = cy + raio * Math.sin(a2)
    doc.triangle(cx, cy, x1, y1, x2, y2, 'F')
  }
}

function desenharDonut(
  doc: jsPDF,
  cx: number,
  cy: number,
  raioExt: number,
  raioInt: number,
  fatias: { valor: number; cor: Rgb; rotulo: string }[],
  totalCentro?: number
): void {
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  if (total <= 0) {
    setFill(doc, COR.slate200)
    doc.circle(cx, cy, raioExt, 'F')
    setFill(doc, COR.white)
    doc.circle(cx, cy, raioInt, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(doc, COR.slate500)
    doc.text('Sem dados', cx, cy + 3, { align: 'center' })
    return
  }

  const gap = 0.04
  let ang = -Math.PI / 2
  for (const fatia of fatias) {
    if (fatia.valor <= 0) continue
    const sweep = (fatia.valor / total) * 2 * Math.PI
    const ini = ang + gap / 2
    const fim = ang + sweep - gap / 2
    if (fim > ini) desenharFatiaPizza(doc, cx, cy, raioExt, ini, fim, fatia.cor)
    ang += sweep
  }

  setFill(doc, COR.white)
  doc.circle(cx, cy, raioInt, 'F')

  if (totalCentro != null) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    setText(doc, COR.slate900)
    doc.text(String(totalCentro), cx, cy + 2, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    setText(doc, COR.slate500)
    doc.text('total', cx, cy + 12, { align: 'center' })
  }
}

function desenharLegendaDonut(
  doc: jsPDF,
  x: number,
  y: number,
  largura: number,
  itens: { rotulo: string; valor: number; cor: Rgb }[],
  total: number
): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  let ly = y
  for (const item of itens) {
    if (item.valor <= 0 && total > 0) continue
    setFill(doc, item.cor)
    doc.roundedRect(x, ly - 7, 8, 8, 2, 2, 'F')
    setText(doc, COR.slate700)
    const pct = total > 0 ? Math.round((item.valor / total) * 100) : 0
    const texto = `${item.rotulo} — ${item.valor} (${pct}%)`
    const linhas = doc.splitTextToSize(texto, largura - 14)
    doc.text(linhas, x + 14, ly)
    ly += linhas.length * 11 + 4
  }
  return ly
}

function desenharComposicaoCategorias(doc: jsPDF, dados: DashboardSolicitacoesDados, yStart: number): number {
  let y = garantirEspaco(doc, yStart, 180)
  y = desenharTituloSecao(doc, 'Composição por categoria', y)

  const fatias = [
    { valor: dados.melhorias, cor: COR.melhoria, rotulo: 'Melhorias' },
    { valor: dados.atualizacoes, cor: COR.atualizacao, rotulo: 'Atualizações / correções' },
    { valor: dados.outros, cor: COR.outro, rotulo: 'Outros pedidos' },
  ]
  const totalCat = dados.melhorias + dados.atualizacoes + dados.outros

  const cx = MARGEM + 72
  const cy = y + 62
  desenharDonut(doc, cx, cy, 52, 30, fatias, dados.totalAtendidas)

  const legX = MARGEM + 150
  const legY = desenharLegendaDonut(doc, legX, y + 24, LARGURA_UTIL - 150, fatias, totalCat)

  setFill(doc, COR.slate100)
  setDraw(doc, COR.slate200)
  const boxY = Math.max(legY + 6, y + 118)
  doc.roundedRect(legX, boxY, LARGURA_UTIL - 150, 52, 6, 6, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setText(doc, COR.slate700)
  doc.text('Detalhe dos indicadores', legX + 10, boxY + 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setText(doc, COR.slate500)
  const detalhes = [
    ['Solicitações atendidas', String(dados.totalAtendidas), 'Eventos «Desenvolvedor enviou ajuste»'],
    ['Melhorias', String(dados.melhorias), 'Novas funções ou módulos'],
    ['Atualizações / correções', String(dados.atualizacoes), 'Ajustes, bugs e padronizações'],
    ['Outros pedidos', String(dados.outros), 'Sem classificação automática'],
  ]
  let dy = boxY + 26
  for (const [ind, qtd, desc] of detalhes) {
    setText(doc, COR.slate700)
    doc.text(`${ind}:`, legX + 10, dy)
    doc.setFont('helvetica', 'bold')
    doc.text(qtd, legX + 130, dy)
    doc.setFont('helvetica', 'normal')
    setText(doc, COR.slate500)
    doc.text(desc, legX + 160, dy)
    dy += 10
  }

  return Math.max(cy + 62, dy) + 16
}

function desenharBarraGradiente(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  corBase: Rgb
): void {
  if (w <= 0 || h <= 0) return
  const escuro: Rgb = [
    Math.max(0, corBase[0] - 18),
    Math.max(0, corBase[1] - 18),
    Math.max(0, corBase[2] - 12),
  ]
  const claro: Rgb = [
    Math.min(255, corBase[0] + 28),
    Math.min(255, corBase[1] + 28),
    Math.min(255, corBase[2] + 20),
  ]
  const meio = h / 2
  setFill(doc, escuro)
  doc.roundedRect(x, y + meio, w, h - meio, 2, 2, 'F')
  setFill(doc, claro)
  doc.roundedRect(x, y, w, meio + 1, 2, 2, 'F')
}

function desenharGraficoTemporal(
  doc: jsPDF,
  serie: { rotulo: string; quantidade: number }[],
  periodo: PeriodoDashboardSolicitacoes,
  yStart: number
): number {
  let y = garantirEspaco(doc, yStart, 200)
  y = desenharTituloSecao(doc, `Atendimentos por ${ROTULO_PERIODO[periodo].toLowerCase()}`, y)

  if (serie.length === 0) {
    setFill(doc, COR.slate100)
    doc.roundedRect(MARGEM, y, LARGURA_UTIL, 48, 8, 8, 'F')
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    setText(doc, COR.slate500)
    doc.text('Sem atendimentos no histórico carregado para o gráfico temporal.', MARGEM + 14, y + 28)
    setText(doc, COR.slate900)
    return y + 60
  }

  const usarVertical = serie.length <= 14
  if (usarVertical) {
    return desenharBarrasVerticais(doc, serie, y)
  }
  return desenharBarrasHorizontais(doc, serie, y)
}

function desenharBarrasVerticais(
  doc: jsPDF,
  serie: { rotulo: string; quantidade: number }[],
  yStart: number
): number {
  const chartX = MARGEM + 36
  const chartY = yStart
  const chartW = LARGURA_UTIL - 48
  const chartH = 150
  const maxQ = Math.max(...serie.map((i) => i.quantidade), 1)

  setFill(doc, COR.slate100)
  setDraw(doc, COR.slate200)
  doc.roundedRect(MARGEM, chartY, LARGURA_UTIL, chartH + 44, 8, 8, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setText(doc, COR.slate500)
  for (let g = 0; g <= 4; g++) {
    const gy = chartY + chartH - (g / 4) * chartH
    setDraw(doc, COR.slate200)
    doc.setLineDashPattern([2, 3], 0)
    doc.line(chartX, gy, chartX + chartW, gy)
    doc.setLineDashPattern([], 0)
    const val = Math.round((g / 4) * maxQ)
    doc.text(String(val), MARGEM + 4, gy + 3)
  }

  const barGap = 6
  const barW = Math.min(28, (chartW - barGap * (serie.length + 1)) / serie.length)
  const totalBarsW = serie.length * barW + (serie.length - 1) * barGap
  let bx = chartX + (chartW - totalBarsW) / 2

  const pontosTendencia: { x: number; y: number }[] = []

  for (const item of serie) {
    const barH = Math.max(2, (item.quantidade / maxQ) * chartH)
    const by = chartY + chartH - barH
    desenharBarraGradiente(doc, bx, by, barW, barH, COR.teal)
    pontosTendencia.push({ x: bx + barW / 2, y: by })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setText(doc, COR.slate700)
    doc.text(String(item.quantidade), bx + barW / 2, by - 4, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setText(doc, COR.slate500)
    const rot = doc.splitTextToSize(item.rotulo, barW + 10)
    doc.text(rot, bx + barW / 2, chartY + chartH + 10, { align: 'center' })
    bx += barW + barGap
  }

  if (pontosTendencia.length >= 2) {
    setDraw(doc, COR.tealLight)
    doc.setLineWidth(1.2)
    for (let i = 1; i < pontosTendencia.length; i++) {
      doc.line(
        pontosTendencia[i - 1].x,
        pontosTendencia[i - 1].y,
        pontosTendencia[i].x,
        pontosTendencia[i].y
      )
    }
    for (const p of pontosTendencia) {
      setFill(doc, COR.white)
      setDraw(doc, COR.teal)
      doc.circle(p.x, p.y, 2.5, 'FD')
    }
    doc.setLineWidth(0.5)
  }

  setText(doc, COR.slate900)
  return chartY + chartH + 52
}

function desenharBarrasHorizontais(
  doc: jsPDF,
  serie: { rotulo: string; quantidade: number }[],
  yStart: number
): number {
  const maxQ = Math.max(...serie.map((i) => i.quantidade), 1)
  const rotuloW = 68
  const barArea = LARGURA_UTIL - rotuloW - 40
  let y = yStart + 6

  setFill(doc, COR.slate100)
  const alturaBloco = serie.length * 18 + 16
  doc.roundedRect(MARGEM, y - 8, LARGURA_UTIL, alturaBloco, 8, 8, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  for (const item of serie) {
    if (y > 760) {
      doc.addPage()
      y = 48
    }
    setText(doc, COR.slate700)
    doc.text(item.rotulo, MARGEM + 10, y)
    const barW = Math.max(3, (item.quantidade / maxQ) * barArea)
    const barX = MARGEM + rotuloW
    setFill(doc, COR.slate200)
    doc.roundedRect(barX, y - 9, barArea, 11, 3, 3, 'F')
    desenharBarraGradiente(doc, barX, y - 9, barW, 11, COR.teal)
    doc.setFont('helvetica', 'bold')
    setText(doc, COR.slate900)
    doc.text(String(item.quantidade), barX + barArea + 8, y)
    doc.setFont('helvetica', 'normal')
    y += 18
  }

  setText(doc, COR.slate900)
  return y + 12
}

function desenharDonutComLegenda(
  doc: jsPDF,
  titulo: string,
  itens: { nome: string; quantidade: number }[],
  x: number,
  y: number,
  largura: number,
  offsetCor: number
): number {
  const cores = coresDonutSolicitacoes().map(hexParaRgb)
  const total = itens.reduce((s, i) => s + i.quantidade, 0)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setText(doc, COR.slate900)
  doc.text(titulo, x, y)

  const cx = x + largura / 2
  const cy = y + 58
  const fatias = itens.map((item, i) => ({
    valor: item.quantidade,
    cor: cores[(i + offsetCor) % cores.length],
    rotulo: item.nome,
  }))
  desenharDonut(doc, cx, cy, 44, 26, fatias, total > 0 ? total : undefined)

  const legItens = itens.map((item, i) => ({
    rotulo: item.nome,
    valor: item.quantidade,
    cor: cores[(i + offsetCor) % cores.length],
  }))
  return desenharLegendaDonut(doc, x, cy + 52, largura, legItens, total)
}

function desenharTabelaRanking(
  doc: jsPDF,
  titulo: string,
  colNome: string,
  colQtd: string,
  linhas: { nome: string; quantidade: number }[],
  yStart: number
): number {
  let y = garantirEspaco(doc, yStart, 80)
  y = desenharTituloSecao(doc, titulo, y)

  const maxQ = Math.max(...linhas.map((l) => l.quantidade), 1)
  const corpo =
    linhas.length > 0
      ? linhas.map((r) => {
          const pct = Math.round((r.quantidade / maxQ) * 100)
          return [r.nome, String(r.quantidade), `${pct}%`]
        })
      : [['—', '0', '—']]

  autoTable(doc, {
    startY: y,
    head: [[colNome, colQtd, 'Participação']],
    body: corpo,
    styles: {
      fontSize: 9,
      cellPadding: { top: 6, right: 6, bottom: 6, left: 8 },
      textColor: COR.slate700,
      lineColor: COR.slate200,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: COR.tealDark,
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: COR.slate100 },
    margin: { left: MARGEM, right: MARGEM },
    columnStyles: {
      0: { cellWidth: 280, fontStyle: 'bold' },
      1: { cellWidth: 72, halign: 'center' },
      2: { cellWidth: 72, halign: 'center', textColor: COR.slate500 },
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 1 || linhas.length === 0) return
      const idx = data.row.index
      const item = linhas[idx]
      if (!item) return
      const cell = data.cell
      const barMaxW = 48
      const barW = Math.max(4, (item.quantidade / maxQ) * barMaxW)
      const bx = cell.x + (cell.width - barMaxW) / 2
      const by = cell.y + cell.height - 5
      setFill(doc, COR.slate200)
      doc.roundedRect(bx, by, barMaxW, 3, 1, 1, 'F')
      setFill(doc, COR.tealLight)
      doc.roundedRect(bx, by, barW, 3, 1, 1, 'F')
    },
  })

  return finalY(doc, y + 40) + 14
}

function desenharRodapes(doc: jsPDF): void {
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    setDraw(doc, COR.slate200)
    doc.line(MARGEM, 812, LARGURA_PAGINA - MARGEM, 812)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setText(doc, COR.slate500)
    doc.text('RG Ambiental · Relatório interno · Gestão de solicitações', MARGEM, 824)
    doc.text(`Página ${p} de ${total}`, LARGURA_PAGINA - MARGEM, 824, { align: 'right' })
  }
  setText(doc, COR.slate900)
}

export function rotuloPeriodoDashboardSolicitacoes(periodo: PeriodoDashboardSolicitacoes): string {
  return ROTULO_PERIODO[periodo]
}

export async function gerarRelatorioDashboardSolicitacoesPdf(input: {
  dados: DashboardSolicitacoesDados
  periodo: PeriodoDashboardSolicitacoes
}): Promise<void> {
  const { dados, periodo } = input
  const logoDataUrl = await carregarLogoDataUrl()

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = desenharCabecalho(doc, { periodo, versaoSistema: dados.versaoSistema, logoDataUrl })

  y = desenharKpiCards(doc, dados, y)
  y = desenharComposicaoCategorias(doc, dados, y)
  y = desenharGraficoTemporal(doc, dados.serieTemporal, periodo, y)

  y = garantirEspaco(doc, y, 200)
  const meio = MARGEM + LARGURA_UTIL / 2
  const colW = LARGURA_UTIL / 2 - 8
  const yDonuts = y
  const yDevFim = desenharDonutComLegenda(
    doc,
    'Atendidas por desenvolvedor',
    dados.porColaboradorDev,
    MARGEM,
    yDonuts,
    colW,
    0
  )
  const ySolFim = desenharDonutComLegenda(
    doc,
    'Pedidos por solicitante',
    dados.porSolicitante,
    meio + 8,
    yDonuts,
    colW,
    2
  )
  y = Math.max(yDevFim, ySolFim) + 10

  y = desenharTabelaRanking(
    doc,
    'Ranking — Desenvolvedores',
    'Desenvolvedor',
    'Atendimentos',
    dados.porColaboradorDev,
    y
  )

  y = desenharTabelaRanking(
    doc,
    'Ranking — Solicitantes',
    'Solicitante',
    'Pedidos atendidos',
    dados.porSolicitante,
    y
  )

  desenharRodapes(doc)

  const iso = new Date().toISOString().slice(0, 10)
  doc.save(`relatorio-gestao-solicitacoes_${periodo}_${iso}.pdf`)
}
