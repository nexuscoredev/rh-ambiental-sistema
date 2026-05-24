import { describe, expect, it } from 'vitest'
import {
  ROTAS_SISTEMA,
  cargoPodeAcessarRotaMenu,
  emailPodeDefinirPaginasPorUsuario,
  pathEstaNaListaValida,
  rotasCheckboxDesdePaginasGuardadas,
  usuarioPodeAcessarRota,
} from './paginasSistema'

describe('paginasSistema', () => {
  it('bem-vindo é sempre acessível com whitelist restrita', () => {
    expect(
      usuarioPodeAcessarRota({ email: 'u@test.com', paginas_permitidas: ['/clientes'] }, '/bem-vindo')
    ).toBe(true)
  })

  it('sem paginas_permitidas ou vazio não restringe rotas (cargo não-Visualizador)', () => {
    expect(usuarioPodeAcessarRota({ email: 'u@test.com', cargo: 'Operacional', paginas_permitidas: null }, '/mtr')).toBe(true)
    expect(usuarioPodeAcessarRota({ email: 'u@test.com', cargo: 'Operacional', paginas_permitidas: [] }, '/mtr')).toBe(true)
  })

  it('Visualizador sem paginas_permitidas só vê /bem-vindo', () => {
    expect(
      usuarioPodeAcessarRota({ email: 'u@test.com', cargo: 'Visualizador', paginas_permitidas: null }, '/bem-vindo')
    ).toBe(true)
    expect(
      usuarioPodeAcessarRota({ email: 'u@test.com', cargo: 'Visualizador', paginas_permitidas: [] }, '/clientes')
    ).toBe(false)
  })

  it('Visualizador com paginas_permitidas explícita vê só os prefixos liberados', () => {
    expect(
      usuarioPodeAcessarRota(
        { email: 'u@test.com', cargo: 'Visualizador', paginas_permitidas: ['/financeiro'] },
        '/financeiro/contas-pagar'
      )
    ).toBe(true)
    expect(
      usuarioPodeAcessarRota(
        { email: 'u@test.com', cargo: 'Visualizador', paginas_permitidas: ['/financeiro'] },
        '/clientes'
      )
    ).toBe(false)
  })

  it('whitelist por prefixo de rota', () => {
    expect(
      usuarioPodeAcessarRota(
        { email: 'u@test.com', paginas_permitidas: ['/financeiro'] },
        '/financeiro/contas-receber'
      )
    ).toBe(true)
    expect(usuarioPodeAcessarRota({ email: 'u@test.com', paginas_permitidas: ['/clientes'] }, '/mtr')).toBe(
      false
    )
  })

  it('e-mails base ignoram whitelist', () => {
    expect(
      usuarioPodeAcessarRota(
        { email: 'gestores@rgambiental.com', paginas_permitidas: ['/clientes'] },
        '/mtr'
      )
    ).toBe(true)
    expect(emailPodeDefinirPaginasPorUsuario('gestores@rgambiental.com')).toBe(true)
  })

  it('rotas de UI alinhadas com a lista válida', () => {
    expect(pathEstaNaListaValida('/faturamento')).toBe(true)
    expect(pathEstaNaListaValida('/financeiro/contas-receber')).toBe(true)
    expect(pathEstaNaListaValida('/financeiro/contas-pagar')).toBe(true)
  })

  it('rotasCheckboxDesdePaginasGuardadas: prefixo expande filhos e aceita path sem slash inicial', () => {
    const a = rotasCheckboxDesdePaginasGuardadas(['/financeiro'])
    expect(a).toContain('/financeiro')
    expect(a).toContain('/financeiro/contas-receber')
    expect(a).toContain('/financeiro/contas-pagar')
    const b = rotasCheckboxDesdePaginasGuardadas(['financeiro/contas-pagar'])
    expect(b).toContain('/financeiro/contas-pagar')
    expect(b).not.toContain('/clientes')
  })

  it('Operacional (Time T): acesso amplo como Administrador (exceto Usuários)', () => {
    expect(cargoPodeAcessarRotaMenu('Operacional (Time T)', '/dashboard')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Operacional (Time T)', '/faturamento')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Operacional (Time T)', '/usuarios')).toBe(false)
  })

  it('Operadores (Time R): programação, MTR, pesagem e chat', () => {
    expect(cargoPodeAcessarRotaMenu('Operadores (Time R)', '/programacao')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Operadores (Time R)', '/mtr')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Operadores (Time R)', '/controle-massa')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Operadores (Time R)', '/chat')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Operadores (Time R)', '/faturamento')).toBe(false)
  })


  it('Operacional: cadastros e fluxo sim; Faturamento, Financeiro, Pós-venda e Usuários não', () => {
    expect(cargoPodeAcessarRotaMenu('Operacional', '/clientes')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Operacional', '/mtr/abc')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Operacional', '/financeiro')).toBe(false)
    expect(cargoPodeAcessarRotaMenu('Operacional', '/financeiro/contas-receber')).toBe(false)
    expect(cargoPodeAcessarRotaMenu('Operacional', '/faturamento')).toBe(false)
    expect(cargoPodeAcessarRotaMenu('Operacional', '/pos-venda')).toBe(false)
    expect(cargoPodeAcessarRotaMenu('Operacional', '/usuarios')).toBe(false)
  })

  it('Comercial: cadastro, programação, MTR e faturamento (equipe Rafaela/Rose/Raquel)', () => {
    expect(cargoPodeAcessarRotaMenu('Comercial', '/dashboard')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Comercial', '/clientes')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Comercial', '/programacao')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Comercial', '/mtr')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Comercial', '/faturamento')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Comercial', '/financeiro')).toBe(false)
    expect(cargoPodeAcessarRotaMenu('Comercial', '/controle-massa')).toBe(false)
  })

  it('Comercial Adm (Thais): acesso amplo de negócio, exceto Usuários', () => {
    expect(cargoPodeAcessarRotaMenu('Comercial Adm', '/dashboard')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Comercial Adm', '/faturamento')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Comercial Adm', '/financeiro')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Comercial Adm', '/usuarios')).toBe(false)
  })

  it('Logística acede ao fluxo do menu mas não a Cadastros', () => {
    expect(cargoPodeAcessarRotaMenu('Logística', '/clientes')).toBe(false)
    expect(cargoPodeAcessarRotaMenu('Logística', '/programacao')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Logística', '/comprovantes-descarte')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Logística', '/checklist-transporte')).toBe(false)
  })

  it('Desenvolvedor: acesso pleno a todas as rotas do sistema', () => {
    for (const { path } of ROTAS_SISTEMA) {
      expect(cargoPodeAcessarRotaMenu('Desenvolvedor', path)).toBe(true)
      expect(
        usuarioPodeAcessarRota({ cargo: 'Desenvolvedor', email: 'dev@rg.test' }, path)
      ).toBe(true)
    }
  })

  it('Desenvolvedor ignora lista paginas_permitidas restritiva', () => {
    expect(
      usuarioPodeAcessarRota(
        { cargo: 'Desenvolvedor', email: 'dev@rg.test', paginas_permitidas: ['/clientes'] },
        '/financeiro'
      )
    ).toBe(true)
  })

  it('Usuários: só Desenvolvedor (Administrador, Financeiro e Diretoria não)', () => {
    expect(cargoPodeAcessarRotaMenu('Administrador', '/usuarios')).toBe(false)
    expect(cargoPodeAcessarRotaMenu('Financeiro', '/usuarios')).toBe(false)
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/usuarios')).toBe(false)
  })

  it('usuarioPodeAcessarRota: /usuarios só com cargo Desenvolvedor', () => {
    expect(
      usuarioPodeAcessarRota(
        { email: 'cavalcantersc07@gmail.com', cargo: 'Administrador', paginas_permitidas: null },
        '/usuarios'
      )
    ).toBe(false)
    expect(
      usuarioPodeAcessarRota(
        { email: 'dev@test.com', cargo: 'Desenvolvedor', paginas_permitidas: null },
        '/usuarios'
      )
    ).toBe(true)
    expect(
      usuarioPodeAcessarRota(
        { email: 'u@test.com', cargo: 'Visualizador', paginas_permitidas: ['/usuarios'] },
        '/usuarios'
      )
    ).toBe(false)
  })

  it('cargoPodeAcessarRotaMenu: Financeiro e Diretoria acedem a rotas financeiras', () => {
    expect(cargoPodeAcessarRotaMenu('Financeiro', '/financeiro')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/financeiro/contas-pagar')).toBe(true)
  })

  it('Diretoria: fluxo completo no menu exceto Usuários', () => {
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/programacao')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/mtr')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/controle-massa')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/faturamento')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/envio-nf')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/clinicas')).toBe(true)
    expect(cargoPodeAcessarRotaMenu('Diretoria', '/usuarios')).toBe(false)
  })
})
