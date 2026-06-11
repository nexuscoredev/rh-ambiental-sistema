import type { KbArtigo, KbFluxoEtapa } from './types'

/** Linha do tempo simplificada — fluxo operacional RG Ambiental. */
export const KB_FLUXO_ETAPAS: KbFluxoEtapa[] = [
  {
    ordem: 1,
    titulo: 'Programação',
    resumo: 'Agenda a visita: cliente, data, serviço e resíduos.',
    artigoSlug: 'programacao',
    emoji: '📅',
  },
  {
    ordem: 2,
    titulo: 'MTR',
    resumo: 'Manifesto de Transporte de Resíduos — documento legal da coleta.',
    artigoSlug: 'mtr',
    emoji: '📋',
  },
  {
    ordem: 3,
    titulo: 'Pesagem e ticket',
    resumo: 'Peso na balança, comprovante e conferência operacional.',
    artigoSlug: 'ticket-pesagem',
    emoji: '⚖️',
  },
  {
    ordem: 4,
    titulo: 'Faturamento',
    resumo: 'Medição, valores do contrato, relatório e emissão.',
    artigoSlug: 'faturamento',
    emoji: '🧾',
  },
  {
    ordem: 5,
    titulo: 'Financeiro',
    resumo: 'Contas a receber, NF, boleto e cobrança.',
    artigoSlug: 'financeiro',
    emoji: '💰',
  },
]

/** Artigos de apoio (cadastro, frota, conferência) — fora da linha do tempo principal. */
export const KB_APOIO_SLUGS = ['frota', 'clientes', 'conferencia-transporte'] as const

export const KB_SETORES_APOIO: KbFluxoEtapa[] = [
  {
    ordem: 1,
    titulo: 'Frota',
    resumo: 'Movimentação, manutenção e relatórios de equipamentos.',
    artigoSlug: 'frota',
    emoji: '🚛',
  },
  {
    ordem: 2,
    titulo: 'Clientes',
    resumo: 'Cadastro comercial, contrato e preços para faturamento.',
    artigoSlug: 'clientes',
    emoji: '🏢',
  },
  {
    ordem: 3,
    titulo: 'Conferência',
    resumo: 'Checklist do motorista, folha modelo e assinaturas.',
    artigoSlug: 'conferencia-transporte',
    emoji: '✅',
  },
]

export const KB_ARTIGO_FLUXO_SLUG = 'fluxo-completo'

export const KB_ARTIGOS: KbArtigo[] = [
  {
    slug: KB_ARTIGO_FLUXO_SLUG,
    ordem: 0,
    titulo: 'Fluxo completo',
    resumo:
      'Visão de ponta a ponta: da programação da coleta até o financeiro receber a cobrança.',
    emoji: '🔄',
    accent: '#0f766e',
    accentSoft: '#ccfbf1',
    tags: ['Onboarding', 'Visão geral', 'Operação'],
    secoes: [
      {
        id: 'visao',
        titulo: 'Por que existe este fluxo?',
        paragrafos: [
          'A RG Ambiental precisa registrar cada coleta de resíduo de forma rastreável: quem pediu, quando foi, quanto pesou, quanto cobrar e como receber.',
          'O sistema divide esse caminho em etapas claras. Cada etapa alimenta a seguinte — se uma informação estiver errada cedo (cliente, resíduo, peso), o faturamento e o financeiro herdam o erro.',
          'Use esta base como mapa. Quando estiver na dúvida, volte ao passo anterior e confira se os dados batem.',
        ],
        capturas: [
          {
            src: '/assets/treinamento/fluxo-completo-visao-etapas.png',
            alt: 'Diagrama das cinco etapas do fluxo operacional RG Ambiental',
            legenda: 'Visão geral — da programação ao financeiro.',
          },
        ],
      },
      {
        id: 'etapas',
        titulo: 'As cinco grandes etapas',
        passos: [
          {
            titulo: '1 · Programação',
            descricao:
              'A equipe comercial ou operacional agenda a visita ao cliente: data, tipo de caminhão, serviço (coleta, troca, retirada…) e resíduos previstos. Aparece no calendário de Programações.',
            dica: 'Menu: Fluxo operacional → Programações.',
          },
          {
            titulo: '2 · MTR (Manifesto)',
            descricao:
              'Documento obrigatório que acompanha o transporte de resíduos. No sistema, a MTR consolida gerador, transportador, resíduos, quantidades e destinador. Nasce a partir da programação ou é criada manualmente.',
            dica: 'Menu: Programações → MTR ou MTR Gerenciador.',
          },
          {
            titulo: '3 · Pesagem e ticket',
            descricao:
              'Na balança registra-se tara, bruto e peso líquido. Gera-se o ticket (comprovante) com número único. Operacional confere peso e documentos antes de liberar para faturamento.',
            dica: 'Menu: Pesagem e Ticket (Controle de Massa).',
          },
          {
            titulo: '4 · Faturamento',
            descricao:
              'Com peso e ticket aprovados, o faturamento calcula valores conforme contrato do cliente (resíduo, frete, equipamentos), monta relatório de medição, passa por esteiras de ajuste/aprovação e emite o registro de faturamento.',
            dica: 'Menu: Faturamento.',
          },
          {
            titulo: '5 · Financeiro',
            descricao:
              'Valores aprovados viram contas a receber, nota fiscal e cobrança (boleto/e-mail). Acompanhamento de pagamento e inadimplência.',
            dica: 'Menu: Financeiro → Contas a receber / Cobrança.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/financeiro-hub.png',
            alt: 'Hub do módulo Financeiro com atalhos para contas a receber e cobrança',
            legenda: 'Etapa final — valores aprovados entram no financeiro.',
          },
        ],
      },
      {
        id: 'papeis',
        titulo: 'Quem faz o quê (resumo)',
        paragrafos: [
          'Comercial / operação: programação, MTR, pesagem e conferência inicial.',
          'Operacional (Time T): ajustes de valores, resumos financeiros, aprovação de ticket quando aplicável.',
          'Faturamento / comercial adm: medição, relatórios, emissão e envio ao financeiro.',
          'Financeiro: NF, boletos, recebimentos e conciliação.',
        ],
        aviso:
          'Seu cargo pode ver apenas parte do menu — isso é normal. Pergunte ao responsável se precisar de acesso a outra etapa.',
      },
      {
        id: 'erros',
        titulo: 'Erros comuns no fluxo',
        dicas: [
          'Cliente ou resíduo errado na programação → MTR e faturamento herdam o erro.',
          'Peso não lançado ou ticket sem aprovação → coleta fica parada na fila de faturamento.',
          'Contrato do cliente sem preço cadastrado → sistema não sugere valor (cadastro comercial).',
          'Pular etapa no sistema “no papel” → relatórios e auditoria ficam inconsistentes.',
        ],
      },
    ],
  },
  {
    slug: 'programacao',
    ordem: 1,
    titulo: 'Programação',
    resumo:
      'Agendar visitas ao cliente: calendário, coleta fixa, tipos de serviço e acompanhamento.',
    emoji: '📅',
    accent: '#2563eb',
    accentSoft: '#dbeafe',
    rotaSistema: { path: '/programacao', label: 'Abrir Programações' },
    tags: ['Operação', 'Comercial', 'Calendário'],
    secoes: [
      {
        id: 'o-que-e',
        titulo: 'O que é a programação?',
        paragrafos: [
          'A programação é o agendamento de uma visita da RG ao cliente: coleta de resíduo, troca de equipamento, retirada, instalação etc.',
          'Cada programação vira um compromisso no calendário com data, cliente, caminhão previsto e resíduos. A operação usa essa agenda para planejar rotas e motoristas.',
          'Quando a visita acontece de fato, a programação alimenta a criação da MTR e da coleta no sistema.',
        ],
      },
      {
        id: 'como-lancar',
        titulo: 'Como lançar uma programação',
        passos: [
          {
            titulo: 'Abrir Programações',
            descricao: 'Menu lateral → Fluxo operacional → Programações.',
          },
          {
            titulo: 'Preencher o formulário',
            descricao:
              'Selecione o cliente, a data programada, tipo de caminhão, motorista/veículo quando aplicável, tipo de serviço e os resíduos/equipamentos do contrato.',
          },
          {
            titulo: 'Salvar',
            descricao:
              'Clique em «Criar programação». O evento aparece no calendário e na lista do dia.',
            dica: 'Sem permissão de edição? O botão fica desabilitado — fale com Comercial ou administrador.',
          },
          {
            titulo: 'Conferir no calendário',
            descricao:
              'Clique no dia ou no evento para ver detalhes, editar ou imprimir declaração quando necessário.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/programacao-calendario.png',
            alt: 'Calendário mensal de programações com eventos por dia',
            legenda: 'Calendário — visão mensal das visitas agendadas.',
          },
          {
            src: '/assets/treinamento/programacao-formulario.png',
            alt: 'Formulário de nova programação com cliente, data e resíduos',
            legenda: 'Formulário — preencha antes de salvar a programação.',
          },
        ],
      },
      {
        id: 'campos',
        titulo: 'Principais campos do formulário',
        campos: [
          { nome: 'Cliente', significado: 'Empresa geradora do resíduo. Deve estar cadastrado em Clientes.' },
          {
            nome: 'Data programada',
            significado: 'Dia previsto para a visita. Aparece no calendário mensal/semanal.',
          },
          {
            nome: 'Tipo de caminhão / Veículo',
            significado: 'Capacidade e placa previstas. Influencia frete no faturamento.',
          },
          {
            nome: 'Tipo de serviço',
            significado: 'Coleta, troca, retirada, carregamento na hora, instalação… Define a operação no campo.',
          },
          {
            nome: 'Resíduos',
            significado: 'Tipos de resíduo previstos (conforme contrato). Base para a MTR e faturamento.',
          },
          {
            nome: 'Equipamentos',
            significado: 'Caçambas, IBCs etc. que serão movimentados na visita.',
          },
          {
            nome: 'Observações',
            significado: 'Instruções internas: horário, portaria, restrições de acesso.',
          },
          {
            nome: 'Coleta fixa / periodicidade',
            significado: 'Repete automaticamente (ex.: toda terça). Gera série de programações.',
          },
        ],
      },
      {
        id: 'acompanhar',
        titulo: 'Como acompanhar',
        paragrafos: [
          'Use o calendário para visão mensal e a agenda lateral para o dia selecionado.',
          'Cores e status indicam se a programação está pendente, em andamento ou já vinculada a MTR/coleta.',
          'Filtros por cliente ou período ajudam a montar a operação da semana.',
        ],
        dicas: [
          'Antes de criar MTR, confira se a programação do dia ainda está correta (cliente e resíduo).',
          'Edições em programação futura não alteram coletas já finalizadas.',
        ],
      },
      {
        id: 'relatorio',
        titulo: 'Relatórios e impressão',
        paragrafos: [
          'A tela de Programações permite gerar relatório por período (visitas agendadas, por cliente ou por motorista).',
          'Declarações de entrega/instalação podem ser impressas quando o tipo de serviço exige comprovante ao cliente.',
        ],
        passos: [
          {
            titulo: 'Relatório de programações',
            descricao: 'Abra o painel de relatório na página, escolha intervalo de datas e exporte/imprima.',
          },
          {
            titulo: 'Editar programação existente',
            descricao: 'Clique no evento no calendário → Editar. Alterações futuras não reescrevem MTR já emitida.',
          },
        ],
      },
    ],
  },
  {
    slug: 'mtr',
    ordem: 2,
    titulo: 'MTR',
    resumo:
      'Manifesto de Transporte de Resíduos: criação, preenchimento, entrega ao motorista e destino.',
    emoji: '📋',
    accent: '#7c3aed',
    accentSoft: '#ede9fe',
    rotaSistema: { path: '/mtr', label: 'Abrir MTR' },
    tags: ['Documento legal', 'Logística', 'Resíduos'],
    secoes: [
      {
        id: 'o-que-e',
        titulo: 'O que é uma MTR?',
        paragrafos: [
          'MTR significa Manifesto de Transporte de Resíduos. É o documento que acompanha legalmente o transporte de resíduos do gerador até o destinador.',
          'No sistema RG, a MTR reúne: dados do gerador (cliente), transportador (RG), tipos e quantidades de resíduos, veículo/motorista e destinador final.',
          'Uma programação atendida geralmente gera uma coleta e uma MTR vinculadas. A MTR é referência para pesagem, ticket e faturamento.',
        ],
      },
      {
        id: 'criar',
        titulo: 'Como criar uma MTR',
        passos: [
          {
            titulo: 'A partir da programação',
            descricao:
              'Na programação do dia, use a ação para gerar/abrir MTR. O sistema pré-preenche cliente, resíduos e veículo.',
          },
          {
            titulo: 'Manualmente',
            descricao: 'Menu → MTR → Nova MTR. Selecione cliente e preencha seções do formulário.',
          },
          {
            titulo: 'Gerenciador de MTR',
            descricao:
              'Para várias linhas ou ajustes em lote: MTR Gerenciador — visão de fila e edição tabular.',
            dica: 'Menu: MTR Gerenciador.',
          },
          {
            titulo: 'Revisar antes de emitir',
            descricao:
              'Confira resíduos (nome igual ao contrato), quantidades estimadas, destinador e assinaturas necessárias.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/mtr-formulario.png',
            alt: 'Formulário de MTR com seções gerador, transportador e resíduos',
            legenda: 'Formulário MTR — revise antes de emitir.',
          },
          {
            src: '/assets/treinamento/mtr-gerenciador.png',
            alt: 'Tabela do gerenciador de MTR com fila de manifestos',
            legenda: 'Gerenciador — edição tabular para várias MTRs.',
          },
        ],
      },
      {
        id: 'campos',
        titulo: 'Seções principais da MTR',
        campos: [
          { nome: 'Gerador', significado: 'Cliente que gera o resíduo — razão social, endereço, CNPJ.' },
          { nome: 'Transportador', significado: 'Dados da RG Ambiental como transportadora.' },
          { nome: 'Resíduos / itens', significado: 'Lista de resíduos com classificação, acondicionamento e quantidade.' },
          { nome: 'Veículo / motorista', significado: 'Placa, tipo de caminhão e condutor responsável pelo transporte.' },
          { nome: 'Destinador', significado: 'Empresa que receberá/tratará o resíduo no destino final.' },
          { nome: 'Status / ciclo de vida', significado: 'Rascunho, emitida, em trânsito, baixada etc. — controla o que ainda pode ser editado.' },
        ],
      },
      {
        id: 'motorista',
        titulo: 'Como o motorista recebe a MTR',
        paragrafos: [
          'Após a MTR ser emitida/liberada, a logística designa motorista e veículo (etapa «MTR na logística» / «Logística designada»).',
          'O motorista recebe a ordem de coleta com referência à MTR — impressa, PDF no celular ou via comunicação interna da RG.',
          'No cliente, o motorista apresenta a MTR, realiza a coleta e segue para pesagem (balança) ou destinador conforme rota.',
        ],
        dicas: [
          'MTR com resíduo diferente do contrato causa erro no faturamento — alinhe nome com cadastro comercial.',
          'Não altere MTR já baixada/faturada sem autorização (Comercial Adm / desenvolvedor).',
        ],
      },
      {
        id: 'para-onde-vai',
        titulo: 'Para onde vai a informação da MTR',
        paragrafos: [
          'Pesagem e ticket: peso líquido e comprovante ficam ligados à coleta da MTR.',
          'Faturamento: lê resíduos, peso e veículo da MTR para calcular valores do contrato.',
          'Financeiro: após emissão, valores consolidados alimentam contas a receber.',
        ],
      },
    ],
  },
  {
    slug: 'ticket-pesagem',
    ordem: 3,
    titulo: 'Pesagem e ticket',
    resumo:
      'Controle de Massa: tara, bruto, peso líquido, ticket de pesagem e conferência operacional.',
    emoji: '⚖️',
    accent: '#d97706',
    accentSoft: '#ffedd5',
    rotaSistema: { path: '/controle-massa', label: 'Abrir Pesagem e Ticket' },
    tags: ['Balança', 'Comprovante', 'Conferência'],
    secoes: [
      {
        id: 'o-que-e',
        titulo: 'O que é o ticket?',
        paragrafos: [
          'O ticket é o comprovante de pesagem da coleta — número único que identifica aquela pesagem na balança.',
          'Ele registra tara (caminhão vazio), bruto (cheio) e peso líquido (resíduo efetivo). Esse peso é a base do faturamento por kg.',
          'A tela «Pesagem e Ticket» (Controle de Massa) concentra lançamento, geração do ticket, conferência e envio para aprovação.',
        ],
      },
      {
        id: 'como-lancar',
        titulo: 'Como lançar pesagem e gerar ticket',
        passos: [
          {
            titulo: 'Localizar a coleta',
            descricao: 'Busque por cliente, número da coleta, MTR ou ticket na fila do Controle de Massa.',
          },
          {
            titulo: 'Registrar tara e bruto',
            descricao:
              'Informe os pesos da balança. O sistema calcula o líquido. Confira unidade (kg).',
          },
          {
            titulo: 'Conferir resíduo e MTR',
            descricao:
              'O tipo de resíduo exibido deve bater com MTR e contrato. Corrija na origem se estiver divergente.',
          },
          {
            titulo: 'Gerar / vincular ticket',
            descricao:
              'Gere o comprovante com número sequencial. Anexe ou registre observações se houver divergência.',
          },
          {
            titulo: 'Enviar para aprovação',
            descricao:
              'Quando exigido pelo fluxo, o ticket passa por aprovação antes de ir ao faturamento.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/controle-massa-fila.png',
            alt: 'Fila de coletas no Controle de Massa aguardando pesagem',
            legenda: 'Fila — localize a coleta antes de lançar peso.',
          },
          {
            src: '/assets/treinamento/controle-massa-pesagem.png',
            alt: 'Formulário de pesagem com tara, bruto e peso líquido',
            legenda: 'Pesagem — tara, bruto e ticket vinculado à MTR.',
          },
        ],
      },
      {
        id: 'campos',
        titulo: 'Campos importantes',
        campos: [
          { nome: 'Nº coleta', significado: 'Identificador interno da operação (ex.: 90011).' },
          { nome: 'MTR', significado: 'Manifesto vinculado — origem dos dados de resíduo e cliente.' },
          { nome: 'Ticket / comprovante', significado: 'Número do comprovante de pesagem (pode ser composto, ex.: 115314-1).' },
          { nome: 'Tara', significado: 'Peso do caminhão vazio (kg).' },
          { nome: 'Bruto', significado: 'Peso caminhão + resíduo (kg).' },
          { nome: 'Peso líquido', significado: 'Bruto − tara = quantidade faturável.' },
          { nome: 'Status conferência', significado: 'Pendente, pronto para faturar, aguardando aprovação…' },
          { nome: 'Etapa do fluxo', significado: 'Onde a coleta está no ciclo (pesagem, ticket, aprovado…).' },
        ],
      },
      {
        id: 'conferencia',
        titulo: 'Conferência operacional',
        paragrafos: [
          'Antes de liberar para faturamento, operacional confere: peso coerente, MTR assinada, resíduo correto, fotos/anexos se necessário.',
          'Coletas «sem ticket» ou «sem peso» aparecem como pendência no diagnóstico de faturamento — resolva aqui primeiro.',
        ],
        aviso: 'Ticket aprovado bloqueia alterações sensíveis — retrabalho exige permissão elevada.',
      },
    ],
  },
  {
    slug: 'faturamento',
    ordem: 4,
    titulo: 'Faturamento',
    resumo:
      'Fila de coletas, valores do contrato, esteiras de medição, relatório e emissão.',
    emoji: '🧾',
    accent: '#059669',
    accentSoft: '#d1fae5',
    rotaSistema: { path: '/faturamento', label: 'Abrir Faturamento' },
    tags: ['Medição', 'Contrato', 'Esteira'],
    secoes: [
      {
        id: 'o-que-e',
        titulo: 'O que é o faturamento no sistema?',
        paragrafos: [
          'Faturamento transforma coletas conferidas (com peso e ticket) em valores a cobrar do cliente, conforme contrato comercial.',
          'Inclui: sugestão de preço por resíduo e frete, ajuste de medição, relatório para o cliente, aprovação interna e emissão do registro de faturamento.',
          'Só entra na fila quem passou pelas etapas operacionais — por isso pendências de peso/ticket aparecem antes.',
        ],
      },
      {
        id: 'filas',
        titulo: 'Principais filas (esteiras)',
        passos: [
          {
            titulo: 'Fila operacional',
            descricao: 'Coletas prontas para iniciar processo de faturamento.',
          },
          {
            titulo: 'Aprovação de ticket',
            descricao: 'Tickets aguardando OK do operacional/comercial.',
          },
          {
            titulo: 'Ajuste de valores',
            descricao: 'Medição em revisão — valores do contrato aplicados ao resumo MTR.',
          },
          {
            titulo: 'Relatório de medição',
            descricao: 'Consolidação por cliente/período para envio e aceite.',
          },
          {
            titulo: 'Pós-faturamento',
            descricao: 'Emitidos aguardando NF/boleto no financeiro.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/faturamento-fila.png',
            alt: 'Esteiras de faturamento com fila operacional e abas de status',
            legenda: 'Esteiras — coletas prontas entram na fila operacional.',
          },
        ],
      },
      {
        id: 'como-faturar',
        titulo: 'Passo a passo resumido',
        passos: [
          {
            titulo: 'Abrir a coleta na fila',
            descricao: 'Clique na linha → modal de registro / preparação de medição.',
          },
          {
            titulo: 'Conferir sugestão do contrato',
            descricao:
              'Sistema mostra valor por resíduo, frete (caminhão) e equipamentos. Se zerado, falta preço no cadastro do cliente.',
          },
          {
            titulo: 'Recalcular se necessário',
            descricao:
              'Botão recalcula a partir de ticket, MTR e contrato — use após correções operacionais.',
          },
          {
            titulo: 'Revisar resumo financeiro',
            descricao: 'Edite peso em kg, valores unitários e caminhão no resumo MTR (quem tem permissão).',
          },
          {
            titulo: 'Emitir',
            descricao: 'Confirma emissão → coleta avança para financeiro / NF conforme fluxo.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/faturamento-resumo.png',
            alt: 'Resumo financeiro MTR com totais de referência e a faturar',
            legenda: 'Resumo MTR — confira valores antes de emitir.',
          },
        ],
      },
      {
        id: 'contrato',
        titulo: 'Contrato do cliente e valores',
        paragrafos: [
          'Preços vêm do cadastro do cliente (resíduos_contrato): tipo de resíduo, R$/kg, mínimo faturável, frete por tipo de caminhão.',
          'Se o nome do resíduo na coleta não «casa» com o contrato, o sistema não sugere valor — alinhe cadastro comercial.',
        ],
        dicas: [
          '«Valor zero no contrato» = resíduo existe no cadastro mas sem preço — Comercial deve preencher.',
          '«Sem match» = nome diferente entre coleta e contrato.',
        ],
      },
    ],
  },
  {
    slug: 'financeiro',
    ordem: 5,
    titulo: 'Financeiro',
    resumo: 'Contas a receber, emissão de NF, cobrança, boletos e acompanhamento de pagamentos.',
    emoji: '💰',
    accent: '#0891b2',
    accentSoft: '#cffafe',
    rotaSistema: { path: '/financeiro', label: 'Abrir Financeiro' },
    tags: ['Cobrança', 'NF', 'Contas a receber'],
    secoes: [
      {
        id: 'o-que-e',
        titulo: 'O que acontece no financeiro?',
        paragrafos: [
          'Depois que o faturamento emite, o financeiro recebe os valores a cobrar: gera ou vincula nota fiscal, boleto, e-mail de cobrança e registra contas a receber.',
          'É a etapa final do fluxo operacional → comercial → cobrança.',
        ],
      },
      {
        id: 'modulos',
        titulo: 'Áreas do menu Financeiro',
        campos: [
          { nome: 'Hub Financeiro', significado: 'Visão geral e atalhos das subáreas.' },
          { nome: 'Contas a receber', significado: 'Títulos em aberto, vencimentos, recebimentos.' },
          { nome: 'Contas a pagar', significado: 'Despesas e fornecedores (quando aplicável).' },
          { nome: 'Cobrança / Mala direta', significado: 'Envio de NF e boletos por e-mail ao cliente.' },
        ],
        capturas: [
          {
            src: '/assets/treinamento/financeiro-hub.png',
            alt: 'Hub Financeiro com cartões para contas a receber e cobrança',
            legenda: 'Hub Financeiro — ponto de entrada das subáreas.',
          },
        ],
      },
      {
        id: 'passo-a-passo',
        titulo: 'Do faturamento ao recebimento',
        passos: [
          {
            titulo: 'Coleta emitida no faturamento',
            descricao: 'Status avança para «enviado financeiro» ou equivalente na esteira.',
          },
          {
            titulo: 'Conferir título a receber',
            descricao: 'Valor, vencimento e cliente batem com medição aprovada.',
          },
          {
            titulo: 'Emitir NF e boleto',
            descricao: 'Use os fluxos de emissão integrados ou registre número externo.',
          },
          {
            titulo: 'Enviar ao cliente',
            descricao: 'Mala direta / e-mail NF conforme cadastro email_nf do cliente.',
          },
          {
            titulo: 'Baixar pagamento',
            descricao: 'Quando pago, registrar recebimento — coleta pode ir a «finalizado».',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/financeiro-contas-receber.png',
            alt: 'Tabela de contas a receber com títulos e vencimentos',
            legenda: 'Contas a receber — acompanhe vencimentos e recebimentos.',
          },
        ],
      },
      {
        id: 'dicas',
        titulo: 'Boas práticas',
        dicas: [
          'Divergência entre medição e NF → volte ao faturamento antes de emitir.',
          'Cliente sem e-mail NF cadastrado → cobrança manual ou atualize cadastro.',
          'Títulos vencidos aparecem nos painéis de cobrança — priorize contato comercial.',
        ],
      },
    ],
  },
  {
    slug: 'frota',
    ordem: 6,
    titulo: 'Transportes (Frota)',
    resumo:
      'Hub operacional da frota: movimentação de equipamentos do cliente, manutenção, diário do veículo e relatório consolidado.',
    emoji: '🚛',
    accent: '#b45309',
    accentSoft: '#fef3c7',
    rotaSistema: { path: '/operacional-frota', label: 'Abrir Transportes' },
    tags: ['Frota', 'Equipamentos', 'Logística'],
    secoes: [
      {
        id: 'o-que-e',
        titulo: 'O que é o módulo Transportes?',
        paragrafos: [
          'O menu «Transportes» (caminho /operacional-frota) concentra tudo o que a RG faz com caminhões e equipamentos no cliente: troca de caçamba, retirada, instalação, carregamento na hora e registro fotográfico.',
          'Diferente da programação (agenda futura) e da MTR (documento legal), aqui registra-se o que de fato aconteceu no campo — com assinatura do cliente, fotos e histórico consultável.',
          'A frota alimenta a operação diária e serve de evidência em auditorias, reclamações e conferência de transporte.',
        ],
        capturas: [
          {
            src: '/assets/treinamento/frota-hub-transportes.png',
            alt: 'Hub Transportes com três áreas: Transportes, Manutenção e Relatório da frota',
            legenda: 'Hub Transportes — escolha a área pelo cartão correspondente.',
          },
        ],
      },
      {
        id: 'areas',
        titulo: 'As três áreas do hub',
        passos: [
          {
            titulo: 'Transportes',
            descricao:
              'Movimentação de equipamentos vinculados ao contrato do cliente: coleta, troca, retirada, carregamento na hora. Formulário com tipo de serviço, equipamento, caminhão, km, fotos e assinaturas.',
            dica: 'Menu: Transportes → Transportes (/operacional-frota/transportes).',
          },
          {
            titulo: 'Manutenção',
            descricao:
              'Ordens de serviço preventiva/corretiva, diário do veículo (quilometragem, checklist, troca de óleo), fotos e assinatura do responsável RG.',
            dica: 'Menu: Transportes → Manutenção.',
          },
          {
            titulo: 'Relatório da frota',
            descricao:
              'Consolida movimentações, manutenções e diários num documento para impressão/PDF, com assinatura do colaborador RG.',
            dica: 'Menu: Transportes → Relatório da frota.',
          },
        ],
      },
      {
        id: 'movimentacao',
        titulo: 'Como registrar uma movimentação',
        passos: [
          {
            titulo: 'Abrir Transportes → Movimentação',
            descricao: 'Selecione o tipo de serviço (troca, retirada, coleta…).',
          },
          {
            titulo: 'Escolher equipamento do cliente',
            descricao:
              'O catálogo lista equipamentos cadastrados no contrato do cliente (caçambas, IBCs etc.). Se não aparecer, confira cadastro em Clientes.',
          },
          {
            titulo: 'Informar caminhão e km',
            descricao: 'Placa do veículo usado na operação e quilometragem quando aplicável.',
          },
          {
            titulo: 'Anexar fotos e assinaturas',
            descricao:
              'Fotos do equipamento no local. Assinatura do responsável no cliente (nome, cargo) e empresa de recebimento quando exigido.',
          },
          {
            titulo: 'Salvar e conferir histórico',
            descricao:
              'A movimentação entra na tabela de histórico. É possível gerar PDF individual da operação.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/frota-movimentacao-formulario.png',
            alt: 'Formulário de movimentação com tipo de serviço, equipamento, caminhão e assinaturas',
            legenda: 'Formulário de movimentação — preencha antes de sair do cliente.',
          },
          {
            src: '/assets/treinamento/frota-historico-movimentacoes.png',
            alt: 'Tabela com histórico de movimentações da frota',
            legenda: 'Histórico — consulte operações recentes e gere PDF.',
          },
        ],
      },
      {
        id: 'campos',
        titulo: 'Campos principais (movimentação)',
        campos: [
          { nome: 'Tipo de serviço', significado: 'Coleta, troca, retirada, carregamento na hora, instalação… Define a operação registrada.' },
          { nome: 'Equipamento', significado: 'Item do contrato do cliente (identificação, tipo, endereço).' },
          { nome: 'Caminhão / placa', significado: 'Veículo RG usado — referência para logística e relatórios.' },
          { nome: 'Quilometragem', significado: 'Km do odômetro quando a operação exige controle de frota.' },
          { nome: 'Fotos', significado: 'Evidência visual — equipamento instalado, retirado ou avariado.' },
          { nome: 'Assinatura cliente', significado: 'Nome e cargo de quem recebeu/entregou no local.' },
          { nome: 'Observações', significado: 'Detalhes operacionais: acesso difícil, equipamento danificado, horário.' },
        ],
      },
      {
        id: 'relacao-fluxo',
        titulo: 'Relação com programação e MTR',
        paragrafos: [
          'A programação agenda a visita; a MTR documenta o transporte legal; a frota registra a execução prática com fotos e assinatura.',
          'Nem toda movimentação nasce de uma programação — retiradas avulsas ou manutenções internas podem ser lançadas direto na frota.',
        ],
        dicas: [
          'Equipamento ausente no catálogo → cadastre no cliente (aba contrato/equipamentos) antes de registrar.',
          'Sem permissão de edição → botões ficam desabilitados; fale com Logística ou administrador.',
          'PDF de movimentação pode ser anexado à conferência de transporte ou arquivo do cliente.',
        ],
      },
    ],
  },
  {
    slug: 'clientes',
    ordem: 7,
    titulo: 'Clientes',
    resumo:
      'Cadastro comercial do gerador: dados fiscais, contrato, resíduos, preços, frete, equipamentos e e-mails de NF.',
    emoji: '🏢',
    accent: '#4f46e5',
    accentSoft: '#e0e7ff',
    rotaSistema: { path: '/clientes', label: 'Abrir Clientes' },
    tags: ['Cadastro', 'Contrato', 'Comercial'],
    secoes: [
      {
        id: 'o-que-e',
        titulo: 'Por que o cadastro de clientes é crítico?',
        paragrafos: [
          'Quase todo o fluxo operacional depende do cliente: programação escolhe o gerador, a MTR copia razão social e endereço, o faturamento lê preços do contrato (residuos_contrato) e o financeiro usa e-mails de NF.',
          'Erro ou omissão no cadastro aparece tarde — como «valor zero no contrato» ou «sem match de resíduo» — quando a coleta já foi pesada.',
          'Comercial e cadastro mantêm clientes ativos, contratos atualizados e preços coerentes com o que foi vendido.',
        ],
        capturas: [
          {
            src: '/assets/treinamento/clientes-lista-busca.png',
            alt: 'Lista de clientes com campo de busca e filtros',
            legenda: 'Lista de clientes — busque por nome, CNPJ ou razão social.',
          },
        ],
      },
      {
        id: 'como-cadastrar',
        titulo: 'Como cadastrar ou editar um cliente',
        passos: [
          {
            titulo: 'Abrir Clientes',
            descricao: 'Menu lateral → Clientes. Use a busca para localizar registro existente.',
          },
          {
            titulo: 'Novo cliente ou editar',
            descricao:
              'Botão «Incluir cliente» ou clique na linha para abrir o formulário. Quem não tem permissão de edição vê os dados somente leitura.',
          },
          {
            titulo: 'Dados gerais',
            descricao:
              'Nome fantasia, razão social, CNPJ, endereço, contatos, região e status (ativo/inativo). CEP pode preencher endereço automaticamente.',
          },
          {
            titulo: 'Faturamento e NF',
            descricao:
              'E-mails para envio de NF, empresa/grupo de faturamento, gerador vs dono do faturamento quando aplicável.',
          },
          {
            titulo: 'Salvar',
            descricao: 'Confirme antes de fechar — alterações no contrato impactam coletas futuras, não as já emitidas.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/clientes-formulario-cadastro.png',
            alt: 'Formulário de cadastro com dados gerais e seções de faturamento',
            legenda: 'Formulário — dados gerais, contatos e faturamento.',
          },
        ],
      },
      {
        id: 'contrato',
        titulo: 'Contrato: resíduos, frete e equipamentos',
        paragrafos: [
          'A seção de contrato define o que a RG cobra e quais resíduos/equipamentos estão no acordo comercial.',
          'Resíduos do contrato (residuos_contrato): nome exato do resíduo, R$/kg, mínimo faturável, unidade. O faturamento compara o nome da coleta com esta lista.',
          'Veículos/frete (veiculos_contrato): tipo de caminhão e valor de frete por visita ou viagem.',
          'Equipamentos (equipamentos_contrato): caçambas e outros itens que aparecem na frota e na programação.',
        ],
        capturas: [
          {
            src: '/assets/treinamento/clientes-contrato-residuos-precos.png',
            alt: 'Seção de contrato com tabela de resíduos, preços e frete por caminhão',
            legenda: 'Contrato — resíduos, preços e frete alimentam o faturamento.',
          },
        ],
        campos: [
          { nome: 'Resíduo (contrato)', significado: 'Nome comercial/idêntico ao usado na MTR e coleta — base do match de preço.' },
          { nome: 'Preço R$/kg', significado: 'Valor unitário faturável. Zero = alerta no faturamento.' },
          { nome: 'Mínimo faturável', significado: 'Piso de cobrança por linha ou tipo, conforme acordo.' },
          { nome: 'Frete / caminhão', significado: 'Valor de deslocamento por tipo de veículo contratado.' },
          { nome: 'Equipamento', significado: 'Identificação no cliente — usado na frota e programação.' },
          { nome: 'E-mail NF', significado: 'Destinatários automáticos da nota fiscal e cobrança.' },
        ],
      },
      {
        id: 'gerenciador',
        titulo: 'Gerenciador de clientes',
        paragrafos: [
          'Em Clientes → Gerenciador há visão ampliada: histórico de MTR por cliente, tabelas de resíduos e ferramentas de consulta em lote.',
          'Útil para auditoria comercial e para alinhar nomes de resíduos entre contrato, MTR e faturamento.',
        ],
        dicas: [
          'Antes de alterar preço, confira se há coletas em fila de faturamento para aquele cliente.',
          'Cliente inativo não some do histórico — impede novas programações conforme regra do sistema.',
          'Nomes de resíduo com acento, espaço ou abreviatura diferente quebram o match — padronize com Comercial.',
        ],
      },
      {
        id: 'impacto',
        titulo: 'Impacto no restante do sistema',
        passos: [
          {
            titulo: 'Programação',
            descricao: 'Lista só clientes ativos; puxa resíduos e equipamentos do contrato.',
          },
          {
            titulo: 'MTR',
            descricao: 'Autofill de gerador, endereço e itens a partir do cadastro.',
          },
          {
            titulo: 'Faturamento',
            descricao: 'Sugestão de valor vem exclusivamente do contrato — sem preço cadastrado, operador ajusta manualmente.',
          },
          {
            titulo: 'Financeiro',
            descricao: 'E-mails de NF e dados fiscais para emissão e cobrança.',
          },
        ],
        aviso: 'Mudanças no contrato não recalculam automaticamente coletas já emitidas — retrabalho passa pelo faturamento.',
      },
    ],
  },
  {
    slug: 'conferencia-transporte',
    ordem: 8,
    titulo: 'Conferência de transportes',
    resumo:
      'Checklist e folha modelo RG para o motorista: escolher coleta, conferir caminhão, rotas e assinaturas antes da viagem.',
    emoji: '✅',
    accent: '#0d9488',
    accentSoft: '#ccfbf1',
    rotaSistema: { path: '/conferencia-transporte', label: 'Abrir Conferência' },
    tags: ['Logística', 'Motorista', 'Checklist'],
    secoes: [
      {
        id: 'o-que-e',
        titulo: 'O que é a conferência de transportes?',
        paragrafos: [
          'A Conferência de transportes (/conferencia-transporte) é a etapa em que logística e motorista validam a coleta antes e durante a viagem.',
          'O fluxo tem dois passos: (1) escolher a coleta na fila; (2) preencher a folha modelo RG Ambiental Transportes — dados de viagem, clientes da rota, checklist do caminhão (SIM/NÃO), termo e assinaturas.',
          'O documento pode ser impresso ou gerado em PDF com o mesmo layout do formulário em papel — serve como registro interno e evidência de conformidade.',
        ],
        capturas: [
          {
            src: '/assets/treinamento/conferencia-transporte-selecao-coleta.png',
            alt: 'Tela inicial da conferência com busca e seleção de coleta',
            legenda: 'Passo 1 — selecione a coleta na lista ou pela busca.',
          },
        ],
      },
      {
        id: 'passo-a-passo',
        titulo: 'Passo a passo (2 etapas)',
        passos: [
          {
            titulo: '1 · Escolher a coleta',
            descricao:
              'Busque por número da coleta, cliente, MTR, placa ou motorista. Clique na linha para abrir a folha daquela operação.',
          },
          {
            titulo: '2 · Preencher a folha modelo',
            descricao:
              'Complete data, motorista, placa, rotas/clientes visitados, checklist do caminhão (itens com SIM/NÃO), observações e assinaturas.',
          },
          {
            titulo: 'Salvar rascunho',
            descricao: 'O sistema guarda progresso na sessão — pode retomar depois na mesma coleta.',
          },
          {
            titulo: 'Gerar PDF / imprimir',
            descricao:
              'Botão «Relatório (PDF)» produz documento unificado (folha + checklist) pronto para arquivo ou impressão.',
          },
        ],
        capturas: [
          {
            src: '/assets/treinamento/conferencia-transporte-folha-modelo.png',
            alt: 'Folha modelo RG Transportes com tabela de clientes e bloco de assinaturas',
            legenda: 'Passo 2 — folha modelo RG com rotas, checklist e assinaturas.',
          },
        ],
      },
      {
        id: 'checklist',
        titulo: 'Checklist do motorista',
        paragrafos: [
          'O checklist percorre itens de segurança e operação do caminhão: documentos, extintor, tacógrafo, luzes, pneus, vazamentos etc.',
          'Cada item recebe SIM ou NÃO. Divergências devem ser registradas nas observações e reportadas à logística antes de sair.',
          'Respostas ficam vinculadas à coleta selecionada — não reutilize checklist de outra viagem.',
        ],
        capturas: [
          {
            src: '/assets/treinamento/conferencia-transporte-checklist-motorista.png',
            alt: 'Checklist do motorista com itens SIM/NÃO para conferência do caminhão',
            legenda: 'Checklist — marque SIM/NÃO em cada item antes da saída.',
          },
        ],
        campos: [
          { nome: 'Coleta / MTR', significado: 'Operação vinculada — origem dos dados de cliente e rota.' },
          { nome: 'Motorista / placa', significado: 'Responsável e veículo da viagem.' },
          { nome: 'Rotas / clientes', significado: 'Sequência de paradas conforme programação da coleta.' },
          { nome: 'Item checklist', significado: 'Condição do caminhão — SIM conforme, NÃO com pendência.' },
          { nome: 'Observações', significado: 'Detalhes de não conformidade ou instruções especiais.' },
          { nome: 'Assinaturas', significado: 'Motorista e responsável RG na folha impressa/PDF.' },
        ],
      },
      {
        id: 'quem-usa',
        titulo: 'Quem usa e quando',
        paragrafos: [
          'Logística abre a conferência no início do turno ou ao designar motorista à coleta.',
          'Motorista preenche checklist no pátio ou antes da primeira parada.',
          'Operacional pode consultar PDF arquivado em caso de auditoria ou incidente na rota.',
        ],
        dicas: [
          'URL com parâmetros (?coleta=…) abre direto na coleta — útil em links internos.',
          'Sem permissão de edição: visualização apenas; alterações exigem cargo de logística/operacional.',
          'Checklist incompleto não bloqueia MTR no sistema, mas é exigência interna RG — preencha antes de sair.',
        ],
      },
      {
        id: 'fluxo',
        titulo: 'Lugar no fluxo operacional',
        passos: [
          {
            titulo: 'Após programação / designação',
            descricao: 'Coleta já existe com cliente e MTR previstos — conferência valida o que vai a campo.',
          },
          {
            titulo: 'Antes da pesagem',
            descricao: 'Motorista retorna com MTR assinada; pesagem usa dados já conferidos na rota.',
          },
          {
            titulo: 'Documentação',
            descricao: 'PDF fica como registro paralelo à MTR legal e ao ticket de balança.',
          },
        ],
        aviso: 'Conferência de transportes não substitui a MTR — são documentos com finalidades diferentes.',
      },
    ],
  },
]

export function kbArtigoPorSlug(slug: string | undefined): KbArtigo | null {
  if (!slug) return null
  return KB_ARTIGOS.find((a) => a.slug === slug) ?? null
}

export const KB_ARTIGOS_ORDENADOS = [...KB_ARTIGOS].sort((a, b) => a.ordem - b.ordem)

export const KB_SETORES = KB_ARTIGOS_ORDENADOS.filter((a) => a.slug !== KB_ARTIGO_FLUXO_SLUG)

export const KB_SETORES_FLUXO = KB_ARTIGOS_ORDENADOS.filter(
  (a) => a.slug !== KB_ARTIGO_FLUXO_SLUG && !(KB_APOIO_SLUGS as readonly string[]).includes(a.slug),
)
