-- =============================================================================
-- RG Ambiental — SQL completo release 1.2.6 (Supabase SQL Editor)
-- =============================================================================
-- Cole e execute este ficheiro INTEIRO no SQL Editor do projeto Supabase (produção).
-- Seguro para reexecutar: usa IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT.
--
-- Inclui:
--   • Margem de lucro (clientes) + função SLA faturamento
--   • Catálogo de resíduos (tabela + dados iniciais)
--   • Ticket impresso + aprovação Faturamento + view vw_faturamento_resumo
--   • Contrato cliente (veículos / equipamentos / resíduos JSONB)
--   • Exclusão MTR/coleta em cascata (RPC)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Margem de lucro + função SLA (pré-requisito da view)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS margem_lucro_percentual numeric(7, 2);

COMMENT ON COLUMN public.clientes.margem_lucro_percentual IS
  'Margem de lucro alvo para o cliente (%). Opcional; usada em precificação / relatórios.';

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

-- ---------------------------------------------------------------------------
-- 2) Catálogo de resíduos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.residuos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  grupo text,
  ativo boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT residuos_codigo_key UNIQUE (codigo)
);

CREATE INDEX IF NOT EXISTS idx_residuos_ativo_sort ON public.residuos (ativo, sort_order, codigo);

COMMENT ON TABLE public.residuos IS
  'Catálogo de tipos de resíduo com código único; coletas referenciam via residuo_catalogo_id.';

ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS residuo_catalogo_id uuid REFERENCES public.residuos (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coletas_residuo_catalogo_id
  ON public.coletas (residuo_catalogo_id)
  WHERE residuo_catalogo_id IS NOT NULL;

ALTER TABLE public.residuos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "residuos_select_authenticated" ON public.residuos;
CREATE POLICY "residuos_select_authenticated"
  ON public.residuos FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.residuos TO authenticated;

INSERT INTO public.residuos (codigo, nome, descricao, grupo, sort_order) VALUES
  ('RG-R-001', 'Lodo de tratamento de efluentes', 'Lodos de ETAs e similares', 'II-A', 10),
  ('RG-R-002', 'Borracha e plástico contaminados', 'Misturas com óleo, solventes ou químicos', 'II-A', 20),
  ('RG-R-003', 'Embalagens contaminadas', 'Tambores, bombonas, IBC após uso', 'II-A', 30),
  ('RG-R-004', 'Filtros e mangas contaminados', 'Filtros industriais, mangas de dedusting', 'II-A', 40),
  ('RG-R-005', 'Sólidos oleosos', 'Sólidos impregnados com óleo mineral', 'II-A', 50),
  ('RG-R-006', 'Óleos lubrificantes usados', 'Óleo de motor, hidráulico, compressores', 'I', 60),
  ('RG-R-007', 'Óleos isolantes usados', 'Óleo dielétrico de transformadores', 'I', 70),
  ('RG-R-008', 'Efluentes líquidos industriais', 'Águas contaminadas de processo', 'II-A', 80),
  ('RG-R-009', 'Solventes halogenados usados', 'Clorados, freons de processo', 'I', 90),
  ('RG-R-010', 'Solventes não halogenados usados', 'Thinners alifáticos, álcoois', 'II-A', 100),
  ('RG-R-011', 'Tintas, tintas em pó e vernizes', 'Resíduos de pintura e revestimentos', 'II-A', 110),
  ('RG-R-012', 'Resinas e colas', 'Epóxi, PU, adesivos fora de especificação', 'II-A', 120),
  ('RG-R-013', 'Ácidos em desuso', 'Ácidos fora de uso ou contaminados', 'I', 130),
  ('RG-R-014', 'Bases em desuso', 'Hidróxidos e alcalinos fora de uso', 'I', 140),
  ('RG-R-015', 'Reagentes de laboratório', 'Químicos laboratoriais mistos ou vencidos', 'I', 150),
  ('RG-R-016', 'Lâmpadas fluorescentes e vapor de mercúrio', 'Lâmpadas classe A (mercúrio)', 'I', 160),
  ('RG-R-017', 'Pilhas e baterias', 'Pilhas e baterias portáteis usadas', 'I', 170),
  ('RG-R-018', 'Resíduos eletrônicos (e-lixo)', 'Placas, cabos, equipamentos fora de uso', 'II-A', 180),
  ('RG-R-019', 'Sucata ferrosa contaminada', 'Metais com óleo, tinta ou solvente', 'II-A', 190),
  ('RG-R-020', 'Sucata não ferrosa contaminada', 'Alumínio, cobre, latão contaminados', 'II-A', 200),
  ('RG-R-021', 'Papel e papelão contaminados', 'Com óleo, químico ou alimentar', 'II-B', 210),
  ('RG-R-022', 'Madeira tratada ou contaminada', 'CCA, creosoto ou químicos', 'II-A', 220),
  ('RG-R-023', 'Resíduos de healthcare similares', 'Afiados, materiais de cura contaminados', 'I', 230),
  ('RG-R-024', 'Resíduos biológicos / infectantes', 'Conforme segregação operacional', 'I', 240),
  ('RG-R-025', 'Lixívia e soda cáustica usada', 'Soluções alcalinas de limpeza', 'II-A', 250),
  ('RG-R-026', 'Areia ou brita contaminada', 'Absorventes de derramamento', 'II-A', 260),
  ('RG-R-027', 'Lodo de decantador / tanque', 'Retirada de tanques e caixas separadoras', 'II-A', 270),
  ('RG-R-028', 'Outros não classificados acima', 'Especificar observações na coleta/MTR', '—', 999)
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Ticket impresso + aprovação Faturamento + view consolidada
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4) Contrato cliente — veículos, equipamentos, resíduos (JSONB)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5) Exclusão MTR / coleta em cascata (evita timeout 57014)
-- ---------------------------------------------------------------------------
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

COMMIT;

-- =============================================================================
-- Fim — release 1.2.6
-- =============================================================================
