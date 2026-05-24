-- Exclusão de O.S. clínica (apenas antes da emissão no faturamento).

CREATE OR REPLACE FUNCTION public.excluir_clinica_ordem_servico(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ordem_id IS NULL THEN
    RAISE EXCEPTION 'O.S. inválida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinicas_ordens_servico
    WHERE id = p_ordem_id AND status = 'aguardando_faturamento'
  ) THEN
    RAISE EXCEPTION 'Só é possível excluir O.S. que ainda aguardam faturamento (não emitidas).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contas_receber WHERE referencia_clinica_os_id = p_ordem_id
  ) THEN
    RAISE EXCEPTION 'O.S. já possui conta a receber — não pode ser excluída.';
  END IF;

  DELETE FROM public.clinicas_faturamento_registros WHERE ordem_servico_id = p_ordem_id;
  DELETE FROM public.clinicas_ordens_servico WHERE id = p_ordem_id;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_clinica_ordem_servico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_clinica_ordem_servico(uuid) TO authenticated;
