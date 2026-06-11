/** Gamificação — Treinamentos RG Ambiental (XP, níveis, conquistas, brindes). */

export type KbNivelDificuldade = 'Iniciante' | 'Intermediário' | 'Avançado'

export type KbArtigoMeta = {
  /** XP base ao certificar (após quiz + leitura). */
  xpCertificacao: number
  /** XP por secção lida (engajamento). */
  xpPorSecao: number
  duracaoMin: number
  nivel: KbNivelDificuldade
  fase: number
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

/** Metadados por artigo — trilha de desenvolvimento (XP exige leitura + quiz). */
export const KB_ARTIGO_META: Record<string, KbArtigoMeta> = {
  'fluxo-completo': {
    xpCertificacao: 80,
    xpPorSecao: 8,
    duracaoMin: 15,
    nivel: 'Iniciante',
    fase: 1,
  },
  programacao: {
    xpCertificacao: 100,
    xpPorSecao: 10,
    duracaoMin: 12,
    nivel: 'Iniciante',
    fase: 2,
  },
  clientes: {
    xpCertificacao: 90,
    xpPorSecao: 10,
    duracaoMin: 12,
    nivel: 'Intermediário',
    fase: 2,
  },
  mtr: {
    xpCertificacao: 110,
    xpPorSecao: 10,
    duracaoMin: 14,
    nivel: 'Intermediário',
    fase: 3,
  },
  'ticket-pesagem': {
    xpCertificacao: 110,
    xpPorSecao: 10,
    duracaoMin: 12,
    nivel: 'Intermediário',
    fase: 3,
  },
  'conferencia-transporte': {
    xpCertificacao: 85,
    xpPorSecao: 8,
    duracaoMin: 10,
    nivel: 'Iniciante',
    fase: 3,
  },
  frota: {
    xpCertificacao: 85,
    xpPorSecao: 8,
    duracaoMin: 10,
    nivel: 'Iniciante',
    fase: 4,
  },
  faturamento: {
    xpCertificacao: 140,
    xpPorSecao: 12,
    duracaoMin: 18,
    nivel: 'Avançado',
    fase: 4,
  },
  financeiro: {
    xpCertificacao: 120,
    xpPorSecao: 10,
    duracaoMin: 14,
    nivel: 'Avançado',
    fase: 5,
  },
}

/** Níveis mais exigentes — curso completo leva semanas. */
export const KB_NIVEIS: KbNivelJogador[] = [
  {
    nivel: 1,
    titulo: 'Aprendiz RG',
    xpMin: 0,
    xpMax: 349,
    cor: '#64748b',
    corSuave: '#f1f5f9',
    emoji: '🌱',
  },
  {
    nivel: 2,
    titulo: 'Operador certificado',
    xpMin: 350,
    xpMax: 799,
    cor: '#0d9488',
    corSuave: '#ccfbf1',
    emoji: '⚙️',
  },
  {
    nivel: 3,
    titulo: 'Especialista',
    xpMin: 800,
    xpMax: 1399,
    cor: '#2563eb',
    corSuave: '#dbeafe',
    emoji: '🎯',
  },
  {
    nivel: 4,
    titulo: 'Mestre Ambiental',
    xpMin: 1400,
    xpMax: 2199,
    cor: '#7c3aed',
    corSuave: '#ede9fe',
    emoji: '🏆',
  },
  {
    nivel: 5,
    titulo: 'Embaixador RG',
    xpMin: 2200,
    xpMax: null,
    cor: '#b45309',
    corSuave: '#fef3c7',
    emoji: '👑',
  },
]

export const KB_CONQUISTAS: KbConquista[] = [
  {
    id: 'primeira_certificacao',
    titulo: 'Primeira certificação',
    descricao: 'Aprovou o quiz e certificou o primeiro módulo do seu perfil.',
    emoji: '🚀',
    xpBonus: 30,
  },
  {
    id: 'trilha_perfil',
    titulo: 'Trilha do perfil',
    descricao: 'Certificou 100% dos módulos liberados para o seu cargo.',
    emoji: '🎓',
    xpBonus: 200,
  },
  {
    id: 'sequencia_3',
    titulo: 'Constância',
    descricao: 'Estudou 3 dias seguidos.',
    emoji: '🔥',
    xpBonus: 50,
  },
  {
    id: 'sequencia_7',
    titulo: 'Dedicação',
    descricao: 'Manteve sequência de 7 dias.',
    emoji: '💎',
    xpBonus: 120,
  },
  {
    id: 'quiz_perfeito',
    titulo: 'Precisão total',
    descricao: 'Acertou 100% em 3 avaliações seguidas.',
    emoji: '🎯',
    xpBonus: 80,
  },
]

export const KB_BRINDES: KbBrinde[] = [
  {
    id: 'caneca',
    titulo: 'Caneca RG Ambiental',
    descricao: 'Caneca térmica sustentável com logo oficial.',
    emoji: '☕',
    pontosNecessarios: 1800,
    disponivel: false,
  },
  {
    id: 'camiseta',
    titulo: 'Camiseta oficial',
    descricao: 'Algodão orgânico — tamanho com RH.',
    emoji: '👕',
    pontosNecessarios: 3200,
    disponivel: false,
  },
  {
    id: 'kit',
    titulo: 'Kit sustentabilidade',
    descricao: 'Garrafa + ecobag + adesivos RG.',
    emoji: '🎁',
    pontosNecessarios: 4800,
    disponivel: false,
  },
  {
    id: 'vale',
    titulo: 'Vale-presente parceiro',
    descricao: 'Consulte RH para opções.',
    emoji: '🎫',
    pontosNecessarios: 6500,
    disponivel: false,
  },
]

export function kbMetaArtigo(slug: string): KbArtigoMeta {
  return (
    KB_ARTIGO_META[slug] ?? {
      xpCertificacao: 60,
      xpPorSecao: 6,
      duracaoMin: 10,
      nivel: 'Iniciante',
      fase: 1,
    }
  )
}

/** @deprecated use xpCertificacao */
export function kbXpRecompensaModulo(slug: string): number {
  return kbMetaArtigo(slug).xpCertificacao
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
