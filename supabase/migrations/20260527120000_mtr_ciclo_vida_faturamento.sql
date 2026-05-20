-- Ciclo de vida MTR: cancelamento (frete opcional), baixa com justificativa, rateio de cobrança, histórico de tickets.

-- ---------------------------------------------------------------------------
-- Colunas em mtrs
-- ---------------------------------------------------------------------------
ALTER TABLE public.mtrs
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelamento_justificativa text,
  ADD COLUMN IF NOT EXISTS cancelamento_cobrar_frete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelamento_valor_frete numeric(12, 2),
  ADD COLUMN IF NOT EXISTS cancelamento_cliente_cobranca_id uuid REFERENCES public.clientes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baixada_em timestamptz,
  ADD COLUMN IF NOT EXISTS baixada_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baixa_justificativa text,
  ADD COLUMN IF NOT EXISTS baixa_cenario_complexo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mtrs.cancelamento_cobrar_frete IS
  'MTR cancelada no local sem coleta: cobrar frete/custo operacional do cliente indicado.';
COMMENT ON COLUMN public.mtrs.baixa_justificativa IS
  'Obrigatória ao concluir baixa do sistema (status Baixada).';
COMMENT ON COLUMN public.mtrs.baixa_cenario_complexo IS
  'Coleta de um cliente e cobrança rateada para outros (ver mtr_cobranca_rateio).';

-- ---------------------------------------------------------------------------
-- Histórico de tickets (arquivados na cancelação sem custo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets_operacionais_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coleta_id uuid NOT NULL REFERENCES public.coletas (id) ON DELETE CASCADE,
  mtr_id uuid REFERENCES public.mtrs (id) ON DELETE SET NULL,
  ticket_snapshot jsonb NOT NULL,
  motivo text NOT NULL DEFAULT 'mtr_cancelada',
  arquivado_em timestamptz NOT NULL DEFAULT now(),
  arquivado_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reativado_em timestamptz,
  reativado_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tickets_operacionais_historico_mtr_idx
  ON public.tickets_operacionais_historico (mtr_id)
  WHERE reativado_em IS NULL;

CREATE INDEX IF NOT EXISTS tickets_operacionais_historico_coleta_idx
  ON public.tickets_operacionais_historico (coleta_id);

ALTER TABLE public.tickets_operacionais_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tickets_operacionais_historico_select ON public.tickets_operacionais_historico;
CREATE POLICY tickets_operacionais_historico_select ON public.tickets_operacionais_historico
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tickets_operacionais_historico_insert ON public.tickets_operacionais_historico;
CREATE POLICY tickets_operacionais_historico_insert ON public.tickets_operacionais_historico
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS tickets_operacionais_historico_update ON public.tickets_operacionais_historico;
CREATE POLICY tickets_operacionais_historico_update ON public.tickets_operacionais_historico
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Rateio de cobrança (MTR baixada — cenário complexo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mtr_cobranca_rateio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mtr_id uuid NOT NULL REFERENCES public.mtrs (id) ON DELETE CASCADE,
  coleta_id uuid REFERENCES public.coletas (id) ON DELETE CASCADE,
  cliente_coleta_id uuid REFERENCES public.clientes (id) ON DELETE SET NULL,
  cliente_cobranca_id uuid NOT NULL REFERENCES public.clientes (id) ON DELETE RESTRICT,
  percentual numeric(7, 4),
  valor numeric(12, 2),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT mtr_cobranca_rateio_pct_ou_valor_chk CHECK (
    (percentual IS NOT NULL AND percentual > 0 AND percentual <= 100)
    OR (valor IS NOT NULL AND valor > 0)
  )
);

CREATE INDEX IF NOT EXISTS mtr_cobranca_rateio_mtr_idx ON public.mtr_cobranca_rateio (mtr_id);

ALTER TABLE public.mtr_cobranca_rateio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mtr_cobranca_rateio_select ON public.mtr_cobranca_rateio;
CREATE POLICY mtr_cobranca_rateio_select ON public.mtr_cobranca_rateio
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mtr_cobranca_rateio_mutate ON public.mtr_cobranca_rateio;
CREATE POLICY mtr_cobranca_rateio_mutate ON public.mtr_cobranca_rateio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._rg_pode_mutar_mtr_ciclo_vida()
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
      OR public.rg_cargo_like('operacional (time t)')
      OR public.rg_cargo_like('gerente do time')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
    );
$$;

CREATE OR REPLACE FUNCTION public._mtr_tem_custos_atrelados(p_mtr_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coletas c
    WHERE c.mtr_id = p_mtr_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.faturamento_registros fr
          WHERE fr.coleta_id = c.id
            AND fr.status = 'emitido'
            AND COALESCE(fr.valor, 0) > 0
        )
        OR EXISTS (
          SELECT 1
          FROM public.contas_receber cr
          WHERE cr.referencia_coleta_id = c.id
            AND COALESCE(cr.valor, 0) > 0
            AND cr.status_pagamento IS DISTINCT FROM 'Cancelado'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public._arquivar_tickets_coletas_mtr(
  p_mtr_id uuid,
  p_motivo text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coleta_id uuid;
  v_ticket record;
BEGIN
  FOR v_coleta_id IN
    SELECT c.id FROM public.coletas c WHERE c.mtr_id = p_mtr_id
  LOOP
    FOR v_ticket IN
      SELECT t.*
      FROM public.tickets_operacionais t
      WHERE t.coleta_id = v_coleta_id
    LOOP
      INSERT INTO public.tickets_operacionais_historico (
        coleta_id,
        mtr_id,
        ticket_snapshot,
        motivo,
        arquivado_por_user_id
      )
      VALUES (
        v_coleta_id,
        p_mtr_id,
        to_jsonb(v_ticket),
        COALESCE(NULLIF(btrim(p_motivo), ''), 'mtr_cancelada'),
        p_user_id
      );
    END LOOP;
    DELETE FROM public.tickets_operacionais WHERE coleta_id = v_coleta_id;
    UPDATE public.coletas
    SET
      ticket_impresso_em = NULL,
      faturamento_ticket_aprovado_em = NULL,
      faturamento_ticket_aprovado_por_user_id = NULL,
      faturamento_ticket_aprovacao_obs = NULL,
      fluxo_status = 'CANCELADA',
      etapa_operacional = 'CANCELADA'
    WHERE id = v_coleta_id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar MTR
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_mtr_por_id(
  p_mtr_id uuid,
  p_justificativa text,
  p_cobrar_frete boolean DEFAULT false,
  p_valor_frete numeric DEFAULT NULL,
  p_cliente_cobranca_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tem_custos boolean;
  v_coleta_id uuid;
BEGIN
  IF NOT public._rg_pode_mutar_mtr_ciclo_vida() THEN
    RAISE EXCEPTION 'Sem permissão para cancelar MTR.';
  END IF;

  IF p_justificativa IS NULL OR btrim(p_justificativa) = '' THEN
    RAISE EXCEPTION 'Justificativa de cancelamento é obrigatória.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mtrs WHERE id = p_mtr_id) THEN
    RAISE EXCEPTION 'MTR não encontrada.';
  END IF;

  v_tem_custos := public._mtr_tem_custos_atrelados(p_mtr_id);

  IF v_tem_custos THEN
    UPDATE public.mtrs
    SET
      status = 'Cancelado',
      cancelada_em = now(),
      cancelada_por_user_id = v_user,
      cancelamento_justificativa = btrim(p_justificativa),
      cancelamento_cobrar_frete = COALESCE(p_cobrar_frete, false),
      cancelamento_valor_frete = p_valor_frete,
      cancelamento_cliente_cobranca_id = p_cliente_cobranca_id
    WHERE id = p_mtr_id;

    FOR v_coleta_id IN SELECT c.id FROM public.coletas c WHERE c.mtr_id = p_mtr_id
    LOOP
      UPDATE public.faturamento_registros
      SET status = 'cancelado', updated_at = now()
      WHERE coleta_id = v_coleta_id AND status = 'pendente';

      UPDATE public.contas_receber
      SET status_pagamento = 'Cancelado'
      WHERE referencia_coleta_id = v_coleta_id
        AND status_pagamento NOT IN ('Pago', 'Cancelado');
    END LOOP;
  ELSE
    PERFORM public._arquivar_tickets_coletas_mtr(p_mtr_id, 'mtr_cancelada_sem_custo', v_user);

    UPDATE public.mtrs
    SET
      status = 'Cancelado',
      cancelada_em = now(),
      cancelada_por_user_id = v_user,
      cancelamento_justificativa = btrim(p_justificativa),
      cancelamento_cobrar_frete = COALESCE(p_cobrar_frete, false),
      cancelamento_valor_frete = p_valor_frete,
      cancelamento_cliente_cobranca_id = p_cliente_cobranca_id
    WHERE id = p_mtr_id;
  END IF;

  IF COALESCE(p_cobrar_frete, false) AND COALESCE(p_valor_frete, 0) > 0 AND p_cliente_cobranca_id IS NOT NULL THEN
    FOR v_coleta_id IN SELECT c.id FROM public.coletas c WHERE c.mtr_id = p_mtr_id LIMIT 1
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.faturamento_registros fr
        WHERE fr.coleta_id = v_coleta_id AND fr.referencia_nf = 'FRETE-MTR-CANCELADA'
      ) THEN
        INSERT INTO public.faturamento_registros (coleta_id, valor, status, referencia_nf)
        VALUES (v_coleta_id, p_valor_frete, 'pendente', 'FRETE-MTR-CANCELADA');
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Baixar MTR (obrigatório justificativa)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.baixar_mtr_por_id(
  p_mtr_id uuid,
  p_justificativa text,
  p_cenario_complexo boolean DEFAULT false,
  p_rateio jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_pct numeric;
  v_val numeric;
BEGIN
  IF NOT public._rg_pode_mutar_mtr_ciclo_vida() THEN
    RAISE EXCEPTION 'Sem permissão para baixar MTR.';
  END IF;

  IF p_justificativa IS NULL OR btrim(p_justificativa) = '' THEN
    RAISE EXCEPTION 'Justificativa/observação é obrigatória para concluir a baixa.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mtrs WHERE id = p_mtr_id) THEN
    RAISE EXCEPTION 'MTR não encontrada.';
  END IF;

  UPDATE public.mtrs
  SET
    status = 'Baixada',
    baixada_em = now(),
    baixada_por_user_id = v_user,
    baixa_justificativa = btrim(p_justificativa),
    baixa_cenario_complexo = COALESCE(p_cenario_complexo, false)
  WHERE id = p_mtr_id;

  DELETE FROM public.mtr_cobranca_rateio WHERE mtr_id = p_mtr_id;

  IF COALESCE(p_cenario_complexo, false) AND jsonb_array_length(COALESCE(p_rateio, '[]'::jsonb)) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_rateio)
    LOOP
      v_pct := NULLIF((v_item->>'percentual')::numeric, 0);
      v_val := NULLIF((v_item->>'valor')::numeric, 0);
      INSERT INTO public.mtr_cobranca_rateio (
        mtr_id,
        coleta_id,
        cliente_coleta_id,
        cliente_cobranca_id,
        percentual,
        valor,
        observacao,
        created_by
      )
      VALUES (
        p_mtr_id,
        NULLIF(v_item->>'coleta_id', '')::uuid,
        NULLIF(v_item->>'cliente_coleta_id', '')::uuid,
        (v_item->>'cliente_cobranca_id')::uuid,
        v_pct,
        v_val,
        NULLIF(btrim(v_item->>'observacao'), ''),
        v_user
      );
    END LOOP;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reativar ticket do histórico
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reativar_ticket_historico(p_historico_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tickets_operacionais_historico%ROWTYPE;
  v_snap jsonb;
  v_new_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF NOT public._rg_pode_mutar_mtr_ciclo_vida() THEN
    RAISE EXCEPTION 'Sem permissão para reativar ticket.';
  END IF;

  SELECT * INTO v_row
  FROM public.tickets_operacionais_historico
  WHERE id = p_historico_id AND reativado_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Histórico de ticket não encontrado ou já reativado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tickets_operacionais WHERE coleta_id = v_row.coleta_id
  ) THEN
    RAISE EXCEPTION 'Já existe ticket ativo para esta coleta.';
  END IF;

  v_snap := v_row.ticket_snapshot;

  INSERT INTO public.tickets_operacionais (coleta_id, numero, descricao, tipo_ticket, created_by)
  VALUES (
    v_row.coleta_id,
    COALESCE(v_snap->>'numero', ''),
    COALESCE(v_snap->>'descricao', ''),
    COALESCE(v_snap->>'tipo_ticket', 'saida'),
    COALESCE((v_snap->>'created_by')::uuid, v_user)
  )
  RETURNING id INTO v_new_id;

  UPDATE public.tickets_operacionais_historico
  SET reativado_em = now(), reativado_por_user_id = v_user
  WHERE id = p_historico_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_mtr_por_id(uuid, text, boolean, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_mtr_por_id(uuid, text, boolean, numeric, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.baixar_mtr_por_id(uuid, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.baixar_mtr_por_id(uuid, text, boolean, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.reativar_ticket_historico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reativar_ticket_historico(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- View faturamento: expor status MTR e bloquear canceladas
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.vw_faturamento_resumo CASCADE;

CREATE VIEW public.vw_faturamento_resumo
WITH (security_invoker = true) AS
SELECT
  c.id AS coleta_id,
  c.numero,
  c.numero_coleta,
  c.cliente_id,
  COALESCE(cl.nome, c.cliente) AS cliente_nome,
  cl.razao_social AS cliente_razao_social,
  cl.margem_lucro_percentual AS cliente_margem_lucro_percentual,
  c.data_agendada,
  COALESCE(p.data_programada, c.data_agendada) AS data_programacao,
  c.data_coleta AS data_execucao,
  c.programacao_id,
  p.numero AS programacao_numero,
  p.observacoes AS programacao_observacoes,
  c.mtr_id,
  m.numero AS mtr_numero,
  m.observacoes AS mtr_observacoes,
  m.status AS mtr_status,
  m.cancelamento_cobrar_frete AS mtr_cancelamento_cobrar_frete,
  m.cancelamento_valor_frete AS mtr_cancelamento_valor_frete,
  m.baixa_cenario_complexo AS mtr_baixa_cenario_complexo,
  m.baixa_justificativa AS mtr_baixa_justificativa,
  COALESCE(
    NULLIF(btrim(c.ticket_numero), ''),
    ltk.ticket_numero
  ) AS ticket_comprovante,
  c.peso_tara,
  c.peso_bruto,
  c.peso_liquido,
  COALESCE(c.motorista_nome, c.motorista) AS motorista,
  c.placa,
  c.valor_coleta,
  c.status_pagamento,
  c.data_vencimento,
  COALESCE(c.numero_nf, lfr.referencia_nf) AS referencia_nf,
  c.numero_nf AS numero_nf_coleta,
  lfr.referencia_nf AS faturamento_referencia_nf,
  lfr.status AS faturamento_registro_status,
  lfr.valor AS faturamento_registro_valor,
  c.confirmacao_recebimento,
  c.fluxo_status,
  c.etapa_operacional,
  c.status_processo,
  c.liberado_financeiro,
  c.observacoes AS coleta_observacoes,
  c.tipo_residuo,
  c.cidade,
  c.created_at,
  c.ticket_impresso_em,
  c.faturamento_ticket_aprovado_em,
  c.faturamento_ticket_aprovacao_obs,
  la.decisao AS ultima_aprovacao_decisao,
  la.observacoes AS ultima_aprovacao_obs,
  la.decidido_em AS ultima_aprovacao_em,
  lco.documentos_ok AS conferencia_documentos_ok,
  lco.observacoes AS conferencia_operacional_obs,
  lco.conferido_em AS conferencia_em,
  lcr.nf_enviada_em AS conta_receber_nf_enviada_em,
  lcr.nf_envio_observacao AS conta_receber_nf_envio_obs,
  lcr.valor_pago AS conta_receber_valor_pago,
  lcr.valor_travado AS conta_receber_valor_travado,
  CASE
    WHEN m.status = 'Cancelado' THEN 'MTR_CANCELADA'::text
    WHEN c.mtr_id IS NOT NULL
      AND c.peso_liquido IS NOT NULL
      AND c.peso_liquido > 0
      AND (
        (c.ticket_numero IS NOT NULL AND btrim(c.ticket_numero) <> '')
        OR (ltk.ticket_numero IS NOT NULL AND btrim(ltk.ticket_numero) <> '')
      )
      AND (m.status IS NULL OR m.status NOT IN ('Cancelado'))
    THEN 'PRONTO_PARA_FATURAR'::text
    ELSE 'PENDENTE'::text
  END AS status_conferencia,
  trim(both ', ' FROM concat_ws(', ',
    CASE WHEN m.status = 'Cancelado' THEN 'MTR cancelada' END,
    CASE WHEN m.status = 'Baixada' AND COALESCE(m.baixa_cenario_complexo, false) THEN 'MTR baixada (rateio)' END,
    CASE WHEN c.mtr_id IS NULL THEN 'sem MTR' END,
    CASE WHEN c.peso_liquido IS NULL OR c.peso_liquido <= 0 THEN 'sem peso líquido' END,
    CASE
      WHEN (c.ticket_numero IS NULL OR btrim(c.ticket_numero) = '')
        AND (ltk.ticket_numero IS NULL OR btrim(ltk.ticket_numero) = '')
      THEN 'sem ticket'
    END,
    CASE
      WHEN c.ticket_impresso_em IS NULL
        AND (
          (c.ticket_numero IS NOT NULL AND btrim(c.ticket_numero) <> '')
          OR (ltk.ticket_numero IS NOT NULL AND btrim(ltk.ticket_numero) <> '')
        )
      THEN 'ticket não impresso'
    END,
    CASE
      WHEN c.ticket_impresso_em IS NOT NULL
        AND c.faturamento_ticket_aprovado_em IS NULL
      THEN 'aguardando aprovação do Faturamento'
    END,
    CASE WHEN c.valor_coleta IS NULL OR c.valor_coleta <= 0 THEN 'sem valor' END
  )) AS pendencias_resumo,
  public.coleta_faturamento_sla_vencido(
    c.created_at,
    lfr.status,
    c.fluxo_status,
    c.etapa_operacional
  ) AS faturamento_sla_vencido,
  c.status_pagamento AS status_faturamento
FROM public.coletas c
LEFT JOIN public.clientes cl ON cl.id = c.cliente_id
LEFT JOIN public.programacoes p ON p.id = c.programacao_id
LEFT JOIN public.mtrs m ON m.id = c.mtr_id
LEFT JOIN LATERAL (
  SELECT t.numero AS ticket_numero
  FROM public.tickets_operacionais t
  WHERE t.coleta_id = c.id
  ORDER BY t.created_at DESC NULLS LAST, t.id DESC
  LIMIT 1
) ltk ON true
LEFT JOIN LATERAL (
  SELECT ad.decisao, ad.observacoes, ad.decidido_em
  FROM public.aprovacoes_diretoria ad
  WHERE ad.coleta_id = c.id
  ORDER BY ad.decidido_em DESC NULLS LAST, ad.id DESC
  LIMIT 1
) la ON true
LEFT JOIN LATERAL (
  SELECT fr.status, fr.referencia_nf, fr.valor
  FROM public.faturamento_registros fr
  WHERE fr.coleta_id = c.id
  ORDER BY fr.updated_at DESC NULLS LAST, fr.id DESC
  LIMIT 1
) lfr ON true
LEFT JOIN LATERAL (
  SELECT co.documentos_ok, co.observacoes, co.conferido_em
  FROM public.conferencia_operacional co
  WHERE co.coleta_id = c.id
  ORDER BY co.conferido_em DESC NULLS LAST, co.id DESC
  LIMIT 1
) lco ON true
LEFT JOIN LATERAL (
  SELECT cr.nf_enviada_em, cr.nf_envio_observacao, cr.valor_pago, cr.valor_travado
  FROM public.contas_receber cr
  WHERE cr.referencia_coleta_id = c.id
  LIMIT 1
) lcr ON true;

COMMENT ON VIEW public.vw_faturamento_resumo IS
  'Faturamento; inclui status MTR (Cancelado/Baixada/rateio) e regras de elegibilidade.';

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;
