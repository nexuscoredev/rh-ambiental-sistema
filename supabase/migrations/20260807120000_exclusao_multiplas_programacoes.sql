-- Permite ver solicitações pendentes (qualquer solicitante) para evitar duplicata
-- e melhora mensagem ao repetir pedido na mesma programação.

DROP POLICY IF EXISTS "solicitacoes_exclusao_select" ON public.solicitacoes_exclusao_operacional;
CREATE POLICY "solicitacoes_exclusao_select"
  ON public.solicitacoes_exclusao_operacional FOR SELECT TO authenticated
  USING (
    solicitante_id = auth.uid()
    OR public.rg_is_thais()
    OR public.rg_is_desenvolvedor_master()
    OR (
      status = 'aguardando'
      AND public._rg_pode_solicitar_exclusao_operacional()
    )
  );

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
  v_rotulo text;
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
    IF v_tipo = 'programacao' THEN
      SELECT coalesce(nullif(trim(p.numero), ''), p.id::text)
      INTO v_rotulo
      FROM public.programacoes p
      WHERE p.id = p_entidade_id;
      RAISE EXCEPTION
        'A programação % já possui solicitação de exclusão pendente na fila da Thais.',
        coalesce(v_rotulo, p_entidade_id::text);
    ELSE
      SELECT coalesce(nullif(trim(m.numero), ''), m.id::text)
      INTO v_rotulo
      FROM public.mtrs m
      WHERE m.id = p_entidade_id;
      RAISE EXCEPTION
        'A MTR % já possui solicitação de exclusão pendente na fila da Thais.',
        coalesce(v_rotulo, p_entidade_id::text);
    END IF;
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
