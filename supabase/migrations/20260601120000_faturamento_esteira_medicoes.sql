-- Esteira de faturamento: medição → e-mail → aprovação cliente → faturar → financeiro → finalizado.

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
  'Esteira: MEDICAO_PENDENTE | MEDICAO_EMAIL_PENDENTE | MEDICAO_AGUARDANDO_CLIENTE | LIBERADO_FATURAMENTO | LIBERADO_FINANCEIRO | FINALIZADO';

-- Backfill conservador (coletas já emitidas não voltam para medição).
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
  WHEN c.faturamento_ticket_aprovado_em IS NOT NULL THEN 'MEDICAO_PENDENTE'
  ELSE c.faturamento_esteira_status
END
WHERE faturamento_esteira_status IS NULL;

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
    CASE
      WHEN c.faturamento_ticket_aprovado_em IS NOT NULL
        AND COALESCE(c.faturamento_esteira_status, '') NOT IN (
          'LIBERADO_FATURAMENTO', 'LIBERADO_FINANCEIRO', 'FINALIZADO'
        )
      THEN 'aguardando medição / aprovação do cliente'
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
  ORDER BY cr.updated_at DESC NULLS LAST, cr.id DESC
  LIMIT 1
) lcr ON true;

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

COMMENT ON VIEW public.vw_faturamento_resumo IS
  'Faturamento / financeiro com esteira de medição e status de conferência do ticket.';
