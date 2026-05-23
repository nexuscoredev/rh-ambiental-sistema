-- Quem já pode lançar pesagem (controle_massa) também pode gravar o ticket operacional.
-- Corrige: "new row violates row-level security policy for table tickets_operacionais"
-- após imprimir no Controle de Massa (garantirTicketAposPesagem).

DROP POLICY IF EXISTS "tickets_operacionais_mutate_roles" ON public.tickets_operacionais;

CREATE POLICY "tickets_operacionais_mutate_roles"
  ON public.tickets_operacionais FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
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
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
  );
