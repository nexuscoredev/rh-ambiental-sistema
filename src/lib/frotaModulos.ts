/** Módulo Frota — Transportes e Manutenção (fluxo operacional). */

export const FROTA_HUB_PATH = '/operacional-frota'

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

export const FROTA_MENU_CHILDREN = FROTA_DIVISOES.map((d) => ({
  label: d.label,
  path: d.path,
}))

export const FROTA_ROTAS_SISTEMA: { path: string; label: string }[] = [
  { path: FROTA_HUB_PATH, label: 'Frota operacional' },
  ...FROTA_DIVISOES.map((d) => ({ path: d.path, label: d.label })),
]

export const FROTA_TIPOS_MOVIMENTACAO = [
  { id: 'troca' as const, label: 'Troca' },
  { id: 'retirada' as const, label: 'Retirada' },
  { id: 'carregamento_hora' as const, label: 'Carregamento na hora' },
  { id: 'instalacao' as const, label: 'Instalação' },
]
