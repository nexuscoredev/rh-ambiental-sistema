-- Cadastro Gerenciador (sub-módulo de Clientes) + linhas MTR baixada

CREATE TABLE IF NOT EXISTS public.clientes_gerenciador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_exibicao text NOT NULL DEFAULT '',
  dados_cadastro jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clientes_gerenciador_mtr_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerenciador_id uuid NOT NULL REFERENCES public.clientes_gerenciador(id) ON DELETE CASCADE,
  mtr_baixada text,
  data date,
  gerador text,
  residuo text,
  quantidade text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_gerenciador_nome
  ON public.clientes_gerenciador (nome_exibicao);

CREATE INDEX IF NOT EXISTS idx_clientes_gerenciador_mtr_gerenciador
  ON public.clientes_gerenciador_mtr_linhas (gerenciador_id, ordem);

ALTER TABLE public.clientes_gerenciador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_gerenciador_mtr_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_gerenciador_auth_all ON public.clientes_gerenciador
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY clientes_gerenciador_mtr_linhas_auth_all ON public.clientes_gerenciador_mtr_linhas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.clientes_gerenciador IS 'Cadastro Gerenciador (campos espelhados do cadastro de clientes em dados_cadastro JSON).';
COMMENT ON TABLE public.clientes_gerenciador_mtr_linhas IS 'Linhas MTR baixada vinculadas ao Gerenciador.';
