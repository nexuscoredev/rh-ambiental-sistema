/** Módulo Frota — hub Transportes (movimentação, manutenção, relatório). */

export const FROTA_HUB_PATH = '/operacional-frota'

export const FROTA_HUB_LABEL = 'Transportes'

export type FrotaDivisaoSlug = 'transportes' | 'manutencao' | 'relatorio'

export type FrotaDivisao = {
  slug: FrotaDivisaoSlug
  path: string
  label: string
  descricao: string
  ordem: number
}

export const FROTA_DIVISOES: readonly FrotaDivisao[] = [
  {
    slug: 'transportes',
    path: '/operacional-frota/transportes',
    label: 'Transportes',
    descricao:
      'Equipamentos do contrato do cliente e movimentação: troca, retirada, carregamento na hora e instalação.',
    ordem: 1,
  },
  {
    slug: 'manutencao',
    path: '/operacional-frota/manutencao',
    label: 'Manutenção',
    descricao:
      'Preventiva e corretiva, diário do veículo, quilometragem, troca de óleo, fotos e assinatura do responsável.',
    ordem: 2,
  },
  {
    slug: 'relatorio',
    path: '/operacional-frota/relatorio',
    label: 'Relatório da frota',
    descricao:
      'Consolidação para impressão: movimentações, manutenções e diários com assinatura do colaborador RG.',
    ordem: 3,
  },
] as const

/** Hub abre subáreas pelos cartões; sem entrada duplicada no menu lateral. */
export const FROTA_MENU_CHILDREN: { label: string; path: string }[] = []

export const FROTA_ROTAS_SISTEMA: { path: string; label: string }[] = [
  { path: FROTA_HUB_PATH, label: FROTA_HUB_LABEL },
  ...FROTA_DIVISOES.map((d) => ({ path: d.path, label: d.label })),
]

export const FROTA_TIPOS_MOVIMENTACAO = [
  { id: 'coleta' as const, label: 'Coleta' },
  { id: 'troca' as const, label: 'Troca' },
  { id: 'retirada' as const, label: 'Retirada' },
  { id: 'carregamento_hora' as const, label: 'Carregamento na hora' },
  { id: 'instalacao' as const, label: 'Instalação' },
  { id: 'instalacoes_entregas' as const, label: 'Instalações/Entregas' },
]

/** Dropdown de tipo de serviço na programação (sem duplicata «Instalação»). */
export const PROGRAMACAO_TIPOS_SERVICO = FROTA_TIPOS_MOVIMENTACAO.filter(
  (t) => t.id !== 'instalacao'
)

/** Tipos no formulário de movimentação da frota (exclui serviços só de programação). */
export const FROTA_TIPOS_MOVIMENTACAO_OPERACIONAL = FROTA_TIPOS_MOVIMENTACAO.filter(
  (t) => t.id !== 'instalacoes_entregas'
)
