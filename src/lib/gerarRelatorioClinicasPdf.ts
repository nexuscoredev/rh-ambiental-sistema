import { jsPDF } from 'jspdf'
import { invokeAutoTable, salvarPdfJsDoc, textoPdfSeguro } from './clinicasPdfSalvar'
import type {
  ClinicaOrdemServicoDetalhe,
  ClinicaRelatorio30dRow,
  ClinicaUnidade,
} from './clinicasTypes'

function finalYAutotable(doc: jsPDF): number {
  const y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
  return typeof y === 'number' ? y : 0
}

function formatMoeda(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function rotuloStatusOs(status: string): string {
  switch (status) {
    case 'aguardando_faturamento':
      return 'Aguardando faturamento'
    case 'emitida':
      return 'Emitida'
    case 'cancelada':
      return 'Cancelada'
    default:
      return status
  }
}

function rotuloMeioCobranca(emiteNota: boolean, pagamentoPix: boolean): string {
  if (emiteNota) return 'Emite NF'
  if (pagamentoPix) return 'PIX (sem NF)'
  return 'Padrao'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [y, m, da] = iso.slice(0, 10).split('-')
  if (!y || !m || !da) return iso
  return `${da}/${m}/${y}`
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return formatDate(iso)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatDocCnpjCpf(cnpj: string | null, cpf: string | null): string {
  if (cnpj && cnpj.length === 14) {
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
  }
  if (cpf && cpf.length === 11) {
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
  }
  return cnpj || cpf || '-'
}

function t(text: string): string {
  return textoPdfSeguro(text)
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

export type ResumoClinicasGestaoPdf = {
  qtdUnidades: number
  qtdUnidadesAtivas: number
  qtdOrdens: number
  qtdOrdensEmitidas: number
  qtdOrdensAguardando: number
  totalEmitido30d: number
  totalPendente30d: number
}

export function calcularResumoClinicasGestao(input: {
  unidades: ClinicaUnidade[]
  ordens: { status: string; faturamento_valor: number | null }[]
  relatorio30d: ClinicaRelatorio30dRow[]
}): ResumoClinicasGestaoPdf {
  let totalEmitido30d = 0
  let totalPendente30d = 0
  for (const r of input.relatorio30d) {
    totalEmitido30d += r.valor_emitido_total
    totalPendente30d += r.valor_pendente_total
  }
  return {
    qtdUnidades: input.unidades.length,
    qtdUnidadesAtivas: input.unidades.filter((u) => u.ativo).length,
    qtdOrdens: input.ordens.length,
    qtdOrdensEmitidas: input.ordens.filter((o) => o.status === 'emitida').length,
    qtdOrdensAguardando: input.ordens.filter((o) => o.status === 'aguardando_faturamento').length,
    totalEmitido30d,
    totalPendente30d,
  }
}

export type GerarRelatorioClinicasGestaoInput = {
  grupoNome: string
  unidades: ClinicaUnidade[]
  ordens: ClinicaOrdemServicoDetalhe[]
  relatorio30d: ClinicaRelatorio30dRow[]
  filtroOsRotulo?: string
}

export function gerarRelatorioClinicasGestaoPdf(input: GerarRelatorioClinicasGestaoInput): void {
  const { grupoNome, unidades, ordens, relatorio30d, filtroOsRotulo } = input
  const resumo = calcularResumoClinicasGestao({ unidades, ordens, relatorio30d })

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margem = 40
  let y = 44

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(t('Relatorio - Clinicas'), margem, y)
  y += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(t(`Grupo mae: ${grupoNome} - Cadastro, O.S. e consolidado (30 dias)`), margem, y)
  y += 18
  doc.text(`Gerado em: ${dataHoraGeracao()}`, margem, y)
  y += 14
  if (filtroOsRotulo) {
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(t(`Filtro O.S.: ${filtroOsRotulo}`), margem, y)
    doc.setTextColor(0, 0, 0)
    y += 14
  }
  y += 6

  invokeAutoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Unidades (ativas / total)', `${resumo.qtdUnidadesAtivas} / ${resumo.qtdUnidades}`],
      ['Ordens de servico no relatorio', String(resumo.qtdOrdens)],
      ['O.S. emitidas (amostra)', String(resumo.qtdOrdensEmitidas)],
      ['O.S. aguardando faturamento (amostra)', String(resumo.qtdOrdensAguardando)],
      ['Total emitido (30 dias)', formatMoeda(resumo.totalEmitido30d)],
      ['Total pendente (30 dias)', formatMoeda(resumo.totalPendente30d)],
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
  doc.text(t(`Unidades (${unidades.length})`), margem, y)
  y += 14

  const corpoUnidades =
    unidades.length > 0
      ? unidades.map((u) => [
          t((u.razao_social || '-').slice(0, 42)),
          formatDocCnpjCpf(u.cnpj, u.cpf),
          t((u.endereco_coleta || '-').slice(0, 36)),
          rotuloMeioCobranca(u.emite_nota, u.pagamento_pix),
          u.ativo ? 'Sim' : 'Nao',
        ])
      : [['-', '-', '-', '-', 'Nenhuma unidade.']]

  invokeAutoTable(doc, {
    startY: y,
    head: [['Razao social', 'CNPJ / CPF', 'Endereco', 'NF / PIX', 'Ativo']],
    body: corpoUnidades,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    margin: { left: margem, right: margem },
  })

  y = finalYAutotable(doc) + 22
  if (y > 640) {
    doc.addPage()
    y = 44
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(t(`Ordens de servico (${ordens.length})`), margem, y)
  y += 14

  const corpoOs =
    ordens.length > 0
      ? ordens.map((o) => [
          o.numero_os,
          t((o.razao_social || '-').slice(0, 36)),
          formatDate(o.data_servico),
          rotuloStatusOs(o.status),
          o.faturamento_valor != null && o.faturamento_valor > 0
            ? formatMoeda(o.faturamento_valor)
            : '-',
        ])
      : [['-', '-', '-', '-', 'Nenhuma O.S. no filtro atual.']]

  invokeAutoTable(doc, {
    startY: y,
    head: [['O.S.', 'Unidade', 'Data serv.', 'Status', 'Valor']],
    body: corpoOs,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    margin: { left: margem, right: margem },
  })

  y = finalYAutotable(doc) + 22
  if (y > 640) {
    doc.addPage()
    y = 44
  }

  const relFiltrado = relatorio30d.filter((r) => r.qtd_os > 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(t(`Consolidado - ultimos 30 dias (${relFiltrado.length} unidades)`), margem, y)
  y += 14

  const corpoRel =
    relFiltrado.length > 0
      ? relFiltrado.map((r) => [
          t((r.razao_social || '-').slice(0, 40)),
          String(r.qtd_os),
          formatMoeda(r.valor_emitido_total),
          formatMoeda(r.valor_pendente_total),
          `${formatDate(r.primeira_data)} - ${formatDate(r.ultima_data)}`,
        ])
      : [['-', '-', '-', '-', 'Sem movimentacao no periodo.']]

  invokeAutoTable(doc, {
    startY: y,
    head: [['Unidade', 'Qtd O.S.', 'Emitido', 'Pendente', 'Período']],
    body: corpoRel,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    margin: { left: margem, right: margem },
  })

  const iso = new Date().toISOString().slice(0, 10)
  salvarPdfJsDoc(doc, `relatorio-clinicas-gestao_${iso}.pdf`)
}

export type FiltrosHistoricoClinicasPdf = {
  dataDe: string
  dataAte: string
  busca?: string
}

export function gerarRelatorioClinicasHistoricoPdf(input: {
  ordens: ClinicaOrdemServicoDetalhe[]
  filtros: FiltrosHistoricoClinicasPdf
}): void {
  const { ordens, filtros } = input
  const totalValor = ordens.reduce((s, o) => s + (o.faturamento_valor ?? 0), 0)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margem = 40
  let y = 44

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(t('Historico - O.S. clinicas faturadas'), margem, y)
  y += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(t('Ordens emitidas no faturamento de clinicas (sem pesagem nem ticket)'), margem, y)
  y += 18
  doc.text(`Gerado em: ${dataHoraGeracao()}`, margem, y)
  y += 16
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  const filtrosTxt = [
    `Periodo (data do servico): ${formatDate(filtros.dataDe)} a ${formatDate(filtros.dataAte)}`,
    filtros.busca?.trim() ? `Busca: ${filtros.busca.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' - ')
  doc.text(t(filtrosTxt), margem, y)
  doc.setTextColor(0, 0, 0)
  y += 20

  invokeAutoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['O.S. no relatorio', String(ordens.length)],
      ['Soma dos valores faturados', formatMoeda(totalValor)],
    ],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: margem, right: margem },
  })

  y = finalYAutotable(doc) + 22

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(t(`Detalhe (${ordens.length} linha${ordens.length === 1 ? '' : 's'})`), margem, y)
  y += 14

  const corpo =
    ordens.length > 0
      ? ordens.map((o) => [
          o.numero_os,
          t((o.razao_social || '-').slice(0, 32)),
          formatDocCnpjCpf(o.cnpj, o.cpf),
          formatDate(o.data_servico),
          rotuloMeioCobranca(o.emite_nota_snapshot, o.pagamento_pix_snapshot),
          t(o.referencia_nf?.trim() || '-'),
          o.faturamento_valor != null ? formatMoeda(o.faturamento_valor) : '-',
          formatDateTime(o.nf_registrada_em),
        ])
      : [['-', '-', '-', '-', '-', '-', '-', 'Nenhuma O.S. emitida no periodo.']]

  invokeAutoTable(doc, {
    startY: y,
    head: [['O.S.', 'Unidade', 'CNPJ/CPF', 'Data serv.', 'Cobranca', 'NF ref.', 'Valor', 'Emitida em']],
    body: corpo,
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7 },
    margin: { left: margem, right: margem },
  })

  const iso = new Date().toISOString().slice(0, 10)
  salvarPdfJsDoc(doc, `relatorio-clinicas-historico_${iso}.pdf`)
}
