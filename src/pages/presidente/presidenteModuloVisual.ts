export type PresidenteModuloVisual = {
  accent: string
  accentSoft: string
  tags: string[]
}

export const PRESIDENTE_MODULO_VISUAL: Record<string, PresidenteModuloVisual> = {
  sede: {
    accent: '#0f766e',
    accentSoft: '#ccfbf1',
    tags: ['Cozinha', 'Salas', 'Receção'],
  },
  frota: {
    accent: '#0891b2',
    accentSoft: '#cffafe',
    tags: ['Dashcam', 'Veículos', 'Ao vivo'],
  },
  balanca: {
    accent: '#d97706',
    accentSoft: '#ffedd5',
    tags: ['Pesagem', 'Plataforma', 'Entrada'],
  },
  rastreamento: {
    accent: '#7c3aed',
    accentSoft: '#ede9fe',
    tags: ['GPS', 'Mapa', 'Alertas'],
  },
}

export function presidenteVisual(slug: string): PresidenteModuloVisual {
  return (
    PRESIDENTE_MODULO_VISUAL[slug] ?? {
      accent: '#0f766e',
      accentSoft: '#ccfbf1',
      tags: ['Monitorização'],
    }
  )
}
