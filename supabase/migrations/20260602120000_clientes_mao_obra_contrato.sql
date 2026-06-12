-- Mão de obra no contrato do cliente (mesma estrutura de equipamentos: descrição + valor).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS mao_obra_contrato jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clientes.mao_obra_contrato IS
  'Itens de mão de obra contratados (descrição, com_custo, valor R$) — espelhados na MTR e faturamento.';
