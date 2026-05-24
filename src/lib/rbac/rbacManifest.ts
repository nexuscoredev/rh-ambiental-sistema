import type { RbacSetor } from './rbacTypes'

/** Rótulos oficiais dos setores (organograma RG Ambiental). */
export const RBAC_SETOR_NOME: Record<RbacSetor, string> = {
  diretoria_financeiro: 'Diretoria/Financeiro',
  operacao: 'Operação',
  comercial: 'Comercial',
  desenvolvedor: 'Desenvolvedor',
}

/** Membros por setor — nomes para exibição e documentação. */
export const RBAC_SETOR_MEMBROS: Record<RbacSetor, readonly string[]> = {
  diretoria_financeiro: ['Ezequiel', 'Ana'],
  operacao: ['Matheus', 'Rafael', 'Heberson', 'Gabriel'],
  comercial: ['Thais', 'Rafaela', 'Rose', 'Raquel'],
  desenvolvedor: ['Rafael Cavalcante', 'Vinicius'],
}

/** Tokens de nome normalizados para matching em `resolverSetorUsuario`. */
export const RBAC_ROSTER_NOMES: Record<RbacSetor, readonly string[]> = {
  diretoria_financeiro: ['ezequiel', 'ana'],
  operacao: ['matheus', 'rafael', 'heberson', 'gabriel'],
  comercial: ['thais', 'rafaela', 'rose', 'raquel'],
  desenvolvedor: ['rafael cavalcante', 'vinicius'],
}

/** Cargo canónico da Thais (única com perfil administrativo diferenciado no cadastro). */
export const CARGO_COMERCIAL_ADM = 'Comercial Adm'
