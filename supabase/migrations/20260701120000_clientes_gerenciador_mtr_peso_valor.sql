-- Linhas MTR do Gerenciador: peso e valor total calculado

ALTER TABLE public.clientes_gerenciador_mtr_linhas
  ADD COLUMN IF NOT EXISTS peso_kg numeric(12, 3),
  ADD COLUMN IF NOT EXISTS valor_unitario numeric(14, 4),
  ADD COLUMN IF NOT EXISTS valor_total numeric(14, 2);

COMMENT ON COLUMN public.clientes_gerenciador_mtr_linhas.peso_kg IS 'Peso em kg (linha MTR baixada no Gerenciador).';
COMMENT ON COLUMN public.clientes_gerenciador_mtr_linhas.valor_unitario IS 'Valor unitário R$/kg (manual ou espelho do contrato).';
COMMENT ON COLUMN public.clientes_gerenciador_mtr_linhas.valor_total IS 'Valor total da linha (peso × valor unitário).';
