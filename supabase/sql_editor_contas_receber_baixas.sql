-- Histórico de baixas (pagamentos parciais/totais) em Contas a Receber.
-- Erro típico sem esta tabela: "Could not find the table 'public.contas_receber_baixas' in the schema cache"
-- Executar no SQL Editor do Supabase (projeto de produção).

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_travado boolean NOT NULL DEFAULT false;

ALTER TABLE public.contas_receber
  DROP CONSTRAINT IF EXISTS contas_receber_valor_pago_chk;

ALTER TABLE public.contas_receber
  ADD CONSTRAINT contas_receber_valor_pago_chk
  CHECK (valor_pago >= 0 AND valor_pago <= valor);

CREATE TABLE IF NOT EXISTS public.contas_receber_baixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id uuid NOT NULL REFERENCES public.contas_receber (id) ON DELETE CASCADE,
  valor numeric NOT NULL CHECK (valor > 0),
  data_baixa date NOT NULL DEFAULT (CURRENT_DATE),
  observacao text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_baixas_conta ON public.contas_receber_baixas (conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_baixas_data ON public.contas_receber_baixas (data_baixa DESC);

COMMENT ON TABLE public.contas_receber_baixas IS 'Histórico de recebimentos parciais (baixas) sobre contas_receber.';

ALTER TABLE public.contas_receber_baixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_receber_baixas_select_authenticated" ON public.contas_receber_baixas;
DROP POLICY IF EXISTS "contas_receber_baixas_mutate_financeiro" ON public.contas_receber_baixas;
DROP POLICY IF EXISTS "contas_receber_baixas_authenticated_all" ON public.contas_receber_baixas;

CREATE POLICY "contas_receber_baixas_authenticated_all"
  ON public.contas_receber_baixas FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_receber_baixas TO authenticated;

-- Recarregar cache do PostgREST (Dashboard → Settings → API → Reload schema, se o erro persistir na UI)
