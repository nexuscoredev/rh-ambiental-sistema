-- Confirmação «Já configurei» na boas-vindas + estatísticas para Desenvolvedor.

CREATE TABLE IF NOT EXISTS public.usuario_senha_pessoal_confirmacao (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  confirmado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuario_senha_pessoal_confirmacao_em
  ON public.usuario_senha_pessoal_confirmacao (confirmado_em DESC);

COMMENT ON TABLE public.usuario_senha_pessoal_confirmacao IS
  'Utilizadores que confirmaram ter configurado senha pessoal (boas-vindas).';

ALTER TABLE public.usuario_senha_pessoal_confirmacao ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rg_usuario_elegivel_aviso_senha_pessoal(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_user_id
      AND lower(trim(coalesce(u.status, ''))) = 'ativo'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%desenvolvedor%'
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_senha_pessoal_ja_confirmada()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_senha_pessoal_confirmacao c
    WHERE c.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.rg_senha_pessoal_ja_confirmada() TO authenticated;

CREATE OR REPLACE FUNCTION public.rg_confirmar_senha_pessoal_configurada()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_em timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT public.rg_usuario_elegivel_aviso_senha_pessoal(v_uid) THEN
    RAISE EXCEPTION 'Perfil não elegível para este registo.';
  END IF;

  INSERT INTO public.usuario_senha_pessoal_confirmacao (user_id, confirmado_em)
  VALUES (v_uid, now())
  ON CONFLICT (user_id) DO UPDATE
  SET confirmado_em = EXCLUDED.confirmado_em
  RETURNING confirmado_em INTO v_em;

  RETURN v_em;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rg_confirmar_senha_pessoal_configurada() TO authenticated;

CREATE OR REPLACE FUNCTION public.rg_stats_senha_pessoal_acompanhamento()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Acesso restrito ao Desenvolvedor.';
  END IF;

  SELECT jsonb_build_object(
    'confirmados', coalesce(agg.confirmados, 0),
    'pendentes', coalesce(agg.pendentes, 0),
    'total_elegiveis', coalesce(agg.total_elegiveis, 0),
    'usuarios_confirmados', coalesce(agg.lista_confirmados, '[]'::jsonb),
    'usuarios_pendentes', coalesce(agg.lista_pendentes, '[]'::jsonb)
  )
  INTO v_result
  FROM (
    SELECT
      count(*) FILTER (WHERE c.user_id IS NOT NULL)::int AS confirmados,
      count(*) FILTER (WHERE c.user_id IS NULL)::int AS pendentes,
      count(*)::int AS total_elegiveis,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'nome', u.nome,
            'email', u.email,
            'cargo', u.cargo,
            'confirmado_em', c.confirmado_em
          )
          ORDER BY c.confirmado_em DESC
        ) FILTER (WHERE c.user_id IS NOT NULL),
        '[]'::jsonb
      ) AS lista_confirmados,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'nome', u.nome,
            'email', u.email,
            'cargo', u.cargo
          )
          ORDER BY u.nome NULLS LAST, u.email
        ) FILTER (WHERE c.user_id IS NULL),
        '[]'::jsonb
      ) AS lista_pendentes
    FROM public.usuarios u
    LEFT JOIN public.usuario_senha_pessoal_confirmacao c ON c.user_id = u.id
    WHERE lower(trim(coalesce(u.status, ''))) = 'ativo'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%desenvolvedor%'
  ) agg;

  RETURN coalesce(v_result, jsonb_build_object(
    'confirmados', 0,
    'pendentes', 0,
    'total_elegiveis', 0,
    'usuarios_confirmados', '[]'::jsonb,
    'usuarios_pendentes', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rg_stats_senha_pessoal_acompanhamento() TO authenticated;

COMMENT ON FUNCTION public.rg_stats_senha_pessoal_acompanhamento() IS
  'Desenvolvedor: totais e listas de quem confirmou senha pessoal na boas-vindas.';
