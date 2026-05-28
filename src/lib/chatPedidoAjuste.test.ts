import { describe, expect, it } from 'vitest'
import {
  CHAT_PEDIDO_AJUSTE_PREFIX,
  etiquetaEventoPedidoAjusteHistorico,
  montarRespostaPedidoAjusteResolvido,
  parsePedidoAjusteConteudo,
} from './chatPedidoAjuste'

describe('chatPedidoAjuste', () => {
  const corpoPedido = `${CHAT_PEDIDO_AJUSTE_PREFIX}

ajusta qualquer coisa

Página: /programacao
— Rafaela Thomaz`

  it('parseia descrição, página e solicitante', () => {
    expect(parsePedidoAjusteConteudo(corpoPedido)).toEqual({
      descricao: 'ajusta qualquer coisa',
      pagina: '/programacao',
      solicitante: 'Rafaela Thomaz',
    })
  })

  it('monta resposta citando a solicitação', () => {
    const msg = montarRespostaPedidoAjusteResolvido(corpoPedido)
    expect(msg).toContain('Referente a: ajusta qualquer coisa')
    expect(msg).toContain('Página: /programacao')
    expect(msg).toContain('Solicitado por: Rafaela Thomaz')
  })

  it('etiqueta eventos do histórico', () => {
    expect(etiquetaEventoPedidoAjusteHistorico('resolvido_dev')).toBe('Desenvolvedor enviou ajuste')
    expect(etiquetaEventoPedidoAjusteHistorico('aprovado_solicitante')).toBe('Solicitante aprovou')
    expect(etiquetaEventoPedidoAjusteHistorico('negado_solicitante')).toBe(
      'Solicitante reabriu o pedido'
    )
  })
})
