-- Chat: pedido de ajuste «marcar como resolvido» — script COMPLETO para o SQL Editor.
-- Execute este ficheiro de uma vez (cria tabela + políticas + RPC).
-- Se já correu só o _fix.sql e deu erro 42P01, use ESTE ficheiro em vez do _fix.sql.

-- 1) Tabela
CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_resolvido (
  mensagem_id uuid PRIMARY KEY REFERENCES public.chat_mensagens (id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas (id) ON DELETE CASCADE,
  resolvido_por uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  resolvido_em timestamptz NOT NULL DEFAULT now(),
  resposta_mensagem_id uuid REFERENCES public.chat_mensagens (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_resolvido_conversa
  ON public.chat_pedido_ajuste_resolvido (conversa_id, resolvido_em DESC);

ALTER TABLE public.chat_pedido_ajuste_resolvido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_pedido_ajuste_resolvido_select_participant" ON public.chat_pedido_ajuste_resolvido;
CREATE POLICY "chat_pedido_ajuste_resolvido_select_participant"
  ON public.chat_pedido_ajuste_resolvido FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participantes cp
      WHERE cp.conversa_id = chat_pedido_ajuste_resolvido.conversa_id
        AND cp.user_id = auth.uid()
    )
  );

-- 2) INSERT: desenvolvedor OU desenvolvedor master (Rafael, etc.)
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

GRANT SELECT, INSERT ON public.chat_pedido_ajuste_resolvido TO authenticated;

-- 3) RPC atómica (resposta automática + registo resolvido)
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
