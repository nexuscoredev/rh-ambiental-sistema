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
