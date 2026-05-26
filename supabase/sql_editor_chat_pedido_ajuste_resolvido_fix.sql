-- Corrige «Marcar como resolvido» no chat (Rafael / desenvolvedor master).
-- ATENÇÃO: só use DEPOIS da tabela existir. Se deu erro 42P01 (relation does not exist),
-- execute em vez disto: supabase/sql_editor_chat_pedido_ajuste_completo.sql (tudo numa vez).

DROP POLICY IF EXISTS "chat_pedido_ajuste_resolvido_insert_dev" ON public.chat_pedido_ajuste_resolvido;
CREATE POLICY "chat_pedido_ajuste_resolvido_insert_dev"
  ON public.chat_pedido_ajuste_resolvido FOR INSERT TO authenticated
  WITH CHECK (
    (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master())
    AND resolvido_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_participantes cp
      WHERE cp.conversa_id = chat_pedido_ajuste_resolvido.conversa_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.chat_marcar_pedido_ajuste_resolvido(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid,
  p_resposta text DEFAULT 'Ajustamos conforme a sua solicitação, pode testar por gentileza?'
)
RETURNS SETOF public.chat_mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_resposta public.chat_mensagens%ROWTYPE;
  v_texto text := trim(coalesce(p_resposta, ''));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Sem permissão para marcar pedidos de ajuste como resolvidos.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = p_conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id
    AND m.conversa_id = p_conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.chat_pedido_ajuste_resolvido r
    WHERE r.mensagem_id = p_mensagem_pedido_id
  ) THEN
    RAISE EXCEPTION 'Este pedido já foi marcado como resolvido.';
  END IF;

  IF length(v_texto) = 0 THEN
    RAISE EXCEPTION 'Resposta vazia.';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (p_conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  INSERT INTO public.chat_pedido_ajuste_resolvido (
    mensagem_id,
    conversa_id,
    resolvido_por,
    resposta_mensagem_id
  )
  VALUES (
    p_mensagem_pedido_id,
    p_conversa_id,
    v_me,
    v_resposta.id
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_marcar_pedido_ajuste_resolvido(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_marcar_pedido_ajuste_resolvido(uuid, uuid, text) TO authenticated;
