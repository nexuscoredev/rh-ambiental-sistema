-- Comprovante de descarte: Desenvolvedor e demais perfis operacionais podem excluir (alinha à UI).

DROP POLICY IF EXISTS "comprovantes_descarte_insert_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_insert_roles_fluxo"
  ON public.comprovantes_descarte FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
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
    )
  );

DROP POLICY IF EXISTS "comprovantes_descarte_update_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_update_roles_fluxo"
  ON public.comprovantes_descarte FOR UPDATE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
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
    )
  )
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
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
    )
  );

DROP POLICY IF EXISTS "comprovantes_descarte_delete_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_delete_roles_fluxo"
  ON public.comprovantes_descarte FOR DELETE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
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
    )
  );
