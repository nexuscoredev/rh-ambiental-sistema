-- Executar no SQL Editor do Supabase se a migration 20260628120000 ainda não foi aplicada.
-- Corrige: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

DROP INDEX IF EXISTS public.contas_receber_coleta_unique;

ALTER TABLE public.contas_receber DROP CONSTRAINT IF EXISTS contas_receber_coleta_unique;

ALTER TABLE public.contas_receber
  ADD CONSTRAINT contas_receber_coleta_unique UNIQUE (referencia_coleta_id);
