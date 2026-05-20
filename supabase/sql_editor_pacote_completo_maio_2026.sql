-- =============================================================================
-- RG Ambiental — Pacote SQL completo (Maio 2026)
-- Executar no Supabase → SQL Editor → Run (uma vez).
-- Idempotente: pode correr de novo sem erro (IF NOT EXISTS / OR REPLACE).
--
-- Inclui:
--   1. Catálogo de resíduos RG-R-029 a RG-R-031
--   2. Vários resíduos por pesagem (residuos_itens + peso tara/bruto/líquido por item)
--   3. Fila de conferência / aprovação do ticket + vista vw_faturamento_resumo
--   4. Sequência do número do ticket + assinatura do motorista
--   5. Suporte técnico no chat (RPC)
--   6. Apagar histórico do chat (Desenvolvedor)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Pré-requisito da vista vw_faturamento_resumo (SLA 3 dias)
-- -----------------------------------------------------------------------------
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS margem_lucro_percentual numeric(7, 2);

CREATE OR REPLACE FUNCTION public.coleta_faturamento_sla_vencido(
  p_created_at timestamptz,
  p_faturamento_registro_status text,
  p_fluxo_status text,
  p_etapa_operacional text
)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT
    p_created_at < (now() - interval '3 days')
    AND COALESCE(btrim(p_faturamento_registro_status), '') <> 'emitido'
    AND NOT (
      COALESCE(btrim(p_fluxo_status), '') IN (
        'ENVIADO_FINANCEIRO',
        'FINALIZADO',
        'FATURADO',
        'LIBERADO_FINANCEIRO'
      )
      OR COALESCE(btrim(p_etapa_operacional), '') IN (
        'ENVIADO_FINANCEIRO',
        'FINALIZADO',
        'FATURADO',
        'LIBERADO_FINANCEIRO'
      )
    );
$$;

-- -----------------------------------------------------------------------------
-- 1) Catálogo de resíduos (dados)
-- -----------------------------------------------------------------------------
INSERT INTO public.residuos (codigo, nome, descricao, grupo, sort_order) VALUES
  (
    'RG-R-029',
    'Mix de resíduos contaminados',
    'Mistura de resíduos com contaminação química ou oleosa',
    'II-A',
    275
  ),
  (
    'RG-R-030',
    'Resíduo comercial classe 1',
    'Resíduos comerciais classe I (não perigosos ou baixo risco operacional)',
    'II-B',
    276
  ),
  (
    'RG-R-031',
    'Resíduo comercial classe 2',
    'Resíduos comerciais classe II (perigosos — NBR 10004)',
    'II-A',
    277
  )
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  grupo = EXCLUDED.grupo,
  sort_order = EXCLUDED.sort_order,
  ativo = true;

-- -----------------------------------------------------------------------------
-- 2) Vários resíduos na pesagem (Controle de Massa)
-- -----------------------------------------------------------------------------
ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS residuos_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.controle_massa
  ADD COLUMN IF NOT EXISTS residuos_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.coletas.residuos_itens IS
  'JSON array: [{ catalogo_id, texto, peso_tara, peso_bruto, peso_liquido }]. Vários resíduos por ticket; colunas peso_* da coleta = soma dos itens.';

COMMENT ON COLUMN public.controle_massa.residuos_itens IS
  'Mesmo formato que coletas.residuos_itens — espelho da pesagem por coleta.';

-- -----------------------------------------------------------------------------
-- 3) Fila de conferência do ticket (Faturamento) + vista consolidada
-- -----------------------------------------------------------------------------
ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS ticket_impresso_em timestamptz,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovado_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovacao_obs text;

COMMENT ON COLUMN public.coletas.ticket_impresso_em IS
  'Preenchido quando o operador imprime/salva o ticket no Controle de Massa; dispara fila de aprovação do Faturamento.';

COMMENT ON COLUMN public.coletas.faturamento_ticket_aprovado_em IS
  'Validação do ticket pelo Faturamento; obrigatório antes de «Faturar» / emitir ao Financeiro.';

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
    WHEN c.mtr_id IS NOT NULL
      AND c.peso_liquido IS NOT NULL
      AND c.peso_liquido > 0
      AND (
        (c.ticket_numero IS NOT NULL AND btrim(c.ticket_numero) <> '')
        OR (ltk.ticket_numero IS NOT NULL AND btrim(ltk.ticket_numero) <> '')
      )
    THEN 'PRONTO_PARA_FATURAR'::text
    ELSE 'PENDENTE'::text
  END AS status_conferencia,
  trim(both ', ' FROM concat_ws(', ',
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
  'Consolidação para faturamento; exige ticket impresso e aprovação do Faturamento antes da fila de emissão.';

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) Número sequencial do ticket + assinatura do motorista
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.ticket_operacional_numero_seq;

DO $$
DECLARE
  mx int;
BEGIN
  SELECT COALESCE(MAX(CAST(NULLIF(TRIM(numero), '') AS int)), 1339)
  INTO mx
  FROM public.tickets_operacionais
  WHERE numero ~ '^[0-9]+$';

  IF mx < 1339 THEN
    mx := 1339;
  END IF;

  PERFORM setval('public.ticket_operacional_numero_seq', mx, true);
END $$;

CREATE OR REPLACE FUNCTION public.next_ticket_operacional_numero()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.ticket_operacional_numero_seq')::text;
$$;

COMMENT ON FUNCTION public.next_ticket_operacional_numero() IS
  'Próximo número de ticket operacional (inteiro como texto). Mantém continuidade com números já gravados; piso operacional 1340.';

GRANT USAGE, SELECT ON SEQUENCE public.ticket_operacional_numero_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_ticket_operacional_numero() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_tickets_operacionais_numero ON public.tickets_operacionais (numero);

ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS assinatura_data_url text;

COMMENT ON COLUMN public.motoristas.assinatura_data_url IS
  'Data URL (PNG) da rubrica/assinatura do motorista para reutilização na conferência de transporte.';

-- -----------------------------------------------------------------------------
-- 5) Suporte técnico no chat
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_resolve_suporte_user_id(p_caller uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_caller IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT u.id INTO v_id
  FROM public.usuarios u
  WHERE lower(coalesce(u.status, '')) = 'ativo'
    AND lower(coalesce(u.cargo, '')) LIKE '%desenvolvedor%'
    AND u.id IS DISTINCT FROM p_caller
  ORDER BY u.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT u.id INTO v_id
  FROM public.usuarios u
  WHERE lower(coalesce(u.status, '')) = 'ativo'
    AND lower(coalesce(u.cargo, '')) LIKE '%administrador%'
    AND u.id IS DISTINCT FROM p_caller
  ORDER BY u.created_at ASC NULLS LAST
  LIMIT 1;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.chat_resolve_suporte_user_id(uuid) IS
  'Resolve utilizador activo para receber pedidos do balão Suporte técnico (Desenvolvedor, depois Administrador).';

GRANT EXECUTE ON FUNCTION public.chat_resolve_suporte_user_id(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) Chat — Desenvolvedor apaga histórico da conversa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rg_is_desenvolvedor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND lower(btrim(coalesce(u.cargo, ''))) LIKE '%desenvolvedor%'
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_admin_apagar_historico_conversa(p_conversa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.rg_is_desenvolvedor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_participantes cp
    WHERE cp.conversa_id = p_conversa_id
      AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  DELETE FROM public.chat_mensagens
  WHERE conversa_id = p_conversa_id;

  UPDATE public.chat_conversas
  SET
    ultima_preview = NULL,
    ultima_em = NULL,
    ultima_remetente_id = NULL,
    updated_at = now()
  WHERE id = p_conversa_id;
END;
$$;

COMMENT ON FUNCTION public.chat_admin_apagar_historico_conversa(uuid) IS
  'Remove mensagens da conversa e limpa preview; anexos do bucket são apagados pela app (Storage API). Apenas Desenvolvedor, participante.';

REVOKE ALL ON FUNCTION public.chat_admin_apagar_historico_conversa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_admin_apagar_historico_conversa(uuid) TO authenticated;

COMMIT;

-- =============================================================================
-- Verificação (opcional — correr depois do COMMIT)
-- =============================================================================
/*
SELECT 'residuos_itens coletas' AS item,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'coletas' AND column_name = 'residuos_itens'
       ) AS ok
UNION ALL
SELECT 'residuos_itens controle_massa',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'controle_massa' AND column_name = 'residuos_itens'
       )
UNION ALL
SELECT 'ticket_impresso_em',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'coletas' AND column_name = 'ticket_impresso_em'
       )
UNION ALL
SELECT 'vw_faturamento_resumo',
       EXISTS (
         SELECT 1 FROM information_schema.views
         WHERE table_schema = 'public' AND table_name = 'vw_faturamento_resumo'
       )
UNION ALL
SELECT 'RG-R-031 no catálogo',
       EXISTS (SELECT 1 FROM public.residuos WHERE codigo = 'RG-R-031');
*/
