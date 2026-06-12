import { describe, expect, it } from 'vitest'
import { CARGO_COMERCIAL_ADM } from './rbacManifest'
import {
  cargoEhComercialAdm,
  nomeEhThais,
  rbacPode,
  resolverSetorUsuario,
  usuarioEhDesenvolvedorMaster,
  usuarioEhEquipeComercial,
  usuarioTemVisaoCompletaPaginas,
} from './rbacAcesso'
import type { UsuarioAcessoContext } from './rbacTypes'

function ctx(nome: string, cargo = ''): UsuarioAcessoContext {
  return { nome, cargo }
}

describe('rbac — setores do organograma', () => {
  it('Ezequiel e Ana têm visão completa de páginas; outros nomes não', () => {
    expect(usuarioTemVisaoCompletaPaginas(ctx('Ezequiel Novaes', 'Diretoria'))).toBe(true)
    expect(usuarioTemVisaoCompletaPaginas(ctx('Ana Novaes', 'Diretoria'))).toBe(true)
    expect(usuarioTemVisaoCompletaPaginas(ctx('Matheus', 'Operadores (Time R)'))).toBe(false)
    expect(usuarioTemVisaoCompletaPaginas(ctx('Outro Diretor', 'Diretoria'))).toBe(false)
  })

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
  it('equipe comercial mantém edição mesmo com cargo Visualizador (legado/sessão)', () => {
    expect(rbacPode('cliente', 'editar', ctx('Rafaela Thomaz', 'Visualizador'))).toBe(true)
    expect(rbacPode('cliente', 'editar', ctx('Rose', 'Visualizador'))).toBe(true)
  })

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

  it('operação pode lançar programação e pesagem/ticket', () => {
    const matheus = ctx('Matheus', 'Operadores (Time R)')
    expect(rbacPode('programacao', 'criar', matheus)).toBe(true)
    expect(rbacPode('programacao', 'editar', matheus)).toBe(true)
    expect(rbacPode('pesagem_ticket', 'criar', matheus)).toBe(true)
    expect(rbacPode('pesagem_ticket', 'editar', matheus)).toBe(true)
  })

  it('Matheus e Gabriel podem cadastrar clientes, motoristas e veículos', () => {
    for (const nome of ['Matheus', 'Gabriel']) {
      const ctxUser = ctx(nome, 'Operadores (Time R)')
      expect(rbacPode('cliente', 'criar', ctxUser)).toBe(true)
      expect(rbacPode('cliente', 'editar', ctxUser)).toBe(true)
      expect(rbacPode('cliente', 'excluir', ctxUser)).toBe(true)
      expect(rbacPode('motorista', 'criar', ctxUser)).toBe(true)
      expect(rbacPode('motorista', 'editar', ctxUser)).toBe(true)
      expect(rbacPode('motorista', 'excluir', ctxUser)).toBe(true)
      expect(rbacPode('veiculo', 'criar', ctxUser)).toBe(true)
      expect(rbacPode('veiculo', 'editar', ctxUser)).toBe(true)
      expect(rbacPode('veiculo', 'excluir', ctxUser)).toBe(true)
    }
  })

  it('Matheus pode cadastrar e editar clientes', () => {
    const matheus = ctx('Matheus', 'Operadores (Time R)')
    expect(rbacPode('cliente', 'criar', matheus)).toBe(true)
    expect(rbacPode('cliente', 'editar', matheus)).toBe(true)
    expect(rbacPode('cliente', 'excluir', matheus)).toBe(true)
  })
})

describe('rbac — conferência transporte', () => {
  it('operação edita; exclusão equipe comercial', () => {
    expect(rbacPode('conferencia_transporte', 'editar', ctx('Gabriel', 'Operadores (Time R)'))).toBe(true)
    expect(rbacPode('conferencia_transporte', 'excluir', ctx('Rose', 'Comercial'))).toBe(true)
    expect(rbacPode('conferencia_transporte', 'editar', ctx('Rose', 'Comercial'))).toBe(false)
  })
})

describe('rbac — frota operacional', () => {
  it('Operacional, Comercial e Diretoria editam; exclusão só Comercial Adm', () => {
    expect(rbacPode('frota_operacional', 'editar', ctx('João', 'Operacional'))).toBe(true)
    expect(rbacPode('frota_operacional', 'editar', ctx('Rafaela', 'Comercial'))).toBe(true)
    expect(rbacPode('frota_operacional', 'editar', ctx('Ana Novaes', 'Diretoria'))).toBe(true)
    expect(rbacPode('frota_operacional', 'excluir', ctx('Thais', 'Comercial Adm'))).toBe(true)
    expect(rbacPode('frota_operacional', 'excluir', ctx('Rafael Cavalcante', 'Desenvolvedor'))).toBe(true)
    expect(rbacPode('frota_operacional', 'excluir', ctx('Rafaela', 'Comercial'))).toBe(false)
    expect(rbacPode('frota_operacional', 'editar', ctx('Gabriel', 'Operadores (Time R)'))).toBe(false)
    expect(rbacPode('frota_operacional', 'editar', ctx('Motorista', 'Logística'))).toBe(false)
  })
})

describe('rbac — Diretoria (visão completa do fluxo)', () => {
  const ana = ctx('Ana Novaes', 'Diretoria')

  it('acede a programação, faturamento e cadastros', () => {
    expect(rbacPode('programacao', 'editar', ana)).toBe(true)
    expect(rbacPode('faturamento', 'ler', ana)).toBe(true)
    expect(rbacPode('faturamento', 'editar', ana)).toBe(true)
    expect(rbacPode('cliente', 'editar', ana)).toBe(true)
    expect(rbacPode('comprovante_descarte', 'editar', ana)).toBe(true)
    expect(rbacPode('conferencia_transporte', 'editar', ana)).toBe(true)
  })
})
