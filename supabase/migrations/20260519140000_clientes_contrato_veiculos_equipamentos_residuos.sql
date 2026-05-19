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
