-- Exclusão em lote de MTR/coleta sem timeout (evita CASCADE lento via PostgREST + RLS por linha).
-- Aplicar: npm run db:apply:sql -- supabase/migrations/20260520140000_excluir_mtr_coleta_cascata.sql

CREATE OR REPLACE FUNCTION public._rg_pode_excluir_operacional_mtr()
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
      OR public.rg_cargo_like('desenvolvedor')
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
    );
$$;

CREATE OR REPLACE FUNCTION public._excluir_dependencias_coleta_ids(p_coleta_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_coleta_ids IS NULL OR cardinality(p_coleta_ids) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.programacoes
  SET coleta_id = NULL
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.contas_receber
  WHERE referencia_coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.faturamento_registros
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.financeiro_documentos
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.checklist_transporte
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.conferencia_transporte
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.tickets_operacionais
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.conferencia_operacional
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.aprovacoes_diretoria
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.controle_massa
  WHERE coleta_id = ANY (p_coleta_ids);

  UPDATE public.comprovantes_descarte
  SET
    coleta_id = NULL,
    controle_massa_id = NULL
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.coletas
  WHERE id = ANY (p_coleta_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_coleta_por_id(p_coleta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_coleta_id IS NULL THEN
    RAISE EXCEPTION 'Coleta inválida';
  END IF;

  IF NOT public._rg_pode_excluir_operacional_mtr() THEN
    RAISE EXCEPTION 'Sem permissão para excluir coleta';
  END IF;

  PERFORM public._excluir_dependencias_coleta_ids(ARRAY[p_coleta_id]);
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_mtr_por_id(p_mtr_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coleta_ids uuid[];
  v_prog_id uuid;
BEGIN
  IF p_mtr_id IS NULL THEN
    RAISE EXCEPTION 'MTR inválida';
  END IF;

  IF NOT public._rg_pode_excluir_operacional_mtr() THEN
    RAISE EXCEPTION 'Sem permissão para excluir MTR';
  END IF;

  SELECT coalesce(array_agg(c.id), ARRAY[]::uuid[])
  INTO v_coleta_ids
  FROM public.coletas c
  WHERE c.mtr_id = p_mtr_id;

  SELECT m.programacao_id
  INTO v_prog_id
  FROM public.mtrs m
  WHERE m.id = p_mtr_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MTR não encontrada';
  END IF;

  PERFORM public._excluir_dependencias_coleta_ids(v_coleta_ids);

  UPDATE public.comprovantes_descarte
  SET mtr_id = NULL
  WHERE mtr_id = p_mtr_id;

  DELETE FROM public.mtrs
  WHERE id = p_mtr_id;

  IF v_prog_id IS NOT NULL THEN
    UPDATE public.programacoes
    SET status_programacao = 'PENDENTE'
    WHERE id = v_prog_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_mtr_por_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_coleta_por_id(uuid) TO authenticated;

COMMENT ON FUNCTION public.excluir_mtr_por_id(uuid) IS
  'Remove MTR e coletas vinculadas (dependências operacionais/financeiras) numa única transação.';

COMMENT ON FUNCTION public.excluir_coleta_por_id(uuid) IS
  'Remove coleta e dependências operacionais/financeiras numa única transação.';
