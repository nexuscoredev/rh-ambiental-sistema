/** Gamificação — Treinamentos RG Ambiental (XP, níveis, conquistas, brindes). */

export type KbNivelDificuldade = 'Iniciante' | 'Intermediário' | 'Avançado'

export type KbArtigoMeta = {
  xpRecompensa: number
  duracaoMin: number
  nivel: KbNivelDificuldade
}

export type KbNivelJogador = {
  nivel: number
  titulo: string
  xpMin: number
  xpMax: number | null
  cor: string
  corSuave: string
  emoji: string
}

export type KbConquista = {
  id: string
  titulo: string
  descricao: string
  emoji: string
  xpBonus: number
}

export type KbBrinde = {
  id: string
  titulo: string
  descricao: string
  emoji: string
  pontosNecessarios: number
  disponivel: boolean
}

/** Metadados por artigo — XP e tempo estimado de leitura. */
export const KB_ARTIGO_META: Record<string, KbArtigoMeta> = {
  'fluxo-completo': { xpRecompensa: 120, duracaoMin: 12, nivel: 'Iniciante' },
  programacao: { xpRecompensa: 100, duracaoMin: 10, nivel: 'Iniciante' },
  mtr: { xpRecompensa: 100, duracaoMin: 12, nivel: 'Intermediário' },
  'ticket-pesagem': { xpRecompensa: 100, duracaoMin: 10, nivel: 'Intermediário' },
  faturamento: { xpRecompensa: 120, duracaoMin: 14, nivel: 'Avançado' },
  financeiro: { xpRecompensa: 100, duracaoMin: 10, nivel: 'Intermediário' },
  frota: { xpRecompensa: 80, duracaoMin: 8, nivel: 'Iniciante' },
  clientes: { xpRecompensa: 90, duracaoMin: 10, nivel: 'Intermediário' },
  'conferencia-transporte': { xpRecompensa: 80, duracaoMin: 8, nivel: 'Iniciante' },
}

export const KB_NIVEIS: KbNivelJogador[] = [
  {
    nivel: 1,
    titulo: 'Aprendiz RG',
    xpMin: 0,
    xpMax: 199,
    cor: '#64748b',
    corSuave: '#f1f5f9',
    emoji: '🌱',
  },
  {
    nivel: 2,
    titulo: 'Operador',
    xpMin: 200,
    xpMax: 449,
    cor: '#0d9488',
    corSuave: '#ccfbf1',
    emoji: '⚙️',
  },
  {
    nivel: 3,
    titulo: 'Especialista',
    xpMin: 450,
    xpMax: 749,
    cor: '#2563eb',
    corSuave: '#dbeafe',
    emoji: '🎯',
  },
  {
    nivel: 4,
    titulo: 'Mestre Ambiental',
    xpMin: 750,
    xpMax: 1099,
    cor: '#7c3aed',
    corSuave: '#ede9fe',
    emoji: '🏆',
  },
  {
    nivel: 5,
    titulo: 'Lenda RG',
    xpMin: 1100,
    xpMax: null,
    cor: '#b45309',
    corSuave: '#fef3c7',
    emoji: '👑',
  },
]

export const KB_CONQUISTAS: KbConquista[] = [
  {
    id: 'primeira_missao',
    titulo: 'Primeira missão',
    descricao: 'Concluiu o primeiro módulo de treinamento.',
    emoji: '🚀',
    xpBonus: 25,
  },
  {
    id: 'trilha_fluxo',
    titulo: 'Trilha operacional',
    descricao: 'Completou todos os módulos do fluxo principal.',
    emoji: '🔄',
    xpBonus: 75,
  },
  {
    id: 'trilha_apoio',
    titulo: 'Suporte total',
    descricao: 'Dominou Frota, Clientes e Conferência de transportes.',
    emoji: '🛡️',
    xpBonus: 60,
  },
  {
    id: 'trilha_mestre',
    titulo: 'Certificação RG',
    descricao: 'Concluiu 100% da base de conhecimento operacional.',
    emoji: '🎓',
    xpBonus: 150,
  },
  {
    id: 'sequencia_3',
    titulo: 'Constância',
    descricao: 'Estudou 3 dias seguidos na plataforma.',
    emoji: '🔥',
    xpBonus: 40,
  },
  {
    id: 'sequencia_7',
    titulo: 'Dedicação',
    descricao: 'Manteve sequência de 7 dias de aprendizado.',
    emoji: '💎',
    xpBonus: 100,
  },
]

export const KB_BRINDES: KbBrinde[] = [
  {
    id: 'caneca',
    titulo: 'Caneca RG Ambiental',
    descricao: 'Caneca térmica sustentável com logo oficial.',
    emoji: '☕',
    pontosNecessarios: 400,
    disponivel: false,
  },
  {
    id: 'camiseta',
    titulo: 'Camiseta oficial',
    descricao: 'Camiseta algodão orgânico — tamanho a escolher com RH.',
    emoji: '👕',
    pontosNecessarios: 800,
    disponivel: false,
  },
  {
    id: 'kit',
    titulo: 'Kit sustentabilidade',
    descricao: 'Garrafa reutilizável + ecobag + adesivos RG.',
    emoji: '🎁',
    pontosNecessarios: 1200,
    disponivel: false,
  },
  {
    id: 'vale',
    titulo: 'Vale-presente parceiro',
    descricao: 'Parceria local — consulte RH para opções disponíveis.',
    emoji: '🎫',
    pontosNecessarios: 2000,
    disponivel: false,
  },
]

export const KB_FLUXO_SLUGS = [
  'programacao',
  'mtr',
  'ticket-pesagem',
  'faturamento',
  'financeiro',
] as const

export const KB_APOIO_SLUGS_GAM = ['frota', 'clientes', 'conferencia-transporte'] as const

export const KB_TOTAL_ARTIGOS = 9

export function kbMetaArtigo(slug: string): KbArtigoMeta {
  return KB_ARTIGO_META[slug] ?? { xpRecompensa: 50, duracaoMin: 8, nivel: 'Iniciante' }
}

export function kbXpTotalPossivel(): number {
  const base = Object.values(KB_ARTIGO_META).reduce((s, m) => s + m.xpRecompensa, 0)
  const bonus = KB_CONQUISTAS.reduce((s, c) => s + c.xpBonus, 0)
  return base + bonus
}

export function kbNivelPorXp(xp: number): KbNivelJogador {
  let atual = KB_NIVEIS[0]
  for (const n of KB_NIVEIS) {
    if (xp >= n.xpMin) atual = n
  }
  return atual
}

export function kbProgressoNivel(xp: number): {
  nivel: KbNivelJogador
  xpNoNivel: number
  xpParaProximo: number
  percentual: number
} {
  const nivel = kbNivelPorXp(xp)
  const xpNoNivel = xp - nivel.xpMin
  const proximo = KB_NIVEIS.find((n) => n.nivel === nivel.nivel + 1)
  const xpParaProximo = proximo ? proximo.xpMin - nivel.xpMin : xpNoNivel || 1
  const percentual = proximo
    ? Math.min(100, Math.round((xpNoNivel / xpParaProximo) * 100))
    : 100
  return { nivel, xpNoNivel, xpParaProximo, percentual }
}

export function kbConquistaPorId(id: string): KbConquista | undefined {
  return KB_CONQUISTAS.find((c) => c.id === id)
}
