/** Acentos visuais por módulo RH (ícones em `RhModuloIcon.tsx`). */

export type RhModuloVisual = {
  accent: string
  accentSoft: string
  tags: string[]
}

export const RH_MODULO_VISUAL: Record<string, RhModuloVisual> = {
  'departamento-pessoal': {
    accent: '#0f766e',
    accentSoft: '#ccfbf1',
    tags: ['Prontuário', 'Contratos', 'Dependentes'],
  },
  'folha-pagamento': {
    accent: '#0891b2',
    accentSoft: '#cffafe',
    tags: ['Holerite', 'Encargos', 'Fechamento'],
  },
  'admissoes-desligamentos': {
    accent: '#7c3aed',
    accentSoft: '#ede9fe',
    tags: ['Admissão', 'TRCT', 'Offboarding'],
  },
  'ferias-afastamentos': {
    accent: '#059669',
    accentSoft: '#d1fae5',
    tags: ['Férias', 'Licenças', 'INSS'],
  },
  'ponto-jornada': {
    accent: '#d97706',
    accentSoft: '#ffedd5',
    tags: ['Espelho', 'Banco de horas', 'Escalas'],
  },
  beneficios: {
    accent: '#db2777',
    accentSoft: '#fce7f3',
    tags: ['VT / VR', 'Saúde', 'Seguros'],
  },
  treinamentos: {
    accent: '#2563eb',
    accentSoft: '#dbeafe',
    tags: ['NR', 'Certificados', 'Presença'],
  },
  'documentos-esocial': {
    accent: '#334155',
    accentSoft: '#e2e8f0',
    tags: ['eSocial', 'Prazos', 'Auditoria'],
  },
}

export function rhVisual(slug: string): RhModuloVisual {
  return (
    RH_MODULO_VISUAL[slug] ?? {
      accent: '#0f766e',
      accentSoft: '#ccfbf1',
      tags: ['Em breve'],
    }
  )
}
