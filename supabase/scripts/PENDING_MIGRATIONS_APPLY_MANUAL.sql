-- =============================================================================
-- SQL PENDENTE (corrigido): DROP VIEW antes de recriar vw_faturamento_resumo
-- Evita erro 42P16: cannot drop columns from view
-- Preferir: npx supabase db push
-- =============================================================================

-- >>> BEGIN 20260426120000_contas_receber_nf_envio.sql

-- Fase 8 — Rastreio de envio de NF na conta a receber (por coleta).
-- Após aplicar, recrie a view vw_faturamento_resumo (este ficheiro inclui o REPLACE completo).

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS nf_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS nf_envio_observacao text,
  ADD COLUMN IF NOT EXISTS nf_envio_log_id uuid REFERENCES public.nf_envios_log (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contas_receber.nf_enviada_em IS 'Data/hora do último registo de envio (simulação ou e-mail) ligado a esta coleta.';
COMMENT ON COLUMN public.contas_receber.nf_envio_observacao IS 'Resumo curto (modo, observação do utilizador, id do log).';
COMMENT ON COLUMN public.contas_receber.nf_envio_log_id IS 'Último registo em nf_envios_log associado a este envio.';

CREATE INDEX IF NOT EXISTS idx_contas_receber_nf_enviada ON public.contas_receber (nf_enviada_em DESC NULLS LAST)
  WHERE nf_enviada_em IS NOT NULL;

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
  la.decisao AS ultima_aprovacao_decisao,
  la.observacoes AS ultima_aprovacao_obs,
  la.decidido_em AS ultima_aprovacao_em,
  lco.documentos_ok AS conferencia_documentos_ok,
  lco.observacoes AS conferencia_operacional_obs,
  lco.conferido_em AS conferencia_em,
  lcr.nf_enviada_em AS conta_receber_nf_enviada_em,
  lcr.nf_envio_observacao AS conta_receber_nf_envio_obs,
  CASE
    WHEN c.mtr_id IS NOT NULL
      AND c.peso_liquido IS NOT NULL
      AND c.peso_liquido > 0
      AND (
        (c.ticket_numero IS NOT NULL AND btrim(c.ticket_numero) <> '')
        OR (ltk.ticket_numero IS NOT NULL AND btrim(ltk.ticket_numero) <> '')
      )
      AND la.decisao = 'aprovado'
      AND c.valor_coleta IS NOT NULL
      AND c.valor_coleta > 0
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
    CASE WHEN la.decisao IS DISTINCT FROM 'aprovado' THEN 'sem aprovação' END,
    CASE WHEN c.valor_coleta IS NULL OR c.valor_coleta <= 0 THEN 'sem valor' END
  )) AS pendencias_resumo,
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
  SELECT cr.nf_enviada_em, cr.nf_envio_observacao
  FROM public.contas_receber cr
  WHERE cr.referencia_coleta_id = c.id
  LIMIT 1
) lcr ON true;

COMMENT ON VIEW public.vw_faturamento_resumo IS
  'Consolidação para conferência final / faturamento: coleta, cliente, programação, MTR, ticket, pesos, aprovação, faturamento operacional, envio NF (conta a receber).';

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

-- <<< END 20260426120000_contas_receber_nf_envio.sql

-- >>> BEGIN 20260427120000_fase9_parcelas_auditoria.sql

-- Fase 9 — Pagamento parcial (baixas), trava de valor pós-faturamento, auditoria, relatório base.
-- Aplicar no SQL Editor ou: npm run db:apply:sql -- supabase/migrations/20260427120000_fase9_parcelas_auditoria.sql

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_travado boolean NOT NULL DEFAULT false;

ALTER TABLE public.contas_receber
  DROP CONSTRAINT IF EXISTS contas_receber_valor_pago_chk;

ALTER TABLE public.contas_receber
  ADD CONSTRAINT contas_receber_valor_pago_chk
  CHECK (valor_pago >= 0 AND valor_pago <= valor);

COMMENT ON COLUMN public.contas_receber.valor_pago IS 'Total já recebido (somatório das baixas ou ajuste manual alinhado ao status).';
COMMENT ON COLUMN public.contas_receber.valor_travado IS 'Se true, o valor da fatura só pode ser alterado por administrador (emitido pelo faturamento).';

UPDATE public.contas_receber
SET valor_pago = valor
WHERE status_pagamento = 'Pago' AND valor_pago = 0 AND valor > 0;

UPDATE public.contas_receber
SET valor_travado = true
WHERE faturamento_registro_id IS NOT NULL;

UPDATE public.contas_receber
SET status_pagamento = 'Parcial'
WHERE valor_pago > 0 AND valor_pago < valor AND status_pagamento NOT IN ('Pago', 'Cancelado');

CREATE TABLE IF NOT EXISTS public.contas_receber_baixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id uuid NOT NULL REFERENCES public.contas_receber (id) ON DELETE CASCADE,
  valor numeric NOT NULL CHECK (valor > 0),
  data_baixa date NOT NULL DEFAULT (CURRENT_DATE),
  observacao text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_baixas_conta ON public.contas_receber_baixas (conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_baixas_data ON public.contas_receber_baixas (data_baixa DESC);

COMMENT ON TABLE public.contas_receber_baixas IS 'Histórico de recebimentos parciais (baixas) sobre contas_receber.';

CREATE TABLE IF NOT EXISTS public.financeiro_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  usuario_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  acao text NOT NULL,
  detalhe jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_auditoria_entidade ON public.financeiro_auditoria (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_auditoria_created ON public.financeiro_auditoria (created_at DESC);

COMMENT ON TABLE public.financeiro_auditoria IS 'Trilha de alterações sensíveis no financeiro (contas a receber, baixas).';

ALTER TABLE public.contas_receber_baixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_receber_baixas_select_authenticated" ON public.contas_receber_baixas;
CREATE POLICY "contas_receber_baixas_select_authenticated"
  ON public.contas_receber_baixas FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "contas_receber_baixas_mutate_financeiro" ON public.contas_receber_baixas;
CREATE POLICY "contas_receber_baixas_mutate_financeiro"
  ON public.contas_receber_baixas FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_is_diretoria()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_receber_baixas TO authenticated;

DROP POLICY IF EXISTS "financeiro_auditoria_select_authenticated" ON public.financeiro_auditoria;
CREATE POLICY "financeiro_auditoria_select_authenticated"
  ON public.financeiro_auditoria FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "financeiro_auditoria_insert_financeiro" ON public.financeiro_auditoria;
CREATE POLICY "financeiro_auditoria_insert_financeiro"
  ON public.financeiro_auditoria FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  );

GRANT SELECT, INSERT ON public.financeiro_auditoria TO authenticated;

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
      AND la.decisao = 'aprovado'
      AND c.valor_coleta IS NOT NULL
      AND c.valor_coleta > 0
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
    CASE WHEN la.decisao IS DISTINCT FROM 'aprovado' THEN 'sem aprovação' END,
    CASE WHEN c.valor_coleta IS NULL OR c.valor_coleta <= 0 THEN 'sem valor' END
  )) AS pendencias_resumo,
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
  'Consolidação para conferência / faturamento / financeiro; inclui snapshot de contas_receber (NF, parcelas, trava).';

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

-- <<< END 20260427120000_fase9_parcelas_auditoria.sql

-- >>> BEGIN 20260427140000_clientes_status_datas.sql

-- Datas de referência do estado comercial (pós-venda / carteira)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS status_ativo_desde date;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS status_inativo_desde date;

COMMENT ON COLUMN public.clientes.status_ativo_desde IS 'Data a partir da qual o cliente está ou passou a estar ativo (cadastro manual).';
COMMENT ON COLUMN public.clientes.status_inativo_desde IS 'Data a partir da qual o cliente está ou passou a estar inativo (cadastro manual).';

-- <<< END 20260427140000_clientes_status_datas.sql

-- >>> BEGIN 20260428120000_vw_faturamento_resumo_pronto_sem_valor_obrigatorio.sql

-- PRONTO_PARA_FATURAR: alinha com o fluxo pós–Controle de Massa + aprovação.
-- Não exige valor pré-gravado em coletas.valor_coleta (definido na emissão / regras de preço).
-- Pendência «sem valor» continua em pendencias_resumo quando aplicável.

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
      AND la.decisao = 'aprovado'
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
    CASE WHEN la.decisao IS DISTINCT FROM 'aprovado' THEN 'sem aprovação' END,
    CASE WHEN c.valor_coleta IS NULL OR c.valor_coleta <= 0 THEN 'sem valor' END
  )) AS pendencias_resumo,
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
  'Consolidação para conferência / faturamento / financeiro; PRONTO_PARA_FATURAR sem exigir valor na coleta (emissão / regras).';

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

-- <<< END 20260428120000_vw_faturamento_resumo_pronto_sem_valor_obrigatorio.sql

-- >>> BEGIN 20260428150000_motoristas_cnh_foto.sql

-- Foto digital da CNH (URL pública no Storage) + bucket motoristas-cnh
-- Aplicar: SQL Editor ou supabase db push

ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS cnh_foto_url text;

COMMENT ON COLUMN public.motoristas.cnh_foto_url IS
  'URL pública da imagem da CNH (bucket motoristas-cnh/<motorista_id>/...).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'motoristas-cnh',
  'motoristas-cnh',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "motoristas_cnh_select_public" ON storage.objects;
CREATE POLICY "motoristas_cnh_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'motoristas-cnh');

DROP POLICY IF EXISTS "motoristas_cnh_authenticated_insert" ON storage.objects;
CREATE POLICY "motoristas_cnh_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'motoristas-cnh');

DROP POLICY IF EXISTS "motoristas_cnh_authenticated_update" ON storage.objects;
CREATE POLICY "motoristas_cnh_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'motoristas-cnh')
  WITH CHECK (bucket_id = 'motoristas-cnh');

DROP POLICY IF EXISTS "motoristas_cnh_authenticated_delete" ON storage.objects;
CREATE POLICY "motoristas_cnh_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'motoristas-cnh');

-- <<< END 20260428150000_motoristas_cnh_foto.sql

-- >>> BEGIN 20260428160000_caminhoes_foto.sql

-- Foto do veículo (URL pública) + bucket caminhoes-fotos

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS foto_url text;

COMMENT ON COLUMN public.caminhoes.foto_url IS
  'URL pública da fotografia do caminhão (bucket caminhoes-fotos/<caminhao_id>/...).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'caminhoes-fotos',
  'caminhoes-fotos',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "caminhoes_fotos_select_public" ON storage.objects;
CREATE POLICY "caminhoes_fotos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'caminhoes-fotos');

DROP POLICY IF EXISTS "caminhoes_fotos_authenticated_insert" ON storage.objects;
CREATE POLICY "caminhoes_fotos_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'caminhoes-fotos');

DROP POLICY IF EXISTS "caminhoes_fotos_authenticated_update" ON storage.objects;
CREATE POLICY "caminhoes_fotos_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'caminhoes-fotos')
  WITH CHECK (bucket_id = 'caminhoes-fotos');

DROP POLICY IF EXISTS "caminhoes_fotos_authenticated_delete" ON storage.objects;
CREATE POLICY "caminhoes_fotos_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'caminhoes-fotos');

-- <<< END 20260428160000_caminhoes_foto.sql

-- >>> BEGIN 20260429120000_vw_faturamento_resumo_sem_aprovacao.sql

-- Remove a exigência de aprovação da diretoria para ficar PRONTO_PARA_FATURAR.
-- Mantém pendências operacionais: MTR, peso líquido, ticket (e valor ainda aparece como pendência, mas não bloqueia o status).
--
-- Garante colunas em contas_receber usadas pela view (projetos que só aplicaram a tabela base).
--
-- Aplicar: SQL Editor ou npm run db:apply:sql -- supabase/migrations/20260429120000_vw_faturamento_resumo_sem_aprovacao.sql

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS nf_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS nf_envio_observacao text;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_travado boolean NOT NULL DEFAULT false;

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
    CASE WHEN c.valor_coleta IS NULL OR c.valor_coleta <= 0 THEN 'sem valor' END
  )) AS pendencias_resumo,
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
  'Consolidação para conferência / faturamento / financeiro; PRONTO_PARA_FATURAR sem exigir aprovação da diretoria.';

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

-- <<< END 20260429120000_vw_faturamento_resumo_sem_aprovacao.sql

-- >>> BEGIN 20260430120000_comprovantes_descarte.sql

-- =============================================================================
-- Comprovante de Descarte — tabela, RLS, storage e gatilhos
-- =============================================================================

-- Atualização automática de updated_at (reutilizável)
CREATE OR REPLACE FUNCTION public.rg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.comprovantes_descarte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  codigo_remessa text,
  data_remessa date,
  cadri text,
  tipo_efluente text,
  linha_tratamento text,
  numero_mtr text,
  volume text,
  acondicionamento text,

  gerador_razao_social text,
  gerador_nome_fantasia text,
  gerador_endereco text,
  gerador_responsavel text,
  gerador_telefone text,
  gerador_contrato text,

  transportador_razao_social text,
  transportador_telefone text,
  placa text,
  motorista_nome text,
  motorista_cnh text,
  transportador_responsavel_assinatura_nome text,
  transportador_responsavel_assinatura_data date,

  destinatario_razao_social text,
  destinatario_endereco text,
  destinatario_telefone text,
  destinatario_responsavel_assinatura_nome text,
  destinatario_responsavel_assinatura_data date,

  peso_entrada numeric(14, 3),
  data_entrada timestamptz,
  peso_saida numeric(14, 3),
  data_saida timestamptz,
  peso_liquido numeric(14, 3) GENERATED ALWAYS AS (
    CASE
      WHEN peso_entrada IS NOT NULL AND peso_saida IS NOT NULL
        THEN peso_entrada - peso_saida
      ELSE NULL
    END
  ) STORED,

  foto_entrada_url text,
  foto_saida_url text,
  fotos_extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  foto_entrada_nome_arquivo text,
  foto_saida_nome_arquivo text,

  foto_entrada_conferida boolean NOT NULL DEFAULT false,
  foto_entrada_observacao_conferencia text,
  foto_saida_conferida boolean NOT NULL DEFAULT false,
  foto_saida_observacao_conferencia text,
  foto_entrada_ocr_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  foto_saida_ocr_meta jsonb NOT NULL DEFAULT '{}'::jsonb,

  observacoes text,
  coleta_id uuid REFERENCES public.coletas (id) ON DELETE SET NULL,
  mtr_id uuid REFERENCES public.mtrs (id) ON DELETE SET NULL,
  controle_massa_id uuid REFERENCES public.controle_massa (id) ON DELETE SET NULL,

  faturamento_liberado boolean NOT NULL DEFAULT false,
  status_documento text NOT NULL DEFAULT 'rascunho'
    CHECK (
      status_documento IN (
        'rascunho',
        'em_conferencia',
        'finalizado',
        'aprovado_faturamento'
      )
    ),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.comprovantes_descarte IS
  'Documento técnico de comprovação de descarte (pós-operacional).';
COMMENT ON COLUMN public.comprovantes_descarte.fotos_extras IS
  'JSON array: [{url, nome_arquivo, conferida_manual, observacao_conferencia, ocr_meta}]';
COMMENT ON COLUMN public.comprovantes_descarte.foto_entrada_ocr_meta IS
  'Reservado para leitura automática (peso/data) — evolução futura.';
COMMENT ON COLUMN public.comprovantes_descarte.faturamento_liberado IS
  'Sinaliza que o comprovante pode ser base para faturamento.';

CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_codigo_remessa
  ON public.comprovantes_descarte (codigo_remessa);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_numero_mtr
  ON public.comprovantes_descarte (numero_mtr);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_gerador_rs
  ON public.comprovantes_descarte (gerador_razao_social);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_motorista
  ON public.comprovantes_descarte (motorista_nome);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_placa
  ON public.comprovantes_descarte (placa);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_data_remessa
  ON public.comprovantes_descarte (data_remessa);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_status
  ON public.comprovantes_descarte (status_documento);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_created
  ON public.comprovantes_descarte (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_coleta
  ON public.comprovantes_descarte (coleta_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_descarte_mtr
  ON public.comprovantes_descarte (mtr_id);

DROP TRIGGER IF EXISTS trg_comprovantes_descarte_updated_at ON public.comprovantes_descarte;
CREATE TRIGGER trg_comprovantes_descarte_updated_at
  BEFORE UPDATE ON public.comprovantes_descarte
  FOR EACH ROW
  EXECUTE FUNCTION public.rg_set_updated_at();

ALTER TABLE public.comprovantes_descarte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comprovantes_descarte_select_authenticated" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_select_authenticated"
  ON public.comprovantes_descarte FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "comprovantes_descarte_insert_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_insert_roles_fluxo"
  ON public.comprovantes_descarte FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
    )
  );

DROP POLICY IF EXISTS "comprovantes_descarte_update_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_update_roles_fluxo"
  ON public.comprovantes_descarte FOR UPDATE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
    )
  );

DROP POLICY IF EXISTS "comprovantes_descarte_delete_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_delete_roles_fluxo"
  ON public.comprovantes_descarte FOR DELETE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comprovantes_descarte TO authenticated;

-- Storage: comprovantes-descarte/{comprovante_id}/entrada|saida|extras/...
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes-descarte',
  'comprovantes-descarte',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "comprovantes_descarte_storage_select" ON storage.objects;
CREATE POLICY "comprovantes_descarte_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprovantes-descarte');

DROP POLICY IF EXISTS "comprovantes_descarte_storage_insert" ON storage.objects;
CREATE POLICY "comprovantes_descarte_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes-descarte'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

DROP POLICY IF EXISTS "comprovantes_descarte_storage_update" ON storage.objects;
CREATE POLICY "comprovantes_descarte_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'comprovantes-descarte'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

DROP POLICY IF EXISTS "comprovantes_descarte_storage_delete" ON storage.objects;
CREATE POLICY "comprovantes_descarte_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes-descarte'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- <<< END 20260430120000_comprovantes_descarte.sql

-- >>> BEGIN 20260430200000_vw_faturamento_resumo_rebuild.sql

-- Reconstrói vw_faturamento_resumo com DROP + CREATE.
-- Motivo: CREATE OR REPLACE VIEW falha com 42P16 se a view já existir com outra ordem/nome de colunas
-- («cannot change name of view column …»). O script em sql_editor_vw_faturamento_resumo.sql faz o mesmo.

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS nf_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS nf_envio_observacao text;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_travado boolean NOT NULL DEFAULT false;

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
    CASE WHEN c.valor_coleta IS NULL OR c.valor_coleta <= 0 THEN 'sem valor' END
  )) AS pendencias_resumo,
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
  'Consolidação para conferência / faturamento / financeiro; PRONTO_PARA_FATURAR sem exigir aprovação da diretoria.';

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

-- <<< END 20260430200000_vw_faturamento_resumo_rebuild.sql

-- >>> BEGIN 20260506120000_clientes_representante_comercial.sql

-- Representante comercial (utilizador interno) associado ao cliente.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS representante_comercial_id uuid REFERENCES public.usuarios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_representante_comercial_id
  ON public.clientes (representante_comercial_id)
  WHERE representante_comercial_id IS NOT NULL;

COMMENT ON COLUMN public.clientes.representante_comercial_id IS
  'Utilizador com cargo Comercial que atende o cliente (FK public.usuarios).';

-- <<< END 20260506120000_clientes_representante_comercial.sql

-- >>> BEGIN 20260506160000_motoristas_nopp.sql

-- MOPP (documento / certificação operacional): indicação e validade no cadastro de motoristas
ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS possui_nopp boolean NOT NULL DEFAULT false;

ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS nopp_validade date;

COMMENT ON COLUMN public.motoristas.possui_nopp IS 'Indica se o motorista possui MOPP.';
COMMENT ON COLUMN public.motoristas.nopp_validade IS 'Data de validade do MOPP.';

-- <<< END 20260506160000_motoristas_nopp.sql

-- >>> BEGIN 20260507120000_representantes_rg.sql

-- Cadastro de representantes comerciais RG (equipa comercial da empresa).
-- Aplicar: SQL Editor no Supabase ou fluxo de migrações do projeto.

CREATE TABLE IF NOT EXISTS public.representantes_rg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  telefone text,
  cpf text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_representantes_rg_nome ON public.representantes_rg (nome);
CREATE INDEX IF NOT EXISTS idx_representantes_rg_email ON public.representantes_rg (email)
  WHERE email IS NOT NULL AND btrim(email) <> '';

COMMENT ON TABLE public.representantes_rg IS
  'Representantes comerciais RG — cadastro da equipa comercial.';
COMMENT ON COLUMN public.representantes_rg.nome IS 'Nome completo do representante.';
COMMENT ON COLUMN public.representantes_rg.email IS 'E-mail de contacto.';
COMMENT ON COLUMN public.representantes_rg.telefone IS 'Telefone de contacto.';
COMMENT ON COLUMN public.representantes_rg.cpf IS 'CPF (opcional).';
COMMENT ON COLUMN public.representantes_rg.observacoes IS 'Notas internas (território, contrato, etc.).';

ALTER TABLE public.representantes_rg ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "representantes_rg_authenticated_all" ON public.representantes_rg;
CREATE POLICY "representantes_rg_authenticated_all"
  ON public.representantes_rg FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- <<< END 20260507120000_representantes_rg.sql

-- >>> BEGIN 20260508120000_clientes_representante_rg_id.sql

-- Cliente → representante do cadastro Representante RG (tabela public.representantes_rg).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS representante_rg_id uuid REFERENCES public.representantes_rg (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_representante_rg_id
  ON public.clientes (representante_rg_id)
  WHERE representante_rg_id IS NOT NULL;

COMMENT ON COLUMN public.clientes.representante_rg_id IS
  'Representante comercial RG (cadastro em representantes_rg) que atende o cliente.';

-- <<< END 20260508120000_clientes_representante_rg_id.sql

-- >>> BEGIN 20260509120000_clientes_caminhao_id.sql

-- Veículo (frota) preferencial para atendimento ao cliente — FK para public.caminhoes.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS caminhao_id uuid REFERENCES public.caminhoes (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_caminhao_id
  ON public.clientes (caminhao_id)
  WHERE caminhao_id IS NOT NULL;

COMMENT ON COLUMN public.clientes.caminhao_id IS
  'Veículo da frota (cadastro Caminhões/Veículos) associado ao cliente.';

-- <<< END 20260509120000_clientes_caminhao_id.sql

-- >>> BEGIN 20260509180000_motoristas_cpf_caminhoes_operacao.sql

-- CPF em motoristas; dados operacionais e RENAVAM em caminhões; vínculo opcional motorista ↔ veículo.
ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS cpf text;

COMMENT ON COLUMN public.motoristas.cpf IS 'CPF do motorista (formato 000.000.000-00), opcional.';

CREATE INDEX IF NOT EXISTS idx_motoristas_cpf_nao_vazio
  ON public.motoristas (cpf)
  WHERE cpf IS NOT NULL AND btrim(cpf) <> '';

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS renavam text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS peso_tara text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS peso_bruto text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS cmt text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS quant_ibcs text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS tipo_caixa text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES public.motoristas (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.caminhoes.renavam IS 'RENAVAM do veículo (9 a 11 dígitos, armazenado sem máscara ou com zeros à esquerda conforme informado).';
COMMENT ON COLUMN public.caminhoes.peso_tara IS 'Peso tara informado na operação (texto livre, ex.: 10.91T ou 13500 kg).';
COMMENT ON COLUMN public.caminhoes.peso_bruto IS 'Peso bruto informado na operação (texto livre).';
COMMENT ON COLUMN public.caminhoes.cmt IS 'CMT — Capacidade Máxima de Tração (texto livre).';
COMMENT ON COLUMN public.caminhoes.quant_ibcs IS 'Quantidade / indicação de IBCs (texto livre).';
COMMENT ON COLUMN public.caminhoes.tipo_caixa IS 'Tipo de caixa / equipamento (texto livre, ex.: 30M³).';
COMMENT ON COLUMN public.caminhoes.motorista_id IS 'Motorista habitual do veículo (opcional).';

CREATE INDEX IF NOT EXISTS idx_caminhoes_motorista_id
  ON public.caminhoes (motorista_id)
  WHERE motorista_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caminhoes_renavam
  ON public.caminhoes (renavam)
  WHERE renavam IS NOT NULL AND btrim(renavam) <> '';

-- <<< END 20260509180000_motoristas_cpf_caminhoes_operacao.sql

-- >>> BEGIN 20260509194500_chat_admin_apagar_historico.sql

-- =============================================================================
-- Chat interno: administradores podem apagar todo o histórico de uma conversa
-- (mensagens + anexos no bucket chat-anexos). Requer participação na conversa.
-- =============================================================================

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

  IF NOT public.rg_is_admin() THEN
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

  DELETE FROM storage.objects
  WHERE bucket_id = 'chat-anexos'
    AND name LIKE p_conversa_id::text || '/%';

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

REVOKE ALL ON FUNCTION public.chat_admin_apagar_historico_conversa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_admin_apagar_historico_conversa(uuid) TO authenticated;

-- <<< END 20260509194500_chat_admin_apagar_historico.sql

-- >>> BEGIN 20260510120000_clientes_endereco_faturamento_estruturado.sql

-- Endereço de faturamento estruturado (espelha o bloco de endereço de coleta).
-- Os campos endereco_coleta / endereco_faturamento (texto livre) continuam sendo
-- preenchidos pela aplicação a partir dos blocos estruturados, para compatibilidade.

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cep_faturamento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS rua_faturamento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numero_faturamento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS complemento_faturamento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS bairro_faturamento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cidade_faturamento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS estado_faturamento text;

COMMENT ON COLUMN public.clientes.cep_faturamento IS 'CEP do endereço de faturamento.';
COMMENT ON COLUMN public.clientes.rua_faturamento IS 'Logradouro (faturamento).';
COMMENT ON COLUMN public.clientes.numero_faturamento IS 'Número (faturamento).';
COMMENT ON COLUMN public.clientes.complemento_faturamento IS 'Complemento (faturamento).';
COMMENT ON COLUMN public.clientes.bairro_faturamento IS 'Bairro (faturamento).';
COMMENT ON COLUMN public.clientes.cidade_faturamento IS 'Cidade (faturamento).';
COMMENT ON COLUMN public.clientes.estado_faturamento IS 'UF (faturamento).';

-- Dados existentes: copia o endereço de coleta estruturado quando o de faturamento ainda está vazio.
UPDATE public.clientes SET
  cep_faturamento = cep,
  rua_faturamento = rua,
  numero_faturamento = numero,
  complemento_faturamento = complemento,
  bairro_faturamento = bairro,
  cidade_faturamento = cidade,
  estado_faturamento = estado
WHERE cep_faturamento IS NULL
  AND rua_faturamento IS NULL
  AND numero_faturamento IS NULL
  AND complemento_faturamento IS NULL
  AND bairro_faturamento IS NULL
  AND cidade_faturamento IS NULL
  AND estado_faturamento IS NULL;

UPDATE public.clientes
SET endereco_faturamento = endereco_coleta
WHERE (endereco_faturamento IS NULL OR btrim(endereco_faturamento) = '')
  AND endereco_coleta IS NOT NULL
  AND btrim(endereco_coleta) <> '';

-- <<< END 20260510120000_clientes_endereco_faturamento_estruturado.sql

-- >>> BEGIN 20260510120000_programacao_coleta_fixa_semanal.sql

-- =============================================================================
-- Coleta fixa com periodicidade semanal: gera programações futuras no mesmo
-- dia da semana que data_programada. Usa programacao_serie_id para agrupar.
-- Chamar: select public.programacao_manter_fixas_semanais(53);
-- (Opcional: agendar com pg_cron diariamente.)
-- =============================================================================

ALTER TABLE public.programacoes
  ADD COLUMN IF NOT EXISTS programacao_serie_id uuid;

COMMENT ON COLUMN public.programacoes.programacao_serie_id IS
  'Identificador da série (recorrência). Partilhado por todas as ocorrências da mesma coleta fixa semanal.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_programacoes_serie_data
  ON public.programacoes (programacao_serie_id, data_programada)
  WHERE programacao_serie_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_programacoes_serie_id
  ON public.programacoes (programacao_serie_id)
  WHERE programacao_serie_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.programacao_periodicidade_e_semanal(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    lower(trim(coalesce(p, ''))) LIKE '%semanal%'
    OR lower(trim(coalesce(p, ''))) LIKE '%weekly%'
    OR lower(trim(coalesce(p, ''))) IN ('semana');
$$;

CREATE OR REPLACE FUNCTION public.programacao_manter_fixas_semanais(p_horizonte_semanas integer DEFAULT 53)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  tmpl public.programacoes%ROWTYPE;
  v_ins date;
  v_lim date;
  v_anchor date;
  v_serie_min date;
  v_dow_tmpl numeric;
  v_dow_anchor numeric;
  v_off integer;
  v_num text;
  n_ins integer := 0;
BEGIN
  IF p_horizonte_semanas IS NULL OR p_horizonte_semanas < 1 THEN
    p_horizonte_semanas := 53;
  END IF;

  v_lim := (CURRENT_DATE + (p_horizonte_semanas * 7))::date;

  FOR r IN
    SELECT DISTINCT w.programacao_serie_id AS sid
    FROM public.programacoes w
    WHERE w.programacao_serie_id IS NOT NULL
      AND coalesce(w.coleta_fixa, false)
      AND public.programacao_periodicidade_e_semanal(w.periodicidade)
  LOOP
    SELECT p.*
    INTO tmpl
    FROM public.programacoes p
    WHERE p.programacao_serie_id = r.sid
    ORDER BY p.data_programada DESC NULLS LAST, p.created_at DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF NOT coalesce(tmpl.coleta_fixa, false)
       OR NOT public.programacao_periodicidade_e_semanal(tmpl.periodicidade) THEN
      CONTINUE;
    END IF;

    IF tmpl.data_programada IS NULL THEN
      CONTINUE;
    END IF;

    SELECT min(p.data_programada::date)
    INTO v_serie_min
    FROM public.programacoes p
    WHERE p.programacao_serie_id = r.sid;

    IF v_serie_min IS NULL THEN
      CONTINUE;
    END IF;

    v_anchor := GREATEST(CURRENT_DATE, v_serie_min);

    v_dow_tmpl := EXTRACT(DOW FROM tmpl.data_programada::date);
    v_dow_anchor := EXTRACT(DOW FROM v_anchor);
    v_off := ((v_dow_tmpl - v_dow_anchor)::integer % 7 + 7) % 7;
    v_ins := (v_anchor + v_off)::date;

    WHILE v_ins <= v_lim LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.programacoes x
        WHERE x.programacao_serie_id = r.sid
          AND x.data_programada = v_ins
      ) THEN
        v_num := lpad(
          ((SELECT count(*)::bigint FROM public.programacoes) + 1)::text,
          3,
          '0'
        );

        INSERT INTO public.programacoes (
          numero,
          cliente_id,
          cliente,
          data_programada,
          tipo_caminhao,
          tipo_servico,
          observacoes,
          coleta_fixa,
          periodicidade,
          status_programacao,
          coleta_id,
          programacao_serie_id
        ) VALUES (
          v_num,
          tmpl.cliente_id,
          tmpl.cliente,
          v_ins,
          tmpl.tipo_caminhao,
          tmpl.tipo_servico,
          tmpl.observacoes,
          true,
          tmpl.periodicidade,
          'PENDENTE',
          NULL,
          tmpl.programacao_serie_id
        );

        n_ins := n_ins + 1;
      END IF;

      v_ins := (v_ins + 7)::date;
    END LOOP;
  END LOOP;

  RETURN n_ins;
END;
$$;

REVOKE ALL ON FUNCTION public.programacao_periodicidade_e_semanal(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.programacao_manter_fixas_semanais(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.programacao_manter_fixas_semanais(integer) TO authenticated;

-- Liga programações antigas (fixas + texto semanal) como série individual para passarem a expandir.
UPDATE public.programacoes p
SET programacao_serie_id = p.id
WHERE p.programacao_serie_id IS NULL
  AND coalesce(p.coleta_fixa, false)
  AND public.programacao_periodicidade_e_semanal(p.periodicidade);

-- <<< END 20260510120000_programacao_coleta_fixa_semanal.sql

-- >>> BEGIN 20260511120000_clientes_equipamentos.sql

-- Lista livre de equipamentos desejados no cadastro de clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS equipamentos text;

COMMENT ON COLUMN public.clientes.equipamentos IS 'Lista de equipamentos desejados (texto livre).';

-- <<< END 20260511120000_clientes_equipamentos.sql

-- >>> BEGIN 20260511130000_programacao_dias_semana.sql

-- =============================================================================
-- Coleta fixa: dias da semana (ISO 1=Seg … 7=Dom) em programacao_dias_semana.
-- Expansão: para cada dia selecionado, gera programações até ao horizonte.
-- =============================================================================

ALTER TABLE public.programacoes
  ADD COLUMN IF NOT EXISTS programacao_dias_semana smallint[];

COMMENT ON COLUMN public.programacoes.programacao_dias_semana IS
  'Dias ISO 1=segunda … 7=domingo em que a coleta fixa se repete. Vazio/null: comportamento legado (só o dia de data_programada).';

CREATE OR REPLACE FUNCTION public.programacao_manter_fixas_semanais(p_horizonte_semanas integer DEFAULT 53)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  tmpl public.programacoes%ROWTYPE;
  v_d date;
  v_lim date;
  v_anchor date;
  v_serie_min date;
  v_num text;
  n_ins integer := 0;
  dias integer[];
BEGIN
  IF p_horizonte_semanas IS NULL OR p_horizonte_semanas < 1 THEN
    p_horizonte_semanas := 53;
  END IF;

  v_lim := (CURRENT_DATE + (p_horizonte_semanas * 7))::date;

  FOR r IN
    SELECT DISTINCT w.programacao_serie_id AS sid
    FROM public.programacoes w
    WHERE w.programacao_serie_id IS NOT NULL
      AND coalesce(w.coleta_fixa, false)
      AND (
        public.programacao_periodicidade_e_semanal(w.periodicidade)
        OR (
          w.programacao_dias_semana IS NOT NULL
          AND coalesce(array_length(w.programacao_dias_semana, 1), 0) > 0
        )
      )
  LOOP
    SELECT p.*
    INTO tmpl
    FROM public.programacoes p
    WHERE p.programacao_serie_id = r.sid
    ORDER BY p.data_programada DESC NULLS LAST, p.created_at DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF NOT coalesce(tmpl.coleta_fixa, false) THEN
      CONTINUE;
    END IF;

    IF tmpl.data_programada IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT public.programacao_periodicidade_e_semanal(tmpl.periodicidade)
       AND (
         tmpl.programacao_dias_semana IS NULL
         OR coalesce(array_length(tmpl.programacao_dias_semana, 1), 0) = 0
       ) THEN
      CONTINUE;
    END IF;

    dias := ARRAY(
      SELECT DISTINCT u::integer
      FROM unnest(coalesce(tmpl.programacao_dias_semana, '{}'::smallint[])) AS u
      WHERE u BETWEEN 1 AND 7
      ORDER BY 1
    );

    IF dias IS NULL OR cardinality(dias) = 0 THEN
      dias := ARRAY[EXTRACT(ISODOW FROM tmpl.data_programada::date)::integer];
    END IF;

    SELECT min(p.data_programada::date)
    INTO v_serie_min
    FROM public.programacoes p
    WHERE p.programacao_serie_id = r.sid;

    IF v_serie_min IS NULL THEN
      CONTINUE;
    END IF;

    v_anchor := GREATEST(CURRENT_DATE, v_serie_min);
    v_d := v_anchor;

    WHILE v_d <= v_lim LOOP
      IF EXTRACT(ISODOW FROM v_d)::integer = ANY(dias) THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.programacoes x
          WHERE x.programacao_serie_id = r.sid
            AND x.data_programada = v_d
        ) THEN
          v_num := lpad(
            ((SELECT count(*)::bigint FROM public.programacoes) + 1)::text,
            3,
            '0'
          );

          INSERT INTO public.programacoes (
            numero,
            cliente_id,
            cliente,
            data_programada,
            tipo_caminhao,
            tipo_servico,
            observacoes,
            coleta_fixa,
            periodicidade,
            status_programacao,
            coleta_id,
            programacao_serie_id,
            programacao_dias_semana
          ) VALUES (
            v_num,
            tmpl.cliente_id,
            tmpl.cliente,
            v_d,
            tmpl.tipo_caminhao,
            tmpl.tipo_servico,
            tmpl.observacoes,
            true,
            coalesce(nullif(trim(tmpl.periodicidade), ''), 'Semanal'),
            'PENDENTE',
            NULL,
            tmpl.programacao_serie_id,
            tmpl.programacao_dias_semana
          );

          n_ins := n_ins + 1;
        END IF;
      END IF;

      v_d := (v_d + 1)::date;
    END LOOP;
  END LOOP;

  RETURN n_ins;
END;
$$;

REVOKE ALL ON FUNCTION public.programacao_manter_fixas_semanais(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.programacao_manter_fixas_semanais(integer) TO authenticated;

UPDATE public.programacoes p
SET programacao_dias_semana = ARRAY[EXTRACT(ISODOW FROM p.data_programada::date)::smallint]
WHERE coalesce(p.coleta_fixa, false)
  AND p.data_programada IS NOT NULL
  AND (
    p.programacao_dias_semana IS NULL
    OR coalesce(array_length(p.programacao_dias_semana, 1), 0) = 0
  )
  AND public.programacao_periodicidade_e_semanal(p.periodicidade);

-- <<< END 20260511130000_programacao_dias_semana.sql

-- >>> BEGIN 20260511180000_usuarios_cargo_desenvolvedor.sql

-- Adiciona o cargo «Desenvolvedor» (perfil master na aplicação) à lista canónica.
alter table public.usuarios
  drop constraint if exists usuarios_cargo_canonico_chk;

alter table public.usuarios
  add constraint usuarios_cargo_canonico_chk
  check (
    cargo is null
    or btrim(cargo) = ''
    or cargo in (
      'Desenvolvedor',
      'Administrador',
      'Diretoria',
      'Comercial',
      'Operacional',
      'Logística',
      'Balanceiro',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

comment on constraint usuarios_cargo_canonico_chk on public.usuarios is
  'Cargos canónicos (inclui Desenvolvedor). Vazio/NULL aceite para onboarding.';

-- <<< END 20260511180000_usuarios_cargo_desenvolvedor.sql

-- >>> BEGIN 20260512100000_caminhoes_crlv_civ_cipp.sql

-- CRLV (validade), CIV e CIPP: números e URLs de arquivo no Storage (bucket caminhoes-certificados)

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS crlv_validade date;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS civ_numero text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS civ_arquivo_url text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS cipp_numero text;

ALTER TABLE public.caminhoes
  ADD COLUMN IF NOT EXISTS cipp_arquivo_url text;

COMMENT ON COLUMN public.caminhoes.crlv_validade IS 'Data de validade do documento CRLV.';
COMMENT ON COLUMN public.caminhoes.civ_numero IS 'Número do certificado CIV (alternativa ou complemento ao arquivo).';
COMMENT ON COLUMN public.caminhoes.civ_arquivo_url IS 'URL pública do arquivo do CIV (bucket caminhoes-certificados).';
COMMENT ON COLUMN public.caminhoes.cipp_numero IS 'Número do certificado CIPP (alternativa ou complemento ao arquivo).';
COMMENT ON COLUMN public.caminhoes.cipp_arquivo_url IS 'URL pública do arquivo do CIPP (bucket caminhoes-certificados).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'caminhoes-certificados',
  'caminhoes-certificados',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "caminhoes_certificados_select_public" ON storage.objects;
CREATE POLICY "caminhoes_certificados_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'caminhoes-certificados');

DROP POLICY IF EXISTS "caminhoes_certificados_authenticated_insert" ON storage.objects;
CREATE POLICY "caminhoes_certificados_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'caminhoes-certificados');

DROP POLICY IF EXISTS "caminhoes_certificados_authenticated_update" ON storage.objects;
CREATE POLICY "caminhoes_certificados_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'caminhoes-certificados')
  WITH CHECK (bucket_id = 'caminhoes-certificados');

DROP POLICY IF EXISTS "caminhoes_certificados_authenticated_delete" ON storage.objects;
CREATE POLICY "caminhoes_certificados_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'caminhoes-certificados');

-- <<< END 20260512100000_caminhoes_crlv_civ_cipp.sql

-- >>> BEGIN 20260513120000_clientes_margem_lucro_vw_faturamento_sla.sql

-- Margem de lucro por cliente + indicador de SLA de faturamento (3 dias) na view de resumo.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS margem_lucro_percentual numeric(7, 2);

COMMENT ON COLUMN public.clientes.margem_lucro_percentual IS
  'Margem de lucro alvo para o cliente (%). Opcional; usada em precificação / relatórios.';

-- Função de apoio: mesma regra da coluna computada da view (para jobs ou relatórios SQL).
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

COMMENT ON FUNCTION public.coleta_faturamento_sla_vencido IS
  'Verdadeiro se a coleta tem mais de 3 dias e ainda não foi faturada (emitida) nem enviada ao financeiro.';

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
  'Consolidação para conferência / faturamento / financeiro; inclui SLA de 3 dias (faturamento_sla_vencido) e margem do cliente.';

COMMENT ON COLUMN public.vw_faturamento_resumo.faturamento_sla_vencido IS
  'Indica atraso: coleta criada há mais de 3 dias sem faturamento emitido e sem envio ao financeiro.';

GRANT SELECT ON public.vw_faturamento_resumo TO authenticated;

-- <<< END 20260513120000_clientes_margem_lucro_vw_faturamento_sla.sql

-- >>> BEGIN 20260514120000_contas_pagar.sql

-- =============================================================================
-- Contas a pagar — títulos, anexos (Storage), RLS alinhado a contas_receber
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor text NOT NULL,
  descricao text NOT NULL,
  valor numeric(14, 2) NOT NULL CHECK (valor >= 0),
  data_vencimento date NOT NULL,
  categoria text NOT NULL DEFAULT 'Geral',
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.contas_pagar IS 'Lançamentos de contas a pagar (fornecedores, despesas). Status «Atrasado» é derivado na aplicação (Pendente + vencimento < hoje).';

CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON public.contas_pagar (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar (status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_categoria ON public.contas_pagar (categoria);

DROP TRIGGER IF EXISTS trg_contas_pagar_updated_at ON public.contas_pagar;
CREATE TRIGGER trg_contas_pagar_updated_at
  BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.rg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.contas_pagar_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_pagar_id uuid NOT NULL REFERENCES public.contas_pagar (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  content_type text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_anexos_conta ON public.contas_pagar_anexos (conta_pagar_id);

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_pagar_select_authenticated" ON public.contas_pagar;
CREATE POLICY "contas_pagar_select_authenticated"
  ON public.contas_pagar FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "contas_pagar_mutate_financeiro" ON public.contas_pagar;
CREATE POLICY "contas_pagar_mutate_financeiro"
  ON public.contas_pagar FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_is_diretoria()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar TO authenticated;

DROP POLICY IF EXISTS "contas_pagar_anexos_select_authenticated" ON public.contas_pagar_anexos;
CREATE POLICY "contas_pagar_anexos_select_authenticated"
  ON public.contas_pagar_anexos FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "contas_pagar_anexos_mutate_financeiro" ON public.contas_pagar_anexos;
CREATE POLICY "contas_pagar_anexos_mutate_financeiro"
  ON public.contas_pagar_anexos FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_is_diretoria()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar_anexos TO authenticated;

-- Storage: contas-pagar-anexos/{conta_pagar_id}/...
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contas-pagar-anexos',
  'contas-pagar-anexos',
  false,
  15728640,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "contas_pagar_anexos_storage_select" ON storage.objects;
CREATE POLICY "contas_pagar_anexos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contas-pagar-anexos');

DROP POLICY IF EXISTS "contas_pagar_anexos_storage_insert" ON storage.objects;
CREATE POLICY "contas_pagar_anexos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contas-pagar-anexos'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  );

DROP POLICY IF EXISTS "contas_pagar_anexos_storage_update" ON storage.objects;
CREATE POLICY "contas_pagar_anexos_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contas-pagar-anexos'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    bucket_id = 'contas-pagar-anexos'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  );

DROP POLICY IF EXISTS "contas_pagar_anexos_storage_delete" ON storage.objects;
CREATE POLICY "contas_pagar_anexos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contas-pagar-anexos'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  );

-- <<< END 20260514120000_contas_pagar.sql

-- >>> BEGIN 20260515120000_usuarios_cargos_canonicos_e_auditoria.sql

-- =============================================================================
-- Cargos canónicos + auditoria de mudança de cargo + RLS de gestão de usuários
-- Alinhado ao documento de regras de negócio:
--   - 9 cargos canónicos
--   - Diretoria também pode gerir usuários (UPDATE), Administrador continua para tudo
--   - Mudanças de cargo passam a ser registadas em usuarios_cargo_log
-- =============================================================================

-- 1) Validação dos cargos canónicos -----------------------------------------
-- Não bloqueia legados em branco/null para não quebrar contas em onboarding.
alter table public.usuarios
  drop constraint if exists usuarios_cargo_canonico_chk;

alter table public.usuarios
  add constraint usuarios_cargo_canonico_chk
  check (
    cargo is null
    or btrim(cargo) = ''
    or cargo in (
      'Administrador',
      'Diretoria',
      'Comercial',
      'Operacional',
      'Logística',
      'Balanceiro',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

comment on constraint usuarios_cargo_canonico_chk on public.usuarios is
  'Cargos canónicos do sistema (acentuação: Logística). Vazio/NULL é aceito para onboarding.';

-- 2) Auditoria de mudança de cargo ------------------------------------------
create table if not exists public.usuarios_cargo_log (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  cargo_antigo text,
  cargo_novo text,
  alterado_por uuid references public.usuarios(id) on delete set null,
  alterado_em timestamptz not null default now()
);

create index if not exists usuarios_cargo_log_usuario_id_idx
  on public.usuarios_cargo_log(usuario_id, alterado_em desc);

alter table public.usuarios_cargo_log enable row level security;

drop policy if exists "usuarios_cargo_log_select_admin_diretoria" on public.usuarios_cargo_log;
create policy "usuarios_cargo_log_select_admin_diretoria"
  on public.usuarios_cargo_log for select to authenticated
  using (public.rg_is_admin() or public.rg_is_diretoria());

drop policy if exists "usuarios_cargo_log_insert_admin_diretoria" on public.usuarios_cargo_log;
create policy "usuarios_cargo_log_insert_admin_diretoria"
  on public.usuarios_cargo_log for insert to authenticated
  with check (public.rg_is_admin() or public.rg_is_diretoria());

grant select, insert on public.usuarios_cargo_log to authenticated;

create or replace function public.usuarios_log_cargo_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') and (coalesce(new.cargo,'') is distinct from coalesce(old.cargo,'')) then
    insert into public.usuarios_cargo_log (usuario_id, cargo_antigo, cargo_novo, alterado_por)
    values (new.id, old.cargo, new.cargo, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_cargo_change_log on public.usuarios;
create trigger usuarios_cargo_change_log
  after update of cargo on public.usuarios
  for each row execute function public.usuarios_log_cargo_change();

-- 3) RLS — gestão de usuários (Admin + Diretoria) ---------------------------
-- Mantém a policy existente de "atualizar o próprio perfil" para uso geral.
-- Adiciona policy específica para Admin e Diretoria poderem editar outros.

alter table public.usuarios enable row level security;

drop policy if exists "usuarios_update_admin_diretoria" on public.usuarios;
create policy "usuarios_update_admin_diretoria"
  on public.usuarios for update to authenticated
  using (public.rg_is_admin() or public.rg_is_diretoria())
  with check (public.rg_is_admin() or public.rg_is_diretoria());

-- Inserção/eliminação direta continua só para Admin (Edge Functions usam service_role e ignoram RLS).
drop policy if exists "usuarios_insert_admin" on public.usuarios;
create policy "usuarios_insert_admin"
  on public.usuarios for insert to authenticated
  with check (public.rg_is_admin());

drop policy if exists "usuarios_delete_admin" on public.usuarios;
create policy "usuarios_delete_admin"
  on public.usuarios for delete to authenticated
  using (public.rg_is_admin());

grant select, insert, update, delete on public.usuarios to authenticated;

-- <<< END 20260515120000_usuarios_cargos_canonicos_e_auditoria.sql

-- >>> BEGIN 20260516120000_clientes_dados_operacionais_planilha.sql

-- Dados operacionais vindos da planilha real de clientes (CLIENTES / DESTINAÇÕES / CLINICAS).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_ibama text,
  ADD COLUMN IF NOT EXISTS descricao_veiculo text,
  ADD COLUMN IF NOT EXISTS mtr_coleta text,
  ADD COLUMN IF NOT EXISTS destino text,
  ADD COLUMN IF NOT EXISTS mtr_destino text,
  ADD COLUMN IF NOT EXISTS residuo_destino text,
  ADD COLUMN IF NOT EXISTS observacoes_operacionais text,
  ADD COLUMN IF NOT EXISTS ajudante text,
  ADD COLUMN IF NOT EXISTS solicitante text,
  ADD COLUMN IF NOT EXISTS origem_planilha_cliente text,
  ADD COLUMN IF NOT EXISTS cnpj_raiz text,
  ADD COLUMN IF NOT EXISTS tipo_unidade_cliente text;

COMMENT ON COLUMN public.clientes.codigo_ibama IS 'Codigo IBAMA informado na planilha de clientes.';
COMMENT ON COLUMN public.clientes.descricao_veiculo IS 'Descricao textual do veiculo preferencial informado na planilha.';
COMMENT ON COLUMN public.clientes.mtr_coleta IS 'Regra ou observacao sobre MTR de coleta.';
COMMENT ON COLUMN public.clientes.destino IS 'Destino operacional informado na planilha.';
COMMENT ON COLUMN public.clientes.mtr_destino IS 'Regra ou observacao sobre MTR de destino.';
COMMENT ON COLUMN public.clientes.residuo_destino IS 'Residuo de destino informado na planilha.';
COMMENT ON COLUMN public.clientes.observacoes_operacionais IS 'Observacoes livres da planilha para operacao/coleta.';
COMMENT ON COLUMN public.clientes.ajudante IS 'Indicacao textual sobre necessidade de ajudante.';
COMMENT ON COLUMN public.clientes.solicitante IS 'Solicitante informado na planilha, quando houver.';
COMMENT ON COLUMN public.clientes.origem_planilha_cliente IS 'Aba da planilha original usada na importacao do cliente.';
COMMENT ON COLUMN public.clientes.cnpj_raiz IS 'Raiz de 8 digitos do CNPJ para agrupar matriz e filiais; vazio para CPF.';
COMMENT ON COLUMN public.clientes.tipo_unidade_cliente IS 'Tipo da unidade pelo documento: Matriz, Filial ou Pessoa fisica.';

CREATE INDEX IF NOT EXISTS idx_clientes_codigo_ibama
  ON public.clientes (codigo_ibama)
  WHERE codigo_ibama IS NOT NULL AND btrim(codigo_ibama) <> '';

CREATE INDEX IF NOT EXISTS idx_clientes_origem_planilha_cliente
  ON public.clientes (origem_planilha_cliente)
  WHERE origem_planilha_cliente IS NOT NULL AND btrim(origem_planilha_cliente) <> '';

CREATE INDEX IF NOT EXISTS idx_clientes_cnpj_raiz
  ON public.clientes (cnpj_raiz)
  WHERE cnpj_raiz IS NOT NULL AND btrim(cnpj_raiz) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_documento_normalizado
  ON public.clientes ((regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')))
  WHERE regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') <> '';

-- <<< END 20260516120000_clientes_dados_operacionais_planilha.sql

-- >>> BEGIN 20260517120000_clientes_validade_cadri_indice_e_comentarios.sql

-- Acelera o filtro "CADRI vencendo em 30/60/90 dias" da listagem de clientes
-- e dashboards de compliance que filtrem por validade próxima.
-- Também documenta as colunas pré-existentes que correspondem ao CADRI da planilha.
COMMENT ON COLUMN public.clientes.licenca_numero
  IS 'Número do CADRI (Certificado de Movimentação de Resíduos de Interesse Ambiental).';
COMMENT ON COLUMN public.clientes.validade
  IS 'Data de vencimento do CADRI (coluna "Venc CADRI" da planilha).';

CREATE INDEX IF NOT EXISTS idx_clientes_validade
  ON public.clientes (validade)
  WHERE validade IS NOT NULL;

-- <<< END 20260517120000_clientes_validade_cadri_indice_e_comentarios.sql

-- >>> BEGIN 20260518120000_clientes_observacoes_gerais_link_google_maps.sql

-- Observacoes gerais do cadastro e link do Google Maps (GPS / localizacao).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS observacoes_gerais text,
  ADD COLUMN IF NOT EXISTS link_google_maps text;

COMMENT ON COLUMN public.clientes.observacoes_gerais IS 'Observacoes gerais do cliente (cadastro), distintas das observacoes operacionais da planilha.';
COMMENT ON COLUMN public.clientes.link_google_maps IS 'URL do Google Maps com a localizacao do cliente (ex.: link compartilhado ou coordenadas).';

-- <<< END 20260518120000_clientes_observacoes_gerais_link_google_maps.sql

-- >>> BEGIN 20260518130000_coletas_ticket_aprovacao_faturamento.sql

-- Após imprimir o ticket (Controle de Massa), a coleta entra na fila de aprovação do Faturamento.
-- Só após `faturamento_ticket_aprovado_em` pode seguir para emissão / faturamento.

ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS ticket_impresso_em timestamptz,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovado_por_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS faturamento_ticket_aprovacao_obs text;

COMMENT ON COLUMN public.coletas.ticket_impresso_em IS
  'Preenchido quando o operador imprime o ticket no Controle de Massa; dispara fila de aprovação do Faturamento.';

COMMENT ON COLUMN public.coletas.faturamento_ticket_aprovado_em IS
  'Validação do ticket pelo perfil Faturamento; obrigatório antes de «Faturar» / emitir ao Financeiro.';

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

-- <<< END 20260518130000_coletas_ticket_aprovacao_faturamento.sql

-- >>> BEGIN 20260519120000_programacoes_mtrs_criador_auditoria.sql

-- =============================================================================
-- Auditoria: quem lançou programação e MTR (nome + user id). Imutável na app
-- exceto para cargo Desenvolvedor (enforcement por trigger).
-- Atualiza RPC de expansão de coleta fixa para copiar o criador do template.
-- =============================================================================

ALTER TABLE public.programacoes
  ADD COLUMN IF NOT EXISTS criado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS criado_por_nome text;

COMMENT ON COLUMN public.programacoes.criado_por_user_id IS 'auth.users / usuarios.id do utilizador que criou a linha (auditoria).';
COMMENT ON COLUMN public.programacoes.criado_por_nome IS 'Nome de exibição gravado no lançamento (auditoria; imutável exceto Desenvolvedor).';

ALTER TABLE public.mtrs
  ADD COLUMN IF NOT EXISTS criado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS criado_por_nome text;

COMMENT ON COLUMN public.mtrs.criado_por_user_id IS 'auth.users / usuarios.id do utilizador que criou a MTR (auditoria).';
COMMENT ON COLUMN public.mtrs.criado_por_nome IS 'Nome de exibição gravado no lançamento (auditoria; imutável exceto Desenvolvedor).';

CREATE OR REPLACE FUNCTION public.trg_bloquear_mudanca_criador_exceto_desenvolvedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF (NEW.criado_por_user_id IS DISTINCT FROM OLD.criado_por_user_id)
     OR (NEW.criado_por_nome IS DISTINCT FROM OLD.criado_por_nome) THEN
    -- Migrações / service role / SQL editor: sem JWT — não bloquear.
    IF auth.uid() IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.id = auth.uid()
          AND lower(trim(coalesce(u.cargo, ''))) LIKE '%desenvolvedor%'
      ) THEN
        RAISE EXCEPTION 'Somente o cargo Desenvolvedor pode alterar os campos de auditoria do lançamento (criado_por).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_programacoes_criador_lock ON public.programacoes;
CREATE TRIGGER trg_programacoes_criador_lock
  BEFORE UPDATE ON public.programacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bloquear_mudanca_criador_exceto_desenvolvedor();

DROP TRIGGER IF EXISTS trg_mtrs_criador_lock ON public.mtrs;
CREATE TRIGGER trg_mtrs_criador_lock
  BEFORE UPDATE ON public.mtrs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bloquear_mudanca_criador_exceto_desenvolvedor();

-- Mantém a lógica de 20260511130000_programacao_dias_semana.sql e acrescenta criador na expansão.
CREATE OR REPLACE FUNCTION public.programacao_manter_fixas_semanais(p_horizonte_semanas integer DEFAULT 53)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  tmpl public.programacoes%ROWTYPE;
  v_d date;
  v_lim date;
  v_anchor date;
  v_serie_min date;
  v_num text;
  n_ins integer := 0;
  dias integer[];
BEGIN
  IF p_horizonte_semanas IS NULL OR p_horizonte_semanas < 1 THEN
    p_horizonte_semanas := 53;
  END IF;

  v_lim := (CURRENT_DATE + (p_horizonte_semanas * 7))::date;

  FOR r IN
    SELECT DISTINCT w.programacao_serie_id AS sid
    FROM public.programacoes w
    WHERE w.programacao_serie_id IS NOT NULL
      AND coalesce(w.coleta_fixa, false)
      AND (
        public.programacao_periodicidade_e_semanal(w.periodicidade)
        OR (
          w.programacao_dias_semana IS NOT NULL
          AND coalesce(array_length(w.programacao_dias_semana, 1), 0) > 0
        )
      )
  LOOP
    SELECT p.*
    INTO tmpl
    FROM public.programacoes p
    WHERE p.programacao_serie_id = r.sid
    ORDER BY p.data_programada DESC NULLS LAST, p.created_at DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF NOT coalesce(tmpl.coleta_fixa, false) THEN
      CONTINUE;
    END IF;

    IF tmpl.data_programada IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT public.programacao_periodicidade_e_semanal(tmpl.periodicidade)
       AND (
         tmpl.programacao_dias_semana IS NULL
         OR coalesce(array_length(tmpl.programacao_dias_semana, 1), 0) = 0
       ) THEN
      CONTINUE;
    END IF;

    dias := ARRAY(
      SELECT DISTINCT u::integer
      FROM unnest(coalesce(tmpl.programacao_dias_semana, '{}'::smallint[])) AS u
      WHERE u BETWEEN 1 AND 7
      ORDER BY 1
    );

    IF dias IS NULL OR cardinality(dias) = 0 THEN
      dias := ARRAY[EXTRACT(ISODOW FROM tmpl.data_programada::date)::integer];
    END IF;

    SELECT min(p.data_programada::date)
    INTO v_serie_min
    FROM public.programacoes p
    WHERE p.programacao_serie_id = r.sid;

    IF v_serie_min IS NULL THEN
      CONTINUE;
    END IF;

    v_anchor := GREATEST(CURRENT_DATE, v_serie_min);
    v_d := v_anchor;

    WHILE v_d <= v_lim LOOP
      IF EXTRACT(ISODOW FROM v_d)::integer = ANY(dias) THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.programacoes x
          WHERE x.programacao_serie_id = r.sid
            AND x.data_programada = v_d
        ) THEN
          v_num := lpad(
            ((SELECT count(*)::bigint FROM public.programacoes) + 1)::text,
            3,
            '0'
          );

          INSERT INTO public.programacoes (
            numero,
            cliente_id,
            cliente,
            data_programada,
            tipo_caminhao,
            tipo_servico,
            observacoes,
            coleta_fixa,
            periodicidade,
            status_programacao,
            coleta_id,
            programacao_serie_id,
            programacao_dias_semana,
            criado_por_user_id,
            criado_por_nome
          ) VALUES (
            v_num,
            tmpl.cliente_id,
            tmpl.cliente,
            v_d,
            tmpl.tipo_caminhao,
            tmpl.tipo_servico,
            tmpl.observacoes,
            true,
            coalesce(nullif(trim(tmpl.periodicidade), ''), 'Semanal'),
            'PENDENTE',
            NULL,
            tmpl.programacao_serie_id,
            tmpl.programacao_dias_semana,
            tmpl.criado_por_user_id,
            tmpl.criado_por_nome
          );

          n_ins := n_ins + 1;
        END IF;
      END IF;

      v_d := (v_d + 1)::date;
    END LOOP;
  END LOOP;

  RETURN n_ins;
END;
$$;

REVOKE ALL ON FUNCTION public.programacao_manter_fixas_semanais(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.programacao_manter_fixas_semanais(integer) TO authenticated;

-- <<< END 20260519120000_programacoes_mtrs_criador_auditoria.sql

-- >>> BEGIN 20260519130000_backfill_criado_por_nome_de_usuarios.sql

-- Preenche criado_por_nome a partir de public.usuarios quando só o UUID foi gravado.
-- Desliga triggers de auditoria: no SQL Editor o JWT não é «Desenvolvedor».

ALTER TABLE public.programacoes DISABLE TRIGGER trg_programacoes_criador_lock;
ALTER TABLE public.mtrs DISABLE TRIGGER trg_mtrs_criador_lock;

UPDATE public.programacoes p
SET criado_por_nome = btrim(coalesce(u.nome, u.email))
FROM public.usuarios u
WHERE p.criado_por_user_id = u.id
  AND (p.criado_por_nome IS NULL OR btrim(p.criado_por_nome) = '')
  AND btrim(coalesce(u.nome, u.email)) <> '';

UPDATE public.mtrs m
SET criado_por_nome = btrim(coalesce(u.nome, u.email))
FROM public.usuarios u
WHERE m.criado_por_user_id = u.id
  AND (m.criado_por_nome IS NULL OR btrim(m.criado_por_nome) = '')
  AND btrim(coalesce(u.nome, u.email)) <> '';

ALTER TABLE public.programacoes ENABLE TRIGGER trg_programacoes_criador_lock;
ALTER TABLE public.mtrs ENABLE TRIGGER trg_mtrs_criador_lock;

-- <<< END 20260519130000_backfill_criado_por_nome_de_usuarios.sql

-- >>> BEGIN 20260519131000_trg_criador_permite_sem_jwt.sql

-- Ajuste: permitir UPDATE de criado_por_* quando auth.uid() é NULL (migrações, SQL interno).
CREATE OR REPLACE FUNCTION public.trg_bloquear_mudanca_criador_exceto_desenvolvedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF (NEW.criado_por_user_id IS DISTINCT FROM OLD.criado_por_user_id)
     OR (NEW.criado_por_nome IS DISTINCT FROM OLD.criado_por_nome) THEN
    IF auth.uid() IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.id = auth.uid()
          AND lower(trim(coalesce(u.cargo, ''))) LIKE '%desenvolvedor%'
      ) THEN
        RAISE EXCEPTION 'Somente o cargo Desenvolvedor pode alterar os campos de auditoria do lançamento (criado_por).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- <<< END 20260519131000_trg_criador_permite_sem_jwt.sql

-- >>> BEGIN 20260519140000_clientes_contrato_veiculos_equipamentos_residuos.sql

-- Veículos/equipamentos de contrato e resíduos estruturados no cadastro de clientes.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS veiculos_contrato jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipamentos_contrato jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS residuos_contrato jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clientes.veiculos_contrato IS
  'Lista [{ tipo_veiculo, sem_custo, valor }] — veículos do contrato comercial.';

COMMENT ON COLUMN public.clientes.equipamentos_contrato IS
  'Lista [{ descricao, com_custo, valor }] — equipamentos do contrato.';

COMMENT ON COLUMN public.clientes.residuos_contrato IS
  'Lista [{ tipo_residuo, classificacao, unidade_medida, valor, frequencia_coleta, faturamento_minimo }].';

-- <<< END 20260519140000_clientes_contrato_veiculos_equipamentos_residuos.sql

-- >>> BEGIN 20260519140000_programacoes_legado_criador_rafaela_thomaz.sql

-- =============================================================================
-- Legado: todas as programações já existentes passam a constar como lançadas
-- por «Rafaela Thomaz». O UUID é preenchido a partir de public.usuarios quando
-- existir utilizadora com esse nome; senão mantém-se o criado_por_user_id já
-- gravado (se houver). Novas programações continuam a ser gravadas pela app
-- com o utilizador autenticado.
--
-- O trigger de auditoria bloqueia alterações a criado_por_* para quem não é
-- Desenvolvedor (incl. no SQL Editor com JWT). Desliga-se temporariamente aqui.
-- =============================================================================

ALTER TABLE public.programacoes DISABLE TRIGGER trg_programacoes_criador_lock;

DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT u.id
  INTO v_uid
  FROM public.usuarios u
  WHERE lower(regexp_replace(trim(coalesce(u.nome, '')), '\s+', ' ', 'g')) = lower('Rafaela Thomaz')
  LIMIT 1;

  IF v_uid IS NULL THEN
    SELECT u.id
    INTO v_uid
    FROM public.usuarios u
    WHERE lower(trim(coalesce(u.nome, ''))) LIKE '%rafaela%'
      AND lower(trim(coalesce(u.nome, ''))) LIKE '%thomaz%'
    LIMIT 1;
  END IF;

  UPDATE public.programacoes p
  SET
    criado_por_nome = 'Rafaela Thomaz',
    criado_por_user_id = coalesce(p.criado_por_user_id, v_uid);

  RAISE NOTICE 'programacoes: criado_por_nome = Rafaela Thomaz em todas as linhas; uuid resolvido: %', v_uid;
END $$;

ALTER TABLE public.programacoes ENABLE TRIGGER trg_programacoes_criador_lock;

-- <<< END 20260519140000_programacoes_legado_criador_rafaela_thomaz.sql

-- >>> BEGIN 20260520120000_programacoes_caminhao_designado.sql

-- Veículo da frota designado na programação (distinto de tipo_caminhao = tipo de equipamento).
-- Copia o valor na expansão de coletas fixas semanais.

ALTER TABLE public.programacoes
  ADD COLUMN IF NOT EXISTS caminhao_id uuid REFERENCES public.caminhoes (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programacoes_caminhao_id
  ON public.programacoes (caminhao_id)
  WHERE caminhao_id IS NOT NULL;

COMMENT ON COLUMN public.programacoes.caminhao_id IS
  'Veículo da frota (caminhoes.id) designado para o serviço; opcional.';

CREATE OR REPLACE FUNCTION public.programacao_manter_fixas_semanais(p_horizonte_semanas integer DEFAULT 53)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  tmpl public.programacoes%ROWTYPE;
  v_d date;
  v_lim date;
  v_anchor date;
  v_serie_min date;
  v_num text;
  n_ins integer := 0;
  dias integer[];
BEGIN
  IF p_horizonte_semanas IS NULL OR p_horizonte_semanas < 1 THEN
    p_horizonte_semanas := 53;
  END IF;

  v_lim := (CURRENT_DATE + (p_horizonte_semanas * 7))::date;

  FOR r IN
    SELECT DISTINCT w.programacao_serie_id AS sid
    FROM public.programacoes w
    WHERE w.programacao_serie_id IS NOT NULL
      AND coalesce(w.coleta_fixa, false)
      AND (
        public.programacao_periodicidade_e_semanal(w.periodicidade)
        OR (
          w.programacao_dias_semana IS NOT NULL
          AND coalesce(array_length(w.programacao_dias_semana, 1), 0) > 0
        )
      )
  LOOP
    SELECT p.*
    INTO tmpl
    FROM public.programacoes p
    WHERE p.programacao_serie_id = r.sid
    ORDER BY p.data_programada DESC NULLS LAST, p.created_at DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF NOT coalesce(tmpl.coleta_fixa, false) THEN
      CONTINUE;
    END IF;

    IF tmpl.data_programada IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT public.programacao_periodicidade_e_semanal(tmpl.periodicidade)
       AND (
         tmpl.programacao_dias_semana IS NULL
         OR coalesce(array_length(tmpl.programacao_dias_semana, 1), 0) = 0
       ) THEN
      CONTINUE;
    END IF;

    dias := ARRAY(
      SELECT DISTINCT u::integer
      FROM unnest(coalesce(tmpl.programacao_dias_semana, '{}'::smallint[])) AS u
      WHERE u BETWEEN 1 AND 7
      ORDER BY 1
    );

    IF dias IS NULL OR cardinality(dias) = 0 THEN
      dias := ARRAY[EXTRACT(ISODOW FROM tmpl.data_programada::date)::integer];
    END IF;

    SELECT min(p.data_programada::date)
    INTO v_serie_min
    FROM public.programacoes p
    WHERE p.programacao_serie_id = r.sid;

    IF v_serie_min IS NULL THEN
      CONTINUE;
    END IF;

    v_anchor := GREATEST(CURRENT_DATE, v_serie_min);
    v_d := v_anchor;

    WHILE v_d <= v_lim LOOP
      IF EXTRACT(ISODOW FROM v_d)::integer = ANY(dias) THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.programacoes x
          WHERE x.programacao_serie_id = r.sid
            AND x.data_programada = v_d
        ) THEN
          v_num := lpad(
            ((SELECT count(*)::bigint FROM public.programacoes) + 1)::text,
            3,
            '0'
          );

          INSERT INTO public.programacoes (
            numero,
            cliente_id,
            cliente,
            data_programada,
            tipo_caminhao,
            tipo_servico,
            observacoes,
            coleta_fixa,
            periodicidade,
            status_programacao,
            coleta_id,
            programacao_serie_id,
            programacao_dias_semana,
            criado_por_user_id,
            criado_por_nome,
            caminhao_id
          ) VALUES (
            v_num,
            tmpl.cliente_id,
            tmpl.cliente,
            v_d,
            tmpl.tipo_caminhao,
            tmpl.tipo_servico,
            tmpl.observacoes,
            true,
            coalesce(nullif(trim(tmpl.periodicidade), ''), 'Semanal'),
            'PENDENTE',
            NULL,
            tmpl.programacao_serie_id,
            tmpl.programacao_dias_semana,
            tmpl.criado_por_user_id,
            tmpl.criado_por_nome,
            tmpl.caminhao_id
          );

          n_ins := n_ins + 1;
        END IF;
      END IF;

      v_d := (v_d + 1)::date;
    END LOOP;
  END LOOP;

  RETURN n_ins;
END;
$$;

REVOKE ALL ON FUNCTION public.programacao_manter_fixas_semanais(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.programacao_manter_fixas_semanais(integer) TO authenticated;

-- <<< END 20260520120000_programacoes_caminhao_designado.sql

-- >>> BEGIN 20260520140000_excluir_mtr_coleta_cascata.sql

-- Exclusão em lote de MTR/coleta sem timeout (evita CASCADE lento via PostgREST + RLS por linha).
-- Aplicar: npm run db:apply:sql -- supabase/migrations/20260520140000_excluir_mtr_coleta_cascata.sql

CREATE OR REPLACE FUNCTION public._rg_pode_excluir_operacional_mtr()
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
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
    );
$$;

CREATE OR REPLACE FUNCTION public._excluir_dependencias_coleta_ids(p_coleta_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_coleta_ids IS NULL OR cardinality(p_coleta_ids) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.programacoes
  SET coleta_id = NULL
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.contas_receber
  WHERE referencia_coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.faturamento_registros
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.financeiro_documentos
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.checklist_transporte
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.conferencia_transporte
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.tickets_operacionais
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.conferencia_operacional
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.aprovacoes_diretoria
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.controle_massa
  WHERE coleta_id = ANY (p_coleta_ids);

  UPDATE public.comprovantes_descarte
  SET
    coleta_id = NULL,
    controle_massa_id = NULL
  WHERE coleta_id = ANY (p_coleta_ids);

  DELETE FROM public.coletas
  WHERE id = ANY (p_coleta_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_coleta_por_id(p_coleta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_coleta_id IS NULL THEN
    RAISE EXCEPTION 'Coleta inválida';
  END IF;

  IF NOT public._rg_pode_excluir_operacional_mtr() THEN
    RAISE EXCEPTION 'Sem permissão para excluir coleta';
  END IF;

  PERFORM public._excluir_dependencias_coleta_ids(ARRAY[p_coleta_id]);
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_mtr_por_id(p_mtr_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coleta_ids uuid[];
  v_prog_id uuid;
BEGIN
  IF p_mtr_id IS NULL THEN
    RAISE EXCEPTION 'MTR inválida';
  END IF;

  IF NOT public._rg_pode_excluir_operacional_mtr() THEN
    RAISE EXCEPTION 'Sem permissão para excluir MTR';
  END IF;

  SELECT coalesce(array_agg(c.id), ARRAY[]::uuid[])
  INTO v_coleta_ids
  FROM public.coletas c
  WHERE c.mtr_id = p_mtr_id;

  SELECT m.programacao_id
  INTO v_prog_id
  FROM public.mtrs m
  WHERE m.id = p_mtr_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MTR não encontrada';
  END IF;

  PERFORM public._excluir_dependencias_coleta_ids(v_coleta_ids);

  UPDATE public.comprovantes_descarte
  SET mtr_id = NULL
  WHERE mtr_id = p_mtr_id;

  DELETE FROM public.mtrs
  WHERE id = p_mtr_id;

  IF v_prog_id IS NOT NULL THEN
    UPDATE public.programacoes
    SET status_programacao = 'PENDENTE'
    WHERE id = v_prog_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_mtr_por_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_coleta_por_id(uuid) TO authenticated;

COMMENT ON FUNCTION public.excluir_mtr_por_id(uuid) IS
  'Remove MTR e coletas vinculadas (dependências operacionais/financeiras) numa única transação.';

COMMENT ON FUNCTION public.excluir_coleta_por_id(uuid) IS
  'Remove coleta e dependências operacionais/financeiras numa única transação.';

-- <<< END 20260520140000_excluir_mtr_coleta_cascata.sql

-- >>> BEGIN 20260520160000_residuos_catalogo_comercial_mix.sql

-- Catálogo: mix contaminado e resíduos comerciais (cadastro de clientes / MTR)
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

-- <<< END 20260520160000_residuos_catalogo_comercial_mix.sql

-- >>> BEGIN 20260520180000_chat_resolve_suporte_user.sql

-- Destinatário do balão «Suporte técnico» quando VITE não define UUID/e-mail válidos.
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

-- <<< END 20260520180000_chat_resolve_suporte_user.sql

-- >>> BEGIN 20260521120000_coletas_controle_massa_residuos_itens.sql

-- Vários resíduos por pesagem (Controle de Massa)
ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS residuos_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.controle_massa
  ADD COLUMN IF NOT EXISTS residuos_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.coletas.residuos_itens IS
  'JSON array: [{ catalogo_id, texto, peso_tara, peso_bruto, peso_liquido }]. Vários resíduos por ticket; colunas peso_* da coleta = soma dos itens.';

COMMENT ON COLUMN public.controle_massa.residuos_itens IS
  'Mesmo formato que coletas.residuos_itens — espelho da pesagem por coleta.';

-- <<< END 20260521120000_coletas_controle_massa_residuos_itens.sql

-- >>> BEGIN 20260521180000_ticket_numero_seq_assinatura_motorista.sql

-- Sequência global para número do ticket operacional (piso 1340 na primeira emissão).
-- Assinatura guardada no cadastro do motorista (opcional) para reutilizar na conferência.

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

-- <<< END 20260521180000_ticket_numero_seq_assinatura_motorista.sql

-- >>> BEGIN 20260521190000_chat_desenvolvedor_apagar_historico.sql

-- =============================================================================
-- Chat interno: perfil Desenvolvedor pode apagar histórico da conversa
-- (mensagens + anexos). Requer participação na conversa.
-- =============================================================================

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

  -- Anexos em chat-anexos: removidos pela app (Storage API). DELETE em storage.objects está proibido no hosted Supabase.

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

-- <<< END 20260521190000_chat_desenvolvedor_apagar_historico.sql

-- >>> BEGIN 20260522120000_chat_apagar_historico_sem_delete_storage.sql

-- hosted Supabase proíbe DELETE directo em storage.objects — usar Storage API no cliente.

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
  'Apaga mensagens; ficheiros em chat-anexos são removidos no cliente (Storage API).';

-- <<< END 20260522120000_chat_apagar_historico_sem_delete_storage.sql

-- >>> BEGIN 20260522120000_clientes_mtr_sigor.sql

-- SIGOR no cadastro de clientes (substituído por 20260522130000_clientes_mtr_sigor_opcoes.sql).
-- Mantido vazio: coluna criada/atualizada na migration seguinte.

-- <<< END 20260522120000_clientes_mtr_sigor.sql

-- >>> BEGIN 20260522130000_clientes_mtr_sigor_opcoes.sql

-- SIGOR no cadastro de clientes: cliente | rg | nao_tem (texto; migra boolean legado se existir).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'mtr_sigor'
      AND udt_name = 'bool'
  ) THEN
    ALTER TABLE public.clientes
      ALTER COLUMN mtr_sigor TYPE text
      USING (
        CASE
          WHEN mtr_sigor IS TRUE THEN 'cliente'
          WHEN mtr_sigor IS FALSE THEN 'nao_tem'
          ELSE NULL
        END
      );
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'mtr_sigor'
  ) THEN
    ALTER TABLE public.clientes ADD COLUMN mtr_sigor text;
  END IF;
END $$;

COMMENT ON COLUMN public.clientes.mtr_sigor IS 'SIGOR: cliente | rg | nao_tem (null = não informado).';

-- <<< END 20260522130000_clientes_mtr_sigor_opcoes.sql

-- >>> BEGIN 20260522140000_faturamento_registros_resumo_financeiro.sql

-- Desvinculação financeira no faturamento: snapshot editável (ticket + MTR) sem alterar operacional.

ALTER TABLE public.faturamento_registros
  ADD COLUMN IF NOT EXISTS resumo_financeiro jsonb;

COMMENT ON COLUMN public.faturamento_registros.resumo_financeiro IS
  'Snapshot JSON (ticket + MTR) com pesos/valores de faturamento desvinculados do operacional.';

-- <<< END 20260522140000_faturamento_registros_resumo_financeiro.sql

-- >>> BEGIN 20260522180000_peso_conferencia_alinha_bruto.sql

-- Conferência do ticket: corrigir persistência do peso manual (alinha bruto = tara + líquido).

CREATE OR REPLACE FUNCTION public.atualizar_peso_liquido_conferencia_ticket(
  p_coleta_id uuid,
  p_peso_liquido numeric,
  p_residuos_itens jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
  v_tara numeric;
  v_bruto numeric;
BEGIN
  IF p_coleta_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta inválida.');
  END IF;

  IF p_peso_liquido IS NULL OR p_peso_liquido <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe um peso líquido maior que zero (kg).');
  END IF;

  IF NOT public.rg_pode_ajustar_peso_conferencia_ticket() THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'message',
      'Sem permissão para alterar o peso nesta conferência (perfil ou política RLS).'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coletas c WHERE c.id = p_coleta_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta não encontrada.');
  END IF;

  SELECT c.peso_tara INTO v_tara
  FROM public.coletas c
  WHERE c.id = p_coleta_id;

  IF v_tara IS NOT NULL THEN
    v_bruto := v_tara + p_peso_liquido;
  END IF;

  BEGIN
    UPDATE public.coletas
    SET
      peso_liquido = p_peso_liquido,
      peso_bruto = COALESCE(v_bruto, peso_bruto),
      residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
    WHERE id = p_coleta_id;
  EXCEPTION
    WHEN undefined_column THEN
      UPDATE public.coletas
      SET peso_liquido = p_peso_liquido
      WHERE id = p_coleta_id;
  END;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível atualizar o peso na coleta.');
  END IF;

  BEGIN
    UPDATE public.controle_massa
    SET
      peso_liquido = p_peso_liquido,
      peso_bruto = COALESCE(v_bruto, peso_bruto),
      residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
    WHERE coleta_id = p_coleta_id;
  EXCEPTION
    WHEN undefined_column THEN
      UPDATE public.controle_massa
      SET peso_liquido = p_peso_liquido
      WHERE coleta_id = p_coleta_id;
  END;

  RETURN jsonb_build_object('ok', true, 'peso_liquido', p_peso_liquido);
END;
$$;

COMMENT ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) IS
  'Fila de conferência do ticket: grava peso líquido (e bruto = tara + líquido quando há tara) na coleta e controle_massa.';

GRANT EXECUTE ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) TO authenticated;

-- <<< END 20260522180000_peso_conferencia_alinha_bruto.sql

-- >>> BEGIN 20260522190000_faturamento_registros_rls_operacional.sql

-- Faturamento registros: Operacional e pesagem podem gravar/atualizar resumo pendente (ex.: editar peso na conferência do ticket).

DROP POLICY IF EXISTS "faturamento_registros_mutate_faturamento" ON public.faturamento_registros;

CREATE POLICY "faturamento_registros_mutate_faturamento"
  ON public.faturamento_registros FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_is_diretoria()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
  );

-- <<< END 20260522190000_faturamento_registros_rls_operacional.sql

-- >>> BEGIN 20260523120000_usuarios_cargo_os_meninos.sql

-- Perfil «Os Meninos» (operadores de pesagem / ticket padrão).
alter table public.usuarios
  drop constraint if exists usuarios_cargo_canonico_chk;

alter table public.usuarios
  add constraint usuarios_cargo_canonico_chk
  check (
    cargo is null
    or btrim(cargo) = ''
    or cargo in (
      'Desenvolvedor',
      'Administrador',
      'Diretoria',
      'Comercial',
      'Operacional',
      'Logística',
      'Balanceiro',
      'Os Meninos',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

comment on constraint usuarios_cargo_canonico_chk on public.usuarios is
  'Cargos canónicos (inclui Os Meninos — lançamento de ticket sem edição financeira posterior).';

-- <<< END 20260523120000_usuarios_cargo_os_meninos.sql

-- >>> BEGIN 20260524120000_usuarios_cargo_gerente_time.sql

-- Perfil «Gerente do Time» (edição de valores e encerramento definitivo do ticket no faturamento).
alter table public.usuarios
  drop constraint if exists usuarios_cargo_canonico_chk;

alter table public.usuarios
  add constraint usuarios_cargo_canonico_chk
  check (
    cargo is null
    or btrim(cargo) = ''
    or cargo in (
      'Desenvolvedor',
      'Administrador',
      'Diretoria',
      'Comercial',
      'Operacional',
      'Logística',
      'Balanceiro',
      'Os Meninos',
      'Gerente do Time',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

comment on constraint usuarios_cargo_canonico_chk on public.usuarios is
  'Cargos canónicos (inclui Gerente do Time — valores editáveis e encerramento de ticket no faturamento).';

-- <<< END 20260524120000_usuarios_cargo_gerente_time.sql

-- >>> BEGIN 20260525120000_usuarios_cargo_operadores.sql

-- Rename perfil «Os Meninos» → «Operadores» (pesagem / ticket padrão).

UPDATE public.usuarios
SET cargo = 'Operadores'
WHERE cargo = 'Os Meninos';

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_cargo_canonico_chk;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_cargo_canonico_chk
  CHECK (
    cargo IS NULL
    OR btrim(cargo) = ''
    OR cargo IN (
      'Desenvolvedor',
      'Administrador',
      'Diretoria',
      'Comercial',
      'Operacional',
      'Logística',
      'Balanceiro',
      'Operadores',
      'Gerente do Time',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

COMMENT ON CONSTRAINT usuarios_cargo_canonico_chk ON public.usuarios IS
  'Cargos canónicos (Operadores = pesagem/ticket padrão; distinto de Operacional).';

-- <<< END 20260525120000_usuarios_cargo_operadores.sql

-- >>> BEGIN 20260525180000_clientes_gerenciador.sql

-- Cadastro Gerenciador (sub-módulo de Clientes) + linhas MTR baixada

CREATE TABLE IF NOT EXISTS public.clientes_gerenciador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_exibicao text NOT NULL DEFAULT '',
  dados_cadastro jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clientes_gerenciador_mtr_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerenciador_id uuid NOT NULL REFERENCES public.clientes_gerenciador(id) ON DELETE CASCADE,
  mtr_baixada text,
  data date,
  gerador text,
  residuo text,
  quantidade text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_gerenciador_nome
  ON public.clientes_gerenciador (nome_exibicao);

CREATE INDEX IF NOT EXISTS idx_clientes_gerenciador_mtr_gerenciador
  ON public.clientes_gerenciador_mtr_linhas (gerenciador_id, ordem);

ALTER TABLE public.clientes_gerenciador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_gerenciador_mtr_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_gerenciador_auth_all ON public.clientes_gerenciador
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY clientes_gerenciador_mtr_linhas_auth_all ON public.clientes_gerenciador_mtr_linhas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.clientes_gerenciador IS 'Cadastro Gerenciador (campos espelhados do cadastro de clientes em dados_cadastro JSON).';
COMMENT ON TABLE public.clientes_gerenciador_mtr_linhas IS 'Linhas MTR baixada vinculadas ao Gerenciador.';

-- <<< END 20260525180000_clientes_gerenciador.sql

-- >>> BEGIN 20260526120000_usuarios_cargos_times_t_r.sql

-- Cargos dos times: Operacional (Time T) e Operadores (Time R).
-- Ordem obrigatória: remover constraint → migrar dados → recriar constraint.

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_canonico_chk;

UPDATE public.usuarios
SET cargo = 'Operacional (Time T)'
WHERE btrim(coalesce(cargo, '')) IN (
  'Gerente do Time',
  'Operacional (Time Thais)',
  'Operacional time thais'
);

UPDATE public.usuarios
SET cargo = 'Operadores (Time R)'
WHERE btrim(coalesce(cargo, '')) IN (
  'Os Meninos',
  'Os meninos',
  'Operadores',
  'Operadores (Time Rafael)'
);

-- Legado já usado na app / migrações posteriores
UPDATE public.usuarios
SET cargo = 'Comercial Adm'
WHERE btrim(coalesce(cargo, '')) IN ('Comercial Adm', 'Comercial adm');

-- Demais valores desconhecidos → Operacional (evita 23514 ao criar o CHECK)
UPDATE public.usuarios
SET cargo = 'Operacional'
WHERE cargo IS NOT NULL
  AND btrim(cargo) <> ''
  AND btrim(cargo) NOT IN (
    'Desenvolvedor',
    'Administrador',
    'Diretoria',
    'Comercial',
    'Comercial Adm',
    'Operacional',
    'Operacional (Time T)',
    'Logística',
    'Balanceiro',
    'Operadores (Time R)',
    'Faturamento',
    'Financeiro',
    'Visualizador'
  );

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_cargo_canonico_chk
  CHECK (
    cargo IS NULL
    OR btrim(cargo) = ''
    OR cargo IN (
      'Desenvolvedor',
      'Administrador',
      'Diretoria',
      'Comercial',
      'Comercial Adm',
      'Operacional',
      'Operacional (Time T)',
      'Logística',
      'Balanceiro',
      'Operadores (Time R)',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

COMMENT ON CONSTRAINT usuarios_cargo_canonico_chk ON public.usuarios IS
  'Cargos canónicos: Time T = admin+faturamento; Time R = prog+MTR+pesagem+chat; Operacional = fluxo geral.';

-- <<< END 20260526120000_usuarios_cargos_times_t_r.sql

-- >>> BEGIN 20260527120000_mtr_ciclo_vida_faturamento.sql

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

-- <<< END 20260527120000_mtr_ciclo_vida_faturamento.sql

-- >>> BEGIN 20260528120000_faturamento_registros_observacoes_adicionais.sql

-- Colunas usadas pelo modal de faturamento (observações e acréscimos).

ALTER TABLE public.faturamento_registros
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS valor_adicionais numeric;

COMMENT ON COLUMN public.faturamento_registros.observacoes IS
  'Observações do faturamento antes de enviar ao financeiro.';

COMMENT ON COLUMN public.faturamento_registros.valor_adicionais IS
  'Acréscimos aplicados no faturamento (além do valor principal).';

-- <<< END 20260528120000_faturamento_registros_observacoes_adicionais.sql

-- >>> BEGIN 20260528140000_coletas_peso_conferencia_desenvolvedor.sql

-- Conferência do ticket (Faturamento): Desenvolvedor e Faturamento podem ajustar peso na coleta / controle_massa.

DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;
CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('desenvolvedor')
    OR public.rg_is_diretoria()
  );

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;
CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('desenvolvedor')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('desenvolvedor')
  );

-- <<< END 20260528140000_coletas_peso_conferencia_desenvolvedor.sql

-- >>> BEGIN 20260528150000_comprovantes_descarte_rls_desenvolvedor.sql

-- Comprovante de descarte: Desenvolvedor e demais perfis operacionais podem excluir (alinha à UI).

DROP POLICY IF EXISTS "comprovantes_descarte_insert_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_insert_roles_fluxo"
  ON public.comprovantes_descarte FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('desenvolvedor')
      OR public.rg_is_diretoria()
    )
  );

DROP POLICY IF EXISTS "comprovantes_descarte_update_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_update_roles_fluxo"
  ON public.comprovantes_descarte FOR UPDATE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('desenvolvedor')
      OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('desenvolvedor')
      OR public.rg_is_diretoria()
    )
  );

DROP POLICY IF EXISTS "comprovantes_descarte_delete_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_delete_roles_fluxo"
  ON public.comprovantes_descarte FOR DELETE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('desenvolvedor')
      OR public.rg_is_diretoria()
    )
  );

-- <<< END 20260528150000_comprovantes_descarte_rls_desenvolvedor.sql

-- >>> BEGIN 20260530150000_controle_massa_ultima_pesagem_rpc.sql

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

-- <<< END 20260530150000_controle_massa_ultima_pesagem_rpc.sql

-- >>> BEGIN 20260601120000_faturamento_esteira_medicoes.sql

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
  'Esteira: AJUSTE_VALORES_MEDICAO | MEDICAO_PENDENTE | MEDICAO_EMAIL_PENDENTE | MEDICAO_AGUARDANDO_CLIENTE | LIBERADO_FATURAMENTO | LIBERADO_FINANCEIRO | FINALIZADO';

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
  WHEN c.faturamento_ticket_aprovado_em IS NOT NULL THEN 'AJUSTE_VALORES_MEDICAO'
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

-- <<< END 20260601120000_faturamento_esteira_medicoes.sql

-- >>> BEGIN 20260602120000_nf_envio_contas_receber_time_t_desenvolvedor.sql

-- Envio de NF: Operacional (Time T) e Desenvolvedor podem atualizar contas_receber (nf_enviada_em, etc.)

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

DROP POLICY IF EXISTS "contas_receber_mutate_financeiro" ON public.contas_receber;

CREATE POLICY "contas_receber_mutate_financeiro"
  ON public.contas_receber FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_is_diretoria()
  );

-- <<< END 20260602120000_nf_envio_contas_receber_time_t_desenvolvedor.sql

-- >>> BEGIN 20260603120000_coletas_peso_operacional_time_t.sql

-- Operacional (Time T) e Faturamento: atualizar peso na conferência do ticket (coletas + controle_massa).

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

DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;
CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_is_diretoria()
  );

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;
CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
  );

-- <<< END 20260603120000_coletas_peso_operacional_time_t.sql

-- >>> BEGIN 20260604120000_faturamento_esteira_ajuste_valores.sql

-- Esteira: passo de ajuste de valores antes do relatório de medição.

COMMENT ON COLUMN public.coletas.faturamento_esteira_status IS
  'AJUSTE_VALORES_MEDICAO | MEDICAO_PENDENTE | MEDICAO_EMAIL_PENDENTE | MEDICAO_AGUARDANDO_CLIENTE | LIBERADO_FATURAMENTO | LIBERADO_FINANCEIRO | FINALIZADO';

-- Coletas com ticket aprovado, sem relatório e ainda em medição pendente → ajuste de valores.
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
  AND NOT EXISTS (
    SELECT 1 FROM public.contas_receber cr
    WHERE cr.referencia_coleta_id = c.id AND cr.nf_enviada_em IS NOT NULL
  )
  AND COALESCE(c.faturamento_esteira_status, '') IN ('', 'MEDICAO_PENDENTE');

-- <<< END 20260604120000_faturamento_esteira_ajuste_valores.sql

-- >>> BEGIN 20260605120000_coletas_peso_conferencia_rpc.sql

-- Conferência do ticket (Faturamento): atualizar peso líquido com SECURITY DEFINER (evita update bloqueado por RLS).

CREATE OR REPLACE FUNCTION public.rg_pode_ajustar_peso_conferencia_ticket()
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
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
    );
$$;

CREATE OR REPLACE FUNCTION public.atualizar_peso_liquido_conferencia_ticket(
  p_coleta_id uuid,
  p_peso_liquido numeric,
  p_residuos_itens jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  IF p_coleta_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta inválida.');
  END IF;

  IF p_peso_liquido IS NULL OR p_peso_liquido <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe um peso líquido maior que zero (kg).');
  END IF;

  IF NOT public.rg_pode_ajustar_peso_conferencia_ticket() THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'message',
      'Sem permissão para alterar o peso nesta conferência (perfil ou política RLS).'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coletas c WHERE c.id = p_coleta_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta não encontrada.');
  END IF;

  UPDATE public.coletas
  SET
    peso_liquido = p_peso_liquido,
    residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
  WHERE id = p_coleta_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível atualizar o peso na coleta.');
  END IF;

  UPDATE public.controle_massa
  SET
    peso_liquido = p_peso_liquido,
    residuos_itens = COALESCE(p_residuos_itens, residuos_itens)
  WHERE coleta_id = p_coleta_id;

  RETURN jsonb_build_object('ok', true, 'peso_liquido', p_peso_liquido);
END;
$$;

COMMENT ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) IS
  'Fila de conferência do ticket: grava peso líquido na coleta e espelha em controle_massa.';

GRANT EXECUTE ON FUNCTION public.atualizar_peso_liquido_conferencia_ticket(uuid, numeric, jsonb) TO authenticated;

-- <<< END 20260605120000_coletas_peso_conferencia_rpc.sql

-- >>> BEGIN 20260610120000_tickets_operacionais_rls_alinha_pesagem.sql

-- Quem já pode lançar pesagem (controle_massa) também pode gravar o ticket operacional.
-- Corrige: "new row violates row-level security policy for table tickets_operacionais"
-- após imprimir no Controle de Massa (garantirTicketAposPesagem).

DROP POLICY IF EXISTS "tickets_operacionais_mutate_roles" ON public.tickets_operacionais;

CREATE POLICY "tickets_operacionais_mutate_roles"
  ON public.tickets_operacionais FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
  );

-- <<< END 20260610120000_tickets_operacionais_rls_alinha_pesagem.sql

-- >>> BEGIN 20260611120000_coleta_apos_pesagem_controle_massa_rpc.sql

-- Controle de Massa: atualizar coleta após pesagem (SECURITY DEFINER), alinhado a quem pode lançar pesagem.

CREATE OR REPLACE FUNCTION public.rg_pode_lancar_pesagem_controle_massa()
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
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    );
$$;

CREATE OR REPLACE FUNCTION public.atualizar_coleta_apos_pesagem_controle_massa(
  p_coleta_id uuid,
  p_dados jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
  v_status_processo text;
BEGIN
  IF p_coleta_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta inválida.');
  END IF;

  IF NOT public.rg_pode_lancar_pesagem_controle_massa() THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'message',
      'Sem permissão para atualizar a coleta após a pesagem (perfil ou política RLS).'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coletas c WHERE c.id = p_coleta_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coleta não encontrada.');
  END IF;

  v_status_processo := NULLIF(btrim(p_dados->>'status_processo'), '');
  IF v_status_processo IS NULL THEN
    v_status_processo := 'EM_CONFERENCIA';
  END IF;

  BEGIN
    UPDATE public.coletas
    SET
      peso_tara = NULLIF(p_dados->>'peso_tara', '')::numeric,
      peso_bruto = NULLIF(p_dados->>'peso_bruto', '')::numeric,
      peso_liquido = NULLIF(p_dados->>'peso_liquido', '')::numeric,
      tipo_residuo = NULLIF(p_dados->>'tipo_residuo', ''),
      residuo_catalogo_id = NULLIF(p_dados->>'residuo_catalogo_id', '')::uuid,
      residuos_itens = COALESCE(p_dados->'residuos_itens', residuos_itens),
      placa = NULLIF(p_dados->>'placa', ''),
      motorista = NULLIF(p_dados->>'motorista', ''),
      motorista_nome = COALESCE(NULLIF(p_dados->>'motorista_nome', ''), NULLIF(p_dados->>'motorista', '')),
      data_execucao = NULLIF(p_dados->>'data_execucao', '')::date,
      data_agendada = COALESCE(
        NULLIF(p_dados->>'data_agendada', '')::date,
        NULLIF(p_dados->>'data_execucao', '')::date
      ),
      fluxo_status = NULLIF(p_dados->>'fluxo_status', ''),
      etapa_operacional = NULLIF(p_dados->>'etapa_operacional', ''),
      status_processo = v_status_processo,
      liberado_financeiro = COALESCE((p_dados->>'liberado_financeiro')::boolean, false)
    WHERE id = p_coleta_id;
  EXCEPTION
    WHEN undefined_column THEN
      UPDATE public.coletas
      SET
        peso_tara = NULLIF(p_dados->>'peso_tara', '')::numeric,
        peso_bruto = NULLIF(p_dados->>'peso_bruto', '')::numeric,
        peso_liquido = NULLIF(p_dados->>'peso_liquido', '')::numeric,
        tipo_residuo = NULLIF(p_dados->>'tipo_residuo', ''),
        placa = NULLIF(p_dados->>'placa', ''),
        motorista = NULLIF(p_dados->>'motorista', ''),
        data_execucao = NULLIF(p_dados->>'data_execucao', '')::date,
        data_agendada = COALESCE(
          NULLIF(p_dados->>'data_agendada', '')::date,
          NULLIF(p_dados->>'data_execucao', '')::date
        ),
        fluxo_status = NULLIF(p_dados->>'fluxo_status', ''),
        etapa_operacional = NULLIF(p_dados->>'etapa_operacional', '')
      WHERE id = p_coleta_id;
    WHEN check_violation THEN
      UPDATE public.coletas
      SET
        peso_tara = NULLIF(p_dados->>'peso_tara', '')::numeric,
        peso_bruto = NULLIF(p_dados->>'peso_bruto', '')::numeric,
        peso_liquido = NULLIF(p_dados->>'peso_liquido', '')::numeric,
        tipo_residuo = NULLIF(p_dados->>'tipo_residuo', ''),
        placa = NULLIF(p_dados->>'placa', ''),
        motorista = NULLIF(p_dados->>'motorista', ''),
        data_execucao = NULLIF(p_dados->>'data_execucao', '')::date,
        data_agendada = COALESCE(
          NULLIF(p_dados->>'data_agendada', '')::date,
          NULLIF(p_dados->>'data_execucao', '')::date
        ),
        fluxo_status = NULLIF(p_dados->>'fluxo_status', ''),
        etapa_operacional = NULLIF(p_dados->>'etapa_operacional', '')
      WHERE id = p_coleta_id;
  END;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível atualizar a coleta.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.atualizar_coleta_apos_pesagem_controle_massa(uuid, jsonb) IS
  'Controle de Massa: espelha peso/resíduo/placa e etapa do fluxo na coleta após gravar pesagem.';

GRANT EXECUTE ON FUNCTION public.atualizar_coleta_apos_pesagem_controle_massa(uuid, jsonb) TO authenticated;

-- Política de UPDATE alinhada (inclui Time T e Desenvolvedor).
DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;
CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_is_diretoria()
  );

-- <<< END 20260611120000_coleta_apos_pesagem_controle_massa_rpc.sql

-- >>> BEGIN 20260622120000_rbac_setores_matriz.sql

-- =============================================================================
-- RBAC por setor/nome — matriz RG Ambiental (organograma oficial)
-- Espelha `src/lib/rbac/rbacAcesso.ts` para RLS e RPCs SECURITY DEFINER.
-- =============================================================================

-- Catálogo (seed / documentação; avaliação principal em funções)
CREATE TABLE IF NOT EXISTS public.rbac_setores (
  codigo text PRIMARY KEY,
  nome text NOT NULL
);

INSERT INTO public.rbac_setores (codigo, nome) VALUES
  ('desenvolvedor', 'Desenvolvedor'),
  ('diretoria_financeiro', 'Diretoria/Financeiro'),
  ('operacao', 'Operação'),
  ('comercial', 'Comercial')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome;

CREATE TABLE IF NOT EXISTS public.rbac_matriz (
  recurso text NOT NULL,
  acao text NOT NULL,
  descricao text,
  PRIMARY KEY (recurso, acao)
);

INSERT INTO public.rbac_matriz (recurso, acao, descricao) VALUES
  ('cliente', 'ler', 'Comercial: Thais, Rafaela, Rose, Raquel'),
  ('cliente', 'criar', 'Comercial: Thais, Rafaela, Rose, Raquel'),
  ('cliente', 'editar', 'Comercial: Thais, Rafaela, Rose, Raquel'),
  ('cliente', 'excluir', 'Comercial: Thais, Rafaela, Rose, Raquel'),
  ('motorista', 'editar', 'Comercial + Operação'),
  ('veiculo', 'editar', 'Comercial + Operação'),
  ('representante', 'ler', 'Comercial'),
  ('programacao', 'ler', 'Todos'),
  ('programacao', 'criar', 'Comercial'),
  ('programacao', 'excluir', 'Comercial'),
  ('mtr', 'editar', 'Todos'),
  ('mtr', 'excluir', 'Comercial'),
  ('pesagem_ticket', 'excluir', 'Comercial'),
  ('comprovante_descarte', 'editar', 'Comercial'),
  ('conferencia_transporte', 'editar', 'Operação'),
  ('conferencia_transporte', 'excluir', 'Comercial'),
  ('faturamento', 'ler', 'Comercial'),
  ('faturamento', 'editar', 'Comercial')
ON CONFLICT (recurso, acao) DO UPDATE SET descricao = EXCLUDED.descricao;

ALTER TABLE public.rbac_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_matriz ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_setores_select_auth" ON public.rbac_setores;
CREATE POLICY "rbac_setores_select_auth"
  ON public.rbac_setores FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rbac_matriz_select_auth" ON public.rbac_matriz;
CREATE POLICY "rbac_matriz_select_auth"
  ON public.rbac_matriz FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.rbac_setores TO authenticated;
GRANT SELECT ON public.rbac_matriz TO authenticated;

-- Helpers ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rg_user_nome()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT btrim(u.nome) FROM public.usuarios u WHERE u.id = auth.uid()),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_normalizar_nome(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    translate(
      coalesce(p, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_nome_contem_token(p_nome text, p_token text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    public.rg_normalizar_nome(p_nome) = public.rg_normalizar_nome(p_token)
    OR public.rg_normalizar_nome(p_nome) ~ (
      '(^|[[:space:]])' || regexp_replace(public.rg_normalizar_nome(p_token), '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '([[:space:]]|$)'
    );
$$;

CREATE OR REPLACE FUNCTION public.rg_is_desenvolvedor_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_cargo_like('desenvolvedor')
    OR public.rg_normalizar_nome(public.rg_user_nome()) LIKE '%cavalcante%'
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'vinicius');
$$;

/** Thais — cargo «Comercial Adm» (legado Operacional Time T). */
CREATE OR REPLACE FUNCTION public.rg_is_comercial_adm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_operacional_time_t()
    OR (
      public.rg_cargo_like('comercial')
      AND public.rg_cargo_like('adm')
    )
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'thais');
$$;

CREATE OR REPLACE FUNCTION public.rg_is_thais()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_is_comercial_adm();
$$;

CREATE OR REPLACE FUNCTION public.rg_rbac_setor_usuario()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n text := public.rg_normalizar_nome(public.rg_user_nome());
  c text := lower(public.rg_user_cargo());
BEGIN
  IF public.rg_is_desenvolvedor_master() THEN
    RETURN 'desenvolvedor';
  END IF;

  IF n LIKE '%ezequiel%' OR n LIKE '% ana%' OR n = 'ana' OR public.rg_nome_contem_token(public.rg_user_nome(), 'ana')
     OR c LIKE '%diretoria%' OR c LIKE '%diretor%'
     OR (c LIKE '%financeiro%' AND c NOT LIKE '%operacional%') THEN
    RETURN 'diretoria_financeiro';
  END IF;

  IF public.rg_nome_contem_token(public.rg_user_nome(), 'thais')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'rafaela')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'rose')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'raquel')
     OR c LIKE '%comercial%'
     OR public.rg_is_operacional_time_t() THEN
    RETURN 'comercial';
  END IF;

  IF n LIKE '%cavalcante%' OR public.rg_nome_contem_token(public.rg_user_nome(), 'rafaela') THEN
    RETURN NULL;
  END IF;

  IF public.rg_nome_contem_token(public.rg_user_nome(), 'matheus')
     OR (public.rg_nome_contem_token(public.rg_user_nome(), 'rafael') AND n NOT LIKE '%cavalcante%' AND n NOT LIKE '%rafaela%')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'heberson')
     OR public.rg_nome_contem_token(public.rg_user_nome(), 'gabriel')
     OR public.rg_is_operadores_time_r()
     OR c LIKE '%operadores%'
     OR c LIKE '%logistica%'
     OR c LIKE '%balanceiro%'
     OR c LIKE '%pesagem%' THEN
    RETURN 'operacao';
  END IF;

  RETURN NULL;
END;
$$;

/** Equipe comercial com o mesmo acesso: Thais, Rafaela, Rose, Raquel. */
CREATE OR REPLACE FUNCTION public.rg_is_equipe_comercial()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_rbac_setor_usuario() = 'comercial';
$$;

CREATE OR REPLACE FUNCTION public.rg_rbac_pode(p_recurso text, p_acao text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text := public.rg_rbac_setor_usuario();
BEGIN
  IF public.rg_is_visualizador() THEN
    RETURN false;
  END IF;

  IF public.rg_is_desenvolvedor_master() THEN
    RETURN true;
  END IF;

  CASE p_recurso
    WHEN 'cliente' THEN
      RETURN s = 'comercial';
    WHEN 'motorista', 'veiculo' THEN
      RETURN s IN ('comercial', 'operacao');
    WHEN 'representante' THEN
      IF p_acao = 'ler' THEN
        RETURN s IN ('comercial', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'programacao' THEN
      IF p_acao = 'ler' THEN RETURN true; END IF;
      RETURN s = 'comercial';
    WHEN 'mtr' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'pesagem_ticket' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'comprovante_descarte' THEN
      RETURN s = 'comercial';
    WHEN 'conferencia_transporte' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN s = 'operacao';
    WHEN 'faturamento' THEN
      IF p_acao IN ('ler', 'criar', 'editar', 'excluir') THEN RETURN s = 'comercial'; END IF;
    ELSE
      NULL;
  END CASE;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_rbac_pode_excluir(p_recurso text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_rbac_pode(p_recurso, 'excluir');
$$;

-- RPCs de exclusão operacional ------------------------------------------------

CREATE OR REPLACE FUNCTION public._rg_pode_excluir_operacional_mtr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rg_rbac_pode_excluir('mtr')
     OR public.rg_rbac_pode_excluir('pesagem_ticket');
$$;

-- Comprovantes descarte -------------------------------------------------------

DROP POLICY IF EXISTS "comprovantes_descarte_insert_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_insert_roles_fluxo"
  ON public.comprovantes_descarte FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND public.rg_rbac_pode('comprovante_descarte', 'editar')
  );

DROP POLICY IF EXISTS "comprovantes_descarte_update_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_update_roles_fluxo"
  ON public.comprovantes_descarte FOR UPDATE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND public.rg_rbac_pode('comprovante_descarte', 'editar')
  )
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND public.rg_rbac_pode('comprovante_descarte', 'editar')
  );

DROP POLICY IF EXISTS "comprovantes_descarte_delete_roles_fluxo" ON public.comprovantes_descarte;
CREATE POLICY "comprovantes_descarte_delete_roles_fluxo"
  ON public.comprovantes_descarte FOR DELETE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND public.rg_rbac_pode('comprovante_descarte', 'editar')
  );

-- Programações — restringir mutação a Comercial; DELETE só Thais --------------

DROP POLICY IF EXISTS "programacoes_mutate_operacional" ON public.programacoes;
DROP POLICY IF EXISTS "programacoes_insert_comercial" ON public.programacoes;
DROP POLICY IF EXISTS "programacoes_update_comercial" ON public.programacoes;
DROP POLICY IF EXISTS "programacoes_delete_thais" ON public.programacoes;

CREATE POLICY "programacoes_insert_comercial"
  ON public.programacoes FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_cargo_vazio_compat()
      OR public.rg_rbac_pode('programacao', 'criar')
    )
  );

CREATE POLICY "programacoes_update_comercial"
  ON public.programacoes FOR UPDATE TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_cargo_vazio_compat()
      OR public.rg_rbac_pode('programacao', 'editar')
    )
  )
  WITH CHECK (
    public.rg_cargo_vazio_compat()
    OR public.rg_rbac_pode('programacao', 'editar')
  );

CREATE POLICY "programacoes_delete_thais"
  ON public.programacoes FOR DELETE TO authenticated
  USING (
    public.rg_cargo_vazio_compat()
    OR public.rg_rbac_pode('programacao', 'excluir')
  );

COMMENT ON FUNCTION public.rg_rbac_pode(text, text) IS
  'Valida permissão RBAC (recurso, ação) pelo nome/cargo do utilizador autenticado.';

-- <<< END 20260622120000_rbac_setores_matriz.sql

-- >>> BEGIN 20260622120000_usuarios_select_own_rpc_perfil.sql

-- Login: cada utilizador lê o próprio registo (qualquer status) + RPC rápida para o bootstrap da app.

DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
CREATE POLICY "usuarios_select_own"
  ON public.usuarios FOR SELECT TO authenticated
  USING (auth.uid() = id);

COMMENT ON POLICY "usuarios_select_own" ON public.usuarios IS
  'Permite ler o próprio perfil (login / permissões), independentemente de status=ativo.';

DROP FUNCTION IF EXISTS public.obter_meu_perfil_usuario();

CREATE OR REPLACE FUNCTION public.obter_meu_perfil_usuario()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  cargo text,
  status text,
  foto_url text,
  paginas_permitidas text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.nome,
    u.email,
    u.cargo,
    u.status,
    u.foto_url,
    u.paginas_permitidas
  FROM public.usuarios u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.obter_meu_perfil_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_meu_perfil_usuario() TO authenticated;

COMMENT ON FUNCTION public.obter_meu_perfil_usuario() IS
  'Perfil do utilizador autenticado (bootstrap UI; ignora RLS de diretório só-ativos).';

-- <<< END 20260622120000_usuarios_select_own_rpc_perfil.sql

-- >>> BEGIN 20260622130000_usuarios_cargo_comercial_adm.sql

-- Cargo canónico «Comercial Adm» + normalização de legados antes do CHECK.
-- Executar no SQL Editor se o CHECK falhar com 23514.

-- 1) Diagnóstico (opcional — descomente para ver cargos fora da lista)
-- SELECT btrim(cargo) AS cargo, count(*)::int AS qtd
-- FROM public.usuarios
-- WHERE cargo IS NOT NULL AND btrim(cargo) <> ''
-- GROUP BY 1
-- ORDER BY 2 DESC;

-- 2) Normalizar legados → cargos do organograma atual
UPDATE public.usuarios
SET cargo = 'Comercial Adm'
WHERE btrim(coalesce(cargo, '')) IN (
  'Operacional (Time T)',
  'Gerente do Time',
  'Operacional time thais'
)
OR (
  lower(btrim(cargo)) LIKE '%operacional%'
  AND lower(btrim(cargo)) LIKE '%time t%'
)
OR (
  lower(btrim(cargo)) LIKE '%gerente%'
  AND lower(btrim(cargo)) LIKE '%time%'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rg_nome_contem_token'
  ) THEN
    UPDATE public.usuarios
    SET cargo = 'Comercial Adm'
    WHERE public.rg_nome_contem_token(coalesce(nome, ''), 'thais')
      AND btrim(coalesce(cargo, '')) NOT IN ('Desenvolvedor', 'Comercial Adm');

    UPDATE public.usuarios
    SET cargo = 'Comercial'
    WHERE (
      public.rg_nome_contem_token(coalesce(nome, ''), 'rafaela')
      OR public.rg_nome_contem_token(coalesce(nome, ''), 'rose')
      OR public.rg_nome_contem_token(coalesce(nome, ''), 'raquel')
    )
    AND btrim(coalesce(cargo, '')) NOT IN ('Desenvolvedor', 'Comercial Adm', 'Comercial');
  END IF;
END $$;

-- Operação: legado Time R → Operacional (RBAC resolve pelo nome)
UPDATE public.usuarios
SET cargo = 'Operacional'
WHERE btrim(coalesce(cargo, '')) IN (
  'Operadores (Time R)',
  'Operadores',
  'Os meninos'
);

-- 3) CHECK — inclui canónicos + legados ainda aceites na UI/RLS
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_cargo_canonico_chk;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_cargo_canonico_chk
  CHECK (
    cargo IS NULL
    OR btrim(cargo) = ''
    OR cargo IN (
      'Administrador',
      'Diretoria',
      'Comercial',
      'Comercial Adm',
      'Operacional',
      'Operadores (Time R)',
      'Operacional (Time T)',
      'Logística',
      'Balanceiro',
      'Faturamento',
      'Financeiro',
      'Visualizador',
      'Desenvolvedor'
    )
  );

COMMENT ON CONSTRAINT usuarios_cargo_canonico_chk ON public.usuarios IS
  'Cargos aceites; Thais → Comercial Adm; comercial Rafaela/Rose/Raquel → Comercial; legados Time T/R e Desenvolvedor mantidos até migração manual.';

-- <<< END 20260622130000_usuarios_cargo_comercial_adm.sql

-- >>> BEGIN 20260624120000_peso_conferencia_comercial_adm.sql

-- Fila de conferência do ticket: Comercial / Comercial Adm podem ajustar peso (Thais e equipe).

CREATE OR REPLACE FUNCTION public.rg_is_comercial_adm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_operacional_time_t()
    OR (
      public.rg_cargo_like('comercial')
      AND public.rg_cargo_like('adm')
    )
    OR lower(btrim(public.rg_user_cargo())) = 'comercial adm'
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'thais');
$$;

CREATE OR REPLACE FUNCTION public.rg_is_equipe_comercial()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_comercial_adm()
    OR public.rg_cargo_like('comercial')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'rafaela')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'rose')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'raquel');
$$;

CREATE OR REPLACE FUNCTION public.rg_pode_ajustar_peso_conferencia_ticket()
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
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_is_comercial_adm()
      OR public.rg_is_equipe_comercial()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_is_diretoria()
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
    );
$$;

COMMENT ON FUNCTION public.rg_pode_ajustar_peso_conferencia_ticket() IS
  'Conferência ticket (faturamento): inclui Comercial Adm, Comercial e legado Time T.';

-- <<< END 20260624120000_peso_conferencia_comercial_adm.sql

-- >>> BEGIN 20260624130000_nf_envio_comercial_adm.sql

-- Mala direta / envio NF: Comercial Adm e equipe Comercial (Thais, Rafaela, Rose, Raquel).

CREATE OR REPLACE FUNCTION public.rg_is_operacional_time_t()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      public.rg_cargo_like('comercial')
      AND public.rg_cargo_like('adm')
    )
    OR lower(btrim(public.rg_user_cargo())) = 'comercial adm'
    OR (
      public.rg_cargo_like('operacional')
      AND (
        public.rg_cargo_like('time t')
        OR public.rg_cargo_like('thais')
        OR public.rg_cargo_like('operacional time thais')
      )
    )
    OR (
      public.rg_cargo_like('gerente')
      AND public.rg_cargo_like('time')
    )
    OR lower(btrim(public.rg_user_cargo())) = 'gerente time';
$$;

DROP POLICY IF EXISTS "contas_receber_mutate_financeiro" ON public.contas_receber;

CREATE POLICY "contas_receber_mutate_financeiro"
  ON public.contas_receber FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_is_comercial_adm()
      OR public.rg_is_equipe_comercial()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_is_diretoria()
      OR public.rg_cargo_like('comercial')
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_is_comercial_adm()
    OR public.rg_is_equipe_comercial()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('financeiro')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_is_diretoria()
    OR public.rg_cargo_like('comercial')
  );

-- <<< END 20260624130000_nf_envio_comercial_adm.sql

-- >>> BEGIN 20260625140000_clinicas_modulo.sql

-- Módulo Clínicas: cadastro mãe/filho, O.S. sem pesagem/ticket, fila de faturamento dedicada.

-- Grupo mãe (ex.: CLINICA)
CREATE TABLE IF NOT EXISTS public.clinicas_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinicas_grupos_nome_unique UNIQUE (nome)
);

COMMENT ON TABLE public.clinicas_grupos IS 'Cadastro mãe — agrupa unidades de clínica (ex. CLINICA).';

-- Unidades filhas
CREATE TABLE IF NOT EXISTS public.clinicas_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.clinicas_grupos (id) ON DELETE RESTRICT,
  razao_social text NOT NULL,
  cnpj text,
  cpf text,
  endereco_coleta text,
  emite_nota boolean NOT NULL DEFAULT false,
  pagamento_pix boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinicas_unidades_grupo ON public.clinicas_unidades (grupo_id);
CREATE INDEX IF NOT EXISTS idx_clinicas_unidades_ativo ON public.clinicas_unidades (ativo) WHERE ativo = true;

COMMENT ON TABLE public.clinicas_unidades IS 'Unidade de coleta vinculada ao grupo mãe CLINICA.';

-- Sequência global de numeração OS-CLIN-AAAA-NNNN
CREATE TABLE IF NOT EXISTS public.clinicas_os_numero_seq (
  ano int PRIMARY KEY,
  ultimo int NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.proximo_numero_os_clinica()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  n int;
BEGIN
  INSERT INTO public.clinicas_os_numero_seq (ano, ultimo)
  VALUES (y, 1)
  ON CONFLICT (ano) DO UPDATE
    SET ultimo = public.clinicas_os_numero_seq.ultimo + 1
  RETURNING ultimo INTO n;
  RETURN format('OS-CLIN-%s-%s', y, lpad(n::text, 4, '0'));
END;
$$;

REVOKE ALL ON FUNCTION public.proximo_numero_os_clinica() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proximo_numero_os_clinica() TO authenticated;

-- Ordens de serviço (sem coleta / ticket / pesagem)
CREATE TABLE IF NOT EXISTS public.clinicas_ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.clinicas_unidades (id) ON DELETE RESTRICT,
  numero_os text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_faturamento'
    CHECK (status IN ('aguardando_faturamento', 'emitida', 'cancelada')),
  data_servico date NOT NULL DEFAULT CURRENT_DATE,
  emite_nota_snapshot boolean NOT NULL DEFAULT false,
  pagamento_pix_snapshot boolean NOT NULL DEFAULT false,
  observacoes text,
  referencia_nf text,
  nf_registrada_em timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinicas_ordens_servico_numero_unique UNIQUE (numero_os)
);

CREATE INDEX IF NOT EXISTS idx_clinicas_os_unidade ON public.clinicas_ordens_servico (unidade_id);
CREATE INDEX IF NOT EXISTS idx_clinicas_os_status ON public.clinicas_ordens_servico (status);
CREATE INDEX IF NOT EXISTS idx_clinicas_os_data_servico ON public.clinicas_ordens_servico (data_servico DESC);

COMMENT ON TABLE public.clinicas_ordens_servico IS
  'O.S. clínica — não gera pesagem nem ticket; segue para fila de faturamento dedicada.';

-- Registo financeiro antes da emissão (valor preenchido no faturamento)
CREATE TABLE IF NOT EXISTS public.clinicas_faturamento_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.clinicas_ordens_servico (id) ON DELETE CASCADE,
  valor numeric,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'emitido', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinicas_fat_reg_os_unique UNIQUE (ordem_servico_id)
);

CREATE INDEX IF NOT EXISTS idx_clinicas_fat_reg_status ON public.clinicas_faturamento_registros (status);

-- Seed grupo mãe CLINICA
INSERT INTO public.clinicas_grupos (nome)
VALUES ('CLINICA')
ON CONFLICT (nome) DO NOTHING;

-- contas_receber: origem coleta OU clínica O.S.
ALTER TABLE public.contas_receber
  ALTER COLUMN referencia_coleta_id DROP NOT NULL;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS referencia_clinica_os_id uuid
    REFERENCES public.clinicas_ordens_servico (id) ON DELETE CASCADE;

ALTER TABLE public.contas_receber DROP CONSTRAINT IF EXISTS contas_receber_coleta_unique;

CREATE UNIQUE INDEX IF NOT EXISTS contas_receber_coleta_unique
  ON public.contas_receber (referencia_coleta_id)
  WHERE referencia_coleta_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contas_receber_clinica_os_unique
  ON public.contas_receber (referencia_clinica_os_id)
  WHERE referencia_clinica_os_id IS NOT NULL;

ALTER TABLE public.contas_receber DROP CONSTRAINT IF EXISTS contas_receber_origem_chk;

ALTER TABLE public.contas_receber
  ADD CONSTRAINT contas_receber_origem_chk CHECK (
    (referencia_coleta_id IS NOT NULL)::int
    + (referencia_clinica_os_id IS NOT NULL)::int = 1
  );

COMMENT ON COLUMN public.contas_receber.referencia_clinica_os_id IS
  'Conta gerada pela emissão de O.S. clínica (sem coleta).';

-- View: fila de faturamento clínicas
CREATE OR REPLACE VIEW public.vw_clinicas_faturamento_fila AS
SELECT
  os.id AS ordem_servico_id,
  os.numero_os,
  os.status AS os_status,
  os.data_servico,
  os.emite_nota_snapshot,
  os.pagamento_pix_snapshot,
  os.observacoes AS os_observacoes,
  os.referencia_nf,
  os.nf_registrada_em,
  os.created_at AS os_created_at,
  u.id AS unidade_id,
  u.razao_social,
  u.cnpj,
  u.cpf,
  u.endereco_coleta,
  g.nome AS grupo_nome,
  fr.id AS faturamento_registro_id,
  fr.valor AS faturamento_valor,
  fr.observacoes AS faturamento_observacoes,
  fr.status AS faturamento_status,
  cr.id AS conta_receber_id,
  cr.status_pagamento,
  CASE
    WHEN os.emite_nota_snapshot THEN 'nf'
  WHEN os.pagamento_pix_snapshot THEN 'pix'
    ELSE 'outro'
  END AS meio_cobranca
FROM public.clinicas_ordens_servico os
JOIN public.clinicas_unidades u ON u.id = os.unidade_id
JOIN public.clinicas_grupos g ON g.id = u.grupo_id
LEFT JOIN public.clinicas_faturamento_registros fr ON fr.ordem_servico_id = os.id
LEFT JOIN public.contas_receber cr ON cr.referencia_clinica_os_id = os.id
WHERE os.status = 'aguardando_faturamento'
  AND (fr.status IS NULL OR fr.status = 'pendente');

GRANT SELECT ON public.vw_clinicas_faturamento_fila TO authenticated;

COMMENT ON VIEW public.vw_clinicas_faturamento_fila IS
  'Fila exclusiva de O.S. clínicas aguardando valor/emissão no faturamento.';

-- Consolidação relatório: últimos 30 dias por unidade
CREATE OR REPLACE VIEW public.vw_clinicas_relatorio_30d AS
SELECT
  u.id AS unidade_id,
  u.razao_social,
  u.cnpj,
  g.nome AS grupo_nome,
  COUNT(os.id)::int AS qtd_os,
  COALESCE(SUM(fr.valor) FILTER (WHERE fr.status = 'emitido'), 0) AS valor_emitido_total,
  COALESCE(SUM(fr.valor) FILTER (WHERE fr.status = 'pendente'), 0) AS valor_pendente_total,
  MIN(os.data_servico) AS primeira_data,
  MAX(os.data_servico) AS ultima_data
FROM public.clinicas_unidades u
JOIN public.clinicas_grupos g ON g.id = u.grupo_id
LEFT JOIN public.clinicas_ordens_servico os
  ON os.unidade_id = u.id
  AND os.data_servico >= (CURRENT_DATE - INTERVAL '30 days')
  AND os.status <> 'cancelada'
LEFT JOIN public.clinicas_faturamento_registros fr ON fr.ordem_servico_id = os.id
GROUP BY u.id, u.razao_social, u.cnpj, g.nome;

GRANT SELECT ON public.vw_clinicas_relatorio_30d TO authenticated;

-- Gerar O.S. em lote (sem valor — preenchido no faturamento)
CREATE OR REPLACE FUNCTION public.gerar_clinicas_ordens_servico_lote(
  p_unidade_ids uuid[],
  p_data_servico date DEFAULT CURRENT_DATE
)
RETURNS TABLE (unidade_id uuid, ordem_id uuid, numero_os text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  urow public.clinicas_unidades%ROWTYPE;
  nos text;
  oid uuid;
BEGIN
  IF p_unidade_ids IS NULL OR cardinality(p_unidade_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma unidade.';
  END IF;

  FOREACH uid IN ARRAY p_unidade_ids LOOP
    SELECT * INTO urow FROM public.clinicas_unidades WHERE id = uid AND ativo = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unidade % inválida ou inativa.', uid;
    END IF;

    nos := public.proximo_numero_os_clinica();

    INSERT INTO public.clinicas_ordens_servico (
      unidade_id,
      numero_os,
      status,
      data_servico,
      emite_nota_snapshot,
      pagamento_pix_snapshot,
      created_by
    )
    VALUES (
      uid,
      nos,
      'aguardando_faturamento',
      COALESCE(p_data_servico, CURRENT_DATE),
      urow.emite_nota,
      urow.pagamento_pix,
      auth.uid()
    )
    RETURNING id INTO oid;

    INSERT INTO public.clinicas_faturamento_registros (ordem_servico_id, status)
    VALUES (oid, 'pendente')
    ON CONFLICT (ordem_servico_id) DO NOTHING;

    unidade_id := uid;
    ordem_id := oid;
    numero_os := nos;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_clinicas_ordens_servico_lote(uuid[], date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_clinicas_ordens_servico_lote(uuid[], date) TO authenticated;

-- Guardar valor no faturamento (antes de emitir)
CREATE OR REPLACE FUNCTION public.salvar_clinica_faturamento_valor(
  p_ordem_id uuid,
  p_valor numeric,
  p_observacoes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ordem_id IS NULL THEN
    RAISE EXCEPTION 'O.S. inválida.';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor maior que zero.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinicas_ordens_servico
    WHERE id = p_ordem_id AND status = 'aguardando_faturamento'
  ) THEN
    RAISE EXCEPTION 'O.S. não está aguardando faturamento.';
  END IF;

  UPDATE public.clinicas_faturamento_registros
  SET
    valor = p_valor,
    observacoes = NULLIF(trim(p_observacoes), ''),
    updated_at = now()
  WHERE ordem_servico_id = p_ordem_id AND status = 'pendente';

  IF NOT FOUND THEN
    INSERT INTO public.clinicas_faturamento_registros (ordem_servico_id, valor, observacoes, status)
    VALUES (p_ordem_id, p_valor, NULLIF(trim(p_observacoes), ''), 'pendente');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_clinica_faturamento_valor(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_clinica_faturamento_valor(uuid, numeric, text) TO authenticated;

-- Emitir: conta a receber + encerrar O.S.
CREATE OR REPLACE FUNCTION public.emitir_faturamento_clinica_os(
  p_ordem_id uuid,
  p_valor numeric,
  p_data_vencimento date DEFAULT NULL,
  p_referencia_nf text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  osrow public.clinicas_ordens_servico%ROWTYPE;
  urow public.clinicas_unidades%ROWTYPE;
  frid uuid;
  crid uuid;
  venc date;
  obs text;
  nf_txt text;
BEGIN
  SELECT * INTO osrow FROM public.clinicas_ordens_servico WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O.S. não encontrada.';
  END IF;

  SELECT * INTO urow FROM public.clinicas_unidades WHERE id = osrow.unidade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unidade da O.S. não encontrada.';
  END IF;

  IF osrow.status <> 'aguardando_faturamento' THEN
    RAISE EXCEPTION 'O.S. já foi emitida ou cancelada.';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor de faturamento inválido.';
  END IF;

  nf_txt := NULLIF(trim(p_referencia_nf), '');

  IF osrow.emite_nota_snapshot AND nf_txt IS NULL THEN
    RAISE EXCEPTION 'Esta unidade emite nota fiscal — informe o número da NF na emissão.';
  END IF;

  IF NOT osrow.emite_nota_snapshot AND nf_txt IS NOT NULL THEN
    nf_txt := NULL;
  END IF;

  venc := COALESCE(p_data_vencimento, CURRENT_DATE + 7);

  UPDATE public.clinicas_faturamento_registros
  SET valor = p_valor, status = 'emitido', updated_at = now()
  WHERE ordem_servico_id = p_ordem_id AND status = 'pendente'
  RETURNING id INTO frid;

  IF frid IS NULL THEN
    INSERT INTO public.clinicas_faturamento_registros (ordem_servico_id, valor, status)
    VALUES (p_ordem_id, p_valor, 'emitido')
    RETURNING id INTO frid;
  END IF;

  obs := format(
    'Clínica: %s | OS: %s | CNPJ: %s | %s',
    urow.razao_social,
    osrow.numero_os,
    COALESCE(urow.cnpj, '—'),
    CASE
      WHEN osrow.pagamento_pix_snapshot AND NOT osrow.emite_nota_snapshot THEN 'Cobrança: PIX (sem NF)'
      WHEN osrow.emite_nota_snapshot THEN 'Cobrança: NF'
      ELSE 'Cobrança: padrão'
    END
  );

  INSERT INTO public.contas_receber (
    cliente_id,
    valor,
    data_emissao,
    data_vencimento,
    status_pagamento,
    referencia_clinica_os_id,
    observacoes,
    valor_pago,
    valor_travado,
    updated_at
  )
  VALUES (
    NULL,
    p_valor,
    CURRENT_DATE,
    venc,
    'Pendente',
    p_ordem_id,
    obs,
    0,
    true,
    now()
  )
  ON CONFLICT (referencia_clinica_os_id) WHERE referencia_clinica_os_id IS NOT NULL
  DO UPDATE SET
    valor = EXCLUDED.valor,
    data_vencimento = EXCLUDED.data_vencimento,
    observacoes = EXCLUDED.observacoes,
    valor_travado = true,
    updated_at = now()
  RETURNING id INTO crid;

  UPDATE public.clinicas_ordens_servico
  SET
    status = 'emitida',
    referencia_nf = nf_txt,
    nf_registrada_em = CASE WHEN nf_txt IS NOT NULL THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_ordem_id;

  RETURN crid;
END;
$$;

REVOKE ALL ON FUNCTION public.emitir_faturamento_clinica_os(uuid, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emitir_faturamento_clinica_os(uuid, numeric, date, text) TO authenticated;

-- RLS
ALTER TABLE public.clinicas_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicas_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicas_ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicas_faturamento_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicas_os_numero_seq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinicas_grupos_auth ON public.clinicas_grupos;
CREATE POLICY clinicas_grupos_auth ON public.clinicas_grupos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS clinicas_unidades_auth ON public.clinicas_unidades;
CREATE POLICY clinicas_unidades_auth ON public.clinicas_unidades
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS clinicas_os_auth ON public.clinicas_ordens_servico;
CREATE POLICY clinicas_os_auth ON public.clinicas_ordens_servico
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS clinicas_fat_reg_auth ON public.clinicas_faturamento_registros;
CREATE POLICY clinicas_fat_reg_auth ON public.clinicas_faturamento_registros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS clinicas_os_seq_auth ON public.clinicas_os_numero_seq;
CREATE POLICY clinicas_os_seq_auth ON public.clinicas_os_numero_seq
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinicas_grupos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinicas_unidades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinicas_ordens_servico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinicas_faturamento_registros TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.clinicas_os_numero_seq TO authenticated;

-- <<< END 20260625140000_clinicas_modulo.sql

-- >>> BEGIN 20260625150000_clinicas_excluir_os.sql

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

-- <<< END 20260625150000_clinicas_excluir_os.sql

-- >>> BEGIN 20260625160000_clinicas_excluir_unidade.sql

-- Exclusão de unidade de clínica (cadastro filho).
-- Bloqueia se houver O.S. emitida; remove O.S. pendentes antes de apagar a unidade.

CREATE OR REPLACE FUNCTION public.excluir_clinica_unidade(p_unidade_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  os_id uuid;
BEGIN
  IF p_unidade_id IS NULL THEN
    RAISE EXCEPTION 'Unidade inválida.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clinicas_unidades WHERE id = p_unidade_id) THEN
    RAISE EXCEPTION 'Unidade não encontrada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinicas_ordens_servico
    WHERE unidade_id = p_unidade_id AND status = 'emitida'
  ) THEN
    RAISE EXCEPTION
      'Esta unidade possui O.S. já faturadas. Edite o cadastro e marque como inativa em vez de excluir.';
  END IF;

  FOR os_id IN
    SELECT id FROM public.clinicas_ordens_servico
    WHERE unidade_id = p_unidade_id AND status = 'aguardando_faturamento'
  LOOP
    PERFORM public.excluir_clinica_ordem_servico(os_id);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.clinicas_ordens_servico WHERE unidade_id = p_unidade_id
  ) THEN
    RAISE EXCEPTION
      'Unidade ainda possui ordens de serviço no histórico e não pode ser excluída.';
  END IF;

  DELETE FROM public.clinicas_unidades WHERE id = p_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_clinica_unidade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_clinica_unidade(uuid) TO authenticated;

-- <<< END 20260625160000_clinicas_excluir_unidade.sql

-- >>> BEGIN 20260625170000_clinicas_financeiro_fila.sql

-- Clínicas: envio ao financeiro, exclusão de O.S. emitida, data de pagamento e fila dedicada.

ALTER TABLE public.clinicas_ordens_servico
  ADD COLUMN IF NOT EXISTS enviado_financeiro_em timestamptz;

COMMENT ON COLUMN public.clinicas_ordens_servico.enviado_financeiro_em IS
  'Preenchido quando a O.S. entra na fila de Contas a receber (clínicas).';

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS data_pagamento date;

COMMENT ON COLUMN public.contas_receber.data_pagamento IS
  'Data em que o título foi quitado (uso destacado na fila de clínicas).';

-- O.S. que já tinham conta a receber passam a constar como enviadas ao financeiro.
UPDATE public.clinicas_ordens_servico os
SET enviado_financeiro_em = cr.created_at
FROM public.contas_receber cr
WHERE cr.referencia_clinica_os_id = os.id
  AND os.enviado_financeiro_em IS NULL;

-- Emissão no faturamento: encerra O.S. sem criar conta a receber (envio é passo separado).
CREATE OR REPLACE FUNCTION public.emitir_faturamento_clinica_os(
  p_ordem_id uuid,
  p_valor numeric,
  p_data_vencimento date DEFAULT NULL,
  p_referencia_nf text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  osrow public.clinicas_ordens_servico%ROWTYPE;
  urow public.clinicas_unidades%ROWTYPE;
  frid uuid;
  nf_txt text;
BEGIN
  SELECT * INTO osrow FROM public.clinicas_ordens_servico WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O.S. não encontrada.';
  END IF;

  SELECT * INTO urow FROM public.clinicas_unidades WHERE id = osrow.unidade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unidade da O.S. não encontrada.';
  END IF;

  IF osrow.status <> 'aguardando_faturamento' THEN
    RAISE EXCEPTION 'O.S. já foi emitida ou cancelada.';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor de faturamento inválido.';
  END IF;

  nf_txt := NULLIF(trim(p_referencia_nf), '');

  IF osrow.emite_nota_snapshot AND nf_txt IS NULL THEN
    RAISE EXCEPTION 'Esta unidade emite nota fiscal — informe o número da NF na emissão.';
  END IF;

  IF NOT osrow.emite_nota_snapshot AND nf_txt IS NOT NULL THEN
    nf_txt := NULL;
  END IF;

  UPDATE public.clinicas_faturamento_registros
  SET valor = p_valor, status = 'emitido', updated_at = now()
  WHERE ordem_servico_id = p_ordem_id AND status = 'pendente'
  RETURNING id INTO frid;

  IF frid IS NULL THEN
    INSERT INTO public.clinicas_faturamento_registros (ordem_servico_id, valor, status)
    VALUES (p_ordem_id, p_valor, 'emitido')
    RETURNING id INTO frid;
  END IF;

  UPDATE public.clinicas_ordens_servico
  SET
    status = 'emitida',
    referencia_nf = nf_txt,
    nf_registrada_em = CASE WHEN nf_txt IS NOT NULL THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_ordem_id;

  RETURN p_ordem_id;
END;
$$;

-- Envia O.S. emitida para Contas a receber (fila clínicas).
CREATE OR REPLACE FUNCTION public.enviar_clinica_os_ao_financeiro(
  p_ordem_id uuid,
  p_data_vencimento date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  osrow public.clinicas_ordens_servico%ROWTYPE;
  urow public.clinicas_unidades%ROWTYPE;
  fr public.clinicas_faturamento_registros%ROWTYPE;
  crid uuid;
  venc date;
  obs text;
  v_valor numeric;
BEGIN
  SELECT * INTO osrow FROM public.clinicas_ordens_servico WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O.S. não encontrada.';
  END IF;

  IF osrow.status <> 'emitida' THEN
    RAISE EXCEPTION 'Só é possível enviar ao financeiro O.S. já emitidas no faturamento.';
  END IF;

  SELECT * INTO fr FROM public.clinicas_faturamento_registros
  WHERE ordem_servico_id = p_ordem_id AND status = 'emitido'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND OR fr.valor IS NULL OR fr.valor <= 0 THEN
    RAISE EXCEPTION 'Registo de faturamento emitido sem valor válido.';
  END IF;

  v_valor := fr.valor;

  SELECT * INTO urow FROM public.clinicas_unidades WHERE id = osrow.unidade_id;

  venc := COALESCE(p_data_vencimento, CURRENT_DATE + 7);

  obs := format(
    'Clínica: %s | OS: %s | CNPJ: %s | %s',
    urow.razao_social,
    osrow.numero_os,
    COALESCE(urow.cnpj, '—'),
    CASE
      WHEN osrow.pagamento_pix_snapshot AND NOT osrow.emite_nota_snapshot THEN 'Cobrança: PIX (sem NF)'
      WHEN osrow.emite_nota_snapshot THEN 'Cobrança: NF'
      ELSE 'Cobrança: padrão'
    END
  );

  INSERT INTO public.contas_receber (
    cliente_id,
    valor,
    data_emissao,
    data_vencimento,
    status_pagamento,
    referencia_clinica_os_id,
    observacoes,
    valor_pago,
    valor_travado,
    updated_at
  )
  VALUES (
    NULL,
    v_valor,
    CURRENT_DATE,
    venc,
    'Pendente',
    p_ordem_id,
    obs,
    0,
    true,
    now()
  )
  ON CONFLICT (referencia_clinica_os_id) WHERE referencia_clinica_os_id IS NOT NULL
  DO UPDATE SET
    valor = EXCLUDED.valor,
    data_vencimento = EXCLUDED.data_vencimento,
    observacoes = EXCLUDED.observacoes,
    valor_travado = true,
    updated_at = now()
  RETURNING id INTO crid;

  UPDATE public.clinicas_ordens_servico
  SET enviado_financeiro_em = now(), updated_at = now()
  WHERE id = p_ordem_id;

  RETURN crid;
END;
$$;

-- Exclui O.S. emitida (remove conta a receber se ainda não paga).
CREATE OR REPLACE FUNCTION public.excluir_clinica_ordem_servico_emitida(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cr public.contas_receber%ROWTYPE;
BEGIN
  IF p_ordem_id IS NULL THEN
    RAISE EXCEPTION 'O.S. inválida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinicas_ordens_servico
    WHERE id = p_ordem_id AND status = 'emitida'
  ) THEN
    RAISE EXCEPTION 'Só é possível excluir O.S. já emitidas no faturamento.';
  END IF;

  SELECT * INTO cr FROM public.contas_receber
  WHERE referencia_clinica_os_id = p_ordem_id;

  IF FOUND THEN
    IF COALESCE(cr.valor_pago, 0) > 0 OR cr.status_pagamento = 'Pago' THEN
      RAISE EXCEPTION 'O.S. com pagamento registado no financeiro — não pode ser excluída.';
    END IF;
    DELETE FROM public.contas_receber_baixas WHERE conta_receber_id = cr.id;
    DELETE FROM public.contas_receber WHERE id = cr.id;
  END IF;

  DELETE FROM public.clinicas_faturamento_registros WHERE ordem_servico_id = p_ordem_id;
  DELETE FROM public.clinicas_ordens_servico WHERE id = p_ordem_id;
END;
$$;

-- Marca pagamento na fila de clínicas (conta a receber).
CREATE OR REPLACE FUNCTION public.salvar_pagamento_conta_clinica(
  p_conta_id uuid,
  p_pago boolean,
  p_data_pagamento date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cr public.contas_receber%ROWTYPE;
  v_pago numeric;
  st text;
BEGIN
  SELECT * INTO cr FROM public.contas_receber WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta a receber não encontrada.';
  END IF;

  IF cr.referencia_clinica_os_id IS NULL THEN
    RAISE EXCEPTION 'Esta conta não é de clínica.';
  END IF;

  IF p_pago THEN
    v_pago := cr.valor;
    st := 'Pago';
    IF p_data_pagamento IS NULL THEN
      RAISE EXCEPTION 'Informe a data de pagamento.';
    END IF;
  ELSE
    v_pago := 0;
    st := 'Pendente';
  END IF;

  UPDATE public.contas_receber
  SET
    valor_pago = v_pago,
    status_pagamento = st,
    data_pagamento = CASE WHEN p_pago THEN p_data_pagamento ELSE NULL END,
    updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_clinica_os_ao_financeiro(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_clinica_os_ao_financeiro(uuid, date) TO authenticated;

REVOKE ALL ON FUNCTION public.excluir_clinica_ordem_servico_emitida(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_clinica_ordem_servico_emitida(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.salvar_pagamento_conta_clinica(uuid, boolean, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_pagamento_conta_clinica(uuid, boolean, date) TO authenticated;

-- <<< END 20260625170000_clinicas_financeiro_fila.sql

-- >>> BEGIN 20260628120000_contas_receber_coleta_unique_constraint.sql

-- Restaura UNIQUE em referencia_coleta_id para upsert PostgREST (onConflict).
-- A migração de clínicas substituiu a constraint por índice parcial, que não satisfaz ON CONFLICT.

DROP INDEX IF EXISTS public.contas_receber_coleta_unique;

ALTER TABLE public.contas_receber DROP CONSTRAINT IF EXISTS contas_receber_coleta_unique;

ALTER TABLE public.contas_receber
  ADD CONSTRAINT contas_receber_coleta_unique UNIQUE (referencia_coleta_id);

COMMENT ON CONSTRAINT contas_receber_coleta_unique ON public.contas_receber IS
  'Uma conta por coleta; vários NULL são permitidos (contas só de clínica).';

-- <<< END 20260628120000_contas_receber_coleta_unique_constraint.sql

