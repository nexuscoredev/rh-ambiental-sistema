-- Corrige listagem da fila de exclusões: clientes.nome (não existe nome_fantasia).

CREATE OR REPLACE FUNCTION public.listar_solicitacoes_exclusao_operacional(
  p_status text DEFAULT 'aguardando'
)
RETURNS TABLE (
  id uuid,
  tipo_entidade text,
  entidade_id uuid,
  motivo text,
  status text,
  excluir_serie_inteira boolean,
  programacao_serie_id uuid,
  solicitante_id uuid,
  solicitante_nome text,
  entidade_rotulo text,
  entidade_detalhe text,
  criado_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := lower(trim(coalesce(p_status, 'aguardando')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT public.rg_is_thais() AND NOT public.rg_is_desenvolvedor_master() THEN
    RAISE EXCEPTION 'Sem permissão para listar a fila de exclusões.';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.tipo_entidade,
    s.entidade_id,
    s.motivo,
    s.status,
    s.excluir_serie_inteira,
    s.programacao_serie_id,
    s.solicitante_id,
    coalesce(u.nome, u.email, 'Utilizador') AS solicitante_nome,
    CASE
      WHEN s.tipo_entidade = 'programacao' THEN
        coalesce(
          nullif(trim(c.nome), ''),
          nullif(trim(c.razao_social), ''),
          nullif(trim(p.cliente), ''),
          'Cliente'
        )
      WHEN s.tipo_entidade = 'mtr' THEN
        coalesce('MTR ' || nullif(trim(m.numero), ''), 'MTR')
      ELSE '—'
    END AS entidade_rotulo,
    CASE
      WHEN s.tipo_entidade = 'programacao' THEN
        coalesce(
          to_char(p.data_programada, 'DD/MM/YYYY'),
          '—'
        )
        || coalesce(' · ' || nullif(trim(p.tipo_servico), ''), '')
        || CASE WHEN s.excluir_serie_inteira THEN ' · série completa' ELSE '' END
      WHEN s.tipo_entidade = 'mtr' THEN
        coalesce(nullif(trim(m.cliente), ''), '—')
      ELSE '—'
    END AS entidade_detalhe,
    s.criado_em
  FROM public.solicitacoes_exclusao_operacional s
  LEFT JOIN public.usuarios u ON u.id = s.solicitante_id
  LEFT JOIN public.programacoes p ON s.tipo_entidade = 'programacao' AND p.id = s.entidade_id
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  LEFT JOIN public.mtrs m ON s.tipo_entidade = 'mtr' AND m.id = s.entidade_id
  WHERE s.status = v_status
  ORDER BY s.criado_em ASC;
END;
$$;
