-- Clientes: datas «Cliente desde» / «Inativo desde» (Financeiro / Pós-venda)
-- Execute no Supabase → SQL Editor se o campo não gravar na tela Clientes.

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS status_ativo_desde date;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS status_inativo_desde date;

COMMENT ON COLUMN public.clientes.status_ativo_desde IS 'Data em que o cliente passou a ser cliente (cadastro manual).';
COMMENT ON COLUMN public.clientes.status_inativo_desde IS 'Data a partir da qual o cliente está ou passou a estar inativo (cadastro manual).';
