-- Operação: lançar programação e pesagem/ticket (alinhado ao RBAC no frontend).

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
    ELSE
      NULL;
  END CASE;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_pode_lancar_pesagem_controle_massa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.rg_is_visualizador()
    AND (
      public.rg_rbac_pode('pesagem_ticket', 'criar')
      OR public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operadores_time_r()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    );
$$;

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;

CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_rbac_pode('pesagem_ticket', 'criar')
      OR public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_is_operadores_time_r()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
    )
  )
  WITH CHECK (
    public.rg_rbac_pode('pesagem_ticket', 'criar')
    OR public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_is_operadores_time_r()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
  );

DROP POLICY IF EXISTS "tickets_operacionais_mutate_roles" ON public.tickets_operacionais;

CREATE POLICY "tickets_operacionais_mutate_roles"
  ON public.tickets_operacionais FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_rbac_pode('pesagem_ticket', 'criar')
      OR public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operadores_time_r()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    )
  )
  WITH CHECK (
    public.rg_rbac_pode('pesagem_ticket', 'criar')
    OR public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operadores_time_r()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
  );

DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;

CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_rbac_pode('pesagem_ticket', 'criar')
    OR public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operadores_time_r()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_is_diretoria()
  );
