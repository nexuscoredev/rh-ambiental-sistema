/** Opções de mão de obra na programação operacional. */
export const MAO_OBRA_PROGRAMACAO_COM = 'C/ Mão de obra' as const
export const MAO_OBRA_PROGRAMACAO_SEM = 'S/ Mão de obra' as const

export const OPCOES_MAO_OBRA_PROGRAMACAO = [
  MAO_OBRA_PROGRAMACAO_COM,
  MAO_OBRA_PROGRAMACAO_SEM,
] as const

export type MaoObraProgramacaoOpcao = (typeof OPCOES_MAO_OBRA_PROGRAMACAO)[number]

export function isMissingProgramacaoMaoObraColumnError(
  error: { message?: string } | null | undefined
): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  return msg.includes('mao_obra_programacao')
}

export function rotuloMaoObraProgramacao(valor: string | null | undefined): string {
  const v = (valor ?? '').trim()
  if (v === MAO_OBRA_PROGRAMACAO_COM || v === MAO_OBRA_PROGRAMACAO_SEM) return v
  return ''
}
