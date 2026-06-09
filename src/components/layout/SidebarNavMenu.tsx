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

function renderNavItem(item: MenuItem, onNavClick?: () => void) {
  if (isMenuBranch(item) && item.children.length > 0) {
    return (
      <div key={item.path} className="layout-sidebar__nav-branch">
        <NavLink
          to={item.path}
          end={navLinkEndExact(item.path)}
          className="sidebar-nav-link"
          onClick={onNavClick}
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
              className="sidebar-nav-link sidebar-nav-link--nested"
              onClick={onNavClick}
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
      className="sidebar-nav-link"
      onClick={onNavClick}
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
}: Props) {
  return (
    <nav className="layout-sidebar__groups" aria-label="Navegação principal">
      {groups.map((group) => {
        const secaoAberta = openSections[group.title] !== false
        const temAtivo = grupoContemRotaAtiva(group, activePathname)
        const groupClass = [
          'layout-sidebar__group',
          secaoAberta ? 'layout-sidebar__group--expanded' : '',
          temAtivo ? 'layout-sidebar__group--has-active' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div key={group.title} className={groupClass}>
            <button
              type="button"
              className="layout-sidebar__group-toggle"
              aria-expanded={secaoAberta}
              onClick={() => onToggleSection(group.title)}
            >
              <span className="layout-sidebar__group-icon">{iconeGrupoMenu(group.title)}</span>
              <span className="layout-sidebar__group-title">{group.title}</span>
              {temAtivo && !secaoAberta ? (
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
              <div className="layout-sidebar__group-items">{group.items.map((item) => renderNavItem(item, onNavClick))}</div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
