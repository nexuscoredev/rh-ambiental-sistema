-- Desenvolvedor pode excluir registos da frota (OS, diário, movimentação).

CREATE OR REPLACE FUNCTION public.rg_pode_excluir_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_desenvolvedor_master()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_diretoria()
    OR public.rg_is_thais()
    OR public.rg_is_comercial_adm()
    OR public.rg_rbac_pode('frota_operacional', 'excluir');
$$;
