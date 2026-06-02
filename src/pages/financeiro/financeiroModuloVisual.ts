export type FinanceiroModuloVisual = {
  accent: string
  accentSoft: string
  tags: string[]
}

export const FINANCEIRO_MODULO_VISUAL: Record<string, FinanceiroModuloVisual> = {
  cobranca: {
    accent: '#0f766e',
    accentSoft: '#ccfbf1',
    tags: ['NF', 'Vencimentos', 'Baixas'],
  },
  'contas-receber': {
    accent: '#0891b2',
    accentSoft: '#cffafe',
    tags: ['Recebimentos', 'Clínicas', 'Títulos'],
  },
  'contas-pagar': {
    accent: '#d97706',
    accentSoft: '#ffedd5',
    tags: ['Despesas', 'Pagamentos', 'Fornecedores'],
  },
}

export function financeiroVisual(slug: string): FinanceiroModuloVisual {
  return (
    FINANCEIRO_MODULO_VISUAL[slug] ?? {
      accent: '#0f766e',
      accentSoft: '#ccfbf1',
      tags: ['Em breve'],
    }
  )
}
