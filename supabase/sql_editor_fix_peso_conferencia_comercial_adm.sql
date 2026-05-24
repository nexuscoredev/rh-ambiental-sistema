-- Correção rápida: Thais (Comercial Adm) — «Guardar» peso na fila de conferência
-- Execute no SQL Editor (Ctrl+A → Run). Depois F5 na app.

-- Requer rg_nome_contem_token (migration rbac). Se não existir, só a linha comercial abaixo basta.
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
    OR lower(btrim(public.rg_user_cargo())) = 'comercial adm';
$$;

CREATE OR REPLACE FUNCTION public.rg_is_equipe_comercial()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_comercial_adm()
    OR public.rg_cargo_like('comercial');
$$;

CREATE OR REPLACE FUNCTION public.rg_pode_ajustar_peso_conferencia_ticket()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_is_comercial_adm()
      OR public.rg_is_equipe_comercial()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('comercial')
    );
$$;
