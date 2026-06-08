-- Solicitações de exclusão de programação / MTR — fila de aprovação da Thais.

CREATE TABLE IF NOT EXISTS public.solicitacoes_exclusao_operacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  motivo text NOT NULL,
  solicitante_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aguardando',
  excluir_serie_inteira boolean NOT NULL DEFAULT false,
  programacao_serie_id uuid,
  decidido_em timestamptz,
  decidido_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  motivo_rejeicao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solicitacoes_exclusao_operacional_tipo_check
    CHECK (tipo_entidade IN ('programacao', 'mtr')),
  CONSTRAINT solicitacoes_exclusao_operacional_status_check
    CHECK (status IN ('aguardando', 'aprovado', 'rejeitado')),
  CONSTRAINT solicitacoes_exclusao_operacional_motivo_check
    CHECK (char_length(trim(motivo)) >= 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitacoes_exclusao_pendente_entidade
  ON public.solicitacoes_exclusao_operacional (tipo_entidade, entidade_id)
  WHERE status = 'aguardando';

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exclusao_status_criado
  ON public.solicitacoes_exclusao_operacional (status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exclusao_solicitante
  ON public.solicitacoes_exclusao_operacional (solicitante_id, status);

ALTER TABLE public.solicitacoes_exclusao_operacional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitacoes_exclusao_select" ON public.solicitacoes_exclusao_operacional;
CREATE POLICY "solicitacoes_exclusao_select"
  ON public.solicitacoes_exclusao_operacional FOR SELECT TO authenticated
  USING (
    solicitante_id = auth.uid()
    OR public.rg_is_thais()
    OR public.rg_is_desenvolvedor_master()
  );

GRANT SELECT ON public.solicitacoes_exclusao_operacional TO authenticated;

CREATE OR REPLACE FUNCTION public._rg_pode_solicitar_exclusao_operacional()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_desenvolvedor_master()
      OR public.rg_is_equipe_comercial()
      OR public.rg_rbac_setor_usuario() = 'operacao'
    );
$$;

CREATE OR REPLACE FUNCTION public._excluir_programacao_interno(
  p_programacao_id uuid,
  p_excluir_serie_inteira boolean DEFAULT false,
  p_programacao_serie_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_count integer;
BEGIN
  IF p_programacao_id IS NULL THEN
    RAISE EXCEPTION 'Programação inválida';
  END IF;

  IF p_excluir_serie_inteira AND p_programacao_serie_id IS NOT NULL THEN
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.programacoes p
    WHERE p.programacao_serie_id = p_programacao_serie_id;
  ELSE
    v_ids := ARRAY[p_programacao_id];
  END IF;

  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Programação não encontrada';
  END IF;

  UPDATE public.programacoes
  SET coleta_id = NULL
  WHERE coleta_id IS NOT NULL
    AND id = ANY (v_ids);

  UPDATE public.mtrs
  SET programacao_id = NULL
  WHERE programacao_id = ANY (v_ids);

  DELETE FROM public.programacoes
  WHERE id = ANY (v_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_exclusao_operacional(
  p_tipo_entidade text,
  p_entidade_id uuid,
  p_motivo text,
  p_excluir_serie_inteira boolean DEFAULT false,
  p_programacao_serie_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_tipo text := lower(trim(coalesce(p_tipo_entidade, '')));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT public._rg_pode_solicitar_exclusao_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para solicitar exclusão.';
  END IF;

  IF v_motivo = '' OR char_length(v_motivo) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo da exclusão (mínimo 3 caracteres).';
  END IF;

  IF v_tipo NOT IN ('programacao', 'mtr') THEN
    RAISE EXCEPTION 'Tipo de entidade inválido.';
  END IF;

  IF p_entidade_id IS NULL THEN
    RAISE EXCEPTION 'Entidade inválida.';
  END IF;

  IF v_tipo = 'programacao' THEN
    IF NOT EXISTS (SELECT 1 FROM public.programacoes p WHERE p.id = p_entidade_id) THEN
      RAISE EXCEPTION 'Programação não encontrada.';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.mtrs m WHERE m.id = p_entidade_id) THEN
      RAISE EXCEPTION 'MTR não encontrada.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.solicitacoes_exclusao_operacional s
    WHERE s.tipo_entidade = v_tipo
      AND s.entidade_id = p_entidade_id
      AND s.status = 'aguardando'
  ) THEN
    RAISE EXCEPTION 'Já existe uma solicitação de exclusão pendente para este registro.';
  END IF;

  INSERT INTO public.solicitacoes_exclusao_operacional (
    tipo_entidade,
    entidade_id,
    motivo,
    solicitante_id,
    status,
    excluir_serie_inteira,
    programacao_serie_id
  )
  VALUES (
    v_tipo,
    p_entidade_id,
    v_motivo,
    v_me,
    'aguardando',
    coalesce(p_excluir_serie_inteira, false),
    p_programacao_serie_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

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

  IF NOT public.rg_is_thais() AND NOT public.rg_is_desenvolvedor_master() THEN
    RAISE EXCEPTION 'Apenas a Thais pode aprovar solicitações desta fila.';
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

  IF NOT public.rg_is_thais() AND NOT public.rg_is_desenvolvedor_master() THEN
    RAISE EXCEPTION 'Apenas a Thais pode rejeitar solicitações desta fila.';
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

-- Exclusão direta de programações: apenas Thais (ou dev master) após fluxo de aprovação.
DROP POLICY IF EXISTS "programacoes_delete_thais" ON public.programacoes;
CREATE POLICY "programacoes_delete_thais"
  ON public.programacoes FOR DELETE TO authenticated
  USING (
    public.rg_cargo_vazio_compat()
    OR public.rg_is_desenvolvedor_master()
    OR public.rg_is_thais()
  );

REVOKE ALL ON FUNCTION public.solicitar_exclusao_operacional(text, uuid, text, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aprovar_solicitacao_exclusao_operacional(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rejeitar_solicitacao_exclusao_operacional(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_solicitacoes_exclusao_operacional(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.solicitar_exclusao_operacional(text, uuid, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_solicitacao_exclusao_operacional(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rejeitar_solicitacao_exclusao_operacional(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_solicitacoes_exclusao_operacional(text) TO authenticated;

COMMENT ON TABLE public.solicitacoes_exclusao_operacional IS
  'Fila de aprovação da Thais para exclusão de programações e MTRs solicitadas por comercial/operação.';

COMMENT ON FUNCTION public.solicitar_exclusao_operacional(text, uuid, text, boolean, uuid) IS
  'Comercial/operação solicita exclusão com motivo obrigatório; decisão fica na fila da Thais.';

COMMENT ON FUNCTION public.aprovar_solicitacao_exclusao_operacional(uuid) IS
  'Thais aprova e executa a exclusão (programação ou MTR com dependências).';
