-- Empresa do grupo responsável pelo faturamento (cadastro cliente + fila de faturamento)

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS empresa_grupo_faturamento jsonb;

COMMENT ON COLUMN public.clientes.empresa_grupo_faturamento IS
  'Opções opcionais: rg1 (+ bradesco, caixa, itau), rg2, sdl. JSON null quando vazio.';
