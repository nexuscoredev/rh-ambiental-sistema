-- Desvinculação financeira no faturamento: snapshot editável (ticket + MTR) sem alterar operacional.

ALTER TABLE public.faturamento_registros
  ADD COLUMN IF NOT EXISTS resumo_financeiro jsonb;

COMMENT ON COLUMN public.faturamento_registros.resumo_financeiro IS
  'Snapshot JSON (ticket + MTR) com pesos/valores de faturamento desvinculados do operacional.';
