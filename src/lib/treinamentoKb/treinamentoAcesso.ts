import { KB_ARTIGO_FLUXO_SLUG, kbArtigoPorSlug } from './conteudo'
import type { KbArtigo } from './types'
import {
  cargoPodeAcessarRotaMenu,
  type UsuarioComPaginas,
  usuarioPodeAcessarRota,
} from '../paginasSistema'

/** Rota do sistema usada para validar se o cargo pode ver o módulo. */
export const KB_ARTIGO_ROTA: Record<string, string> = {
  'fluxo-completo': '/programacao',
  programacao: '/programacao',
  mtr: '/mtr',
  'ticket-pesagem': '/controle-massa',
  faturamento: '/faturamento',
  financeiro: '/financeiro',
  frota: '/operacional-frota',
  clientes: '/clientes',
  'conferencia-transporte': '/conferencia-transporte',
}

/** Ordem pedagógica do curso RG Ambiental (trilha de desenvolvimento). */
export const KB_CURRICULUM_ORDER = [
  KB_ARTIGO_FLUXO_SLUG,
  'programacao',
  'clientes',
  'mtr',
  'ticket-pesagem',
  'conferencia-transporte',
  'frota',
  'faturamento',
  'financeiro',
] as const

export type KbModuloStatus = 'concluido' | 'disponivel' | 'bloqueado_prereq' | 'sem_acesso'

export function kbUsuarioPodeVerArtigo(
  slug: string,
  usuario: UsuarioComPaginas | null | undefined,
): boolean {
  if (!usuario) return false
  if (slug === KB_ARTIGO_FLUXO_SLUG) {
    return KB_CURRICULUM_ORDER.some(
      (s) =>
        s !== KB_ARTIGO_FLUXO_SLUG &&
        kbUsuarioPodeVerArtigo(s, usuario),
    )
  }
  const rota = KB_ARTIGO_ROTA[slug]
  if (!rota) return false
  return (
    usuarioPodeAcessarRota(usuario, rota) &&
    cargoPodeAcessarRotaMenu(usuario.cargo, rota, usuario.nome, usuario.email)
  )
}

export function kbArtigosDoUsuario(usuario: UsuarioComPaginas | null | undefined): KbArtigo[] {
  if (!usuario) return []
  return KB_CURRICULUM_ORDER.map((slug) => kbArtigoPorSlug(slug))
    .filter((a): a is KbArtigo => !!a && kbUsuarioPodeVerArtigo(a.slug, usuario))
}

export function kbStatusModulo(
  slug: string,
  usuario: UsuarioComPaginas | null | undefined,
  concluidos: string[],
): KbModuloStatus {
  if (!kbUsuarioPodeVerArtigo(slug, usuario)) return 'sem_acesso'
  if (concluidos.includes(slug)) return 'concluido'

  const curriculum = kbArtigosDoUsuario(usuario).map((a) => a.slug)
  const idx = curriculum.indexOf(slug)
  if (idx <= 0) return 'disponivel'

  const anterior = curriculum[idx - 1]
  if (concluidos.includes(anterior)) return 'disponivel'
  return 'bloqueado_prereq'
}

export function kbModuloAnterior(
  slug: string,
  usuario: UsuarioComPaginas | null | undefined,
): KbArtigo | null {
  const curriculum = kbArtigosDoUsuario(usuario)
  const idx = curriculum.findIndex((a) => a.slug === slug)
  if (idx <= 0) return null
  return curriculum[idx - 1] ?? null
}

export function kbFluxoEtapaPermitida(
  artigoSlug: string,
  usuario: UsuarioComPaginas | null | undefined,
): boolean {
  return kbUsuarioPodeVerArtigo(artigoSlug, usuario)
}

/** Artigos do fluxo principal visíveis ao utilizador (sem apoio). */
export function kbFluxoArtigosUsuario(usuario: UsuarioComPaginas | null | undefined): KbArtigo[] {
  const fluxoSlugs = ['programacao', 'mtr', 'ticket-pesagem', 'faturamento', 'financeiro']
  return fluxoSlugs
    .map((s) => kbArtigoPorSlug(s))
    .filter((a): a is KbArtigo => !!a && kbUsuarioPodeVerArtigo(a.slug, usuario))
}

export function kbApoioArtigosUsuario(usuario: UsuarioComPaginas | null | undefined): KbArtigo[] {
  const apoio = ['clientes', 'frota', 'conferencia-transporte']
  return apoio
    .map((s) => kbArtigoPorSlug(s))
    .filter((a): a is KbArtigo => !!a && kbUsuarioPodeVerArtigo(a.slug, usuario))
}

export function kbTotalModulosUsuario(usuario: UsuarioComPaginas | null | undefined): number {
  return kbArtigosDoUsuario(usuario).length
}
