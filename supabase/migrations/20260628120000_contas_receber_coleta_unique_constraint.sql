-- Restaura UNIQUE em referencia_coleta_id para upsert PostgREST (onConflict).
-- A migração de clínicas substituiu a constraint por índice parcial, que não satisfaz ON CONFLICT.

DROP INDEX IF EXISTS public.contas_receber_coleta_unique;

ALTER TABLE public.contas_receber DROP CONSTRAINT IF EXISTS contas_receber_coleta_unique;

ALTER TABLE public.contas_receber
  ADD CONSTRAINT contas_receber_coleta_unique UNIQUE (referencia_coleta_id);

COMMENT ON CONSTRAINT contas_receber_coleta_unique ON public.contas_receber IS
  'Uma conta por coleta; vários NULL são permitidos (contas só de clínica).';
