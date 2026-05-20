import { jsPDF } from 'jspdf'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { BRAND_LOGO_MARK } from './brandLogo'
import { supabase } from './supabase'
import { empresaTicketImpressaoRg } from './rgAmbientalDadosCorporativos'

export type TicketPdfRowInput = Pick<
  FaturamentoResumoViewRow,
  | 'coleta_id'
  | 'ticket_comprovante'
  | 'mtr_numero'
  | 'cliente_nome'
  | 'tipo_residuo'
  | 'peso_tara'
  | 'peso_bruto'
  | 'peso_liquido'
  | 'motorista'
  | 'placa'
  | 'ticket_impresso_em'
  | 'created_at'
>

type TipoTicket = 'entrada' | 'saida' | 'frete'

function normalizarTipoTicket(raw: string | null | undefined): TipoTicket {
  if (raw === 'frete') return 'frete'
  if (raw === 'entrada') return 'entrada'
  return 'saida'
}

function tituloTipo(t: TipoTicket): string {
  if (t === 'frete') return 'FRETE'
  if (t === 'entrada') return 'ENTRADA'
  return 'SAIDA'
}

function formatPeso(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n))
}

function formatDataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function formatHoraBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    const url = src.startsWith('http') ? src : `${window.location.origin}${src}`
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

type ExtrasTicket = {
  numero: string
  tipo: TipoTicket
  descricao: string
  balanceiro: string
  empresaTransporte: string
  horaEntrada: string
  horaSaida: string
}

async function carregarExtrasTicket(coletaId: string): Promise<ExtrasTicket | null> {
  const [ticketRes, massaRes] = await Promise.all([
    supabase
      .from('tickets_operacionais')
      .select('numero, tipo_ticket, descricao, created_at')
      .eq('coleta_id', coletaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('controle_massa')
      .select(
        'empresa, cliente, balanceiro, balanceiro_nome, usuario_balanceiro, hora_entrada, hora_saida, created_at, updated_at'
      )
      .eq('coleta_id', coletaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (ticketRes.error) console.error(ticketRes.error)
  if (massaRes.error) console.error(massaRes.error)

  const ticket = ticketRes.data as Record<string, unknown> | null
  const massa = massaRes.data as Record<string, unknown> | null

  const numeroTicket = typeof ticket?.numero === 'string' ? ticket.numero.trim() : ''

  if (!numeroTicket && !ticket && !massa) return null

  let balanceiro = '—'
  let empresaTransporte = empresaTicketImpressaoRg()
  let horaEntrada = '—'
  let horaSaida = '—'

  if (massa) {
    const bal = massa.balanceiro ?? massa.balanceiro_nome ?? massa.usuario_balanceiro
    if (typeof bal === 'string' && bal.trim()) balanceiro = bal.trim()
    const he = massa.hora_entrada
    const hs = massa.hora_saida
    if (typeof he === 'string' && he.trim()) {
      horaEntrada = he.trim()
    } else {
      horaEntrada = formatHoraBr((massa.created_at ?? massa.updated_at) as string | undefined)
    }
    if (typeof hs === 'string' && hs.trim()) {
      horaSaida = hs.trim()
    } else {
      horaSaida = formatHoraBr((massa.updated_at ?? massa.created_at) as string | undefined)
    }
  }

  return {
    numero: numeroTicket,
    tipo: normalizarTipoTicket(ticket?.tipo_ticket as string | null),
    descricao: typeof ticket?.descricao === 'string' ? ticket.descricao.trim() : '',
    balanceiro,
    empresaTransporte,
    horaEntrada,
    horaSaida,
  }
}

/** Gera e abre o PDF do ticket operacional (mesmo conteúdo da impressão no Controle de Massa). */
export async function abrirPdfTicketOperacional(
  row: TicketPdfRowInput
): Promise<{ ok: boolean; message?: string }> {
  if (!row.coleta_id?.trim()) {
    return { ok: false, message: 'Coleta inválida.' }
  }

  const extras = await carregarExtrasTicket(row.coleta_id.trim())
  const numero =
    extras?.numero?.trim() ||
    (row.ticket_comprovante ?? '').trim() ||
    ''

  if (!numero) {
    return { ok: false, message: 'Não há ticket registado para esta coleta.' }
  }

  const w = 82
  const margin = 5
  const lineH = 5.2
  let y = margin

  const doc = new jsPDF({ unit: 'mm', format: [w, 260], orientation: 'portrait' })

  const centerText = (text: string, fontSize: number, style: 'normal' | 'bold' = 'bold') => {
    doc.setFont('courier', style)
    doc.setFontSize(fontSize)
    const tw = doc.getTextWidth(text)
    doc.text(text, (w - tw) / 2, y)
    y += lineH * (fontSize >= 16 ? 1.35 : 1.05)
  }

  const dashedRule = () => {
    y += 2
    doc.setDrawColor(120)
    doc.setLineDashPattern([1.2, 1.2], 0)
    doc.line(margin, y, w - margin, y)
    doc.setLineDashPattern([], 0)
    y += 5
  }

  const linha = (k: string, v: string) => {
    doc.setFont('courier', 'bold')
    doc.setFontSize(10.5)
    const text = `${k}: ${v}`
    const tw = doc.getTextWidth(text)
    doc.text(text, (w - tw) / 2, y)
    y += lineH
  }

  const logo = await loadImageDataUrl(BRAND_LOGO_MARK)
  if (logo) {
    const logoW = 32
    const logoH = 9
    doc.addImage(logo, 'PNG', (w - logoW) / 2, y, logoW, logoH)
    y += logoH + 4
  }

  centerText(numero, 20)
  centerText(tituloTipo(extras?.tipo ?? 'saida'), 13)
  dashedRule()

  const dataBr = formatDataBr(row.ticket_impresso_em ?? row.created_at)
  linha('Data', dataBr)
  linha('MTR', (row.mtr_numero ?? '').trim() || '—')
  y += 2
  centerText('EMPRESA', 11)
  centerText((row.cliente_nome ?? '').trim() || '—', 10, 'normal')
  y += 2
  centerText('RESIDUO', 11)
  centerText((row.tipo_residuo ?? '').trim() || '—', 10, 'normal')
  dashedRule()

  linha('Peso Bruto', formatPeso(row.peso_bruto))
  linha('Tara', formatPeso(row.peso_tara))
  linha('Peso Liquido', formatPeso(row.peso_liquido))
  dashedRule()

  linha('Balanceiro', extras?.balanceiro ?? '—')
  linha('Motorista', (row.motorista ?? '').trim() || '—')
  linha('PLACA', (row.placa ?? '').trim() || '—')
  y += 2
  centerText('EMPRESA', 11)
  centerText(extras?.empresaTransporte ?? empresaTicketImpressaoRg(), 10, 'normal')
  dashedRule()

  linha('OBS', extras?.descricao?.trim() || '—')
  dashedRule()

  linha('Hora Entrada', extras?.horaEntrada ?? '—')
  linha('Hora Saida', extras?.horaSaida ?? '—')

  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    URL.revokeObjectURL(url)
    return {
      ok: false,
      message: 'O navegador bloqueou a abertura do PDF. Permita pop-ups para este site.',
    }
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000)
  return { ok: true }
}
