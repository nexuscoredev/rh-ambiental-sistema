-- Mala direta — Thais (Comercial Adm) e equipe Comercial
-- 1) Execute este SQL no Supabase (Ctrl+A → Run)
-- 2) Faça deploy da Edge Function: supabase functions deploy send-nf-email
--    (ou redeploy pelo dashboard Functions)

-- RLS contas_receber (registo de envio / simulação)
CREATE OR REPLACE FUNCTION public.rg_is_operacional_time_t()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (public.rg_cargo_like('comercial') AND public.rg_cargo_like('adm'))
    OR lower(btrim(public.rg_user_cargo())) = 'comercial adm'
    OR (
      public.rg_cargo_like('operacional')
      AND (
        public.rg_cargo_like('time t')
        OR public.rg_cargo_like('thais')
      )
    )
    OR (public.rg_cargo_like('gerente') AND public.rg_cargo_like('time'))
    OR lower(btrim(public.rg_user_cargo())) = 'gerente time';
$$;

CREATE OR REPLACE FUNCTION public.rg_is_comercial_adm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_operacional_time_t()
    OR (public.rg_cargo_like('comercial') AND public.rg_cargo_like('adm'))
    OR lower(btrim(public.rg_user_cargo())) = 'comercial adm';
$$;

CREATE OR REPLACE FUNCTION public.rg_is_equipe_comercial()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_is_comercial_adm() OR public.rg_cargo_like('comercial');
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
      OR public.rg_is_comercial_adm()
      OR public.rg_is_equipe_comercial()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
      OR public.rg_cargo_like('comercial')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_is_comercial_adm()
    OR public.rg_is_equipe_comercial()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_is_diretoria()
    OR public.rg_cargo_like('comercial')
  );
