-- Equipe Comercial: lançar pesagem (controle_massa), ticket operacional e espelho na coleta.

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
      public.rg_is_equipe_comercial()
      OR public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    );
$$;

COMMENT ON FUNCTION public.rg_pode_lancar_pesagem_controle_massa() IS
  'Quem pode gravar pesagem no Controle de Massa (inclui equipe Comercial).';

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;

CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_equipe_comercial()
      OR public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
    )
  )
  WITH CHECK (
    public.rg_is_equipe_comercial()
    OR public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
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
      public.rg_is_equipe_comercial()
      OR public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
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
    public.rg_is_equipe_comercial()
    OR public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
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
    public.rg_is_equipe_comercial()
    OR public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
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
