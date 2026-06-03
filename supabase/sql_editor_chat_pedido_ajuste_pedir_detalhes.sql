-- =============================================================================
-- «Pedir mais detalhes» nas Solicitações (chat interno)
-- Cole TUDO no SQL Editor do Supabase (projeto rgambientalhub) → Run
-- Depois: recarregue a página do sistema (F5)
--
-- Confirme:
--   SELECT proname FROM pg_proc
--   WHERE proname IN ('chat_pedir_detalhes_pedido_ajuste', 'chat_responder_detalhes_pedido_ajuste');
-- =============================================================================

-- Pré-requisitos (seguros se já existirem)
ALTER TABLE public.chat_pedido_ajuste_resolvido
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando_solicitante',
  ADD COLUMN IF NOT EXISTS justificativa_solicitante text,
  ADD COLUMN IF NOT EXISTS decidido_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS ciclo int NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_pedido_id uuid NOT NULL REFERENCES public.chat_mensagens (id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas (id) ON DELETE CASCADE,
  evento text NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  texto text,
  ciclo int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_historico_pedido
  ON public.chat_pedido_ajuste_historico (mensagem_pedido_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_aprovacao_thais (
  mensagem_id uuid PRIMARY KEY REFERENCES public.chat_mensagens (id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas (id) ON DELETE CASCADE,
  dev_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aguardando',
  enviado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_em timestamptz,
  aprovado_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT chat_pedido_ajuste_aprovacao_thais_status_check
    CHECK (status IN ('aguardando', 'aprovado'))
);

GRANT SELECT ON public.chat_pedido_ajuste_aprovacao_thais TO authenticated;

-- Migração principal (20260603130000)
ALTER TABLE public.chat_pedido_ajuste_resolvido
  DROP CONSTRAINT IF EXISTS chat_pedido_ajuste_resolvido_status_check;

ALTER TABLE public.chat_pedido_ajuste_resolvido
  ADD CONSTRAINT chat_pedido_ajuste_resolvido_status_check
  CHECK (status IN ('aguardando_solicitante', 'aguardando_detalhes', 'reaberto', 'aprovado'));

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'chat_pedido_ajuste_historico'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%evento%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.chat_pedido_ajuste_historico DROP CONSTRAINT IF EXISTS %I',
      r.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.chat_pedido_ajuste_historico
  DROP CONSTRAINT IF EXISTS chat_pedido_ajuste_historico_evento_check;

ALTER TABLE public.chat_pedido_ajuste_historico
  ADD CONSTRAINT chat_pedido_ajuste_historico_evento_check
  CHECK (
    evento IN (
      'resolvido_dev',
      'aprovado_solicitante',
      'negado_solicitante',
      'enviado_fila_thais',
      'aprovado_fila_thais',
      'detalhes_solicitados_dev',
      'detalhes_respondidos_solicitante'
    )
  );

CREATE OR REPLACE FUNCTION public.chat_pedir_detalhes_pedido_ajuste(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid,
  p_mensagem text DEFAULT NULL
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
    RAISE EXCEPTION 'Sem permissão para pedir detalhes no pedido de ajuste.';
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
    RAISE EXCEPTION 'Este pedido está na fila da Thais. Aguarde a aprovação antes de pedir detalhes.';
  END IF;

  SELECT r.*
  INTO v_existente
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND v_existente.status NOT IN ('reaberto') THEN
    RAISE EXCEPTION 'Este pedido já foi tratado ou aguarda resposta do solicitante.';
  END IF;

  IF FOUND THEN
    v_ciclo := coalesce(v_existente.ciclo, 1);
  END IF;

  v_texto := trim(coalesce(p_mensagem, ''));
  IF length(v_texto) = 0 THEN
    v_texto :=
      'Precisamos de mais detalhes sobre o seu pedido para conseguir tratar o caso. '
      || 'Pode complementar com passos para reproduzir, exemplos ou o que esperava ver no sistema?';
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
      status = 'aguardando_detalhes',
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
      'aguardando_detalhes',
      1
    );
    v_ciclo := 1;
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'detalhes_solicitados_dev',
    v_me,
    v_texto,
    v_ciclo
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_responder_detalhes_pedido_ajuste(
  p_mensagem_pedido_id uuid,
  p_complemento text
)
RETURNS SETOF public.chat_mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_resposta public.chat_mensagens%ROWTYPE;
  v_texto text := trim(coalesce(p_complemento, ''));
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
    RAISE EXCEPTION 'Apenas quem abriu o pedido pode enviar o complemento.';
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

  IF NOT FOUND OR v_reg.status <> 'aguardando_detalhes' THEN
    RAISE EXCEPTION 'Não há pedido de detalhes pendente para este caso.';
  END IF;

  IF length(v_texto) < 3 THEN
    RAISE EXCEPTION 'Descreva o complemento com pelo menos 3 caracteres.';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (v_pedido.conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  UPDATE public.chat_pedido_ajuste_resolvido
  SET
    status = 'reaberto',
    justificativa_solicitante = v_texto,
    decidido_por = v_me,
    decidido_em = now()
  WHERE mensagem_id = p_mensagem_pedido_id;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    v_pedido.conversa_id,
    'detalhes_respondidos_solicitante',
    v_me,
    v_texto,
    coalesce(v_reg.ciclo, 1)
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_pedir_detalhes_pedido_ajuste(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_responder_detalhes_pedido_ajuste(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_pedir_detalhes_pedido_ajuste(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_responder_detalhes_pedido_ajuste(uuid, text) TO authenticated;
