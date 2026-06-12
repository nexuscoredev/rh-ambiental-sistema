/** Tipos de cadastro que o time RG pode solicitar incluir no sistema. */
export type ItemCadastroSolicitacao =
  | 'residuo'
  | 'equipamento'
  | 'campo_informacao'
  | 'cliente'
  | 'outro'

export const ITENS_CADASTRO_SOLICITACAO: {
  id: ItemCadastroSolicitacao
  label: string
  hint: string
}[] = [
  {
    id: 'residuo',
    label: 'Resíduo',
    hint: 'Ex.: tipo de resíduo, unidade, frequência — ausente no cadastro do cliente',
  },
  {
    id: 'equipamento',
    label: 'Equipamento',
    hint: 'Ex.: caçamba, compactador — não cadastrado para o cliente',
  },
  {
    id: 'campo_informacao',
    label: 'Campo / informação',
    hint: 'Ex.: dado comercial ou operacional em falta no cadastro',
  },
  {
    id: 'cliente',
    label: 'Cliente (novo ou incompleto)',
    hint: 'Ex.: cliente ainda não existe ou cadastro incompleto',
  },
  {
    id: 'outro',
    label: 'Outro',
    hint: 'Descreva o que precisa ser cadastrado',
  },
]

export function rotuloItemCadastroSolicitacao(id: string): string {
  return ITENS_CADASTRO_SOLICITACAO.find((i) => i.id === id)?.label ?? id
}

export type TipoSolicitacaoSistema = 'ajuste' | 'cadastro'
