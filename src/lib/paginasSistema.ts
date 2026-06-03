import { NEXUS_CARGOS_POR_ROTA } from './nexusCargosPorRota'
import { FROTA_ROTAS_SISTEMA } from './frotaModulos'
import { FINANCEIRO_ROTAS_SISTEMA } from './financeiroModulos'
import { RH_ROTAS_SISTEMA } from './rhModulos'
import { nomeEhOperacaoTimeRCadastroEstendido } from './rbac'
import {
  cargoEhOperacionalTimeT,
  cargoTemAutoridadeMaximaSistema,
} from './workflowPermissions'

/**
 * Página inicial de boas-vindas — sempre acessível (fora da lista `paginas_permitidas`).
 */
export const ROTA_BEM_VINDO = '/bem-vindo'

/** Alteração de senha própria — acessível a qualquer utilizador autenticado (fora de `ROTAS_SISTEMA`). */
export const ROTA_MINHA_CONTA = '/minha-conta'

/**
 * Rotas configuráveis para restrição por utilizador (`usuarios.paginas_permitidas`).
 * Valores guardados na BD são os `path` (prefixo), alinhados com as rotas em App.tsx.
 */
export const ROTAS_SISTEMA: { path: string; label: string }[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/clientes', label: 'Clientes' },
  { path: '/clientes/gerenciador', label: 'Gerenciador (Clientes)' },
  { path: '/motoristas', label: 'Motoristas' },
  { path: '/representantes-rg', label: 'Representante RG' },
  { path: '/caminhoes', label: 'Veículos' },
  { path: '/programacao', label: 'Programação' },
  { path: '/mtr', label: 'MTR' },
  { path: '/mtr/gerenciador', label: 'MTR Gerenciador' },
  { path: '/controle-massa', label: 'Pesagem e Ticket' },
  { path: '/comprovantes-descarte', label: 'Comprovante de Descarte' },
  { path: '/checklist-transporte', label: 'Checklist de transportes' },
  { path: '/conferencia-transporte', label: 'Conferência de transportes' },
  ...FROTA_ROTAS_SISTEMA,
  { path: '/ticket-operacional', label: 'Ticket operacional' },
  { path: '/clinicas', label: 'Clínicas' },
  { path: '/faturamento', label: 'Faturamento' },
  { path: '/faturamento-clinicas', label: 'Faturar clínicas' },
  { path: '/envio-nf', label: 'Mala Direta' },
  ...FINANCEIRO_ROTAS_SISTEMA,
  { path: '/pos-venda', label: 'Pós-venda' },
  ...RH_ROTAS_SISTEMA,
  { path: '/usuarios', label: 'Usuários' },
  { path: '/sistema/solicitacoes-ajuste', label: 'Gestão de solicitações' },
  { path: '/sistema/senha-pessoal', label: 'Acompanhamento senha pessoal' },
  { path: '/chat', label: 'Chat' },
]

const ROTAS_VALIDAS = new Set(ROTAS_SISTEMA.map((r) => r.path))

export function pathEstaNaListaValida(path: string): boolean {
  return ROTAS_VALIDAS.has(path)
}

/** Contas que ignoram a lista de páginas (sempre incluídas). */
const EMAILS_BYPASS_PAGINAS_BASE = new Set([
  'cavalcantersc07@gmail.com',
  'gestores@rgambiental.com',
])

function parseEmailsBypassFromEnv(): string[] {
  const raw = String(import.meta.env.VITE_PAGINAS_BYPASS_EMAILS ?? '').trim()
  if (!raw) return []
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** Base + opcional `VITE_PAGINAS_BYPASS_EMAILS` (lista separada por vírgula ou ponto e vírgula). */
const EMAILS_BYPASS_PAGINAS = (() => {
  const s = new Set(EMAILS_BYPASS_PAGINAS_BASE)
  for (const em of parseEmailsBypassFromEnv()) {
    s.add(em)
  }
  return s
})()

export function emailPodeDefinirPaginasPorUsuario(email: string | null | undefined): boolean {
  const em = (email || '').trim().toLowerCase()
  return EMAILS_BYPASS_PAGINAS.has(em)
}

export type UsuarioComPaginas = {
  email?: string | null
  cargo?: string | null
  nome?: string | null
  paginas_permitidas?: string[] | null
}

function cargoEhVisualizadorLocal(cargo: string | null | undefined): boolean {
  return String(cargo ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .includes('visualizador')
}

export function normalizarPath(pathname: string): string {
  if (!pathname) return '/'
  const p = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  return p || '/'
}

/** Garante `/` inicial para valores vindos da BD ou de importações. */
function normalizarPrefixoPaginaGuardada(p: string): string {
  const t = String(p).trim()
  if (!t) return '/'
  const comSlash = t.startsWith('/') ? t : `/${t.replace(/^\/+/, '')}`
  return normalizarPath(comSlash)
}

/**
 * Converte `paginas_permitidas` (prefixos ou paths exatos) nos paths canónicos de `ROTAS_SISTEMA`
 * usados nos checkboxes (inclui filhos de um prefixo, ex.: `/financeiro` → contas a pagar/receber).
 */
export function rotasCheckboxDesdePaginasGuardadas(paginas: string[] | null | undefined): string[] {
  if (!paginas?.length) return []
  const prefixes = [
    ...new Set(paginas.map((p) => normalizarPrefixoPaginaGuardada(p)).filter((p) => p !== '/')),
  ]
  const out = new Set<string>()
  for (const pre of prefixes) {
    if (ROTAS_VALIDAS.has(pre)) out.add(pre)
  }
  for (const { path } of ROTAS_SISTEMA) {
    const pathN = normalizarPath(path)
    if (prefixes.some((pre) => pathN === pre || pathN.startsWith(`${pre}/`))) {
      out.add(path)
    }
  }
  return Array.from(out)
}

/**
 * Cargos autorizados por prefixo de rota — mesma fonte que `App-NEXUS.tsx` (`nexusCargosPorRota.ts`).
 */
const CARGOS_POR_PREFIXO_ROTA: Record<string, readonly string[]> = {
  ...NEXUS_CARGOS_POR_ROTA,
}

const PREFIXOS_ROTA_PARA_CARGO = Object.keys(CARGOS_POR_PREFIXO_ROTA).sort(
  (a, b) => normalizarPath(b).length - normalizarPath(a).length
)

/**
 * Indica se o cargo pode aceder à rota segundo as regras do `App` (menu e CTAs).
 * Prefixo mais longo ganha (ex.: `/financeiro/contas-receber` antes de `/financeiro`).
 */
export function rotaEhCadastroCliente(pathname: string): boolean {
  const path = normalizarPath(pathname)
  return path === '/clientes' || path.startsWith('/clientes/')
}

/** Rotas de cadastro de motoristas e veículos. */
export function rotaEhCadastroMotoristaVeiculo(pathname: string): boolean {
  const path = normalizarPath(pathname)
  return (
    path === '/motoristas' ||
    path.startsWith('/motoristas/') ||
    path === '/caminhoes' ||
    path.startsWith('/caminhoes/')
  )
}

/** Exceções por nome — Matheus e Gabriel (Operação Time R): clientes, motoristas e veículos. */
export function usuarioTemExcecaoCadastroOperacaoTimeR(
  usuario: UsuarioComPaginas,
  pathname: string
): boolean {
  if (!nomeEhOperacaoTimeRCadastroEstendido({ nome: usuario.nome, cargo: usuario.cargo })) {
    return false
  }
  return rotaEhCadastroCliente(pathname) || rotaEhCadastroMotoristaVeiculo(pathname)
}

/** @deprecated Preferir `usuarioTemExcecaoCadastroOperacaoTimeR`. */
export function usuarioTemExcecaoCadastroCliente(
  usuario: UsuarioComPaginas,
  pathname: string
): boolean {
  return usuarioTemExcecaoCadastroOperacaoTimeR(usuario, pathname)
}

export function cargoPodeAcessarRotaMenu(
  cargo: string | null | undefined,
  pathname: string,
  nome?: string | null,
  email?: string | null
): boolean {
  if (cargoTemAutoridadeMaximaSistema(cargo, nome, email)) return true
  const path = normalizarPath(pathname)
  if (rotaEhCadastroCliente(path) && nomeEhOperacaoTimeRCadastroEstendido({ nome, cargo })) return true
  if (rotaEhCadastroMotoristaVeiculo(path) && nomeEhOperacaoTimeRCadastroEstendido({ nome, cargo })) {
    return true
  }
  if (cargoEhOperacionalTimeT(cargo)) {
    if (path === '/usuarios' || path.startsWith('/usuarios/')) return false
    return true
  }
  const c = String(cargo ?? '').trim()
  if (!c) return false
  for (const key of PREFIXOS_ROTA_PARA_CARGO) {
    const k = normalizarPath(key)
    if (path === k || path.startsWith(`${k}/`)) {
      const lista = CARGOS_POR_PREFIXO_ROTA[key]
      return lista.includes(c)
    }
  }
  return true
}

/** Rotas da checklist a que o cargo já pode aceder pelo menu (base para pré-marcação ao mudar para «lista»). */
export function rotasPermitidasPorCargoParaChecklist(cargo: string | null | undefined): Set<string> {
  if (cargoTemAutoridadeMaximaSistema(cargo)) {
    return new Set(ROTAS_SISTEMA.map((r) => r.path))
  }
  const c = String(cargo ?? '').trim()
  const out = new Set<string>()
  for (const { path } of ROTAS_SISTEMA) {
    if (cargoPodeAcessarRotaMenu(c, path)) out.add(path)
  }
  return out
}

/**
 * Regras (alinhadas ao documento de cargos):
 * - Páginas `/bem-vindo` e `/minha-conta` são sempre acessíveis.
 * - E-mails de gestão (bypass) ignoram qualquer restrição.
 * - Cargo `Visualizador` exige `paginas_permitidas` explícita; sem lista, só vê `/bem-vindo`.
 * - Demais cargos: lista vazia/nula = sem filtro extra por **lista de páginas** (o cargo continua a ser
 *   validado nas rotas em `App.tsx` e no menu com `cargoPodeAcessarRotaMenu`).
 *   Lista preenchida = só os prefixos listados.
 */
function rotaUsuarios(path: string): boolean {
  return path === '/usuarios' || path.startsWith('/usuarios/')
}

export function usuarioPodeAcessarRota(usuario: UsuarioComPaginas, pathname: string): boolean {
  const path = normalizarPath(pathname)
  const bem = normalizarPath(ROTA_BEM_VINDO)
  if (path === bem || path.startsWith(`${bem}/`)) return true

  const minhaConta = normalizarPath(ROTA_MINHA_CONTA)
  if (path === minhaConta || path.startsWith(`${minhaConta}/`)) return true

  if (cargoTemAutoridadeMaximaSistema(usuario.cargo, usuario.nome, usuario.email)) return true

  if (rotaUsuarios(path)) {
    return cargoTemAutoridadeMaximaSistema(usuario.cargo, usuario.nome, usuario.email)
  }

  const em = (usuario.email || '').trim().toLowerCase()
  if (EMAILS_BYPASS_PAGINAS.has(em)) return true

  const raw = usuario.paginas_permitidas
  const visualizador = cargoEhVisualizadorLocal(usuario.cargo)

  if (raw == null || raw.length === 0) {
    return !visualizador
  }

  return raw.some((prefix) => {
    const pre = normalizarPrefixoPaginaGuardada(String(prefix))
    return path === pre || path.startsWith(`${pre}/`)
  })
}

export function labelParaPath(path: string): string {
  return ROTAS_SISTEMA.find((r) => r.path === path)?.label ?? path
}

/** Primeira rota operacional a que o utilizador tem acesso (para CTAs na página inicial). */
export function primeiraRotaOperacionalPermitida(usuario: UsuarioComPaginas): string | null {
  for (const { path } of ROTAS_SISTEMA) {
    if (
      usuarioPodeAcessarRota(usuario, path) &&
      cargoPodeAcessarRotaMenu(usuario.cargo, path, usuario.nome, usuario.email)
    ) {
      return path
    }
  }
  return null
}
