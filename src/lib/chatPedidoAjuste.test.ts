import { describe, expect, it } from 'vitest'
import {
  CHAT_PEDIDO_AJUSTE_PREFIX,
  etiquetaEventoPedidoAjusteHistorico,
  montarRespostaPedidoAjusteResolvido,
  montarConteudoPedidoAjuste,
  parsePedidoAjusteConteudo,
  pedidoAjusteSolicitantePodeEditar,
  pedidoVisivelNaFilaDesenvolvedor,
  rotuloSituacaoPedidoAjuste,
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
    expect(etiquetaEventoPedidoAjusteHistorico('enviado_fila_thais')).toBe(
      'Enviado para aprovação da Thais'
    )
    expect(etiquetaEventoPedidoAjusteHistorico('aprovado_fila_thais')).toBe(
      'Thais aprovou — devolver à fila do desenvolvedor'
    )
  })

  it('filtra pedidos visíveis na fila do desenvolvedor', () => {
    const devA = '11111111-1111-1111-1111-111111111111'
    const devB = '22222222-2222-2222-2222-222222222222'

    expect(pedidoVisivelNaFilaDesenvolvedor(undefined, undefined, devA)).toBe(true)

    expect(
      pedidoVisivelNaFilaDesenvolvedor(undefined, {
        mensagem_id: 'm1',
        conversa_id: 'c1',
        dev_id: devA,
        status: 'aguardando',
      }, devA)
    ).toBe(false)

    expect(
      pedidoVisivelNaFilaDesenvolvedor(undefined, {
        mensagem_id: 'm1',
        conversa_id: 'c1',
        dev_id: devA,
        status: 'aprovado',
      }, devA)
    ).toBe(true)

    expect(
      pedidoVisivelNaFilaDesenvolvedor(undefined, {
        mensagem_id: 'm1',
        conversa_id: 'c1',
        dev_id: devA,
        status: 'aprovado',
      }, devB)
    ).toBe(false)

    expect(
      pedidoVisivelNaFilaDesenvolvedor(
        {
          mensagem_id: 'm1',
          conversa_id: 'c1',
          status: 'reaberto',
          justificativa_solicitante: 'x',
          ciclo: 2,
        },
        {
          mensagem_id: 'm1',
          conversa_id: 'c1',
          dev_id: devA,
          status: 'aprovado',
        },
        devA
      )
    ).toBe(true)

    expect(
      pedidoVisivelNaFilaDesenvolvedor(
        {
          mensagem_id: 'm1',
          conversa_id: 'c1',
          status: 'reaberto',
          justificativa_solicitante: 'x',
          ciclo: 2,
        },
        {
          mensagem_id: 'm1',
          conversa_id: 'c1',
          dev_id: devA,
          status: 'aguardando',
        },
        devA
      )
    ).toBe(false)
  })

  it('monta corpo do pedido no formato padrão', () => {
    const corpo = montarConteudoPedidoAjuste({
      descricao: 'Campo de busca no quadro',
      pagina: '/programacao',
      solicitante: 'Rafaela Thomaz',
    })
    expect(parsePedidoAjusteConteudo(corpo)).toEqual({
      descricao: 'Campo de busca no quadro',
      pagina: '/programacao',
      solicitante: 'Rafaela Thomaz',
    })
  })

  it('define quando solicitante pode editar', () => {
    expect(pedidoAjusteSolicitantePodeEditar(null)).toBe(true)
    expect(pedidoAjusteSolicitantePodeEditar('aguardando_detalhes')).toBe(true)
    expect(pedidoAjusteSolicitantePodeEditar('aguardando_solicitante')).toBe(false)
    expect(pedidoAjusteSolicitantePodeEditar('aprovado')).toBe(false)
    expect(pedidoAjusteSolicitantePodeEditar('reaberto')).toBe(false)
  })

  it('rotula situação do pedido para relatório', () => {
    expect(rotuloSituacaoPedidoAjuste(null)).toBe('Novo (na fila)')
    expect(rotuloSituacaoPedidoAjuste('reaberto')).toBe('Negado — reaberto')
    expect(rotuloSituacaoPedidoAjuste('aguardando_solicitante')).toBe('Aguardando confirmação')
    expect(rotuloSituacaoPedidoAjuste('aprovado')).toBe('Aprovado')
  })
})
