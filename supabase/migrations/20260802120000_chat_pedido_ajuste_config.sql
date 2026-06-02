-- Configuração central das respostas automáticas e destino dos pedidos de ajuste (desenvolvedores).

CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_config (
  id int PRIMARY KEY DEFAULT 1,
  resposta_fallback text NOT NULL,
  resposta_intro text NOT NULL,
  rotulo_referente text NOT NULL DEFAULT 'Referente a: ',
  rotulo_pagina text NOT NULL DEFAULT 'Página: ',
  rotulo_solicitante text NOT NULL DEFAULT 'Solicitado por: ',
  destinatario_dev_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT chat_pedido_ajuste_config_singleton CHECK (id = 1)
);

COMMENT ON TABLE public.chat_pedido_ajuste_config IS
  'Configuração única (linha id=1) das respostas automáticas ao marcar pedido de ajuste como resolvido.';

INSERT INTO public.chat_pedido_ajuste_config (
  id,
  resposta_fallback,
  resposta_intro,
  rotulo_referente,
  rotulo_pagina,
  rotulo_solicitante
)
VALUES (
  1,
  'Ajustamos conforme a sua solicitação, pode testar por gentileza?',
  'Ajustamos conforme a solicitação indicada abaixo, pode testar por gentileza?',
  'Referente a: ',
  'Página: ',
  'Solicitado por: '
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.chat_pedido_ajuste_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_pedido_ajuste_config_select_dev" ON public.chat_pedido_ajuste_config;
CREATE POLICY "chat_pedido_ajuste_config_select_dev"
  ON public.chat_pedido_ajuste_config FOR SELECT TO authenticated
  USING (
    public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  );

DROP POLICY IF EXISTS "chat_pedido_ajuste_config_mutate_dev" ON public.chat_pedido_ajuste_config;
CREATE POLICY "chat_pedido_ajuste_config_mutate_dev"
  ON public.chat_pedido_ajuste_config FOR ALL TO authenticated
  USING (
    public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  )
  WITH CHECK (
    public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_pedido_ajuste_config TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_obter_config_pedido_ajuste()
RETURNS public.chat_pedido_ajuste_config
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.chat_pedido_ajuste_config c
  WHERE c.id = 1;
$$;

CREATE OR REPLACE FUNCTION public.chat_atualizar_config_pedido_ajuste(
  p_resposta_fallback text,
  p_resposta_intro text,
  p_rotulo_referente text DEFAULT NULL,
  p_rotulo_pagina text DEFAULT NULL,
  p_rotulo_solicitante text DEFAULT NULL,
  p_destinatario_dev_id uuid DEFAULT NULL
)
RETURNS public.chat_pedido_ajuste_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.chat_pedido_ajuste_config;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Apenas desenvolvedores podem alterar a configuração.';
  END IF;

  IF length(trim(coalesce(p_resposta_fallback, ''))) = 0 THEN
    RAISE EXCEPTION 'Texto fallback é obrigatório.';
  END IF;

  IF length(trim(coalesce(p_resposta_intro, ''))) = 0 THEN
    RAISE EXCEPTION 'Texto introdutório é obrigatório.';
  END IF;

  IF p_destinatario_dev_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = p_destinatario_dev_id
        AND u.status = 'ativo'
    ) THEN
      RAISE EXCEPTION 'Destinatário inválido ou inactivo.';
    END IF;
  END IF;

  UPDATE public.chat_pedido_ajuste_config
  SET
    resposta_fallback = trim(p_resposta_fallback),
    resposta_intro = trim(p_resposta_intro),
    rotulo_referente = coalesce(nullif(trim(p_rotulo_referente), ''), rotulo_referente),
    rotulo_pagina = coalesce(nullif(trim(p_rotulo_pagina), ''), rotulo_pagina),
    rotulo_solicitante = coalesce(nullif(trim(p_rotulo_solicitante), ''), rotulo_solicitante),
    destinatario_dev_id = p_destinatario_dev_id,
    updated_at = now(),
    updated_by = v_me
  WHERE id = 1
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_montar_resposta_pedido_ajuste_resolvido(p_conteudo_pedido text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.chat_pedido_ajuste_config;
  v_raw text := trim(coalesce(p_conteudo_pedido, ''));
  v_body text;
  v_lines text[];
  v_last text;
  v_penult text;
  v_solicitante text;
  v_pagina text;
  v_descricao text;
  v_out text := '';
BEGIN
  SELECT * INTO v_cfg FROM public.chat_pedido_ajuste_config WHERE id = 1;

  IF NOT starts_with(v_raw, '[Solicitação de ajuste no sistema]') THEN
    RETURN coalesce(v_cfg.resposta_fallback, 'Ajustamos conforme a sua solicitação, pode testar por gentileza?');
  END IF;

  v_body := trim(substring(v_raw from length('[Solicitação de ajuste no sistema]') + 1));
  v_lines := string_to_array(v_body, E'\n');

  IF array_length(v_lines, 1) IS NULL OR array_length(v_lines, 1) = 0 THEN
    RETURN coalesce(v_cfg.resposta_fallback, 'Ajustamos conforme a sua solicitação, pode testar por gentileza?');
  END IF;

  v_last := trim(v_lines[array_length(v_lines, 1)]);
  IF v_last ~ '^—\s*' THEN
    v_solicitante := trim(regexp_replace(v_last, '^—\s*', ''));
    v_lines := v_lines[1:array_length(v_lines, 1) - 1];
  END IF;

  IF array_length(v_lines, 1) IS NOT NULL AND array_length(v_lines, 1) > 0 THEN
    v_penult := trim(v_lines[array_length(v_lines, 1)]);
    IF v_penult ~* '^Página:\s*' THEN
      v_pagina := trim(regexp_replace(v_penult, '^Página:\s*', '', 'i'));
      IF v_pagina = '—' OR v_pagina = '' THEN
        v_pagina := NULL;
      END IF;
      v_lines := v_lines[1:array_length(v_lines, 1) - 1];
    END IF;
  END IF;

  v_descricao := trim(array_to_string(v_lines, E'\n'));

  IF v_descricao = '' THEN
    RETURN coalesce(v_cfg.resposta_fallback, 'Ajustamos conforme a sua solicitação, pode testar por gentileza?');
  END IF;

  v_out := coalesce(v_cfg.resposta_intro, 'Ajustamos conforme a solicitação indicada abaixo, pode testar por gentileza?');
  v_out := v_out || E'\n\n' || coalesce(v_cfg.rotulo_referente, 'Referente a: ') || v_descricao;

  IF v_pagina IS NOT NULL THEN
    v_out := v_out || E'\n' || coalesce(v_cfg.rotulo_pagina, 'Página: ') || v_pagina;
  END IF;

  IF v_solicitante IS NOT NULL AND v_solicitante <> '' THEN
    v_out := v_out || E'\n' || coalesce(v_cfg.rotulo_solicitante, 'Solicitado por: ') || v_solicitante;
  END IF;

  RETURN v_out;
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

REVOKE ALL ON FUNCTION public.chat_obter_config_pedido_ajuste() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_atualizar_config_pedido_ajuste(text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_montar_resposta_pedido_ajuste_resolvido(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_obter_config_pedido_ajuste() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_atualizar_config_pedido_ajuste(text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_montar_resposta_pedido_ajuste_resolvido(text) TO authenticated;

COMMENT ON FUNCTION public.chat_obter_config_pedido_ajuste() IS
  'Dev: lê configuração das respostas automáticas (singleton id=1).';
COMMENT ON FUNCTION public.chat_atualizar_config_pedido_ajuste(text, text, text, text, text, uuid) IS
  'Dev: actualiza textos das respostas automáticas e destinatário opcional dos novos pedidos.';
COMMENT ON FUNCTION public.chat_montar_resposta_pedido_ajuste_resolvido(text) IS
  'Monta resposta automática citando descrição/página/solicitante conforme configuração.';
