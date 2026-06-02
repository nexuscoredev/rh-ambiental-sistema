-- Thais vê pedidos escalados mesmo sem ser participante da conversa dev↔solicitante.

DROP POLICY IF EXISTS "chat_mensagens_select_thais_pedido_escalado" ON public.chat_mensagens;
CREATE POLICY "chat_mensagens_select_thais_pedido_escalado"
  ON public.chat_mensagens FOR SELECT TO authenticated
  USING (
    public.rg_is_thais()
    AND starts_with(trim(coalesce(conteudo, '')), '[Solicitação de ajuste no sistema]')
    AND EXISTS (
      SELECT 1
      FROM public.chat_pedido_ajuste_aprovacao_thais a
      WHERE a.mensagem_id = chat_mensagens.id
        AND a.status = 'aguardando'
    )
  );

CREATE OR REPLACE FUNCTION public.chat_listar_pedidos_ajuste_fila_thais()
RETURNS TABLE (
  mensagem_id uuid,
  conversa_id uuid,
  remetente_id uuid,
  conteudo text,
  created_at timestamptz,
  dev_id uuid,
  enviado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.mensagem_id,
    a.conversa_id,
    m.remetente_id,
    m.conteudo,
    m.created_at,
    a.dev_id,
    a.enviado_em
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  INNER JOIN public.chat_mensagens m ON m.id = a.mensagem_id
  WHERE a.status = 'aguardando'
  ORDER BY a.enviado_em ASC;
$$;

REVOKE ALL ON FUNCTION public.chat_listar_pedidos_ajuste_fila_thais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_listar_pedidos_ajuste_fila_thais() TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_enviar_pedido_fila_thais(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid
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
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Apenas desenvolvedores podem enviar pedidos para a fila da Thais.';
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

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND coalesce(v_reg.status, 'aguardando_solicitante') NOT IN ('reaberto') THEN
    RAISE EXCEPTION 'Este pedido já foi tratado ou aguarda confirmação do solicitante.';
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND v_esc.status = 'aguardando' THEN
    RAISE EXCEPTION 'Este pedido já está na fila da Thais.';
  END IF;

  IF FOUND THEN
    UPDATE public.chat_pedido_ajuste_aprovacao_thais
    SET
      conversa_id = p_conversa_id,
      dev_id = v_me,
      status = 'aguardando',
      enviado_em = now(),
      aprovado_em = NULL,
      aprovado_por = NULL
    WHERE mensagem_id = p_mensagem_pedido_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_aprovacao_thais (
      mensagem_id,
      conversa_id,
      dev_id,
      status,
      enviado_em,
      aprovado_em,
      aprovado_por
    )
    VALUES (
      p_mensagem_pedido_id,
      p_conversa_id,
      v_me,
      'aguardando',
      now(),
      NULL,
      NULL
    );
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'enviado_fila_thais',
    v_me,
    NULL,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;
