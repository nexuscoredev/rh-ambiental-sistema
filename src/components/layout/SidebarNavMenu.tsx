import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  isMenuBranch,
  navLinkEndExact,
  type MenuGroup,
  type MenuItem,
} from '../../lib/menuNavegacao'
import { iconeGrupoMenu, iconeItemMenu } from './menuSidebarIcones'

type Props = {
  groups: MenuGroup[]
  openSections: Record<string, boolean>
  activePathname: string
  onToggleSection: (title: string) => void
  onNavClick?: () => void
  recolhida?: boolean
}

function grupoContemRotaAtiva(group: MenuGroup, pathname: string): boolean {
  for (const item of group.items) {
    if (isMenuBranch(item)) {
      if (pathname === item.path || pathname.startsWith(`${item.path}/`)) return true
      for (const child of item.children) {
        if (pathname === child.path || pathname.startsWith(`${child.path}/`)) return true
      }
    } else if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      return true
    }
  }
  return false
}

function renderNavItem(
  item: MenuItem,
  onItemClick?: () => void,
  flyout = false
) {
  const linkClass = flyout ? 'sidebar-nav-link sidebar-nav-link--flyout' : 'sidebar-nav-link'

  if (isMenuBranch(item) && item.children.length > 0) {
    return (
      <div key={item.path} className="layout-sidebar__nav-branch">
        <NavLink
          to={item.path}
          end={navLinkEndExact(item.path)}
          className={linkClass}
          onClick={onItemClick}
        >
          <span className="sidebar-nav-link__icon">{iconeItemMenu(item.path)}</span>
          <span className="sidebar-nav-link__label">{item.label}</span>
        </NavLink>
        <div className="layout-sidebar__nav-branch-children">
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              end={navLinkEndExact(child.path)}
              className={`${linkClass} sidebar-nav-link--nested`}
              onClick={onItemClick}
            >
              <span className="sidebar-nav-link__dot" aria-hidden />
              <span className="sidebar-nav-link__label">{child.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    )
  }

  const path = isMenuBranch(item) ? item.path : item.path
  const label = item.label

  return (
    <NavLink
      key={path}
      to={path}
      end={navLinkEndExact(path)}
      className={linkClass}
      onClick={onItemClick}
    >
      <span className="sidebar-nav-link__icon">{iconeItemMenu(path)}</span>
      <span className="sidebar-nav-link__label">{label}</span>
    </NavLink>
  )
}

export function SidebarNavMenu({
  groups,
  openSections,
  activePathname,
  onToggleSection,
  onNavClick,
  recolhida = false,
}: Props) {
  const [flyoutGrupo, setFlyoutGrupo] = useState<string | null>(null)

  useEffect(() => {
    if (!recolhida) setFlyoutGrupo(null)
  }, [recolhida])

  useEffect(() => {
    setFlyoutGrupo(null)
  }, [activePathname])

  useEffect(() => {
    if (!flyoutGrupo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlyoutGrupo(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [flyoutGrupo])

  useEffect(() => {
    if (!flyoutGrupo || !recolhida) return
    const onPointerDown = (e: PointerEvent) => {
      const alvo = e.target as Element
      if (
        alvo.closest('.layout-sidebar__flyout') ||
        alvo.closest('.layout-sidebar__group-toggle')
      ) {
        return
      }
      setFlyoutGrupo(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [flyoutGrupo, recolhida])

  function fecharFlyoutENavegar() {
    setFlyoutGrupo(null)
    onNavClick?.()
  }

  function handleGrupoClick(title: string) {
    if (recolhida) {
      setFlyoutGrupo((prev) => (prev === title ? null : title))
      return
    }
    onToggleSection(title)
  }

  return (
    <nav
      className={`layout-sidebar__groups${recolhida ? ' layout-sidebar__groups--recolhida' : ''}`}
      aria-label="Navegação principal"
    >
      {groups.map((group) => {
        const secaoAberta = !recolhida && openSections[group.title] !== false
        const flyoutAberto = recolhida && flyoutGrupo === group.title
        const temAtivo = grupoContemRotaAtiva(group, activePathname)
        const groupClass = [
          'layout-sidebar__group',
          secaoAberta ? 'layout-sidebar__group--expanded' : '',
          flyoutAberto ? 'layout-sidebar__group--flyout-open' : '',
          temAtivo ? 'layout-sidebar__group--has-active' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div key={group.title} className={groupClass}>
            <button
              type="button"
              className="layout-sidebar__group-toggle"
              aria-expanded={recolhida ? flyoutAberto : secaoAberta}
              title={recolhida ? group.title : undefined}
              onClick={() => handleGrupoClick(group.title)}
            >
              <span className="layout-sidebar__group-icon">{iconeGrupoMenu(group.title)}</span>
              <span className="layout-sidebar__group-title">{group.title}</span>
              {temAtivo && !secaoAberta && !flyoutAberto ? (
                <span className="layout-sidebar__group-active-dot" aria-hidden title="Secção ativa" />
              ) : null}
              <span className="layout-sidebar__group-chevron" aria-hidden>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {secaoAberta ? (
              <div className="layout-sidebar__group-items">
                {group.items.map((item) => renderNavItem(item, onNavClick))}
              </div>
            ) : null}
            {flyoutAberto ? (
              <div className="layout-sidebar__flyout" role="menu" aria-label={group.title}>
                <p className="layout-sidebar__flyout-title">{group.title}</p>
                <div className="layout-sidebar__flyout-items">
                  {group.items.map((item) => renderNavItem(item, fecharFlyoutENavegar, true))}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
