-- Frota operacional: acessos restritos (Operacional, Comercial, Comercial Adm, Diretoria; exclusão Thais).

CREATE OR REPLACE FUNCTION public.rg_cargo_eh_operacional_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND lower(trim(coalesce(u.status, ''))) = 'ativo'
      AND lower(trim(coalesce(u.cargo, ''))) LIKE '%operacional%'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%operadores%'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%time r%'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%time t%'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%visualizador%'
  );
$$;

COMMENT ON FUNCTION public.rg_cargo_eh_operacional_frota() IS
  'Cargo Operacional (sem Operadores / Time T/R) — transportes e manutenção da frota.';

CREATE OR REPLACE FUNCTION public.rg_pode_acessar_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_desenvolvedor_master()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_admin()
    OR public.rg_is_diretoria()
    OR public.rg_is_equipe_comercial()
    OR public.rg_cargo_eh_operacional_frota();
$$;

COMMENT ON FUNCTION public.rg_pode_acessar_frota() IS
  'Ler frota: Operacional, Comercial (incl. Adm), Diretoria e Desenvolvedor.';

CREATE OR REPLACE FUNCTION public.rg_pode_mutar_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_desenvolvedor_master()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_admin()
      OR public.rg_rbac_pode('frota_operacional', 'editar')
    );
$$;

COMMENT ON FUNCTION public.rg_pode_mutar_frota() IS
  'Incluir/editar frota e gerar relatório para assinatura.';

CREATE OR REPLACE FUNCTION public.rg_pode_excluir_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_desenvolvedor_master()
    OR public.rg_is_diretoria()
    OR public.rg_is_thais()
    OR public.rg_is_comercial_adm()
    OR public.rg_rbac_pode('frota_operacional', 'excluir');
$$;

COMMENT ON FUNCTION public.rg_pode_excluir_frota() IS
  'Excluir registos da frota — Comercial Adm (Thais), Diretoria e Desenvolvedor.';

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
      RETURN s = 'comercial'
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'matheus')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'gabriel');
    WHEN 'motorista', 'veiculo' THEN
      RETURN s IN ('comercial', 'operacao')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'matheus')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'gabriel');
    WHEN 'representante' THEN
      IF p_acao = 'ler' THEN
        RETURN s IN ('comercial', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'programacao' THEN
      IF p_acao = 'ler' THEN RETURN true; END IF;
      IF p_acao IN ('criar', 'editar') THEN
        RETURN s IN ('comercial', 'operacao', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'mtr' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'pesagem_ticket' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      IF p_acao IN ('criar', 'editar') THEN
        RETURN s IN ('comercial', 'operacao', 'diretoria_financeiro');
      END IF;
      RETURN true;
    WHEN 'comprovante_descarte' THEN
      RETURN s = 'comercial';
    WHEN 'conferencia_transporte' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN s = 'operacao';
    WHEN 'faturamento' THEN
      IF p_acao IN ('ler', 'criar', 'editar', 'excluir') THEN RETURN s = 'comercial'; END IF;
    WHEN 'frota_operacional' THEN
      IF p_acao = 'excluir' THEN
        RETURN public.rg_is_comercial_adm() OR s = 'diretoria_financeiro';
      END IF;
      IF p_acao IN ('ler', 'criar', 'editar') THEN
        RETURN s IN ('comercial', 'diretoria_financeiro')
          OR public.rg_cargo_eh_operacional_frota();
      END IF;
    ELSE
      NULL;
  END CASE;

  RETURN false;
END;
$$;

INSERT INTO public.rbac_matriz (recurso, acao, descricao) VALUES
  ('frota_operacional', 'ler', 'Operacional, Comercial, Diretoria'),
  ('frota_operacional', 'criar', 'Operacional, Comercial, Diretoria'),
  ('frota_operacional', 'editar', 'Operacional, Comercial, Diretoria — inclui relatório assinatura'),
  ('frota_operacional', 'excluir', 'Comercial Adm (Thais), Diretoria')
ON CONFLICT (recurso, acao) DO UPDATE SET descricao = EXCLUDED.descricao;

DROP POLICY IF EXISTS "frota_movimentacao_select" ON public.frota_movimentacao;
CREATE POLICY "frota_movimentacao_select"
  ON public.frota_movimentacao FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota());

DROP POLICY IF EXISTS "frota_movimentacao_mutate" ON public.frota_movimentacao;
DROP POLICY IF EXISTS "frota_movimentacao_insert" ON public.frota_movimentacao;
DROP POLICY IF EXISTS "frota_movimentacao_update" ON public.frota_movimentacao;
DROP POLICY IF EXISTS "frota_movimentacao_delete" ON public.frota_movimentacao;

CREATE POLICY "frota_movimentacao_insert"
  ON public.frota_movimentacao FOR INSERT TO authenticated
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_movimentacao_update"
  ON public.frota_movimentacao FOR UPDATE TO authenticated
  USING (public.rg_pode_mutar_frota())
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_movimentacao_delete"
  ON public.frota_movimentacao FOR DELETE TO authenticated
  USING (public.rg_pode_excluir_frota());

DROP POLICY IF EXISTS "frota_manutencao_select" ON public.frota_manutencao;
CREATE POLICY "frota_manutencao_select"
  ON public.frota_manutencao FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota());

DROP POLICY IF EXISTS "frota_manutencao_mutate" ON public.frota_manutencao;
DROP POLICY IF EXISTS "frota_manutencao_insert" ON public.frota_manutencao;
DROP POLICY IF EXISTS "frota_manutencao_update" ON public.frota_manutencao;
DROP POLICY IF EXISTS "frota_manutencao_delete" ON public.frota_manutencao;

CREATE POLICY "frota_manutencao_insert"
  ON public.frota_manutencao FOR INSERT TO authenticated
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_manutencao_update"
  ON public.frota_manutencao FOR UPDATE TO authenticated
  USING (public.rg_pode_mutar_frota())
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_manutencao_delete"
  ON public.frota_manutencao FOR DELETE TO authenticated
  USING (public.rg_pode_excluir_frota());

DROP POLICY IF EXISTS "frota_diario_select" ON public.frota_diario_veiculo;
CREATE POLICY "frota_diario_select"
  ON public.frota_diario_veiculo FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota());

DROP POLICY IF EXISTS "frota_diario_mutate" ON public.frota_diario_veiculo;
DROP POLICY IF EXISTS "frota_diario_insert" ON public.frota_diario_veiculo;
DROP POLICY IF EXISTS "frota_diario_update" ON public.frota_diario_veiculo;
DROP POLICY IF EXISTS "frota_diario_delete" ON public.frota_diario_veiculo;

CREATE POLICY "frota_diario_insert"
  ON public.frota_diario_veiculo FOR INSERT TO authenticated
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_diario_update"
  ON public.frota_diario_veiculo FOR UPDATE TO authenticated
  USING (public.rg_pode_mutar_frota())
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_diario_delete"
  ON public.frota_diario_veiculo FOR DELETE TO authenticated
  USING (public.rg_pode_excluir_frota());
