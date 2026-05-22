-- =============================================================================
-- Editar peso — Fila de conferência do ticket (Faturamento)
-- Cole TUDO no SQL Editor do Supabase e execute (Run).
-- Depois: F5 na app e tente «Guardar» de novo na coleta.
-- =============================================================================

-- 1) Quem pode ajustar peso na conferência
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

-- 2) Grava peso líquido (coletas + controle_massa) e confirma dentro da RPC
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
  'Fila de conferência do ticket: grava peso líquido na coleta e espelha em controle_massa.';

GRANT EXECUTE ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) TO authenticated;

-- 3) Políticas: Faturamento / Desenvolvedor podem UPDATE em coletas e controle_massa (fallback se RPC falhar)
DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;
CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('desenvolvedor')
    OR public.rg_is_diretoria()
  );

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;
CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('desenvolvedor')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('desenvolvedor')
  );

-- 4) RLS faturamento_registros — Operacional pode atualizar resumo pendente ao editar peso
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

-- =============================================================================
-- Verificação (deve devolver 1 linha):
-- =============================================================================
-- SELECT proname FROM pg_proc
-- WHERE proname IN (
--   'atualizar_peso_liquido_conferencia_ticket',
--   'rg_pode_ajustar_peso_conferencia_ticket'
-- );
