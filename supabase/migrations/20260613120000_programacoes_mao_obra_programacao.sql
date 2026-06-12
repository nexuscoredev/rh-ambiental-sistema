-- Mão de obra na programação: C/ ou S/ (informação operacional para MTR e faturamento).
ALTER TABLE public.programacoes
  ADD COLUMN IF NOT EXISTS mao_obra_programacao text;

COMMENT ON COLUMN public.programacoes.mao_obra_programacao IS
  'Indica se a visita inclui mão de obra contratada: «C/ Mão de obra» ou «S/ Mão de obra».';
