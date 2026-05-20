-- Vários resíduos por pesagem (Controle de Massa)
ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS residuos_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.controle_massa
  ADD COLUMN IF NOT EXISTS residuos_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.coletas.residuos_itens IS
  'JSON array: [{ catalogo_id, texto, peso_tara, peso_bruto, peso_liquido }]. Vários resíduos por ticket; colunas peso_* da coleta = soma dos itens.';

COMMENT ON COLUMN public.controle_massa.residuos_itens IS
  'Mesmo formato que coletas.residuos_itens — espelho da pesagem por coleta.';
