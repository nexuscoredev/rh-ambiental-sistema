import { CARGO_COMERCIAL_ADM, RBAC_ROSTER_NOMES } from './rbacManifest'
import type { RbacAcao, RbacRecurso, RbacSetor, UsuarioAcessoContext } from './rbacTypes'

function normalizarTextoCargo(s: string | null | undefined): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function cargoEhDesenvolvedor(cargo: string | null | undefined): boolean {
  return normalizarTextoCargo(cargo).includes('desenvolvedor')
}

function cargoEhVisualizador(cargo: string | null | undefined): boolean {
  return normalizarTextoCargo(cargo).includes('visualizador')
}

function cargoEhOperadoresTimeR(cargo: string | null | undefined): boolean {
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (c.includes('operadores') && c.includes('time r')) return true
  if (c.includes('operadores') && c.includes('rafael')) return true
  return c === 'operadores' || c.includes('meninos') || c.includes('operadores time rafael')
}

/** Thais: cargo «Comercial Adm» (legado: Operacional Time T). */
/** Cargo «Operacional» (sem Operadores / Time T/R) — módulo frota. */
export function cargoEhOperacionalFrotaFluxo(cargo: string | null | undefined): boolean {
  const c = normalizarTextoCargo(cargo)
  if (!c.includes('operacional')) return false
  if (cargoEhVisualizador(cargo)) return false
  if (c.includes('operadores') || c.includes('time r') || c.includes('time t')) return false
  return true
}

export function cargoEhComercialAdm(cargo: string | null | undefined): boolean {
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (c === normalizarTextoCargo(CARGO_COMERCIAL_ADM)) return true
  if (c.includes('comercial') && c.includes('adm')) return true
  if (c.includes('operacional') && c.includes('time t')) return true
  if (c.includes('operacional') && c.includes('thais')) return true
  if (c.includes('gerente') && c.includes('time')) return true
  return c === 'gerente time' || c.includes('operacional time thais')
}

export function normalizarNomePessoa(s: string | null | undefined): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function nomeContemToken(nomeNorm: string, token: string): boolean {
  if (!nomeNorm || !token) return false
  const t = token.trim().toLowerCase()
  if (nomeNorm === t) return true
  return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(nomeNorm)
}

/** Thais pelo nome (cargo administrativo é `Comercial Adm`). */
export function nomeEhThais(ctx: UsuarioAcessoContext): boolean {
  return nomeContemToken(normalizarNomePessoa(ctx.nome), 'thais')
}

/** Matheus (Operação): cadastro de clientes liberado por exceção de negócio. */
export function nomeEhMatheus(ctx: UsuarioAcessoContext): boolean {
  return nomeContemToken(normalizarNomePessoa(ctx.nome), 'matheus')
}

/** Matheus e Gabriel (Operação Time R): cadastros estendidos (clientes, motoristas, veículos). */
export function nomeEhOperacaoTimeRCadastroEstendido(ctx: UsuarioAcessoContext): boolean {
  const n = normalizarNomePessoa(ctx.nome)
  return nomeContemToken(n, 'matheus') || nomeContemToken(n, 'gabriel')
}

/** Equipe comercial com o mesmo acesso operacional (Thais, Rafaela, Rose, Raquel). */
export function usuarioEhEquipeComercial(ctx: UsuarioAcessoContext): boolean {
  if (usuarioEhDesenvolvedorMaster(ctx)) return true
  if (resolverSetorUsuario(ctx) === 'comercial') return true
  const c = normalizarTextoCargo(ctx.cargo)
  if (c.includes('comercial')) return true
  return cargoEhComercialAdm(ctx.cargo)
}

function nomeEhDesenvolvedorMaster(nomeNorm: string): boolean {
  if (!nomeNorm) return false
  if (nomeNorm.includes('cavalcante')) return true
  for (const full of RBAC_ROSTER_NOMES.desenvolvedor) {
    if (nomeNorm === full || nomeNorm.startsWith(`${full} `)) return true
  }
  return nomeContemToken(nomeNorm, 'vinicius')
}

function nomeCasaSetor(nomeNorm: string, setor: RbacSetor): boolean {
  if (!nomeNorm) return false
  if (setor === 'desenvolvedor') return nomeEhDesenvolvedorMaster(nomeNorm)
  if (setor === 'operacao') {
    if (nomeEhDesenvolvedorMaster(nomeNorm)) return false
    if (nomeContemToken(nomeNorm, 'rafaela')) return false
    if (nomeNorm.includes('cavalcante')) return false
  }
  for (const token of RBAC_ROSTER_NOMES[setor]) {
    if (nomeContemToken(nomeNorm, token)) {
      if (setor === 'operacao' && token === 'rafael' && nomeNorm.includes('cavalcante')) continue
      if (setor === 'operacao' && token === 'rafael' && nomeContemToken(nomeNorm, 'rafaela')) continue
      return true
    }
  }
  return false
}

/** Resolve setor predominante (nome tem prioridade sobre cargo). */
export function resolverSetorUsuario(ctx: UsuarioAcessoContext): RbacSetor | null {
  const nomeNorm = normalizarNomePessoa(ctx.nome)
  if (nomeEhDesenvolvedorMaster(nomeNorm) || cargoEhDesenvolvedor(ctx.cargo)) return 'desenvolvedor'

  const ordem: RbacSetor[] = ['diretoria_financeiro', 'comercial', 'operacao']
  for (const setor of ordem) {
    if (nomeCasaSetor(nomeNorm, setor)) return setor
  }

  const c = normalizarTextoCargo(ctx.cargo)
  if (!c) return null
  if (c.includes('desenvolvedor')) return 'desenvolvedor'
  if (c.includes('diretoria') || c.includes('diretor')) return 'diretoria_financeiro'
  if (c.includes('financeiro') && !c.includes('operacional')) return 'diretoria_financeiro'
  if (cargoEhComercialAdm(ctx.cargo) || c.includes('comercial')) return 'comercial'
  if (cargoEhOperadoresTimeR(ctx.cargo)) return 'operacao'
  if (
    c.includes('operacional') ||
    c.includes('logistica') ||
    c.includes('balanceiro') ||
    c.includes('pesagem')
  ) {
    return 'operacao'
  }
  if (c.includes('administrador')) return 'diretoria_financeiro'
  return null
}

export function usuarioEhDesenvolvedorMaster(ctx: UsuarioAcessoContext): boolean {
  return resolverSetorUsuario(ctx) === 'desenvolvedor'
}

export function usuarioEhDiretoriaFinanceiro(ctx: UsuarioAcessoContext): boolean {
  return resolverSetorUsuario(ctx) === 'diretoria_financeiro'
}

/** Ezequiel e Ana — visibilidade de todas as páginas do menu e rotas (como Desenvolvedor na UI). */
export function usuarioTemVisaoCompletaPaginas(ctx: UsuarioAcessoContext): boolean {
  const nomeNorm = normalizarNomePessoa(ctx.nome)
  if (!nomeNorm) return false
  if (nomeContemToken(nomeNorm, 'ezequiel') || nomeContemToken(nomeNorm, 'ezequeil')) return true
  return nomeContemToken(nomeNorm, 'ana')
}

export function usuarioEhComercial(ctx: UsuarioAcessoContext): boolean {
  return usuarioEhEquipeComercial(ctx)
}

export function usuarioEhOperacao(ctx: UsuarioAcessoContext): boolean {
  const s = resolverSetorUsuario(ctx)
  return s === 'operacao' || s === 'desenvolvedor'
}

function setorComercialOuOperacao(ctx: UsuarioAcessoContext): boolean {
  const s = resolverSetorUsuario(ctx)
  return s === 'comercial' || s === 'operacao' || s === 'desenvolvedor'
}

function leituraGeralSistema(ctx: UsuarioAcessoContext): boolean {
  if (usuarioEhDesenvolvedorMaster(ctx)) return true
  if (cargoEhVisualizador(ctx.cargo)) return false
  return true
}

/** Diretoria / financeiro estratégico — visão e operação em todo o fluxo (exceto gestão de acessos). */
function diretoriaAcessoNegocio(ctx: UsuarioAcessoContext): boolean {
  return usuarioEhDiretoriaFinanceiro(ctx)
}

/**
 * Matriz RBAC — fonte da verdade no frontend (espelhada em `rg_rbac_pode` no Supabase).
 * Equipe Comercial (Thais, Rafaela, Rose, Raquel): mesmo acesso; Thais usa cargo «Comercial Adm».
 */
export function rbacPode(
  recurso: RbacRecurso,
  acao: RbacAcao,
  ctx: UsuarioAcessoContext
): boolean {
  if (usuarioEhDesenvolvedorMaster(ctx)) return true
  // Cargo «Visualizador» não revoga quem está no organograma comercial/diretoria (nome tem prioridade).
  if (
    cargoEhVisualizador(ctx.cargo) &&
    !usuarioEhEquipeComercial(ctx) &&
    !diretoriaAcessoNegocio(ctx)
  ) {
    return false
  }

  switch (recurso) {
    case 'cliente':
      return (
        usuarioEhEquipeComercial(ctx) ||
        diretoriaAcessoNegocio(ctx) ||
        nomeEhOperacaoTimeRCadastroEstendido(ctx)
      )
    case 'motorista':
    case 'veiculo':
      return (
        setorComercialOuOperacao(ctx) ||
        diretoriaAcessoNegocio(ctx) ||
        nomeEhOperacaoTimeRCadastroEstendido(ctx)
      )
    case 'representante': {
      if (acao === 'ler') return usuarioEhComercial(ctx) || diretoriaAcessoNegocio(ctx)
      return usuarioEhEquipeComercial(ctx) || diretoriaAcessoNegocio(ctx)
    }
    case 'programacao': {
      if (acao === 'ler') return leituraGeralSistema(ctx)
      if (acao === 'criar' || acao === 'editar') {
        return (
          usuarioEhEquipeComercial(ctx) ||
          usuarioEhOperacao(ctx) ||
          diretoriaAcessoNegocio(ctx)
        )
      }
      if (acao === 'excluir') {
        return usuarioEhEquipeComercial(ctx) || diretoriaAcessoNegocio(ctx)
      }
      return false
    }
    case 'mtr': {
      if (acao === 'ler' || acao === 'editar' || acao === 'criar') return leituraGeralSistema(ctx)
      if (acao === 'excluir') return usuarioEhEquipeComercial(ctx) || diretoriaAcessoNegocio(ctx)
      return false
    }
    case 'pesagem_ticket': {
      if (acao === 'ler') return leituraGeralSistema(ctx)
      if (acao === 'criar' || acao === 'editar') {
        return (
          usuarioEhOperacao(ctx) ||
          usuarioEhEquipeComercial(ctx) ||
          diretoriaAcessoNegocio(ctx)
        )
      }
      if (acao === 'excluir') return usuarioEhEquipeComercial(ctx) || diretoriaAcessoNegocio(ctx)
      return false
    }
    case 'comprovante_descarte':
      return usuarioEhEquipeComercial(ctx) || diretoriaAcessoNegocio(ctx)
    case 'conferencia_transporte': {
      if (acao === 'excluir') return usuarioEhEquipeComercial(ctx) || diretoriaAcessoNegocio(ctx)
      return usuarioEhOperacao(ctx) || diretoriaAcessoNegocio(ctx)
    }
    case 'faturamento': {
      if (acao === 'ler') return usuarioEhEquipeComercial(ctx) || diretoriaAcessoNegocio(ctx)
      if (acao === 'criar' || acao === 'editar' || acao === 'excluir') {
        return usuarioEhEquipeComercial(ctx) || diretoriaAcessoNegocio(ctx)
      }
      return false
    }
    case 'frota_operacional': {
      if (acao === 'excluir') {
        return (
          cargoEhDesenvolvedor(ctx.cargo) ||
          nomeEhThais(ctx) ||
          cargoEhComercialAdm(ctx.cargo) ||
          diretoriaAcessoNegocio(ctx)
        )
      }
      if (acao === 'ler' || acao === 'criar' || acao === 'editar') {
        return (
          usuarioEhEquipeComercial(ctx) ||
          diretoriaAcessoNegocio(ctx) ||
          cargoEhOperacionalFrotaFluxo(ctx.cargo)
        )
      }
      return false
    }
    default:
      return false
  }
}

export function rbacPodeExcluir(recurso: RbacRecurso, ctx: UsuarioAcessoContext): boolean {
  return rbacPode(recurso, 'excluir', ctx)
}
