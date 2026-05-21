-- Conferência do ticket (Faturamento): atualizar peso líquido com SECURITY DEFINER (evita update bloqueado por RLS).

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
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
    );
$$;

CREATE OR REPLACE FUNCTION public.atualizar_peso_liquido_conferencia_ticket(
  p_coleta_id uuid,
  p_peso_liquido numeric,
  p_residuos_itens jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  IF p_coleta_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta inválida.');
  END IF;

  IF p_peso_liquido IS NULL OR p_peso_liquido <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe um peso líquido maior que zero (kg).');
  END IF;

  IF NOT public.rg_pode_ajustar_peso_conferencia_ticket() THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'message',
      'Sem permissão para alterar o peso nesta conferência (perfil ou política RLS).'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coletas c WHERE c.id = p_coleta_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta não encontrada.');
  END IF;

  UPDATE public.coletas
  SET
    peso_liquido = p_peso_liquido,
    residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
  WHERE id = p_coleta_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível atualizar o peso na coleta.');
  END IF;

  UPDATE public.controle_massa
  SET
    peso_liquido = p_peso_liquido,
    residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
  WHERE coleta_id = p_coleta_id;

  RETURN jsonb_build_object('ok', true, 'peso_liquido', p_peso_liquido);
END;
$$;

COMMENT ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) IS
  'Fila de conferência do ticket: grava peso líquido na coleta e espelha em controle_massa.';

GRANT EXECUTE ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) TO authenticated;
