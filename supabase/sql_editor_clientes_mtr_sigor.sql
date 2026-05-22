-- Executar no SQL Editor do Supabase (ou: npm run db:apply:sql -- supabase/sql_editor_clientes_mtr_sigor.sql)

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS mtr_sigor boolean;

COMMENT ON COLUMN public.clientes.mtr_sigor IS 'Cliente utiliza MTR via SIGOR: true=sim, false=não, null=não informado.';
