-- MTR — SIGOR (sim/não) no cadastro de clientes (aba CLIENTES da planilha).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS mtr_sigor boolean;

COMMENT ON COLUMN public.clientes.mtr_sigor IS 'Cliente utiliza MTR via SIGOR: true=sim, false=não, null=não informado.';
