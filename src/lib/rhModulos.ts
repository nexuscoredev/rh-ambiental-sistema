/** Módulos do departamento RH — rotas e metadados (sem lógica de negócio ainda). */

export type RhModulo = {
  slug: string
  path: string
  label: string
  descricao: string
  /** Ordem no hub e no menu lateral. */
  ordem: number
}

export const RH_HUB_PATH = '/rh'

export const RH_MODULOS: readonly RhModulo[] = [
  {
    slug: 'departamento-pessoal',
    path: '/rh/departamento-pessoal',
    label: 'Departamento Pessoal',
    descricao:
      'Cadastro de colaboradores, contratos, documentos admissionais, dependentes e prontuário do funcionário.',
    ordem: 1,
  },
  {
    slug: 'folha-pagamento',
    path: '/rh/folha-pagamento',
    label: 'Folha de pagamento',
    descricao:
      'Processamento mensal da folha, proventos, descontos, encargos, holerites e fechamento contábil.',
    ordem: 2,
  },
  {
    slug: 'admissoes-desligamentos',
    path: '/rh/admissoes-desligamentos',
    label: 'Admissões e desligamentos',
    descricao:
      'Fluxo de admissão, exame admissional, integração, rescisão, TRCT e checklist de offboarding.',
    ordem: 3,
  },
  {
    slug: 'ferias-afastamentos',
    path: '/rh/ferias-afastamentos',
    label: 'Férias e afastamentos',
    descricao:
      'Programação de férias, licenças, afastamentos médicos, INSS e controle de saldo de dias.',
    ordem: 4,
  },
  {
    slug: 'ponto-jornada',
    path: '/rh/ponto-jornada',
    label: 'Ponto e jornada',
    descricao:
      'Espelho de ponto, banco de horas, horas extras, escalas e conformidade com a jornada de trabalho.',
    ordem: 5,
  },
  {
    slug: 'beneficios',
    path: '/rh/beneficios',
    label: 'Benefícios',
    descricao:
      'Vale-transporte, vale-refeição, plano de saúde, seguros e outros benefícios corporativos.',
    ordem: 6,
  },
  {
    slug: 'treinamentos',
    path: '/rh/treinamentos',
    label: 'Treinamentos',
    descricao:
      'Base de conhecimento operacional: programação, MTR, ticket, faturamento e financeiro — passo a passo para novos colaboradores.',
    ordem: 7,
  },
  {
    slug: 'documentos-esocial',
    path: '/rh/documentos-esocial',
    label: 'Documentos e eSocial',
    descricao:
      'Gestão documental trabalhista, eventos eSocial, prazos legais e auditoria de conformidade.',
    ordem: 8,
  },
] as const

export const RH_MODULOS_ORDENADOS = [...RH_MODULOS].sort((a, b) => a.ordem - b.ordem)

export const RH_MENU_CHILDREN = RH_MODULOS_ORDENADOS.map((m) => ({
  label: m.label,
  path: m.path,
}))

/** Todas as rotas RH (hub + módulos) — permissões e checklist de utilizadores. */
export const RH_ROTAS_SISTEMA: { path: string; label: string }[] = [
  { path: RH_HUB_PATH, label: 'RH' },
  ...RH_MODULOS_ORDENADOS.map((m) => ({ path: m.path, label: m.label })),
]

export function rhModuloPorPath(pathname: string): RhModulo | null {
  const norm = pathname.replace(/\/+$/, '') || '/'
  return RH_MODULOS.find((m) => m.path === norm) ?? null
}
