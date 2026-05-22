-- Conferência do ticket: corrigir persistência do peso manual (alinha bruto = tara + líquido).

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
  v_tara numeric;
  v_bruto numeric;
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

  SELECT c.peso_tara INTO v_tara
  FROM public.coletas c
  WHERE c.id = p_coleta_id;

  IF v_tara IS NOT NULL THEN
    v_bruto := v_tara + p_peso_liquido;
  END IF;

  BEGIN
    UPDATE public.coletas
    SET
      peso_liquido = p_peso_liquido,
      peso_bruto = COALESCE(v_bruto, peso_bruto),
      residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
    WHERE id = p_coleta_id;
  EXCEPTION
    WHEN undefined_column THEN
      UPDATE public.coletas
      SET peso_liquido = p_peso_liquido
      WHERE id = p_coleta_id;
  END;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível atualizar o peso na coleta.');
  END IF;

  BEGIN
    UPDATE public.controle_massa
    SET
      peso_liquido = p_peso_liquido,
      peso_bruto = COALESCE(v_bruto, peso_bruto),
      residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
    WHERE coleta_id = p_coleta_id;
  EXCEPTION
    WHEN undefined_column THEN
      UPDATE public.controle_massa
      SET peso_liquido = p_peso_liquido
      WHERE coleta_id = p_coleta_id;
  END;

  RETURN jsonb_build_object('ok', true, 'peso_liquido', p_peso_liquido);
END;
$$;

COMMENT ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) IS
  'Fila de conferência do ticket: grava peso líquido (e bruto = tara + líquido quando há tara) na coleta e controle_massa.';

GRANT EXECUTE ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) TO authenticated;
