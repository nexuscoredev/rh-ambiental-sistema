/** Módulos do Financeiro — hub e rotas filhas (mesma lógica do RH). */

export type FinanceiroModulo = {
  slug: string
  path: string
  label: string
  descricao: string
  ordem: number
  /** Módulo já com página funcional (badge no hub). */
  pronto: boolean
}

export const FINANCEIRO_HUB_PATH = '/financeiro'

export const FINANCEIRO_MODULOS: readonly FinanceiroModulo[] = [
  {
    slug: 'cobranca',
    path: '/financeiro/cobranca',
    label: 'Cobrança e documentos',
    descricao:
      'Coletas liberadas pelo Faturamento: NF, vencimentos, boletos, conferência de fluxo e recebimento, baixas e exportação.',
    ordem: 1,
    pronto: true,
  },
  {
    slug: 'contas-receber',
    path: '/financeiro/contas-receber',
    label: 'Contas a receber',
    descricao:
      'Títulos a receber, clínicas, faturamento consolidado, registo de pagamentos e integração com a cobrança por coleta.',
    ordem: 2,
    pronto: true,
  },
  {
    slug: 'contas-pagar',
    path: '/financeiro/contas-pagar',
    label: 'Contas a pagar',
    descricao:
      'Despesas e obrigações da empresa: cadastro, vencimentos, pagamentos e acompanhamento de saídas.',
    ordem: 3,
    pronto: true,
  },
] as const

export const FINANCEIRO_MODULOS_ORDENADOS = [...FINANCEIRO_MODULOS].sort((a, b) => a.ordem - b.ordem)

export const FINANCEIRO_MENU_CHILDREN = FINANCEIRO_MODULOS_ORDENADOS.map((m) => ({
  label: m.label,
  path: m.path,
}))

export const FINANCEIRO_ROTAS_SISTEMA: { path: string; label: string }[] = [
  { path: FINANCEIRO_HUB_PATH, label: 'Financeiro' },
  ...FINANCEIRO_MODULOS_ORDENADOS.map((m) => ({ path: m.path, label: m.label })),
]

export function financeiroModuloPorPath(pathname: string): FinanceiroModulo | null {
  const norm = pathname.replace(/\/+$/, '') || '/'
  return FINANCEIRO_MODULOS.find((m) => m.path === norm) ?? null
}
