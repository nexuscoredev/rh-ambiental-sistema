/** Destaques exibidos no modal «Confira as novidades!» (página Bem-vindo). */
export type NovidadeSistemaItem = {
  ordem: number
  titulo: string
  descricao?: string
  destaque?: string
}

export const NOVIDADES_SISTEMA_ATUAL: {
  titulo: string
  subtitulo: string
  itens: NovidadeSistemaItem[]
} = {
  titulo: 'Ganhamos novas funcionalidades!',
  subtitulo: 'Confira o que mudou nas últimas atualizações do sistema.',
  itens: [
    {
      ordem: 1,
      titulo: 'Nova página Clínicas!',
      descricao: 'Cadastro, O.S. e faturamento dedicados ao fluxo de clínicas.',
      destaque: 'Clínicas',
    },
    {
      ordem: 2,
      titulo: 'O financeiro ganhou novas funções!',
      descricao: 'Mais clareza em contas a receber e na fila de clínicas.',
      destaque: 'Financeiro',
    },
    {
      ordem: 3,
      titulo: 'A página de Faturamento está de cara nova!',
      descricao: 'Visual renovado para acompanhar o dia a dia com mais conforto.',
      destaque: 'Faturamento',
    },
  ],
}
