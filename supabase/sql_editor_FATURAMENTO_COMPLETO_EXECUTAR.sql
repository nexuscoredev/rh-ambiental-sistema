-- =============================================================================
-- RG Ambiental — SQL COMPLETO para o Supabase SQL Editor (copiar e executar de uma vez)
--
-- Inclui tudo o que falhou ou ficou pendente nas conversas recentes:
--   • Esteira (AJUSTE_VALORES → medição → Mala Direta → faturar → NF → finalizado)
--   • View vw_faturamento_resumo
--   • Função rg_is_operacional_time_t (corrige erro 42883)
--   • RPC atualizar_peso_liquido_conferencia_ticket (editar peso na conferência)
--   • RLS coletas / controle_massa / contas_receber (Time T + Faturamento)
--
-- COMO USAR:
--   1. Abra SQL Editor → New query
--   2. Cole TODO este ficheiro
--   3. Run (uma vez)
--
-- Se a VIEW falhar em m.baixa_cenario_complexo, aplique antes no projeto:
--   supabase/migrations/20260527120000_mtr_ciclo_vida_faturamento.sql
--
-- Idempotente: pode executar mais de uma vez.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0) Funções de cargo (dependências — inclui rg_is_operacional_time_t)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rg_user_cargo()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT u.cargo FROM public.usuarios u WHERE u.id = auth.uid()), '');
$$;

CREATE OR REPLACE FUNCTION public.rg_cargo_like(p text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(public.rg_user_cargo()) LIKE '%' || lower(coalesce(p, '')) || '%';
$$;

CREATE OR REPLACE FUNCTION public.rg_cargo_vazio_compat()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT btrim(public.rg_user_cargo()) = '';
$$;

CREATE OR REPLACE FUNCTION public.rg_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_cargo_like('administrador');
$$;

CREATE OR REPLACE FUNCTION public.rg_is_diretoria()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_cargo_like('diretoria') OR public.rg_cargo_like('diretor');
$$;

CREATE OR REPLACE FUNCTION public.rg_is_visualizador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_cargo_like('visualizador');
$$;

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

CREATE OR REPLACE FUNCTION public.rg_is_operacional_time_t()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_cargo_like('operacional')
    AND (
      public.rg_cargo_like('time t')
      OR public.rg_cargo_like('thais')
      OR public.rg_cargo_like('operacional time thais')
    )
    OR (
      public.rg_cargo_like('gerente')
      AND public.rg_cargo_like('time')
    )
    OR lower(btrim(public.rg_user_cargo())) = 'gerente time';
$$;

-- Colunas para peso por item (RPC de peso na conferência)
ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS residuos_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.controle_massa
  ADD COLUMN IF NOT EXISTS residuos_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

-- SLA na view (se ainda não existir em produção)
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
SET search_path = public
AS $$
  SELECT
    p_created_at < (now() - interval '3 days')
    AND COALESCE(btrim(p_faturamento_registro_status), '') <> 'emitido'
    AND NOT (
      COALESCE(btrim(p_fluxo_status), '') IN (
        'ENVIADO_FINANCEIRO', 'FINALIZADO', 'FATURADO', 'LIBERADO_FINANCEIRO'
      )
      OR COALESCE(btrim(p_etapa_operacional), '') IN (
        'ENVIADO_FINANCEIRO', 'FINALIZADO', 'FATURADO', 'LIBERADO_FINANCEIRO'
      )
    );
$$;

-- MTR rateio (coluna usada na view)
ALTER TABLE public.mtrs
  ADD COLUMN IF NOT EXISTS baixa_cenario_complexo boolean NOT NULL DEFAULT false;

-- =============================================================================
-- 1) Contrato comercial no cadastro de clientes
-- =============================================================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS veiculos_contrato jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipamentos_contrato jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS residuos_contrato jsonb NOT NULL DEFAULT '[]'::jsonb;

-- =============================================================================
-- 2) Ticket: impressão + aprovação pelo Faturamento
-- =============================================================================
ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS ticket_impresso_em timestamptz,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovado_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovacao_obs text;

-- =============================================================================
-- 3) Esteira de faturamento
-- =============================================================================
ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS faturamento_esteira_status text,
  ADD COLUMN IF NOT EXISTS medicao_relatorio_gerado_em timestamptz,
  ADD COLUMN IF NOT EXISTS medicao_email_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS medicao_email_enviado_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS medicao_cliente_aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS medicao_cliente_aprovado_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS medicao_cliente_aprovacao_obs text,
  ADD COLUMN IF NOT EXISTS faturamento_relatorio_cliente_em timestamptz;

COMMENT ON COLUMN public.coletas.faturamento_esteira_status IS
  'AJUSTE_VALORES_MEDICAO | MEDICAO_PENDENTE | MEDICAO_EMAIL_PENDENTE | MEDICAO_AGUARDANDO_CLIENTE | LIBERADO_FATURAMENTO | LIBERADO_FINANCEIRO | FINALIZADO';

UPDATE public.coletas c
SET faturamento_esteira_status = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.contas_receber cr
    WHERE cr.referencia_coleta_id = c.id AND cr.nf_enviada_em IS NOT NULL
  ) THEN 'FINALIZADO'
  WHEN EXISTS (
    SELECT 1 FROM public.faturamento_registros fr
    WHERE fr.coleta_id = c.id AND fr.status = 'emitido'
  ) THEN 'LIBERADO_FINANCEIRO'
  WHEN c.faturamento_ticket_aprovado_em IS NOT NULL THEN 'AJUSTE_VALORES_MEDICAO'
  ELSE c.faturamento_esteira_status
END
WHERE faturamento_esteira_status IS NULL;

UPDATE public.coletas c
SET faturamento_esteira_status = 'AJUSTE_VALORES_MEDICAO'
WHERE c.faturamento_ticket_aprovado_em IS NOT NULL
  AND c.medicao_relatorio_gerado_em IS NULL
  AND c.medicao_email_enviado_em IS NULL
  AND c.medicao_cliente_aprovado_em IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.faturamento_registros fr
    WHERE fr.coleta_id = c.id AND fr.status = 'emitido'
  )
  AND COALESCE(c.faturamento_esteira_status, '') = 'MEDICAO_PENDENTE';

-- =============================================================================
-- 4) View vw_faturamento_resumo
-- =============================================================================
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
  cl.email_nf AS cliente_email_nf,
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
  COALESCE(NULLIF(btrim(c.ticket_numero), ''), ltk.ticket_numero) AS ticket_comprovante,
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
  c.faturamento_esteira_status,
  c.medicao_relatorio_gerado_em,
  c.medicao_email_enviado_em,
  c.medicao_cliente_aprovado_em,
  c.medicao_cliente_aprovacao_obs,
  c.faturamento_relatorio_cliente_em,
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
      AND c.peso_liquido IS NOT NULL AND c.peso_liquido > 0
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
      WHEN c.ticket_impresso_em IS NOT NULL AND c.faturamento_ticket_aprovado_em IS NULL
      THEN 'aguardando aprovação do Faturamento'
    END,
    CASE
      WHEN c.faturamento_ticket_aprovado_em IS NOT NULL
        AND COALESCE(c.faturamento_esteira_status, '') NOT IN (
          'LIBERADO_FATURAMENTO', 'LIBERADO_FINANCEIRO', 'FINALIZADO'
        )
      THEN 'aguardando medição / aprovação do cliente'
    END,
    CASE WHEN c.valor_coleta IS NULL OR c.valor_coleta <= 0 THEN 'sem valor' END
  )) AS pendencias_resumo,
  public.coleta_faturamento_sla_vencido(c.created_at, lfr.status, c.fluxo_status, c.etapa_operacional) AS faturamento_sla_vencido,
  c.status_pagamento AS status_faturamento
FROM public.coletas c
LEFT JOIN public.clientes cl ON cl.id = c.cliente_id
LEFT JOIN public.programacoes p ON p.id = c.programacao_id
LEFT JOIN public.mtrs m ON m.id = c.mtr_id
LEFT JOIN LATERAL (
  SELECT t.numero AS ticket_numero FROM public.tickets_operacionais t
  WHERE t.coleta_id = c.id ORDER BY t.created_at DESC NULLS LAST, t.id DESC LIMIT 1
) ltk ON true
LEFT JOIN LATERAL (
  SELECT ad.decisao, ad.observacoes, ad.decidido_em FROM public.aprovacoes_diretoria ad
  WHERE ad.coleta_id = c.id ORDER BY ad.decidido_em DESC NULLS LAST, ad.id DESC LIMIT 1
) la ON true
LEFT JOIN LATERAL (
  SELECT fr.status, fr.referencia_nf, fr.valor FROM public.faturamento_registros fr
  WHERE fr.coleta_id = c.id ORDER BY fr.updated_at DESC NULLS LAST, fr.id DESC LIMIT 1
) lfr ON true
LEFT JOIN LATERAL (
  SELECT co.documentos_ok, co.observacoes, co.conferido_em FROM public.conferencia_operacional co
  WHERE co.coleta_id = c.id ORDER BY co.conferido_em DESC NULLS LAST, co.id DESC LIMIT 1
) lco ON true
LEFT JOIN LATERAL (
  SELECT cr.nf_enviada_em, cr.nf_envio_observacao, cr.valor_pago, cr.valor_travado
  FROM public.contas_receber cr
  WHERE cr.referencia_coleta_id = c.id ORDER BY cr.updated_at DESC NULLS LAST, cr.id DESC LIMIT 1
) lcr ON true;

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

-- =============================================================================
-- 5) RPC última pesagem (Controle de Massa)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ultima_pesagem_por_coleta_ids(p_ids uuid[])
RETURNS TABLE (coleta_id uuid, data date, hora_entrada time, hora_saida time)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT DISTINCT ON (cm.coleta_id) cm.coleta_id, cm.data, cm.hora_entrada, cm.hora_saida
  FROM public.controle_massa cm
  WHERE cm.coleta_id = ANY (p_ids)
  ORDER BY cm.coleta_id, cm.created_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.ultima_pesagem_por_coleta_ids(uuid[]) TO authenticated;

-- =============================================================================
-- 6) RLS peso + RPC conferência do ticket
-- =============================================================================
DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;
CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_is_admin() OR public.rg_is_desenvolvedor() OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat() OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica') OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem') OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro') OR public.rg_is_diretoria()
  );

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;
CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin() OR public.rg_is_desenvolvedor() OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat() OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem') OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional') OR public.rg_cargo_like('faturamento')
    )
  )
  WITH CHECK (
    public.rg_is_admin() OR public.rg_is_desenvolvedor() OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat() OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem') OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional') OR public.rg_cargo_like('faturamento')
  );

CREATE OR REPLACE FUNCTION public.rg_pode_ajustar_peso_conferencia_ticket()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT public.rg_is_visualizador() AND (
    public.rg_is_admin() OR public.rg_is_desenvolvedor() OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat() OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro') OR public.rg_is_diretoria()
    OR public.rg_cargo_like('operacional') OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro') OR public.rg_cargo_like('pesagem')
  );
$$;

CREATE OR REPLACE FUNCTION public.atualizar_peso_liquido_conferencia_ticket(
  p_coleta_id uuid, p_peso_liquido numeric, p_residuos_itens jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rows int;
BEGIN
  IF p_coleta_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta inválida.');
  END IF;
  IF p_peso_liquido IS NULL OR p_peso_liquido <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe um peso líquido maior que zero (kg).');
  END IF;
  IF NOT public.rg_pode_ajustar_peso_conferencia_ticket() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sem permissão para alterar o peso nesta conferência.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.coletas c WHERE c.id = p_coleta_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta não encontrada.');
  END IF;
  UPDATE public.coletas
  SET peso_liquido = p_peso_liquido, residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
  WHERE id = p_coleta_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível atualizar o peso na coleta.');
  END IF;
  UPDATE public.controle_massa
  SET peso_liquido = p_peso_liquido, residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
  WHERE coleta_id = p_coleta_id;
  RETURN jsonb_build_object('ok', true, 'peso_liquido', p_peso_liquido);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) TO authenticated;

-- =============================================================================
-- 7) Mala direta / NF — contas a receber
-- =============================================================================
DROP POLICY IF EXISTS "contas_receber_mutate_financeiro" ON public.contas_receber;
CREATE POLICY "contas_receber_mutate_financeiro"
  ON public.contas_receber FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador() AND (
      public.rg_is_admin() OR public.rg_is_desenvolvedor() OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat() OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento') OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    public.rg_is_admin() OR public.rg_is_desenvolvedor() OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat() OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('faturamento') OR public.rg_is_diretoria()
  );

COMMIT;

-- Verificação (opcional, executar depois do COMMIT):
-- SELECT proname FROM pg_proc WHERE proname = 'rg_is_operacional_time_t';
-- SELECT proname FROM pg_proc WHERE proname = 'atualizar_peso_liquido_conferencia_ticket';
-- SELECT COUNT(*) FROM public.vw_faturamento_resumo LIMIT 1;
