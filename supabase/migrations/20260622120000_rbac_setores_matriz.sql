-- =============================================================================
-- RBAC por setor/nome — matriz RG Ambiental (organograma oficial)
-- Espelha `src/lib/rbac/rbacAcesso.ts` para RLS e RPCs SECURITY DEFINER.
-- =============================================================================

-- Catálogo (seed / documentação; avaliação principal em funções)
CREATE TABLE IF NOT EXISTS public.rbac_setores (
  codigo text PRIMARY KEY,
  nome text NOT NULL
);

INSERT INTO public.rbac_setores (codigo, nome) VALUES
  ('desenvolvedor', 'Desenvolvedor'),
  ('diretoria_financeiro', 'Diretoria/Financeiro'),
  ('operacao', 'Operação'),
  ('comercial', 'Comercial')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome;

CREATE TABLE IF NOT EXISTS public.rbac_matriz (
  recurso text NOT NULL,
  acao text NOT NULL,
  descricao text,
  PRIMARY KEY (recurso, acao)
);

INSERT INTO public.rbac_matriz (recurso, acao, descricao) VALUES
  ('cliente', 'ler', 'Comercial: Thais, Rafaela, Rose, Raquel'),
  ('cliente', 'criar', 'Comercial: Thais, Rafaela, Rose, Raquel'),
  ('cliente', 'editar', 'Comercial: Thais, Rafaela, Rose, Raquel'),
  ('cliente', 'excluir', 'Comercial: Thais, Rafaela, Rose, Raquel'),
  ('motorista', 'editar', 'Comercial + Operação'),
  ('veiculo', 'editar', 'Comercial + Operação'),
  ('representante', 'ler', 'Comercial'),
  ('programacao', 'ler', 'Todos'),
  ('programacao', 'criar', 'Comercial'),
  ('programacao', 'excluir', 'Comercial'),
  ('mtr', 'editar', 'Todos'),
  ('mtr', 'excluir', 'Comercial'),
  ('pesagem_ticket', 'excluir', 'Comercial'),
  ('comprovante_descarte', 'editar', 'Comercial'),
  ('conferencia_transporte', 'editar', 'Operação'),
  ('conferencia_transporte', 'excluir', 'Comercial'),
  ('faturamento', 'ler', 'Comercial'),
  ('faturamento', 'editar', 'Comercial')
ON CONFLICT (recurso, acao) DO UPDATE SET descricao = EXCLUDED.descricao;

ALTER TABLE public.rbac_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_matriz ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_setores_select_auth" ON public.rbac_setores;
CREATE POLICY "rbac_setores_select_auth"
  ON public.rbac_setores FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rbac_matriz_select_auth" ON public.rbac_matriz;
CREATE POLICY "rbac_matriz_select_auth"
  ON public.rbac_matriz FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.rbac_setores TO authenticated;
GRANT SELECT ON public.rbac_matriz TO authenticated;

-- Helpers ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rg_user_nome()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT btrim(u.nome) FROM public.usuarios u WHERE u.id = auth.uid()),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_normalizar_nome(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    translate(
      coalesce(p, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_nome_contem_token(p_nome text, p_token text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    public.rg_normalizar_nome(p_nome) = public.rg_normalizar_nome(p_token)
    OR public.rg_normalizar_nome(p_nome) ~ (
      '(^|[[:space:]])' || regexp_replace(public.rg_normalizar_nome(p_token), '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '([[:space:]]|$)'
    );
$$;

CREATE OR REPLACE FUNCTION public.rg_is_desenvolvedor_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_cargo_like('desenvolvedor')
    OR public.rg_normalizar_nome(public.rg_user_nome()) LIKE '%cavalcante%'
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'vinicius');
$$;

/** Thais — cargo «Comercial Adm» (legado Operacional Time T). */
CREATE OR REPLACE FUNCTION public.rg_is_comercial_adm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_operacional_time_t()
    OR (
      public.rg_cargo_like('comercial')
      AND public.rg_cargo_like('adm')
    )
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'thais');
$$;

CREATE OR REPLACE FUNCTION public.rg_is_thais()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_is_comercial_adm();
$$;

/** Operadores (Time R) — pesagem / ticket padrão. */
CREATE OR REPLACE FUNCTION public.rg_is_operadores_time_r()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_cargo_like('operadores')
    AND (
      public.rg_cargo_like('time r')
      OR public.rg_cargo_like('rafael')
      OR public.rg_cargo_like('operadores time rafael')
    )
    OR public.rg_cargo_like('meninos')
    OR lower(btrim(public.rg_user_cargo())) = 'operadores';
$$;

CREATE OR REPLACE FUNCTION public.rg_rbac_setor_usuario()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n text := public.rg_normalizar_nome(public.rg_user_nome());
  c text := lower(public.rg_user_cargo());
BEGIN
  IF public.rg_is_desenvolvedor_master() THEN
    RETURN 'desenvolvedor';
  END IF;

  IF n LIKE '%ezequiel%' OR n LIKE '% ana%' OR n = 'ana' OR public.rg_nome_contem_token(public.rg_user_nome(), 'ana')
     OR c LIKE '%diretoria%' OR c LIKE '%diretor%'
     OR (c LIKE '%financeiro%' AND c NOT LIKE '%operacional%') THEN
    RETURN 'diretoria_financeiro';
  END IF;

  IF public.rg_nome_contem_token(public.rg_user_nome(), 'thais')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'rafaela')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'rose')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'raquel')
     OR c LIKE '%comercial%'
     OR public.rg_is_operacional_time_t() THEN
    RETURN 'comercial';
  END IF;

  IF n LIKE '%cavalcante%' OR public.rg_nome_contem_token(public.rg_user_nome(), 'rafaela') THEN
    RETURN NULL;
  END IF;

  IF public.rg_nome_contem_token(public.rg_user_nome(), 'matheus')
     OR (public.rg_nome_contem_token(public.rg_user_nome(), 'rafael') AND n NOT LIKE '%cavalcante%' AND n NOT LIKE '%rafaela%')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'heberson')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'gabriel')
     OR public.rg_is_operadores_time_r()
     OR c LIKE '%operadores%'
     OR c LIKE '%logistica%'
     OR c LIKE '%balanceiro%'
     OR c LIKE '%pesagem%' THEN
    RETURN 'operacao';
  END IF;

  RETURN NULL;
END;
$$;

/** Equipe comercial com o mesmo acesso: Thais, Rafaela, Rose, Raquel. */
CREATE OR REPLACE FUNCTION public.rg_is_equipe_comercial()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_rbac_setor_usuario() = 'comercial';
$$;

CREATE OR REPLACE FUNCTION public.rg_rbac_pode(p_recurso text, p_acao text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text := public.rg_rbac_setor_usuario();
BEGIN
  IF public.rg_is_visualizador() THEN
    RETURN false;
  END IF;

  IF public.rg_is_desenvolvedor_master() THEN
    RETURN true;
  END IF;

  CASE p_recurso
    WHEN 'cliente' THEN
      RETURN s = 'comercial';
    WHEN 'motorista', 'veiculo' THEN
      RETURN s IN ('comercial', 'operacao');
    WHEN 'representante' THEN
      IF p_acao = 'ler' THEN
        RETURN s IN ('comercial', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'programacao' THEN
      IF p_acao = 'ler' THEN RETURN true; END IF;
      RETURN s = 'comercial';
    WHEN 'mtr' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'pesagem_ticket' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'comprovante_descarte' THEN
      RETURN s = 'comercial';
    WHEN 'conferencia_transporte' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN s = 'operacao';
    WHEN 'faturamento' THEN
      IF p_acao IN ('ler', 'criar', 'editar', 'excluir') THEN RETURN s = 'comercial'; END IF;
    ELSE
      NULL;
  END CASE;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_rbac_pode_excluir(p_recurso text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_rbac_pode(p_recurso, 'excluir');
$$;

-- RPCs de exclusão operacional ------------------------------------------------

CREATE OR REPLACE FUNCTION public._rg_pode_excluir_operacional_mtr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_rbac_pode_excluir('mtr')
     OR public.rg_rbac_pode_excluir('pesagem_ticket');
$$;

-- Comprovantes descarte -------------------------------------------------------

DROP POLICY IF EXISTS "comprovantes_descarte_insert_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_insert_roles_fluxo"
  ON public.comprovantes_descarte FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND public.rg_rbac_pode('comprovante_descarte', 'editar')
  );

DROP POLICY IF EXISTS "comprovantes_descarte_update_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_update_roles_fluxo"
  ON public.comprovantes_descarte FOR UPDATE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND public.rg_rbac_pode('comprovante_descarte', 'editar')
  )
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND public.rg_rbac_pode('comprovante_descarte', 'editar')
  );

DROP POLICY IF EXISTS "comprovantes_descarte_delete_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_delete_roles_fluxo"
  ON public.comprovantes_descarte FOR DELETE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND public.rg_rbac_pode('comprovante_descarte', 'editar')
  );

-- Programações — restringir mutação a Comercial; DELETE só Thais --------------

DROP POLICY IF EXISTS "programacoes_mutate_operacional" ON public.programacoes;
DROP POLICY IF EXISTS "programacoes_insert_comercial" ON public.programacoes;
DROP POLICY IF EXISTS "programacoes_update_comercial" ON public.programacoes;
DROP POLICY IF EXISTS "programacoes_delete_thais" ON public.programacoes;

CREATE POLICY "programacoes_insert_comercial"
  ON public.programacoes FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_cargo_vazio_compat()
      OR public.rg_rbac_pode('programacao', 'criar')
    )
  );

CREATE POLICY "programacoes_update_comercial"
  ON public.programacoes FOR UPDATE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_cargo_vazio_compat()
      OR public.rg_rbac_pode('programacao', 'editar')
    )
  )
  WITH CHECK (
    public.rg_cargo_vazio_compat()
    OR public.rg_rbac_pode('programacao', 'editar')
  );

CREATE POLICY "programacoes_delete_thais"
  ON public.programacoes FOR DELETE TO authenticated
  USING (
    public.rg_cargo_vazio_compat()
    OR public.rg_rbac_pode('programacao', 'excluir')
  );

COMMENT ON FUNCTION public.rg_rbac_pode(text, text) IS
  'Valida permissão RBAC (recurso, ação) pelo nome/cargo do utilizador autenticado.';
