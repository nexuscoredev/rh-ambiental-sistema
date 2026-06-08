-- Desenvolvedor pode listar/aprovar/rejeitar fila; rótulo da programação com número.

CREATE OR REPLACE FUNCTION public.rg_pode_decidir_fila_exclusao_operacional()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_thais()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master();
$$;

GRANT EXECUTE ON FUNCTION public.rg_pode_decidir_fila_exclusao_operacional() TO authenticated;

CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_exclusao_operacional(
  p_solicitacao_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.solicitacoes_exclusao_operacional%ROWTYPE;
  v_qtd integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT public.rg_pode_decidir_fila_exclusao_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações desta fila.';
  END IF;

  SELECT s.*
  INTO v_row
  FROM public.solicitacoes_exclusao_operacional s
  WHERE s.id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já foi decidida.';
  END IF;

  IF v_row.tipo_entidade = 'programacao' THEN
    v_qtd := public._excluir_programacao_interno(
      v_row.entidade_id,
      v_row.excluir_serie_inteira,
      v_row.programacao_serie_id
    );
    IF coalesce(v_qtd, 0) < 1 THEN
      RAISE EXCEPTION 'Nenhuma programação foi removida.';
    END IF;
  ELSIF v_row.tipo_entidade = 'mtr' THEN
    PERFORM public.excluir_mtr_por_id(v_row.entidade_id);
  ELSE
    RAISE EXCEPTION 'Tipo de entidade inválido.';
  END IF;

  UPDATE public.solicitacoes_exclusao_operacional
  SET
    status = 'aprovado',
    decidido_em = now(),
    decidido_por = v_me
  WHERE id = p_solicitacao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rejeitar_solicitacao_exclusao_operacional(
  p_solicitacao_id uuid,
  p_motivo_rejeicao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.solicitacoes_exclusao_operacional%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT public.rg_pode_decidir_fila_exclusao_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar solicitações desta fila.';
  END IF;

  SELECT s.*
  INTO v_row
  FROM public.solicitacoes_exclusao_operacional s
  WHERE s.id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já foi decidida.';
  END IF;

  UPDATE public.solicitacoes_exclusao_operacional
  SET
    status = 'rejeitado',
    decidido_em = now(),
    decidido_por = v_me,
    motivo_rejeicao = nullif(trim(coalesce(p_motivo_rejeicao, '')), '')
  WHERE id = p_solicitacao_id;
END;
$$;

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

  IF NOT public.rg_pode_decidir_fila_exclusao_operacional() THEN
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
        coalesce(nullif(trim(m.cliente), ''), 'MTR')
      ELSE '—'
    END AS entidade_rotulo,
    CASE
      WHEN s.tipo_entidade = 'programacao' THEN
        trim(both ' · ' from concat_ws(
          ' · ',
          CASE
            WHEN nullif(trim(p.numero), '') IS NOT NULL THEN 'Nº ' || trim(p.numero)
            ELSE NULL
          END,
          to_char(p.data_programada, 'DD/MM/YYYY'),
          nullif(trim(p.tipo_servico), ''),
          CASE WHEN s.excluir_serie_inteira THEN 'série completa' ELSE NULL END
        ))
      WHEN s.tipo_entidade = 'mtr' THEN
        coalesce('Nº ' || nullif(trim(m.numero), ''), 'MTR')
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
