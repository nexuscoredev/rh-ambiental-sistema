import { describe, expect, it } from 'vitest'
import {
  filtroOrBuscaMtrLista,
  MTR_LISTA_BUSCA_MIN_CHARS,
  MTR_LISTA_TAMANHO_PAGINA,
} from './mtrListaQuery'

describe('mtrListaQuery', () => {
  it('página com 10 itens', () => {
    expect(MTR_LISTA_TAMANHO_PAGINA).toBe(10)
  })

  it('exige pelo menos 2 caracteres na busca', () => {
    expect(filtroOrBuscaMtrLista('a')).toBeNull()
    expect(filtroOrBuscaMtrLista('ab')).toContain('numero.ilike')
  })

  it('inclui cliente e gerador no filtro', () => {
    const f = filtroOrBuscaMtrLista('ECO')
    expect(f).toContain('cliente.ilike')
    expect(f).toContain('gerador.ilike')
  })

  it('constante mínima coerente', () => {
    expect(MTR_LISTA_BUSCA_MIN_CHARS).toBe(2)
  })
})
