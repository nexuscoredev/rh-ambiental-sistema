/** Setores do organograma RG Ambiental (matriz RBAC). */
export type RbacSetor =
  | 'desenvolvedor'
  | 'diretoria_financeiro'
  | 'operacao'
  | 'comercial'

export type RbacAcao = 'ler' | 'criar' | 'editar' | 'excluir'

/** Recursos alinhados aos módulos do manifesto de negócio. */
export type RbacRecurso =
  | 'cliente'
  | 'motorista'
  | 'representante'
  | 'veiculo'
  | 'programacao'
  | 'mtr'
  | 'pesagem_ticket'
  | 'comprovante_descarte'
  | 'conferencia_transporte'
  | 'faturamento'
  | 'frota_operacional'

export type UsuarioAcessoContext = {
  cargo?: string | null
  nome?: string | null
  email?: string | null
}
