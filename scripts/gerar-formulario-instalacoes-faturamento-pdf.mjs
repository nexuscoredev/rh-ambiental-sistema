/**
 * Gera PDF: contexto + decisões para Fases 2 e 3 (Instalações/Entregas × Faturamento).
 * Uso: node scripts/gerar-formulario-instalacoes-faturamento-pdf.mjs
 */
import { jsPDF } from 'jspdf'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'docs', 'formulario-instalacoes-entregas-faturamento.pdf')

const MARGEM = 48
const LARGURA_TEXTO = 499
const COR_VERDE = [15, 118, 110]
const COR_CINZA = [100, 116, 139]

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
  doc.setFillColor(...COR_VERDE)
  doc.rect(MARGEM, y - 14, 6, 18, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text(texto, MARGEM + 14, y)
  return y + 28
}

function paragrafo(doc, texto, y, opts = {}) {
  const { bold = false, size = 10, color = [30, 41, 59], indent = 0 } = opts
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...color)
  const linhas = doc.splitTextToSize(texto, LARGURA_TEXTO - indent)
  for (const linha of linhas) {
    y = novaPaginaSePreciso(doc, y, 40)
    doc.text(linha, MARGEM + indent, y)
    y += size * 1.45
  }
  return y + 6
}

function itemLista(doc, rotulo, descricao, y) {
  y = novaPaginaSePreciso(doc, y, 56)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  const rotuloLinhas = doc.splitTextToSize(rotulo, LARGURA_TEXTO - 20)
  doc.text(rotuloLinhas, MARGEM + 8, y)
  y += rotuloLinhas.length * 14 + 4
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)
  const descLinhas = doc.splitTextToSize(descricao, LARGURA_TEXTO - 20)
  for (const linha of descLinhas) {
    y = novaPaginaSePreciso(doc, y, 40)
    doc.text(linha, MARGEM + 8, y)
    y += 14
  }
  return y + 10
}

function perguntaDecisao(doc, numero, pergunta, opcoes, y) {
  y = novaPaginaSePreciso(doc, y, 100)
  doc.setFillColor(241, 245, 249)
  const boxH = 18 + opcoes.length * 22 + 36
  y = novaPaginaSePreciso(doc, y, boxH + 20)
  const yBox = y - 4
  doc.roundedRect(MARGEM, yBox, LARGURA_TEXTO, boxH, 4, 4, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(MARGEM, yBox, LARGURA_TEXTO, boxH, 4, 4, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  const perguntaLinhas = doc.splitTextToSize(`${numero}. ${pergunta}`, LARGURA_TEXTO - 24)
  let ty = y + 12
  doc.text(perguntaLinhas, MARGEM + 12, ty)
  ty += perguntaLinhas.length * 13 + 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(71, 85, 105)
  for (const op of opcoes) {
    doc.rect(MARGEM + 14, ty - 8, 10, 10)
    doc.text(op, MARGEM + 30, ty)
    ty += 20
  }

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...COR_CINZA)
  doc.text('Observações / outro: ________________________________________________________________', MARGEM + 12, ty + 4)
  doc.text('________________________________________________________________________________', MARGEM + 12, ty + 18)

  return yBox + boxH + 16
}

function rodapePaginas(doc) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COR_CINZA)
    doc.text('Nexus · Sistema RG Ambiental · Documento interno', MARGEM, doc.internal.pageSize.getHeight() - 28)
    doc.text(`Página ${i} de ${total}`, MARGEM + LARGURA_TEXTO - 52, doc.internal.pageSize.getHeight() - 28)
  }
}

function gerar() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const dataDoc = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  // Capa
  doc.setFillColor(...COR_VERDE)
  doc.rect(0, 0, 595, 148, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('NEXUS · SISTEMA RG AMBIENTAL', MARGEM, 36)
  doc.setFontSize(22)
  doc.text('Instalações / Entregas', MARGEM, 62)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('Alinhamento com Faturamento — Fases 2 e 3', MARGEM, 84)
  doc.setFontSize(11)
  const notaCabecalho = doc.splitTextToSize(
    'Documento Nexus para decisão que envolve módulos do sistema (Programação, Faturamento e Frota).',
    LARGURA_TEXTO
  )
  doc.text(notaCabecalho, MARGEM, 104)

  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.text(`Documento gerado em ${dataDoc}`, MARGEM, 172)
  doc.text('Origem: Nexus — desenvolvimento e evolução do Sistema RG Ambiental', MARGEM, 188)
  doc.text('Destinatário: Equipe de Faturamento / Responsável comercial', MARGEM, 204)
  const objetivo = doc.splitTextToSize(
    'Objetivo: Entender o contexto e registrar decisões de negócio necessárias para implantar o faturamento deste fluxo nos módulos do sistema.',
    LARGURA_TEXTO
  )
  doc.text(objetivo, MARGEM, 220)

  let y = 252

  y = tituloSecao(doc, '1. Contexto — para entender o cenário', y)
  y = paragrafo(
    doc,
    'Na RG Ambiental existem dois tipos de serviço operacional distintos. O primeiro — e mais comum — é a coleta de resíduos: programação → MTR → controle de massa (pesagem) → ticket → faturamento → NF → financeiro. Esse fluxo está maduro no sistema e a lógica de valores (contrato, medição, esteira) foi aprovada e congelada em maio/2026.',
    y
  )
  y = paragrafo(
    doc,
    'O segundo tipo é Instalações/Entregas: a RG leva e instala equipamento (caçamba, container, etc.) nas dependências do cliente. Não há resíduo coletado, não há pesagem e não há MTR/ticket no mesmo sentido da coleta. O documento oficial para o cliente é a Declaração de Entrega de Equipamento (layout já padronizado no sistema).',
    y
  )
  y = paragrafo(
    doc,
    'Hoje, quando a programação é do tipo Instalações/Entregas, o operacional agenda o serviço, gera a declaração de entrega e marca a programação como concluída — sem passar por MTR nem ticket. Porém, esse serviço ainda não entra automaticamente na fila de faturamento, porque o módulo de Faturamento foi construído exclusivamente para coletas com MTR, peso líquido, ticket impresso e aprovação.',
    y
  )

  y = tituloSecao(doc, '2. O que já está implantado (Fase 1 — concluída)', y)
  y = itemLista(
    doc,
    'Programação',
    'Tipo de serviço Instalações/Entregas disponível no calendário. Badge visual indicando fluxo sem MTR/ticket.',
    y
  )
  y = itemLista(
    doc,
    'Declaração de entrega',
    'Botão na programação que gera o documento oficial (mesmo layout do anexo aprovado), com cliente, endereço, equipamentos e data pré-preenchidos.',
    y
  )
  y = itemLista(
    doc,
    'Conclusão operacional',
    'Ao confirmar a declaração, a programação passa ao status Concluída.',
    y
  )
  y = itemLista(
    doc,
    'Frota (movimentação)',
    'Registos de instalação na aba Transportes também podem gerar a mesma declaração (casos avulsos).',
    y
  )
  y = paragrafo(
    doc,
    'Importante: a Fase 1 não alterou nenhuma regra de faturamento das coletas normais. O que falta é definir como as instalações passam a ser cobradas e em que momento entram na esteira financeira.',
    y,
    { bold: true }
  )

  y = tituloSecao(doc, '3. Por que precisamos deste alinhamento', y)
  y = paragrafo(
    doc,
    'Para a Fase 2, o sistema precisará abrir um caminho paralelo no Faturamento — uma “faixa” só para instalação/entrega — sem exigir MTR, peso ou ticket, mas reutilizando a mesma esteira (ajuste de valores → relatório de medição → emissão → contas a receber) sempre que fizer sentido para o negócio.',
    y
  )
  y = paragrafo(
    doc,
    'Qualquer mudança na lógica de faturamento exige decisão explícita do responsável de produto/faturamento e atualização do documento oficial de regras (faturamento-logica-aprovada). Por isso, antes de programar a Fase 2, precisamos das respostas abaixo — preferencialmente por escrito neste formulário.',
    y
  )

  doc.addPage()
  y = 56
  y = tituloSecao(doc, '4. Decisões necessárias — Fase 2 (Faturamento)', y)
  y = paragrafo(
    doc,
    'Marque a opção aplicável em cada pergunta. Se nenhuma couber, use o campo de observações. As respostas orientarão a implementação técnica.',
    y,
    { color: COR_CINZA }
  )

  y = perguntaDecisao(
    doc,
    '4.1',
    'O que deve ser cobrado em uma instalação/entrega?',
    [
      'Somente equipamento (valor do contrato)',
      'Equipamento + frete (caminhão/veículo do contrato)',
      'Taxa fixa de instalação (valor diferente do contrato de coleta)',
      'Combinar conforme o cliente (definir caso a caso)',
    ],
    y
  )

  y = perguntaDecisao(
    doc,
    '4.2',
    'Uma programação com vários equipamentos gera quantos lançamentos para faturamento?',
    [
      'Um único lançamento com o total',
      'Uma linha por equipamento no mesmo lançamento',
      'Um lançamento separado por equipamento',
    ],
    y
  )

  y = perguntaDecisao(
    doc,
    '4.3',
    'Quando o serviço fica “pronto para faturar”?',
    [
      'Automaticamente ao gerar/confirmar a declaração de entrega',
      'Somente após clique manual “Registrar para faturamento”',
      'Após conferência/aprovação de outra área (qual?)',
    ],
    y
  )

  y = perguntaDecisao(
    doc,
    '4.4',
    'A instalação precisa passar pela mesma esteira das coletas?',
    [
      'Sim — ajuste de valores, relatório de medição (~30 dias) e aprovação',
      'Parcial — pular ticket e pesagem, mas manter medição e aprovação',
      'Não — pode ir direto para emissão/NF após conferência simples',
    ],
    y
  )

  y = perguntaDecisao(
    doc,
    '4.5',
    'A declaração de entrega assinada é prova suficiente para faturar?',
    [
      'Sim, basta a declaração (com responsável pelo recebimento)',
      'Sim, mas o responsável pelo recebimento deve ser obrigatório',
      'Não — exige outro documento ou evidência (especificar)',
    ],
    y
  )

  y = perguntaDecisao(
    doc,
    '4.6',
    'Instalação e coleta no mesmo cliente/período:',
    [
      'Entram no mesmo relatório de medição do cliente',
      'Faturamento de instalação sempre separado da coleta',
      'Depende do contrato do cliente',
    ],
    y
  )

  doc.addPage()
  y = 56
  y = tituloSecao(doc, '5. Decisões necessárias — Fase 3 (Rastreio em Frota)', y)
  y = paragrafo(
    doc,
    'A Fase 3 é opcional e não altera valores. Serve apenas para histórico operacional (movimentação de equipamento ligada à programação).',
    y,
    { color: COR_CINZA }
  )

  y = perguntaDecisao(
    doc,
    '5.1',
    'Ao concluir instalação na programação, deve criar registo automático na Frota?',
    ['Sim, automaticamente', 'Não, operador regista manualmente se quiser', 'Sim, mas só se houver fotos/assinatura'],
    y
  )

  y = perguntaDecisao(
    doc,
    '5.2',
    'Instalações feitas só pela Frota (sem programação) continuam como hoje?',
    ['Sim, fluxo independente', 'Não, devem obrigatoriamente passar pela programação'],
    y
  )

  y = tituloSecao(doc, '6. Resumo — cinco decisões mínimas para desbloquear a Fase 2', y)
  y = paragrafo(doc, 'Preencha de forma objetiva (pode ser à mão após imprimir):', y)

  const resumo = [
    ['1. Composição do valor:', '_______________________________________________________________'],
    ['2. Um ou vários lançamentos por programação:', '________________________________________'],
    ['3. Gatilho (automático ou manual):', '____________________________________________________'],
    ['4. Esteira (completa, parcial ou atalho):', '_______________________________________________'],
    ['5. Evidência documental aceita:', '________________________________________________________'],
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  for (const [rotulo, linha] of resumo) {
    y = novaPaginaSePreciso(doc, y, 36)
    doc.setFont('helvetica', 'bold')
    doc.text(rotulo, MARGEM, y)
    doc.setFont('helvetica', 'normal')
    doc.text(linha, MARGEM + 160, y)
    y += 28
  }

  y += 16
  y = tituloSecao(doc, '7. Validação', y)
  y = paragrafo(doc, 'Responsável Faturamento / Comercial:', y)
  y += 8
  doc.text('Nome: ________________________________________________', MARGEM, y)
  y += 24
  doc.text('Data: ____/____/________', MARGEM, y)
  y += 24
  doc.text('Assinatura: __________________________________________', MARGEM, y)
  y += 32
  y = paragrafo(
    doc,
    'Após devolução deste formulário, a equipe de desenvolvimento atualizará o documento de lógica aprovada e implementará a Fase 2 conforme as decisões registradas.',
    y,
    { size: 9, color: COR_CINZA }
  )

  rodapePaginas(doc)

  mkdirSync(dirname(OUT), { recursive: true })
  const buf = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(OUT, buf)
  const htmlOut = join(__dirname, '..', 'docs', 'formulario-instalacoes-entregas-faturamento.html')
  console.log('')
  console.log('[ok] PDF gerado com sucesso!')
  console.log(`     ${OUT}`)
  console.log('')
  console.log('Se o PDF nao abrir no Cursor, use uma destas opcoes:')
  console.log('  1) Abra o ficheiro no Explorador de Ficheiros (duplo clique)')
  console.log('  2) Abra o HTML e imprima como PDF:')
  console.log(`     ${htmlOut}`)
  console.log('     Botao "Imprimir / Guardar PDF" ou Ctrl+P -> Microsoft Print to PDF')
  console.log('')
  console.log('Comando: npm run pdf:formulario-instalacoes')
}

gerar()
