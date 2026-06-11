export type KbQuizQuestao = {
  id: string
  pergunta: string
  opcoes: [string, string, string, string]
  respostaIndex: number
  explicacao: string
}

export type KbQuizModulo = {
  slug: string
  titulo: string
  notaMinima: number
  questoes: KbQuizQuestao[]
}

export const KB_QUIZZES: Record<string, KbQuizModulo> = {
  'fluxo-completo': {
    slug: 'fluxo-completo',
    titulo: 'Avaliação — Visão do fluxo',
    notaMinima: 100,
    questoes: [
      {
        id: 'fc1',
        pergunta: 'Qual a ordem correta do fluxo operacional RG?',
        opcoes: [
          'Financeiro → Programação → MTR → Ticket',
          'Programação → MTR → Pesagem/Ticket → Faturamento → Financeiro',
          'MTR → Programação → Faturamento → Ticket',
          'Ticket → Financeiro → Programação → MTR',
        ],
        respostaIndex: 1,
        explicacao:
          'Cada etapa alimenta a seguinte. Erros cedo (cliente, resíduo, peso) propagam até o financeiro.',
      },
      {
        id: 'fc2',
        pergunta: 'Por que o cadastro do cliente é crítico no início do fluxo?',
        opcoes: [
          'Só para impressão de relatórios',
          'Porque preços, contrato e e-mail NF vêm do cadastro — sem isso o faturamento zera',
          'Apenas para o RH',
          'Não impacta o faturamento',
        ],
        respostaIndex: 1,
        explicacao: 'Contrato (residuos_contrato) define valores que o faturamento sugere.',
      },
      {
        id: 'fc3',
        pergunta: 'O que fazer quando há divergência entre peso e contrato?',
        opcoes: [
          'Ignorar e emitir NF',
          'Voltar à etapa anterior e conferir dados antes de faturar',
          'Apagar a coleta',
          'Alterar só no financeiro',
        ],
        respostaIndex: 1,
        explicacao: 'Corrigir na origem evita retrabalho e cobrança incorreta.',
      },
    ],
  },
  programacao: {
    slug: 'programacao',
    titulo: 'Avaliação — Programação',
    notaMinima: 100,
    questoes: [
      {
        id: 'pg1',
        pergunta: 'O que a programação registra?',
        opcoes: [
          'Apenas o valor da NF',
          'Visita ao cliente: data, serviço, caminhão e resíduos previstos',
          'Somente o peso na balança',
          'Contas a pagar',
        ],
        respostaIndex: 1,
        explicacao: 'Programação agenda a operação que gera MTR e ticket depois.',
      },
      {
        id: 'pg2',
        pergunta: 'Onde a coleta programada aparece no sistema?',
        opcoes: [
          'Só no financeiro',
          'Calendário de Programações (Fluxo operacional)',
          'Apenas em PDF',
          'Não aparece até faturar',
        ],
        respostaIndex: 1,
        explicacao: 'Menu: Fluxo operacional → Programações.',
      },
    ],
  },
  mtr: {
    slug: 'mtr',
    titulo: 'Avaliação — MTR',
    notaMinima: 100,
    questoes: [
      {
        id: 'mtr1',
        pergunta: 'O que é a MTR?',
        opcoes: [
          'Nota fiscal de serviço',
          'Manifesto de Transporte de Resíduos — documento legal da coleta',
          'Ticket de pesagem',
          'Contrato comercial',
        ],
        respostaIndex: 1,
        explicacao: 'A MTR consolida gerador, transportador, resíduos e destinador.',
      },
      {
        id: 'mtr2',
        pergunta: 'De onde nasce a MTR na maioria dos casos?',
        opcoes: [
          'Do financeiro',
          'Da programação da coleta ou criação manual no gerenciador',
          'Do ticket apenas',
          'Do cadastro de motoristas',
        ],
        respostaIndex: 1,
        explicacao: 'Programação → MTR ou MTR Gerenciador.',
      },
    ],
  },
  'ticket-pesagem': {
    slug: 'ticket-pesagem',
    titulo: 'Avaliação — Pesagem e ticket',
    notaMinima: 100,
    questoes: [
      {
        id: 'tk1',
        pergunta: 'Qual o fluxo na tela Pesagem e Ticket?',
        opcoes: [
          'NF → Boleto → Ticket',
          'MTR → Pesagem → Ticket → Imprimir',
          'Programação → Financeiro',
          'Ticket → MTR → Programação',
        ],
        respostaIndex: 1,
        explicacao: 'Controle de Massa segue o stepper operacional.',
      },
      {
        id: 'tk2',
        pergunta: 'Após salvar pesagem e ticket, para onde vai a coleta?',
        opcoes: [
          'Arquivo morto',
          'Conferência / fila do Faturamento',
          'Direto para contas a pagar',
          'Não avança automaticamente',
        ],
        respostaIndex: 1,
        explicacao: 'Ticket liberado alimenta a esteira de faturamento.',
      },
    ],
  },
  faturamento: {
    slug: 'faturamento',
    titulo: 'Avaliação — Faturamento',
    notaMinima: 100,
    questoes: [
      {
        id: 'ft1',
        pergunta: 'De onde vêm os valores sugeridos no faturamento?',
        opcoes: [
          'Digitados manualmente sempre',
          'Cadastro do cliente (residuos_contrato), ticket e MTR',
          'Apenas do ticket, sem contrato',
          'Planilha externa obrigatória',
        ],
        respostaIndex: 1,
        explicacao: 'Sem match contrato ↔ resíduo da coleta, valor pode ficar zero.',
      },
      {
        id: 'ft2',
        pergunta: 'O que significa «valor zero no contrato»?',
        opcoes: [
          'Coleta gratuita aprovada',
          'Resíduo existe no cadastro mas sem preço — Comercial deve preencher',
          'Erro do sistema sempre',
          'Ticket inválido',
        ],
        respostaIndex: 1,
        explicacao: 'Alinhar cadastro comercial antes de emitir.',
      },
    ],
  },
  financeiro: {
    slug: 'financeiro',
    titulo: 'Avaliação — Financeiro',
    notaMinima: 100,
    questoes: [
      {
        id: 'fn1',
        pergunta: 'O que o financeiro faz após emissão no faturamento?',
        opcoes: [
          'Reprograma coletas',
          'NF, boleto, cobrança e contas a receber',
          'Emite MTR',
          'Pesa na balança',
        ],
        respostaIndex: 1,
        explicacao: 'Etapa final: cobrar o que foi medido e aprovado.',
      },
      {
        id: 'fn2',
        pergunta: 'Se medição e NF divergem, o que fazer?',
        opcoes: [
          'Emitir NF mesmo assim',
          'Voltar ao faturamento antes de emitir',
          'Apagar o cliente',
          'Ignorar diferença',
        ],
        respostaIndex: 1,
        explicacao: 'Conferir medição aprovada antes de cobrança.',
      },
    ],
  },
  clientes: {
    slug: 'clientes',
    titulo: 'Avaliação — Clientes',
    notaMinima: 100,
    questoes: [
      {
        id: 'cl1',
        pergunta: 'O que é residuos_contrato no cadastro?',
        opcoes: [
          'Lista de motoristas',
          'Preços por tipo de resíduo, frete e mínimos faturáveis',
          'Histórico de chat',
          'Fotos da frota',
        ],
        respostaIndex: 1,
        explicacao: 'Base comercial para o faturamento sugerir valores.',
      },
    ],
  },
  frota: {
    slug: 'frota',
    titulo: 'Avaliação — Frota',
    notaMinima: 100,
    questoes: [
      {
        id: 'fr1',
        pergunta: 'Para que serve o módulo Frota / Transportes?',
        opcoes: [
          'Emitir NF',
          'Registrar movimentação, manutenção e relatórios de equipamentos',
          'Cadastrar resíduos',
          'Aprovar tickets',
        ],
        respostaIndex: 1,
        explicacao: 'Apoio logístico ao fluxo operacional.',
      },
    ],
  },
  'conferencia-transporte': {
    slug: 'conferencia-transporte',
    titulo: 'Avaliação — Conferência',
    notaMinima: 100,
    questoes: [
      {
        id: 'cf1',
        pergunta: 'O que é a conferência de transportes?',
        opcoes: [
          'Fechamento contábil mensal',
          'Checklist do motorista, fotos e assinaturas da operação',
          'Cadastro de clínicas',
          'Emissão de MTR',
        ],
        respostaIndex: 1,
        explicacao: 'Garante rastreabilidade antes/durante o transporte.',
      },
    ],
  },
}

export function kbQuizPorSlug(slug: string): KbQuizModulo | null {
  return KB_QUIZZES[slug] ?? null
}

export function kbNotaQuiz(questoes: KbQuizQuestao[], respostas: number[]): number {
  if (questoes.length === 0) return 0
  let acertos = 0
  questoes.forEach((q, i) => {
    if (respostas[i] === q.respostaIndex) acertos++
  })
  return Math.round((acertos / questoes.length) * 100)
}
