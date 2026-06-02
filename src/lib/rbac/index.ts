export type { RbacAcao, RbacRecurso, RbacSetor, UsuarioAcessoContext } from './rbacTypes'
export {
  CARGO_COMERCIAL_ADM,
  RBAC_ROSTER_NOMES,
  RBAC_SETOR_MEMBROS,
  RBAC_SETOR_NOME,
} from './rbacManifest'
export {
  cargoEhComercialAdm,
  nomeContemToken,
  nomeEhThais,
  nomeEhMatheus,
  nomeEhOperacaoTimeRCadastroEstendido,
  normalizarNomePessoa,
  rbacPode,
  rbacPodeExcluir,
  resolverSetorUsuario,
  usuarioEhComercial,
  usuarioEhDesenvolvedorMaster,
  usuarioEhDiretoriaFinanceiro,
  usuarioEhEquipeComercial,
  usuarioEhOperacao,
} from './rbacAcesso'
