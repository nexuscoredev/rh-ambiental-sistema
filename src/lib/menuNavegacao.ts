/**
 * Estrutura única do menu lateral — rotas e paths inalterados; só agrupamento visual.
 * Usado por MainLayout.tsx e MainLayout-NEXUS.tsx.
 */

import { FROTA_HUB_PATH, FROTA_MENU_CHILDREN } from './frotaModulos'
import { FINANCEIRO_HUB_PATH, FINANCEIRO_MENU_CHILDREN } from './financeiroModulos'
import { RH_HUB_PATH, RH_MENU_CHILDREN } from './rhModulos'

export type MenuLeaf = { label: string; path: string }

/** Item com subitens (ex.: Faturamento → Mala Direta). */
export type MenuBranch = { label: string; path: string; children: MenuLeaf[] }

export type MenuItem = MenuLeaf | MenuBranch

export type MenuGroup = { title: string; items: MenuItem[] }

export function isMenuBranch(item: MenuItem): item is MenuBranch {
  return 'children' in item && Array.isArray((item as MenuBranch).children)
}

export function flattenMenuLeaves(items: MenuItem[]): MenuLeaf[] {
  const out: MenuLeaf[] = []
  for (const item of items) {
    if (isMenuBranch(item)) {
      out.push({ label: item.label, path: item.path })
      out.push(...item.children)
    } else {
      out.push(item)
    }
  }
  return out
}

/** Ramo: programação → MTR → pesagem (ordem do fluxo de coleta). */
const MENU_COLETA_EMISSAO_CHILDREN: MenuLeaf[] = [
  { label: 'MTR', path: '/mtr' },
  { label: 'MTR Gerenciador', path: '/mtr/gerenciador' },
  { label: 'Pesagem e Ticket', path: '/controle-massa' },
]

/** Ramo: conferência, comprovante e hub Transportes (manutenção e relatório dentro do hub). */
const MENU_TRANSPORTE_FROTA_CHILDREN: MenuLeaf[] = [
  { label: 'Conferência de transportes', path: '/conferencia-transporte' },
  { label: 'Comprovante de Descarte', path: '/comprovantes-descarte' },
  ...FROTA_MENU_CHILDREN,
]

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: 'Visão geral',
    items: [
      { label: 'Bem-vindo', path: '/bem-vindo' },
      { label: 'Dashboard', path: '/dashboard' },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      {
        label: 'Clientes',
        path: '/clientes',
        children: [{ label: 'Gerenciador', path: '/clientes/gerenciador' }],
      },
      { label: 'Motoristas', path: '/motoristas' },
      { label: 'Representante RG', path: '/representantes-rg' },
      { label: 'Veículos', path: '/caminhoes' },
    ],
  },
  {
    title: 'Fluxo operacional',
    items: [
      {
        label: 'Programações',
        path: '/programacao',
        children: MENU_COLETA_EMISSAO_CHILDREN,
      },
      {
        label: 'Transporte e frota',
        path: FROTA_HUB_PATH,
        children: MENU_TRANSPORTE_FROTA_CHILDREN,
      },
    ],
  },
  {
    title: 'Faturamento',
    items: [
      {
        label: 'Faturamento',
        path: '/faturamento',
        children: [
          { label: 'Faturar clínicas', path: '/faturamento-clinicas' },
          { label: 'Clínicas', path: '/clinicas' },
          { label: 'Mala Direta', path: '/envio-nf' },
        ],
      },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      {
        label: 'Financeiro',
        path: FINANCEIRO_HUB_PATH,
        children: FINANCEIRO_MENU_CHILDREN,
      },
    ],
  },
  {
    title: 'RH',
    items: [
      {
        label: 'RH',
        path: RH_HUB_PATH,
        children: RH_MENU_CHILDREN,
      },
    ],
  },
  {
    title: 'Pós-venda',
    items: [{ label: 'Pós-venda', path: '/pos-venda' }],
  },
  {
    title: 'Sistema',
    items: [
      {
        label: 'Gestão de solicitações',
        path: '/sistema/solicitacoes-ajuste',
        children: [{ label: 'Exclusões operacionais', path: '/sistema/fila-exclusoes' }],
      },
      { label: 'Senha pessoal (acompanhamento)', path: '/sistema/senha-pessoal' },
      { label: 'Usuários', path: '/usuarios' },
    ],
  },
]

export const ALL_MENU_LEAVES = flattenMenuLeaves(MENU_GROUPS.flatMap((g) => g.items))

/**
 * Rotas com páginas filhas na URL (/mtr/:id, /operacional-frota/…) — NavLink usa prefix match.
 */
export const NAV_LINK_PREFIX_PATHS = new Set([
  '/mtr',
  '/mtr/gerenciador',
  '/programacao',
  '/controle-massa',
  '/comprovantes-descarte',
  '/conferencia-transporte',
  '/operacional-frota',
  '/clientes',
  '/financeiro',
  '/rh',
])

export function navLinkEndExact(path: string): boolean {
  return !NAV_LINK_PREFIX_PATHS.has(path)
}

/** Ramo do menu que contém a rota (para expandir subitens). */
export function menuBranchParaPath(pathname: string, groups: MenuGroup[]): string | null {
  for (const g of groups) {
    for (const item of g.items) {
      if (!isMenuBranch(item)) continue
      const paths = [item.path, ...item.children.map((c) => c.path)]
      const hit = paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
      if (hit) return item.path
    }
  }
  return null
}
