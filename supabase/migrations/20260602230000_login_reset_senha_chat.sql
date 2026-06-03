-- Pedido de reset de senha no ecrã de login → mensagem no chat para o desenvolvedor.

CREATE OR REPLACE FUNCTION public.rg_resolver_id_desenvolvedor_sistema()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev uuid;
BEGIN
  SELECT u.id INTO v_dev
  FROM public.usuarios u
  WHERE lower(trim(coalesce(u.status, ''))) = 'ativo'
    AND lower(trim(coalesce(u.nome, ''))) LIKE '%rafael%cavalcante%'
  ORDER BY
    CASE WHEN lower(trim(coalesce(u.cargo, ''))) LIKE '%desenvolvedor%' THEN 0 ELSE 1 END,
    u.created_at NULLS LAST
  LIMIT 1;

  IF v_dev IS NOT NULL THEN
    RETURN v_dev;
  END IF;

  SELECT u.id INTO v_dev
  FROM public.usuarios u
  WHERE lower(trim(coalesce(u.status, ''))) = 'ativo'
    AND lower(trim(coalesce(u.cargo, ''))) LIKE '%desenvolvedor%'
  ORDER BY u.created_at NULLS LAST
  LIMIT 1;

  RETURN v_dev;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_solicitar_reset_senha_login(
  p_email text,
  p_nome text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_solicitante uuid;
  v_dev uuid;
  v_low uuid;
  v_high uuid;
  v_conversa uuid;
  v_nome text;
  v_corpo text;
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  SELECT u.id, coalesce(nullif(trim(p_nome), ''), nullif(trim(u.nome), ''), u.email)
  INTO v_solicitante, v_nome
  FROM public.usuarios u
  WHERE lower(trim(coalesce(u.email, ''))) = v_email
    AND lower(trim(coalesce(u.status, ''))) = 'ativo'
  LIMIT 1;

  IF v_solicitante IS NULL THEN
    RAISE EXCEPTION 'E-mail não encontrado no cadastro activo. Confira o endereço ou contacte a gestão.';
  END IF;

  v_dev := public.rg_resolver_id_desenvolvedor_sistema();
  IF v_dev IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar o desenvolvedor do sistema.';
  END IF;

  IF v_solicitante = v_dev THEN
    RAISE EXCEPTION 'Esta conta é do desenvolvedor; use outro canal para alterar a senha.';
  END IF;

  IF v_solicitante < v_dev THEN
    v_low := v_solicitante;
    v_high := v_dev;
  ELSE
    v_low := v_dev;
    v_high := v_solicitante;
  END IF;

  INSERT INTO public.chat_conversas (participant_low, participant_high)
  VALUES (v_low, v_high)
  ON CONFLICT (participant_low, participant_high) DO UPDATE
  SET updated_at = now();

  SELECT c.id INTO STRICT v_conversa
  FROM public.chat_conversas c
  WHERE c.participant_low = v_low AND c.participant_high = v_high;

  INSERT INTO public.chat_participantes (conversa_id, user_id)
  VALUES (v_conversa, v_low), (v_conversa, v_high)
  ON CONFLICT DO NOTHING;

  v_corpo :=
    '[Pedido de reset de senha — ecrã de login]' || E'\n\n'
    || 'E-mail: ' || v_email || E'\n'
    || 'Nome: ' || coalesce(nullif(trim(p_nome), ''), v_nome, '—');

  IF nullif(trim(coalesce(p_observacao, '')), '') IS NOT NULL THEN
    v_corpo := v_corpo || E'\n\nObservação: ' || trim(p_observacao);
  END IF;

  v_corpo := v_corpo || E'\n\n— ' || coalesce(v_nome, v_email);

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (v_conversa, v_solicitante, v_corpo);

  RETURN jsonb_build_object(
    'conversa_id', v_conversa,
    'desenvolvedor_id', v_dev,
    'solicitante_id', v_solicitante
  );
END;
$$;

COMMENT ON FUNCTION public.rg_solicitar_reset_senha_login(text, text, text) IS
  'Login sem sessão: envia pedido de reset de senha ao chat com o desenvolvedor.';

REVOKE ALL ON FUNCTION public.rg_solicitar_reset_senha_login(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rg_solicitar_reset_senha_login(text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.rg_resolver_id_desenvolvedor_sistema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rg_resolver_id_desenvolvedor_sistema() TO authenticated;
