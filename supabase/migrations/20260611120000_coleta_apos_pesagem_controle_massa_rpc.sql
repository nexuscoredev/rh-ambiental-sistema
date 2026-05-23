-- Controle de Massa: atualizar coleta após pesagem (SECURITY DEFINER), alinhado a quem pode lançar pesagem.

CREATE OR REPLACE FUNCTION public.rg_pode_lancar_pesagem_controle_massa()
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
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    );
$$;

CREATE OR REPLACE FUNCTION public.atualizar_coleta_apos_pesagem_controle_massa(
  p_coleta_id uuid,
  p_dados jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
  v_status_processo text;
BEGIN
  IF p_coleta_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta inválida.');
  END IF;

  IF NOT public.rg_pode_lancar_pesagem_controle_massa() THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'message',
      'Sem permissão para atualizar a coleta após a pesagem (perfil ou política RLS).'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coletas c WHERE c.id = p_coleta_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta não encontrada.');
  END IF;

  v_status_processo := NULLIF(btrim(p_dados->>'status_processo'), '');
  IF v_status_processo IS NULL THEN
    v_status_processo := 'EM_CONFERENCIA';
  END IF;

  BEGIN
    UPDATE public.coletas
    SET
      peso_tara = NULLIF(p_dados->>'peso_tara', '')::numeric,
      peso_bruto = NULLIF(p_dados->>'peso_bruto', '')::numeric,
      peso_liquido = NULLIF(p_dados->>'peso_liquido', '')::numeric,
      tipo_residuo = NULLIF(p_dados->>'tipo_residuo', ''),
      residuo_catalogo_id = NULLIF(p_dados->>'residuo_catalogo_id', '')::uuid,
      residuos_itens = COALESCE(p_dados->'residuos_itens', residuos_itens),
      placa = NULLIF(p_dados->>'placa', ''),
      motorista = NULLIF(p_dados->>'motorista', ''),
      motorista_nome = COALESCE(NULLIF(p_dados->>'motorista_nome', ''), NULLIF(p_dados->>'motorista', '')),
      data_execucao = NULLIF(p_dados->>'data_execucao', '')::date,
      data_agendada = COALESCE(
        NULLIF(p_dados->>'data_agendada', '')::date,
        NULLIF(p_dados->>'data_execucao', '')::date
      ),
      fluxo_status = NULLIF(p_dados->>'fluxo_status', ''),
      etapa_operacional = NULLIF(p_dados->>'etapa_operacional', ''),
      status_processo = v_status_processo,
      liberado_financeiro = COALESCE((p_dados->>'liberado_financeiro')::boolean, false)
    WHERE id = p_coleta_id;
  EXCEPTION
    WHEN undefined_column THEN
      UPDATE public.coletas
      SET
        peso_tara = NULLIF(p_dados->>'peso_tara', '')::numeric,
        peso_bruto = NULLIF(p_dados->>'peso_bruto', '')::numeric,
        peso_liquido = NULLIF(p_dados->>'peso_liquido', '')::numeric,
        tipo_residuo = NULLIF(p_dados->>'tipo_residuo', ''),
        placa = NULLIF(p_dados->>'placa', ''),
        motorista = NULLIF(p_dados->>'motorista', ''),
        data_execucao = NULLIF(p_dados->>'data_execucao', '')::date,
        data_agendada = COALESCE(
          NULLIF(p_dados->>'data_agendada', '')::date,
          NULLIF(p_dados->>'data_execucao', '')::date
        ),
        fluxo_status = NULLIF(p_dados->>'fluxo_status', ''),
        etapa_operacional = NULLIF(p_dados->>'etapa_operacional', '')
      WHERE id = p_coleta_id;
    WHEN check_violation THEN
      UPDATE public.coletas
      SET
        peso_tara = NULLIF(p_dados->>'peso_tara', '')::numeric,
        peso_bruto = NULLIF(p_dados->>'peso_bruto', '')::numeric,
        peso_liquido = NULLIF(p_dados->>'peso_liquido', '')::numeric,
        tipo_residuo = NULLIF(p_dados->>'tipo_residuo', ''),
        placa = NULLIF(p_dados->>'placa', ''),
        motorista = NULLIF(p_dados->>'motorista', ''),
        data_execucao = NULLIF(p_dados->>'data_execucao', '')::date,
        data_agendada = COALESCE(
          NULLIF(p_dados->>'data_agendada', '')::date,
          NULLIF(p_dados->>'data_execucao', '')::date
        ),
        fluxo_status = NULLIF(p_dados->>'fluxo_status', ''),
        etapa_operacional = NULLIF(p_dados->>'etapa_operacional', '')
      WHERE id = p_coleta_id;
  END;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível atualizar a coleta.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.atualizar_coleta_apos_pesagem_controle_massa(uuid, jsonb) IS
  'Controle de Massa: espelha peso/resíduo/placa e etapa do fluxo na coleta após gravar pesagem.';

GRANT EXECUTE ON FUNCTION public.atualizar_coleta_apos_pesagem_controle_massa(uuid, jsonb) TO authenticated;

-- Política de UPDATE alinhada (inclui Time T e Desenvolvedor).
DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;
CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_is_diretoria()
  );
