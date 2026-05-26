-- Gerador é dono do faturamento? (cadastro cliente + conferência na medição)

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS gerador_dono_faturamento text;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS faturamento_titular_razao_social text;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS faturamento_titular_cnpj text;

COMMENT ON COLUMN public.clientes.gerador_dono_faturamento IS
  'sim | nao — o gerador (cadastro) é o mesmo titular de faturamento/NF.';

COMMENT ON COLUMN public.clientes.faturamento_titular_razao_social IS
  'Quando gerador_dono_faturamento = nao: razão social do titular de faturamento.';

COMMENT ON COLUMN public.clientes.faturamento_titular_cnpj IS
  'Quando gerador_dono_faturamento = nao: CNPJ do titular de faturamento.';

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_gerador_dono_faturamento_check;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_gerador_dono_faturamento_check
  CHECK (
    gerador_dono_faturamento IS NULL
    OR gerador_dono_faturamento IN ('sim', 'nao')
  );
