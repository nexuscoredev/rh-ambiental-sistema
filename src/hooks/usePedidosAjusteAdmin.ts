import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { chatListarUsuariosAtivos } from '../lib/chat'
import {
  chatAprovarPedidoAjusteFilaThais,
  chatEnviarPedidoAjusteFilaThais,
  chatListarHistoricoPedidosAjuste,
  chatListarPedidosAjusteFilaThais,
  chatListarPedidosAjusteAguardandoDetalhesDev,
  chatListarPedidosAjustePendentes,
  chatMarcarPedidoAjusteResolvido,
  chatPedirDetalhesPedidoAjuste,
  type PedidoAjusteFilaItem,
  type PedidoAjusteHistoricoItem,
} from '../lib/chatPedidoAjuste'
import type { ChatUsuarioLista } from '../types/chat'

export function usePedidosAjusteAdmin() {
  const [meuId, setMeuId] = useState<string | null>(null)
  const [usuarios, setUsuarios] = useState<ChatUsuarioLista[]>([])
  const [filaDev, setFilaDev] = useState<PedidoAjusteFilaItem[]>([])
  const [filaThais, setFilaThais] = useState<PedidoAjusteFilaItem[]>([])
  const [historico, setHistorico] = useState<PedidoAjusteHistoricoItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoHistorico, setCarregandoHistorico] = useState(true)
  const [erro, setErro] = useState('')
  const [marcandoId, setMarcandoId] = useState<string | null>(null)
  const [aprovandoThaisId, setAprovandoThaisId] = useState<string | null>(null)
  const [enviandoThaisId, setEnviandoThaisId] = useState<string | null>(null)
  const [pedindoDetalhesId, setPedindoDetalhesId] = useState<string | null>(null)

  const usuariosPorId = useMemo(
    () => new Map(usuarios.map((u) => [u.id, u])),
    [usuarios]
  )

  const resumo = useMemo(() => {
    const novos = filaDev.filter((i) => i.situacao === 'novo').length
    const reabertos = filaDev.filter((i) => i.situacao === 'reaberto').length
    const aprovadosThais = filaDev.filter((i) => i.situacao === 'aprovado_thais').length
    const aguardandoDetalhes = filaDev.filter((i) => i.situacao === 'aguardando_detalhes').length
    return {
      filaDev: novos + reabertos + aprovadosThais + aguardandoDetalhes,
      novos,
      reabertos,
      aprovadosThais,
      aguardandoDetalhes,
      filaThais: filaThais.length,
      historico: historico.length,
    }
  }, [filaDev, filaThais.length, historico.length])

  const recarregar = useCallback(async () => {
    const uid = meuId
    if (!uid) {
      setFilaDev([])
      setFilaThais([])
      setHistorico([])
      return
    }
    setCarregando(true)
    setCarregandoHistorico(true)
    setErro('')
    try {
      const [dev, aguardandoDetalhes, thais, hist] = await Promise.all([
        chatListarPedidosAjustePendentes(uid),
        chatListarPedidosAjusteAguardandoDetalhesDev(),
        chatListarPedidosAjusteFilaThais(),
        chatListarHistoricoPedidosAjuste(100),
      ])
      setFilaDev([...dev, ...aguardandoDetalhes])
      setFilaThais(thais)
      setHistorico(hist)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as filas.')
    } finally {
      setCarregando(false)
      setCarregandoHistorico(false)
    }
  }, [meuId])

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setMeuId(user?.id ?? null)
        if (user?.id) {
          const list = await chatListarUsuariosAtivos(user.id)
          setUsuarios(list)
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Sessão inválida.')
        setCarregando(false)
        setCarregandoHistorico(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!meuId) return
    void recarregar()
  }, [meuId, recarregar])

  const pedirDetalhes = useCallback(
    async (item: PedidoAjusteFilaItem, mensagem: string) => {
      if (!meuId) return
      setPedindoDetalhesId(item.mensagemId)
      setErro('')
      try {
        await chatPedirDetalhesPedidoAjuste(item.conversaId, item.mensagemId, meuId, mensagem)
        await recarregar()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível pedir mais detalhes.')
        throw e
      } finally {
        setPedindoDetalhesId(null)
      }
    },
    [meuId, recarregar]
  )

  const marcarResolvido = useCallback(
    async (item: PedidoAjusteFilaItem) => {
      if (!meuId) return
      setMarcandoId(item.mensagemId)
      setErro('')
      try {
        await chatMarcarPedidoAjusteResolvido(item.conversaId, item.mensagemId, meuId)
        await recarregar()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível marcar como resolvido.')
        throw e
      } finally {
        setMarcandoId(null)
      }
    },
    [meuId, recarregar]
  )

  const enviarFilaThais = useCallback(
    async (item: PedidoAjusteFilaItem) => {
      setEnviandoThaisId(item.mensagemId)
      setErro('')
      try {
        await chatEnviarPedidoAjusteFilaThais(item.conversaId, item.mensagemId)
        await recarregar()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível enviar para a fila da Thais.')
        throw e
      } finally {
        setEnviandoThaisId(null)
      }
    },
    [recarregar]
  )

  const aprovarFilaThais = useCallback(
    async (item: PedidoAjusteFilaItem) => {
      setAprovandoThaisId(item.mensagemId)
      setErro('')
      try {
        await chatAprovarPedidoAjusteFilaThais(item.mensagemId)
        await recarregar()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível aprovar o pedido.')
        throw e
      } finally {
        setAprovandoThaisId(null)
      }
    },
    [recarregar]
  )

  return {
    meuId,
    usuarios,
    usuariosPorId,
    filaDev,
    filaThais,
    historico,
    resumo,
    carregando,
    carregandoHistorico,
    erro,
    setErro,
    marcandoId,
    aprovandoThaisId,
    enviandoThaisId,
    pedindoDetalhesId,
    recarregar,
    pedirDetalhes,
    marcarResolvido,
    enviarFilaThais,
    aprovarFilaThais,
  }
}
