import { describe, expect, it } from 'vitest'
import { CARGO_COMERCIAL_ADM } from './rbacManifest'
import {
  cargoEhComercialAdm,
  nomeEhThais,
  rbacPode,
  resolverSetorUsuario,
  usuarioEhDesenvolvedorMaster,
  usuarioEhEquipeComercial,
} from './rbacAcesso'
import type { UsuarioAcessoContext } from './rbacTypes'

function ctx(nome: string, cargo = ''): UsuarioAcessoContext {
  return { nome, cargo }
}

describe('rbac — setores do organograma', () => {
  it('resolve os quatro setores pelos nomes', () => {
    expect(resolverSetorUsuario(ctx('Ezequiel', ''))).toBe('diretoria_financeiro')
    expect(resolverSetorUsuario(ctx('Matheus', 'Operadores (Time R)'))).toBe('operacao')
    expect(resolverSetorUsuario(ctx('Rafaela', 'Comercial'))).toBe('comercial')
    expect(resolverSetorUsuario(ctx('Rafael Cavalcante', ''))).toBe('desenvolvedor')
  })

  it('Rafael operação não confunde com Rafael Cavalcante', () => {
    expect(resolverSetorUsuario(ctx('Rafael', 'Operadores (Time R)'))).toBe('operacao')
    expect(usuarioEhDesenvolvedorMaster(ctx('Rafael Cavalcante', 'Operadores (Time R)'))).toBe(true)
  })

  it('Thais: nome ou cargo Comercial Adm', () => {
    expect(nomeEhThais(ctx('Thais', 'Comercial'))).toBe(true)
    expect(cargoEhComercialAdm(CARGO_COMERCIAL_ADM)).toBe(true)
    expect(resolverSetorUsuario(ctx('', CARGO_COMERCIAL_ADM))).toBe('comercial')
  })
})

describe('rbac — equipe comercial (mesmo acesso)', () => {
  it('Rafaela, Rose e Raquel têm o mesmo acesso que Thais', () => {
    for (const nome of ['Thais', 'Rafaela', 'Rose', 'Raquel']) {
      expect(usuarioEhEquipeComercial(ctx(nome, 'Comercial'))).toBe(true)
      expect(rbacPode('cliente', 'editar', ctx(nome, 'Comercial'))).toBe(true)
      expect(rbacPode('programacao', 'excluir', ctx(nome, 'Comercial'))).toBe(true)
      expect(rbacPode('faturamento', 'editar', ctx(nome, 'Comercial'))).toBe(true)
      expect(rbacPode('comprovante_descarte', 'editar', ctx(nome, 'Comercial'))).toBe(true)
    }
  })

  it('operação não entra na equipe comercial', () => {
    expect(rbacPode('faturamento', 'ler', ctx('Matheus', 'Operadores (Time R)'))).toBe(false)
    expect(rbacPode('programacao', 'excluir', ctx('Rafael', 'Operadores (Time R)'))).toBe(false)
  })
})

describe('rbac — conferência transporte', () => {
  it('operação edita; exclusão equipe comercial', () => {
    expect(rbacPode('conferencia_transporte', 'editar', ctx('Gabriel', 'Operadores (Time R)'))).toBe(true)
    expect(rbacPode('conferencia_transporte', 'excluir', ctx('Rose', 'Comercial'))).toBe(true)
    expect(rbacPode('conferencia_transporte', 'editar', ctx('Rose', 'Comercial'))).toBe(false)
  })
})
