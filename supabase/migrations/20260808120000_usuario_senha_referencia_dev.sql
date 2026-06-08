-- Referência da senha definida pelo Desenvolvedor (criação ou redefinição).
-- Não substitui o hash do Auth; só permite consulta de suporte quando o dev cadastrou a senha.

CREATE TABLE IF NOT EXISTS public.usuario_senha_referencia_dev (
  user_id uuid PRIMARY KEY REFERENCES public.usuarios (id) ON DELETE CASCADE,
  senha_cadastrada text NOT NULL,
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  fonte text NOT NULL DEFAULT 'criacao',
  CONSTRAINT usuario_senha_referencia_dev_fonte_chk
    CHECK (fonte IN ('criacao', 'redefinicao_dev'))
);

COMMENT ON TABLE public.usuario_senha_referencia_dev IS
  'Senha em texto definida pelo Desenvolvedor ao criar ou redefinir utilizador. Limpo quando o utilizador altera a própria senha.';

ALTER TABLE public.usuario_senha_referencia_dev ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rg_mapa_senhas_cadastradas_dev()
RETURNS TABLE (
  user_id uuid,
  senha_cadastrada text,
  atualizada_em timestamptz,
  fonte text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Acesso restrito ao Desenvolvedor.';
  END IF;

  RETURN QUERY
  SELECT
    r.user_id,
    r.senha_cadastrada,
    r.atualizada_em,
    r.fonte
  FROM public.usuario_senha_referencia_dev r
  ORDER BY r.atualizada_em DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_limpar_senha_referencia_apos_alteracao_propria()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  DELETE FROM public.usuario_senha_referencia_dev
  WHERE user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.rg_mapa_senhas_cadastradas_dev() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rg_limpar_senha_referencia_apos_alteracao_propria() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rg_mapa_senhas_cadastradas_dev() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rg_limpar_senha_referencia_apos_alteracao_propria() TO authenticated;

COMMENT ON FUNCTION public.rg_mapa_senhas_cadastradas_dev() IS
  'Mapa user_id → senha cadastrada pelo Desenvolvedor (suporte).';

COMMENT ON FUNCTION public.rg_limpar_senha_referencia_apos_alteracao_propria() IS
  'Remove referência quando o utilizador altera a própria senha em Minha conta.';
