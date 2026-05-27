-- Resíduos e equipamentos selecionados na programação (múltipla escolha do contrato do cliente)

ALTER TABLE public.programacoes
  ADD COLUMN IF NOT EXISTS residuos_programacao jsonb;

ALTER TABLE public.programacoes
  ADD COLUMN IF NOT EXISTS equipamentos_programacao jsonb;

COMMENT ON COLUMN public.programacoes.residuos_programacao IS
  'Lista JSON dos resíduos do contrato do cliente escolhidos nesta programação.';

COMMENT ON COLUMN public.programacoes.equipamentos_programacao IS
  'Lista JSON dos equipamentos do contrato do cliente escolhidos nesta programação.';
