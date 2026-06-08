import { describe, expect, it } from 'vitest'
import {
  motivoExclusaoValido,
  programacaoComExclusaoPendente,
  rotuloTipoEntidadeExclusao,
  rpcExclusaoOperacionalIndisponivel,
} from './solicitacaoExclusaoOperacional'
import {
  cargoPodeSolicitarExclusaoMtr,
  cargoPodeSolicitarExclusaoProgramacao,
  usuarioEhAprovadorExclusaoOperacionalThais,
  usuarioPodeDecidirFilaExclusaoOperacional,
} from './workflowPermissions'
import { CARGO_COMERCIAL_ADM, CARGO_OPERADORES_TIME_R } from './workflowPermissions'

describe('solicitacaoExclusaoOperacional', () => {
  it('valida motivo mínimo', () => {
    expect(motivoExclusaoValido('')).toBe(false)
    expect(motivoExclusaoValido('ab')).toBe(false)
    expect(motivoExclusaoValido('  motivo  ')).toBe(true)
  })

  it('rotula tipo de entidade', () => {
    expect(rotuloTipoEntidadeExclusao('programacao')).toBe('Programação')
    expect(rotuloTipoEntidadeExclusao('mtr')).toBe('MTR')
  })

  it('bloqueia só a programação com exclusão pendente, não o mesmo cliente', () => {
    const resumo = {
      entidadeIds: new Set(['prog-612']),
      seriesInteirasPendentes: new Set<string>(),
    }
    expect(
      programacaoComExclusaoPendente(
        { id: 'prog-612', programacaoSerieId: null },
        resumo
      )
    ).toBe(true)
    expect(
      programacaoComExclusaoPendente(
        { id: 'prog-614', programacaoSerieId: null },
        resumo
      )
    ).toBe(false)
    expect(
      programacaoComExclusaoPendente(
        { id: 'prog-999', programacaoSerieId: 'serie-1' },
        { entidadeIds: new Set(), seriesInteirasPendentes: new Set(['serie-1']) }
      )
    ).toBe(true)
  })

  it('detecta RPC de exclusão indisponível no servidor', () => {
    expect(rpcExclusaoOperacionalIndisponivel({ code: 'PGRST202' })).toBe(true)
    expect(rpcExclusaoOperacionalIndisponivel({ code: '42883' })).toBe(true)
    expect(
      rpcExclusaoOperacionalIndisponivel({
        message: 'Could not find the function public.listar_solicitacoes_exclusao_operacional',
      })
    ).toBe(true)
    expect(rpcExclusaoOperacionalIndisponivel({ code: '42501' })).toBe(false)
  })
})

describe('workflowPermissions — solicitação de exclusão', () => {
  it('comercial e operação podem solicitar', () => {
    expect(cargoPodeSolicitarExclusaoProgramacao('Comercial', 'Rose')).toBe(true)
    expect(cargoPodeSolicitarExclusaoMtr(CARGO_OPERADORES_TIME_R, 'Matheus')).toBe(true)
  })

  it('visualizador não solicita exclusão', () => {
    expect(cargoPodeSolicitarExclusaoProgramacao('Visualizador', 'Convidado')).toBe(false)
  })

  it('Thais é aprovadora da fila', () => {
    expect(usuarioEhAprovadorExclusaoOperacionalThais('Thais Pichirilli', CARGO_COMERCIAL_ADM)).toBe(
      true
    )
    expect(usuarioEhAprovadorExclusaoOperacionalThais('Rose', 'Comercial')).toBe(false)
  })

  it('Desenvolvedor pode decidir na fila de exclusões', () => {
    expect(usuarioPodeDecidirFilaExclusaoOperacional('Rafael Cavalcante', 'Desenvolvedor')).toBe(
      true
    )
    expect(usuarioPodeDecidirFilaExclusaoOperacional('Rose', 'Comercial')).toBe(false)
  })
})
