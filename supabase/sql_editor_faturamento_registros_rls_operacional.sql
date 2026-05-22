-- =============================================================================
-- RLS faturamento_registros — Operacional / pesagem podem atualizar resumo pendente
-- (necessário ao editar peso na fila de conferência do ticket)
-- Cole no SQL Editor do Supabase e execute (Run).
-- =============================================================================

DROP POLICY IF EXISTS "faturamento_registros_mutate_faturamento" ON public.faturamento_registros;

CREATE POLICY "faturamento_registros_mutate_faturamento"
  ON public.faturamento_registros FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_is_diretoria()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
  );
