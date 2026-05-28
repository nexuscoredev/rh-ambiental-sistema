-- Ciclo solicitante: aprovar / negar ajuste; reabertura na fila do desenvolvedor; histórico.

ALTER TABLE public.chat_pedido_ajuste_resolvido
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando_solicitante',
  ADD COLUMN IF NOT EXISTS justificativa_solicitante text,
  ADD COLUMN IF NOT EXISTS decidido_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS ciclo int NOT NULL DEFAULT 1;

-- Pedidos já fechados antes desta funcionalidade tratam-se como aprovados.
UPDATE public.chat_pedido_ajuste_resolvido
SET status = 'aprovado'
WHERE status = 'aguardando_solicitante'
  AND decidido_por IS NULL
  AND justificativa_solicitante IS NULL;

ALTER TABLE public.chat_pedido_ajuste_resolvido
  DROP CONSTRAINT IF EXISTS chat_pedido_ajuste_resolvido_status_check;

ALTER TABLE public.chat_pedido_ajuste_resolvido
  ADD CONSTRAINT chat_pedido_ajuste_resolvido_status_check
  CHECK (status IN ('aguardando_solicitante', 'reaberto', 'aprovado'));

CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_pedido_id uuid NOT NULL REFERENCES public.chat_mensagens (id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas (id) ON DELETE CASCADE,
  evento text NOT NULL CHECK (evento IN ('resolvido_dev', 'aprovado_solicitante', 'negado_solicitante')),
  actor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  texto text,
  ciclo int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_historico_pedido
  ON public.chat_pedido_ajuste_historico (mensagem_pedido_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_historico_created
  ON public.chat_pedido_ajuste_historico (created_at DESC);

ALTER TABLE public.chat_pedido_ajuste_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_pedido_ajuste_historico_select_participant" ON public.chat_pedido_ajuste_historico;
CREATE POLICY "chat_pedido_ajuste_historico_select_participant"
  ON public.chat_pedido_ajuste_historico FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participantes cp
      WHERE cp.conversa_id = chat_pedido_ajuste_historico.conversa_id
        AND cp.user_id = auth.uid()
    )
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  );

GRANT SELECT ON public.chat_pedido_ajuste_historico TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_registar_historico_pedido_ajuste(
  p_mensagem_pedido_id uuid,
  p_conversa_id uuid,
  p_evento text,
  p_actor_id uuid,
  p_texto text,
  p_ciclo int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_pedido_ajuste_historico (
    mensagem_pedido_id,
    conversa_id,
    evento,
    actor_id,
    texto,
    ciclo
  )
  VALUES (
    p_mensagem_pedido_id,
    p_conversa_id,
    p_evento,
    p_actor_id,
    nullif(trim(coalesce(p_texto, '')), ''),
    greatest(coalesce(p_ciclo, 1), 1)
  );
END;
$$;

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
  v_existente public.chat_pedido_ajuste_resolvido%ROWTYPE;
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
    v_ciclo := 1;
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

REVOKE ALL ON FUNCTION public.chat_registar_historico_pedido_ajuste(uuid, uuid, text, uuid, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_marcar_pedido_ajuste_resolvido(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_decidir_pedido_ajuste_solicitante(uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_marcar_pedido_ajuste_resolvido(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_decidir_pedido_ajuste_solicitante(uuid, boolean, text) TO authenticated;
