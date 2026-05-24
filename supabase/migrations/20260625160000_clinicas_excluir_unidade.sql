-- Exclusão de unidade de clínica (cadastro filho).
-- Bloqueia se houver O.S. emitida; remove O.S. pendentes antes de apagar a unidade.

CREATE OR REPLACE FUNCTION public.excluir_clinica_unidade(p_unidade_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  os_id uuid;
BEGIN
  IF p_unidade_id IS NULL THEN
    RAISE EXCEPTION 'Unidade inválida.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clinicas_unidades WHERE id = p_unidade_id) THEN
    RAISE EXCEPTION 'Unidade não encontrada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinicas_ordens_servico
    WHERE unidade_id = p_unidade_id AND status = 'emitida'
  ) THEN
    RAISE EXCEPTION
      'Esta unidade possui O.S. já faturadas. Edite o cadastro e marque como inativa em vez de excluir.';
  END IF;

  FOR os_id IN
    SELECT id FROM public.clinicas_ordens_servico
    WHERE unidade_id = p_unidade_id AND status = 'aguardando_faturamento'
  LOOP
    PERFORM public.excluir_clinica_ordem_servico(os_id);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.clinicas_ordens_servico WHERE unidade_id = p_unidade_id
  ) THEN
    RAISE EXCEPTION
      'Unidade ainda possui ordens de serviço no histórico e não pode ser excluída.';
  END IF;

  DELETE FROM public.clinicas_unidades WHERE id = p_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_clinica_unidade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_clinica_unidade(uuid) TO authenticated;
