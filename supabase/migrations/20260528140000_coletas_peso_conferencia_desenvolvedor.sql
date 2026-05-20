-- Conferência do ticket (Faturamento): Desenvolvedor e Faturamento podem ajustar peso na coleta / controle_massa.

DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;
CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('desenvolvedor')
    OR public.rg_is_diretoria()
  );

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;
CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('desenvolvedor')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('desenvolvedor')
  );
