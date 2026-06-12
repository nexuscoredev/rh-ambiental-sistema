/**
 * Guia de padronização de cadastro para faturamento (feedback RG).
 * Uso: node scripts/gerar-padronizacao-cadastro-faturamento-pdf.mjs
 */
import { jsPDF } from 'jspdf'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'docs', 'padronizacao-cadastro-faturamento-rg.pdf')

const MARGEM = 48
const LARGURA = 499
const VERDE = [15, 118, 110]
const CINZA = [100, 116, 139]
const VERMELHO = [180, 83, 9]

function novaPaginaSePreciso(doc, y, minimo = 72) {
  const pageH = doc.internal.pageSize.getHeight()
  if (y > pageH - minimo) {
    doc.addPage()
    return 56
  }
  return y
}

function tituloSecao(doc, texto, y) {
  y = novaPaginaSePreciso(doc, y, 80)
  doc.setFillColor(...VERDE)
  doc.rect(MARGEM, y - 14, 6, 18, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text(texto, MARGEM + 14, y)
  return y + 28
}

function paragrafo(doc, texto, y, opts = {}) {
  const { bold = false, size = 10, color = [30, 41, 59], indent = 0, gap = 6 } = opts
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...color)
  const linhas = doc.splitTextToSize(texto, LARGURA - indent)
  for (const linha of linhas) {
    y = novaPaginaSePreciso(doc, y, 40)
    doc.text(linha, MARGEM + indent, y)
    y += size * 1.45
  }
  return y + gap
}

function tabelaSimples(doc, cabecalhos, linhas, y) {
  const colW = [150, 160, LARGURA - 310]
  y = novaPaginaSePreciso(doc, y, 60)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  let x = MARGEM
  for (let i = 0; i < cabecalhos.length; i++) {
    doc.text(cabecalhos[i], x + 4, y)
    x += colW[i]
  }
  y += 16
  doc.setDrawColor(226, 232, 240)
  doc.line(MARGEM, y - 6, MARGEM + LARGURA, y - 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  for (const row of linhas) {
    y = novaPaginaSePreciso(doc, y, 50)
    let maxH = 0
    const cells = row.map((cell, i) => {
      const linhasCell = doc.splitTextToSize(cell, colW[i] - 8)
      maxH = Math.max(maxH, linhasCell.length * 11)
      return linhasCell
    })
    x = MARGEM
    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i], x + 4, y)
      x += colW[i]
    }
    y += maxH + 8
  }
  return y + 8
}

function bullet(doc, texto, y, indent = 12) {
  y = novaPaginaSePreciso(doc, y, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(51, 65, 85)
  doc.text('•', MARGEM + indent - 8, y)
  const linhas = doc.splitTextToSize(texto, LARGURA - indent - 8)
  doc.text(linhas, MARGEM + indent, y)
  return y + linhas.length * 13 + 4
}

function destaque(doc, texto, y) {
  y = novaPaginaSePreciso(doc, y, 60)
  doc.setFillColor(255, 251, 235)
  doc.setDrawColor(251, 191, 36)
  const linhas = doc.splitTextToSize(texto, LARGURA - 24)
  const h = linhas.length * 13 + 20
  doc.roundedRect(MARGEM, y - 8, LARGURA, h, 4, 4, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...VERMELHO)
  doc.text(linhas, MARGEM + 12, y + 8)
  return y + h + 10
}

function rodapePaginas(doc) {
  const total = doc.getNumberOfPages()
  const gerado = new Date().toLocaleString('pt-BR')
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text('RG Ambiental · Padronização de cadastro e faturamento · Documento interno', MARGEM, doc.internal.pageSize.getHeight() - 28)
    doc.text(`Gerado em ${gerado} · Página ${i} de ${total}`, MARGEM + LARGURA - 140, doc.internal.pageSize.getHeight() - 28)
  }
}

function gerar() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 56

  doc.setFillColor(...VERDE)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 100, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text('Padronização de cadastro', MARGEM, 48)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Nomes que confundem o faturamento — guia para feedback à equipe RG', MARGEM, 72)
  y = 120

  y = paragrafo(
    doc,
    'Este documento lista padrões de nomenclatura que causam valores zerados, match errado ou retrabalho no faturamento. O sistema compara textos entre programação, contrato do cliente, MTR, coleta e ticket — não adivinha variações.',
    y
  )

  y = tituloSecao(doc, '1. Onde cada nome vive', y)
  y = tabelaSimples(
    doc,
    ['Onde', 'Campo', 'Exemplo'],
    [
      ['Programação', 'tipo_caminhao', 'Vacuo de 15'],
      ['Contrato', 'veiculos_contrato', 'VACUO - FOSSA, ROLON'],
      ['Contrato', 'equipamentos_contrato', 'Vacuo de 15, CONTAINER 1,2 (LOG)'],
      ['Contrato', 'residuos_contrato', 'FOSSA + classificação Líquido'],
      ['MTR', 'contrato_veiculos / equipamentos', 'Seleção do contrato (sem preço)'],
      ['MTR', 'residuo.caracterizacao', 'FOSSA'],
      ['Coleta / ticket', 'tipo_residuo', 'FOSSA — Classe II'],
    ],
    y
  )

  y = tituloSecao(doc, '2. Caso clássico: VÁCUO', y)
  y = destaque(
    doc,
    'Programação fala de tamanho do caminhão (Vacuo de 15). Contrato fala de serviço cobrável (VACUO - FOSSA). São campos diferentes — não trocar.',
    y
  )
  y = tabelaSimples(
    doc,
    ['Texto', 'O que parece', 'O que o sistema entende'],
    [
      ['VACUO', 'Tipo de serviço', 'Linha de veículo no contrato'],
      ['Vacuo de 15', 'Mesmo vácuo', 'Programação OU equipamento'],
      ['VACUO - FOSSA', 'Variante', 'Outra linha de veículo no contrato'],
    ],
    y
  )
  y = paragrafo(doc, 'Catálogo oficial de programação (tipo_caminhao):', y, { bold: true, size: 9.5 })
  y = bullet(doc, 'Baú, Fiorino', y)
  y = bullet(doc, 'Rollon Caixa Alta, Rollon Caixa baixa, Rollon Caixa de 30, Rollon caixa de 40', y)
  y = bullet(doc, 'Vacuo de 13, Vacuo de 15 (exatamente assim — sem VACUO, Vácuo ou Vacuo 15)', y)
  y = bullet(doc, 'Carreta de 30, Carreta de 40, Graneleira', y)
  y = bullet(doc, 'Polli (Caçamba de 5), Polli (Caçamba de 7), Polli (Caçamba de 10)', y)

  y = tituloSecao(doc, '3. Veículos no contrato — evitar', y)
  for (const t of [
    'VACUO vs VACUO - FOSSA vs CAMINHÃO VACUO - EFLUENTE — match parcial pode pegar veículo errado.',
    'ROLON vs Rollon Caixa de 30 — programação não é linha de preço do contrato.',
    'Vacuo de 15 cadastrado como veículo — é nome de programação, salvo se for item cobrável distinto.',
    'Veículo marcado sem custo — R$ 0,00 está correto; não é bug do sistema.',
    'descricao_veiculo (legado) diferente de veiculos_contrato (JSON) — dois cadastros para a mesma coisa.',
  ]) {
    y = bullet(doc, t, y)
  }

  y = tituloSecao(doc, '4. Equipamentos — evitar', y)
  for (const t of [
    'Vacuo de 15 como equipamento E como programação — duplicidade; faturamento não sabe onde cobrar.',
    'Equipamento sem “com custo” no contrato — valor sempre zero.',
    'Descrições genéricas: Caçamba, Vácuo, Equipamento.',
    'CONTAINER 1,2 (LOG) vs Container 1.2 — pontuação e maiúsculas quebram o match.',
  ]) {
    y = bullet(doc, t, y)
  }

  y = tituloSecao(doc, '5. Resíduos — maior fonte de erro', y)
  y = paragrafo(
    doc,
    'Contrato: tipo_residuo + classificacao (ex.: FOSSA — Líquido). Coleta: muitas vezes NOME — Classe I/II. Classificação do contrato (Líquido/Sólido) não é a mesma coisa que Classe I/II na coleta.',
    y,
    { size: 9.5 }
  )
  y = tabelaSimples(
    doc,
    ['Na coleta', 'No contrato', 'Resultado'],
    [
      ['FOSSA — Classe II', 'FOSSA + Líquido', 'Pode casar ou falhar'],
      ['ENTULHO — Classe II', 'só CLASSE II', 'Match frágil — preço errado'],
      ['CLASSE II (só isso)', 'Classe II', 'Genérico demais'],
      ['Mix contaminado — Classe I', '(sem match)', 'Cadastro incompleto'],
      ['TROCA CAÇAMBA 7M³ - LODO', '(sem match)', 'Serviço sem linha no contrato'],
      ['RECICLADO — Classe II', 'RECICLADO valor 0', 'Casa, mas sem preço'],
      ['BORRA DE ÓLEO — LÍQUIDO', '(sem match)', 'Falta linha no contrato'],
      ['PLÁSTICO / PAPEL', '(sem match)', 'Resíduo não cadastrado'],
      ['FRETE', 'FRETE valor 0', 'Linha existe, preço zerado'],
    ],
    y
  )
  y = paragrafo(doc, 'Variações que parecem iguais, mas não são:', y, { bold: true, size: 9.5 })
  for (const t of [
    'CLASSE II vs Classe II vs Classe 2',
    'SEMISSÓLIDO vs Semissólido vs SÓLIDO',
    'Mix contaminado vs MIX DE CONTAMINADO vs MIX CONTAMINADO — SÓLIDO',
    'Efluente vs EFLUENTE vs Efluente — Classe I',
  ]) {
    y = bullet(doc, t, y)
  }

  y = tituloSecao(doc, '6. Erros silenciosos (zeram sem “parecer” erro)', y)
  for (const t of [
    'Linha no contrato com valor R$ 0,00 — parece cadastrada, não fatura.',
    'Veículo sem custo ou equipamento sem “com custo” — zero correto.',
    'Resíduo só no campo legado tipo_residuo (texto), não em residuos_contrato (JSON).',
    'Contrato genérico CLASSE II + coleta específica ENTULHO — Classe II — match perigoso.',
    'MTR com FOSSA, ticket com FOSSA — Classe II, contrato com VACUO - FOSSA — trio incoerente.',
  ]) {
    y = bullet(doc, t, y)
  }

  y = tituloSecao(doc, '7. Checklist para cadastro', y)
  y = paragrafo(doc, 'Contrato do cliente:', y, { bold: true, size: 10 })
  for (const t of [
    'Todo resíduo cobrado tem linha em residuos_contrato com valor > 0 (ou sem custo explícito).',
    'tipo_residuo = nome curto (FOSSA), não só CLASSE II.',
    'classificacao = estado físico (Líquido, Sólido), não Classe I/II.',
    'Veículos com preço têm nome estável; não repetir Vacuo de 15 da programação.',
    'Equipamentos cobráveis: “com custo” + valor preenchido.',
  ]) {
    y = bullet(doc, t, y)
  }
  y = paragrafo(doc, 'Programação:', y, { bold: true, size: 10 })
  y = bullet(doc, 'tipo_caminhao = só opção do catálogo (Vacuo de 15, nunca VACUO).', y)
  y = paragrafo(doc, 'MTR:', y, { bold: true, size: 10 })
  for (const t of [
    'Selecionar veículo/equipamento/resíduo do contrato — não digitar variantes.',
    'caracterizacao = mesmo tipo_residuo do contrato.',
  ]) {
    y = bullet(doc, t, y)
  }
  y = paragrafo(doc, 'Pesagem / ticket:', y, { bold: true, size: 10 })
  y = bullet(doc, 'tipo_residuo da coleta: mesmo núcleo do contrato + sufixo de classe se preciso (ex.: FOSSA — Classe II). Evitar só CLASSE II.', y)

  y = tituloSecao(doc, '8. Frases para reunião com a equipe', y)
  for (const t of [
    '“Se no contrato o resíduo chama FOSSA, na MTR tem que ser FOSSA, não só Classe II.”',
    '“Cadastro com valor zero conta como ‘tem contrato’, mas o faturamento avisa sem preço.”',
    '“Antes de culpar o sistema, conferir se contrato, MTR e ticket usam o mesmo nome-base.”',
    '“184+ coletas na fila bateram em linha sem taxa ou sem match — revisar contrato primeiro.”',
  ]) {
    y = bullet(doc, t, y)
  }

  y = tituloSecao(doc, '9. Prioridade de limpeza', y)
  for (const t of [
    '1. Clientes vácuo/fossa — padronizar VACUO, VACUO - FOSSA, Vacuo de 13/15.',
    '2. Linhas só CLASSE II / CLASSE I — substituir por resíduo específico.',
    '3. Contratos com valor 0 nas linhas mais usadas (RECICLADO, FRETE, MADEIRA).',
    '4. Coletas “sem match” no diagnóstico — cadastrar resíduo ou corrigir texto da coleta.',
  ]) {
    y = bullet(doc, t, y)
  }

  y = paragrafo(
    doc,
    'Diagnóstico automático: npm run diagnostico:saude-faturamento (relatório JSON em scripts/).',
    y,
    { size: 8.5, color: CINZA, gap: 0 }
  )

  rodapePaginas(doc)
  mkdirSync(dirname(OUT), { recursive: true })
  const buf = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(OUT, buf)
  console.log(`PDF gerado: ${OUT}`)
}

gerar()
