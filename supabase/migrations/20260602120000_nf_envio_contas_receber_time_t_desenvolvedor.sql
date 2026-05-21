-- Envio de NF: Operacional (Time T) e Desenvolvedor podem atualizar contas_receber (nf_enviada_em, etc.)

CREATE OR REPLACE FUNCTION public.rg_is_operacional_time_t()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_cargo_like('operacional')
    AND (
      public.rg_cargo_like('time t')
      OR public.rg_cargo_like('thais')
      OR public.rg_cargo_like('operacional time thais')
    )
    OR (
      public.rg_cargo_like('gerente')
      AND public.rg_cargo_like('time')
    )
    OR lower(btrim(public.rg_user_cargo())) = 'gerente time';
$$;

DROP POLICY IF EXISTS "contas_receber_mutate_financeiro" ON public.contas_receber;

CREATE POLICY "contas_receber_mutate_financeiro"
  ON public.contas_receber FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_is_diretoria()
  );
