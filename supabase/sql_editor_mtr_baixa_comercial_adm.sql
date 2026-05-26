-- Corrige «Sem permissão para baixar MTR» para Thais (Comercial Adm).
-- Execute no Supabase → SQL Editor (igual a 20260726130000_mtr_baixa_comercial_adm.sql).

CREATE OR REPLACE FUNCTION public._rg_pode_cancelar_baixar_mtr_por_nome()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_desenvolvedor_master()
    OR public.rg_is_comercial_adm()
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'thais')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'ezequiel')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'ezequeil')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'ana')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'raquel')
    OR public.rg_normalizar_nome(public.rg_user_nome()) LIKE '%cavalcante%'
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'vinicius');
$$;

CREATE OR REPLACE FUNCTION public._rg_pode_mutar_mtr_ciclo_vida()
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
      OR public.rg_cargo_like('operacional (time t)')
      OR public.rg_cargo_like('gerente do time')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public._rg_pode_cancelar_baixar_mtr_por_nome()
    );
$$;
