/** Catálogo fixo de tipos de caminhão na programação (valor salvo = texto da opção). */
export const TIPOS_CAMINHAO_GRUPOS: readonly { titulo: string; opcoes: readonly string[] }[] = [
  { titulo: 'Baú e veículo leve', opcoes: ['Baú', 'Fiorino'] },
  {
    titulo: 'Roll-on',
    opcoes: [
      'Rollon Caixa Alta',
      'Rollon Caixa baixa',
      'Rollon Caixa de 30',
      'Rollon caixa de 40',
    ],
  },
  { titulo: 'Vácuo', opcoes: ['Vacuo de 13', 'Vacuo de 15'] },
  { titulo: 'Carreta', opcoes: ['Carreta de 30', 'Carreta de 40'] },
  {
    titulo: 'Polli (caçamba)',
    opcoes: ['Polli (Caçamba de 5)', 'Polli (Caçamba de 7)', 'Polli (Caçamba de 10)'],
  },
] as const

export const TIPOS_CAMINHAO_CATALOGO = new Set(
  TIPOS_CAMINHAO_GRUPOS.flatMap((g) => g.opcoes as string[])
)

export const TIPOS_CAMINHAO_LISTA = TIPOS_CAMINHAO_GRUPOS.flatMap((g) => [...g.opcoes])

export function combinaFiltroTipoCaminhao(
  tipoCaminhao: string | null | undefined,
  filtroTipo: string
): boolean {
  const filtro = filtroTipo.trim()
  if (!filtro) return true
  return (tipoCaminhao || '').trim().toLowerCase() === filtro.toLowerCase()
}

export function combinaFiltrosProgramacaoCaminhao(
  item: { tipoCaminhao: string; caminhaoId: string },
  opts: { filtroTipo?: string; filtroCaminhaoId?: string }
): boolean {
  const caminhaoId = (opts.filtroCaminhaoId || '').trim()
  if (caminhaoId && item.caminhaoId !== caminhaoId) return false
  return combinaFiltroTipoCaminhao(item.tipoCaminhao, opts.filtroTipo ?? '')
}

export function textoBuscaCombinaCaminhao(busca: string, ...partes: (string | null | undefined)[]): boolean {
  const q = busca.trim().toLowerCase()
  if (!q) return true
  return partes.some((p) => (p || '').toLowerCase().includes(q))
}
