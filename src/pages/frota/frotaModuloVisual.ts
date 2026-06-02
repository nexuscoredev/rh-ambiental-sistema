import type { FrotaDivisaoSlug } from '../../lib/frotaModulos'

export type FrotaModuloVisual = {
  accent: string
  accentSoft: string
  tags: string[]
}

export const FROTA_MODULO_VISUAL: Record<FrotaDivisaoSlug, FrotaModuloVisual> = {
  transportes: {
    accent: '#0f766e',
    accentSoft: '#ccfbf1',
    tags: ['Equipamentos', 'Movimentação', 'Assinatura'],
  },
  manutencao: {
    accent: '#0891b2',
    accentSoft: '#cffafe',
    tags: ['Diário', 'Preventiva', 'Óleo'],
  },
  relatorio: {
    accent: '#059669',
    accentSoft: '#d1fae5',
    tags: ['Impressão', 'Consolidação', 'Período'],
  },
}

export function frotaVisual(slug: string): FrotaModuloVisual {
  return (
    FROTA_MODULO_VISUAL[slug as FrotaDivisaoSlug] ?? {
      accent: '#0f766e',
      accentSoft: '#ccfbf1',
      tags: ['Em breve'],
    }
  )
}
