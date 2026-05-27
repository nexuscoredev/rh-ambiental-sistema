-- Tipo de resíduo escolhido na programação (espelho do contrato do cliente)

ALTER TABLE public.programacoes
  ADD COLUMN IF NOT EXISTS tipo_residuo text;

COMMENT ON COLUMN public.programacoes.tipo_residuo IS
  'Resíduo principal da visita (rótulo do contrato do cliente).';
