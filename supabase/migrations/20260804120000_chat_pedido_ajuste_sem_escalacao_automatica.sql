-- Pedidos de ajuste: chegam primeiro ao desenvolvedor; escalação para a Thais só manual.

DROP TRIGGER IF EXISTS chat_trg_escalar_pedido_ajuste_thais ON public.chat_mensagens;
DROP FUNCTION IF EXISTS public.chat_trg_escalar_pedido_ajuste_thais();

-- Pedidos presos em «aguardando» (escalação automática antiga) voltam à fila do dev.
DELETE FROM public.chat_pedido_ajuste_aprovacao_thais
WHERE status = 'aguardando';

CREATE OR REPLACE FUNCTION public.chat_decidir_pedido_ajuste_solicitante(
  p_mensagem_pedido_id uuid,
  p_aprovado boolean,
  p_justificativa text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_just text := trim(coalesce(p_justificativa, ''));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  IF v_pedido.remetente_id <> v_me THEN
    RAISE EXCEPTION 'Apenas quem abriu o pedido pode aprovar ou negar o ajuste.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = v_pedido.conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF NOT FOUND OR v_reg.status <> 'aguardando_solicitante' THEN
    RAISE EXCEPTION 'Não há ajuste pendente da sua confirmação para este pedido.';
  END IF;

  IF coalesce(p_aprovado, false) THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      status = 'aprovado',
      decidido_por = v_me,
      decidido_em = now(),
      justificativa_solicitante = NULL
    WHERE mensagem_id = p_mensagem_pedido_id;

    PERFORM public.chat_registar_historico_pedido_ajuste(
      p_mensagem_pedido_id,
      v_pedido.conversa_id,
      'aprovado_solicitante',
      v_me,
      NULL,
      coalesce(v_reg.ciclo, 1)
    );
    RETURN;
  END IF;

  IF length(v_just) = 0 THEN
    RAISE EXCEPTION 'Indique a justificativa ao negar o ajuste.';
  END IF;

  UPDATE public.chat_pedido_ajuste_resolvido
  SET
    status = 'reaberto',
    decidido_por = v_me,
    decidido_em = now(),
    justificativa_solicitante = v_just
  WHERE mensagem_id = p_mensagem_pedido_id;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    v_pedido.conversa_id,
    'negado_solicitante',
    v_me,
    v_just,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_marcar_pedido_ajuste_resolvido(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid,
  p_resposta text DEFAULT NULL
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
  v_texto text;
  v_existente public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
  v_ciclo int := 1;
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

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND v_esc.status = 'aguardando' THEN
    RAISE EXCEPTION 'Este pedido está na fila da Thais. Aguarde a aprovação dela ou trate-o depois da aprovação.';
  END IF;

  IF FOUND AND v_esc.status = 'aprovado' AND v_esc.dev_id <> v_me THEN
    RAISE EXCEPTION 'Este pedido foi aprovado para outro desenvolvedor tratar.';
  END IF;

  SELECT r.*
  INTO v_existente
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND THEN
    IF v_existente.status <> 'reaberto' THEN
      RAISE EXCEPTION 'Este pedido já foi tratado (aguarda o solicitante ou está encerrado).';
    END IF;
    v_ciclo := coalesce(v_existente.ciclo, 1) + 1;
  END IF;

  v_texto := trim(coalesce(p_resposta, ''));
  IF length(v_texto) = 0 THEN
    v_texto := public.chat_montar_resposta_pedido_ajuste_resolvido(v_pedido.conteudo);
  END IF;

  IF length(v_texto) = 0 THEN
    RAISE EXCEPTION 'Resposta vazia.';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (p_conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  IF v_existente.mensagem_id IS NOT NULL THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      conversa_id = p_conversa_id,
      resolvido_por = v_me,
      resolvido_em = now(),
      resposta_mensagem_id = v_resposta.id,
      status = 'aguardando_solicitante',
      justificativa_solicitante = NULL,
      decidido_por = NULL,
      decidido_em = NULL,
      ciclo = v_ciclo
    WHERE mensagem_id = p_mensagem_pedido_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_resolvido (
      mensagem_id,
      conversa_id,
      resolvido_por,
      resposta_mensagem_id,
      status,
      ciclo
    )
    VALUES (
      p_mensagem_pedido_id,
      p_conversa_id,
      v_me,
      v_resposta.id,
      'aguardando_solicitante',
      1
    );
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'resolvido_dev',
    v_me,
    v_texto,
    v_ciclo
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

COMMENT ON FUNCTION public.chat_marcar_pedido_ajuste_resolvido(uuid, uuid, text) IS
  'Dev resolve pedido na sua fila; se escalado à Thais, só após aprovação (ou sem escalação).';
