import { describe, expect, it } from 'vitest'
import { ALL_MENU_LEAVES } from './menuNavegacao'
import { pathEstaNaListaValida } from './paginasSistema'

describe('menuNavegacao', () => {
  it('todos os paths do menu existem em ROTAS_SISTEMA (exceto bem-vindo)', () => {
    const semBemVindo = ALL_MENU_LEAVES.filter((m) => m.path !== '/bem-vindo')
    for (const { path, label } of semBemVindo) {
      expect(pathEstaNaListaValida(path), `menu "${label}" → ${path}`).toBe(true)
    }
  })

  it('não há paths duplicados no menu', () => {
    const paths = ALL_MENU_LEAVES.map((m) => m.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
