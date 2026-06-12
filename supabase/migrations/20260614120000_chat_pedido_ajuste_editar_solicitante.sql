-- Solicitante pode editar o texto do pedido enquanto ainda não foi tratado pelo desenvolvedor.

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
      'detalhes_respondidos_solicitante',
      'editado_solicitante'
    )
  );

CREATE OR REPLACE FUNCTION public.chat_editar_pedido_ajuste_solicitante(
  p_mensagem_id uuid,
  p_descricao text
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
  v_desc text := trim(coalesce(p_descricao, ''));
  v_conteudo text;
  v_pagina text;
  v_solicitante text;
  v_linhas text[];
  v_last text;
  v_penult text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF length(v_desc) < 3 THEN
    RAISE EXCEPTION 'Descreva a solicitação com pelo menos 3 caracteres.';
  END IF;

  SELECT * INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_pedido.remetente_id <> v_me THEN
    RAISE EXCEPTION 'Apenas quem enviou a solicitação pode editá-la.';
  END IF;

  IF coalesce(v_pedido.conteudo, '') NOT LIKE '[Solicitação de ajuste no sistema]%' THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  SELECT * INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_id;

  IF FOUND THEN
    IF v_reg.status NOT IN ('aguardando_detalhes') THEN
      RAISE EXCEPTION 'Este pedido já está em tratamento ou encerrado; não pode ser editado.';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_participantes cp
    WHERE cp.conversa_id = v_pedido.conversa_id
      AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Sem acesso a esta conversa.';
  END IF;

  v_linhas := string_to_array(
    regexp_replace(v_pedido.conteudo, '^\[Solicitação de ajuste no sistema\]\s*\n?', ''),
    E'\n'
  );

  v_last := trim(coalesce(v_linhas[array_length(v_linhas, 1)], ''));
  IF v_last ~ '^—\s*' THEN
    v_solicitante := regexp_replace(v_last, '^—\s*', '');
    v_linhas := v_linhas[1:array_length(v_linhas, 1) - 1];
  END IF;

  IF array_length(v_linhas, 1) IS NOT NULL AND array_length(v_linhas, 1) > 0 THEN
    v_penult := trim(coalesce(v_linhas[array_length(v_linhas, 1)], ''));
    IF v_penult ~* '^Página:\s*' THEN
      v_pagina := trim(regexp_replace(v_penult, '^Página:\s*', '', 'i'));
      IF v_pagina = '—' THEN
        v_pagina := NULL;
      END IF;
      v_linhas := v_linhas[1:array_length(v_linhas, 1) - 1];
    END IF;
  END IF;

  v_conteudo := '[Solicitação de ajuste no sistema]' || E'\n\n' || v_desc;
  IF v_pagina IS NOT NULL AND length(trim(v_pagina)) > 0 THEN
    v_conteudo := v_conteudo || E'\n\nPágina: ' || trim(v_pagina);
  END IF;
  IF v_solicitante IS NOT NULL AND length(trim(v_solicitante)) > 0 THEN
    v_conteudo := v_conteudo || E'\n— ' || trim(v_solicitante);
  END IF;

  UPDATE public.chat_mensagens
  SET conteudo = v_conteudo
  WHERE id = p_mensagem_id
  RETURNING * INTO v_pedido;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id := p_mensagem_id,
    p_conversa_id := v_pedido.conversa_id,
    p_evento := 'editado_solicitante',
    p_actor_id := v_me,
    p_texto := left(v_desc, 500),
    p_ciclo := coalesce(v_reg.ciclo, 1)
  );

  RETURN NEXT v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_editar_pedido_ajuste_solicitante(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_editar_pedido_ajuste_solicitante(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.chat_editar_pedido_ajuste_solicitante(uuid, text) IS
  'Solicitante altera o texto do pedido antes do tratamento (ou enquanto aguarda detalhes).';
