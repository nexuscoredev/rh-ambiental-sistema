-- Colunas usadas pelo modal de faturamento (observações e acréscimos).

ALTER TABLE public.faturamento_registros
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS valor_adicionais numeric;

COMMENT ON COLUMN public.faturamento_registros.observacoes IS
  'Observações do faturamento antes de enviar ao financeiro.';

COMMENT ON COLUMN public.faturamento_registros.valor_adicionais IS
  'Acréscimos aplicados no faturamento (além do valor principal).';
