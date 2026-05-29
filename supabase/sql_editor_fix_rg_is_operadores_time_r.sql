-- Corrige: function public.rg_is_operadores_time_r() does not exist
-- Execute no SQL Editor ANTES de 20260627140000_operacao_programacao_pesagem_lancar.sql

CREATE OR REPLACE FUNCTION public.rg_is_operadores_time_r()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_cargo_like('operadores')
    AND (
      public.rg_cargo_like('time r')
      OR public.rg_cargo_like('rafael')
      OR public.rg_cargo_like('operadores time rafael')
    )
    OR public.rg_cargo_like('meninos')
    OR lower(btrim(public.rg_user_cargo())) = 'operadores';
$$;

COMMENT ON FUNCTION public.rg_is_operadores_time_r() IS
  'Perfil Operadores (Time R) — lançamento de pesagem e ticket no Controle de Massa.';
