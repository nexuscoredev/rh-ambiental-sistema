import { describe, expect, it } from 'vitest'
import {
  classificarTipoEntregaSolicitacao,
  montarDashboardSolicitacoes,
} from './solicitacaoAjusteDashboard'
import type { PedidoAjusteHistoricoItem } from './chatPedidoAjuste'

function evt(partial: Partial<PedidoAjusteHistoricoItem>): PedidoAjusteHistoricoItem {
  return {
    id: '1',
    mensagemPedidoId: 'm1',
    conversaId: 'c1',
    evento: 'resolvido_dev',
    actorId: 'dev-1',
    texto: null,
    ciclo: 1,
    createdAt: '2026-06-09T10:00:00Z',
    solicitanteId: 'sol-1',
    parseado: { categoria: 'ajuste', descricao: 'Corrigir filtro na listagem', pagina: '/programacao' },
    ...partial,
  }
}

describe('solicitacaoAjusteDashboard', () => {
  it('classifica melhoria e atualização por palavras-chave', () => {
    expect(classificarTipoEntregaSolicitacao('Nova funcionalidade no módulo frota')).toBe('melhoria')
    expect(classificarTipoEntregaSolicitacao('Corrigir bug no filtro')).toBe('atualizacao')
  })

  it('agrega atendimentos por período e colaborador', () => {
    const usuarios = new Map([
      ['dev-1', { nome: 'Rafael', email: null }],
      ['sol-1', { nome: 'Rafaela', email: null }],
    ])
    const dados = montarDashboardSolicitacoes(
      [
        evt({ id: '1', createdAt: '2026-06-09T10:00:00Z' }),
        evt({
          id: '2',
          createdAt: '2026-06-08T10:00:00Z',
          parseado: { categoria: 'ajuste', descricao: 'Implementar dashboard de solicitações' },
        }),
      ],
      usuarios,
      'dia',
      '1.2.196'
    )
    expect(dados.totalAtendidas).toBe(2)
    expect(dados.melhorias).toBe(1)
    expect(dados.atualizacoes).toBe(1)
    expect(dados.porColaboradorDev[0]?.nome).toBe('Rafael')
    expect(dados.serieTemporal.length).toBeGreaterThan(0)
  })
})
