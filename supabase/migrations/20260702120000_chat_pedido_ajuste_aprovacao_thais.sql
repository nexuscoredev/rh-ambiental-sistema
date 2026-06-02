-- Escalacao de pedidos de ajuste para aprovação da Thais (desenvolvedores).

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

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_aprovacao_thais_status
  ON public.chat_pedido_ajuste_aprovacao_thais (status, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_aprovacao_thais_dev
  ON public.chat_pedido_ajuste_aprovacao_thais (dev_id, status);

ALTER TABLE public.chat_pedido_ajuste_aprovacao_thais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_pedido_ajuste_aprovacao_thais_select" ON public.chat_pedido_ajuste_aprovacao_thais;
CREATE POLICY "chat_pedido_ajuste_aprovacao_thais_select"
  ON public.chat_pedido_ajuste_aprovacao_thais FOR SELECT TO authenticated
  USING (
    public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
    OR public.rg_is_thais()
    OR dev_id = auth.uid()
  );

GRANT SELECT ON public.chat_pedido_ajuste_aprovacao_thais TO authenticated;

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
      'aprovado_fila_thais'
    )
  );

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

  IF FOUND AND v_esc.status = 'aprovado' THEN
    RAISE EXCEPTION 'Este pedido já foi aprovado pela Thais. Trate-o na sua fila.';
  END IF;

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

CREATE OR REPLACE FUNCTION public.chat_aprovar_pedido_fila_thais(
  p_mensagem_pedido_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT public.rg_is_thais() THEN
    RAISE EXCEPTION 'Apenas a Thais pode aprovar pedidos desta fila.';
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF NOT FOUND OR v_esc.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Pedido não encontrado na fila de aprovação ou já foi decidido.';
  END IF;

  UPDATE public.chat_pedido_ajuste_aprovacao_thais
  SET
    status = 'aprovado',
    aprovado_em = now(),
    aprovado_por = v_me
  WHERE mensagem_id = p_mensagem_pedido_id;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    v_esc.conversa_id,
    'aprovado_fila_thais',
    v_me,
    NULL,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chat_enviar_pedido_fila_thais(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_aprovar_pedido_fila_thais(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_enviar_pedido_fila_thais(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_aprovar_pedido_fila_thais(uuid) TO authenticated;

COMMENT ON TABLE public.chat_pedido_ajuste_aprovacao_thais IS
  'Pedidos de ajuste escalados por desenvolvedores para aprovação da Thais antes do tratamento.';
