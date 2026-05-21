-- Última pesagem por coleta (Controle de Massa): uma linha por coleta_id via DISTINCT ON,
-- em vez de varrer milhares de linhas no cliente.

CREATE OR REPLACE FUNCTION public.ultima_pesagem_por_coleta_ids(p_ids uuid[])
RETURNS TABLE (
  coleta_id uuid,
  data date,
  hora_entrada time,
  hora_saida time
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (cm.coleta_id)
    cm.coleta_id,
    cm.data,
    cm.hora_entrada,
    cm.hora_saida
  FROM public.controle_massa cm
  WHERE cm.coleta_id = ANY (p_ids)
  ORDER BY cm.coleta_id, cm.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.ultima_pesagem_por_coleta_ids(uuid[]) IS
  'Retorna a pesagem mais recente (por created_at) de cada coleta_id informado.';

GRANT EXECUTE ON FUNCTION public.ultima_pesagem_por_coleta_ids(uuid[]) TO authenticated;
