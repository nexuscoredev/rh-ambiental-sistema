import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RhColaboradorRelatorioLinha } from './rhColaboradores'

export function exportarCsvRhColaboradores(
  linhas: RhColaboradorRelatorioLinha[],
  nomeBase = 'relatorio-colaboradores'
): void {
  const esc = (s: string | number) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return `"${t}"`
  }
  const header = [
    'Nome',
    'CPF',
    'Admissão',
    'Cargo/Função',
    'Departamento',
    'Status',
    'E-mail',
    'Telefone',
    'Motorista vinculado',
  ]
    .map(esc)
    .join(';')
  const body = linhas
    .map((l) =>
      [
        esc(l.nome),
        esc(l.cpf),
        esc(l.dataAdmissao),
        esc(l.cargoFuncao),
        esc(l.departamento),
        esc(l.status),
        esc(l.email),
        esc(l.telefone),
        esc(l.motorista),
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

export function gerarRelatorioRhColaboradoresPdf(input: {
  linhas: RhColaboradorRelatorioLinha[]
  filtroBusca: string
  filtroStatus: string
}): void {
  const { linhas, filtroBusca, filtroStatus } = input
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margem = 36
  let y = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Relatório — Colaboradores (RH)', margem, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Departamento Pessoal — cadastro de funcionários', margem, y)
  y += 16

  const agora = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
  doc.text(`Gerado em: ${agora}`, margem, y)
  y += 14
  doc.text(`Busca: ${filtroBusca.trim() || '—'} · Status: ${filtroStatus || 'Todos'}`, margem, y)
  y += 14
  doc.text(`Total: ${linhas.length}`, margem, y)
  y += 8

  autoTable(doc, {
    startY: y + 6,
    head: [
      [
        'Nome',
        'CPF',
        'Admissão',
        'Cargo/Função',
        'Departamento',
        'Status',
        'E-mail',
        'Telefone',
        'Motorista',
      ],
    ],
    body: linhas.map((l) => [
      l.nome,
      l.cpf,
      l.dataAdmissao,
      l.cargoFuncao,
      l.departamento,
      l.status,
      l.email,
      l.telefone,
      l.motorista,
    ]),
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 7 },
    margin: { left: margem, right: margem },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 68 },
      2: { cellWidth: 52 },
      3: { cellWidth: 72 },
      4: { cellWidth: 72 },
      5: { cellWidth: 44 },
      6: { cellWidth: 88 },
      7: { cellWidth: 68 },
      8: { cellWidth: 72 },
    },
  })

  doc.save(`relatorio-colaboradores_${new Date().toISOString().slice(0, 10)}.pdf`)
}
