-- Ordem de Serviço (OS) na manutenção da frota — campos do formulário impresso RG.

ALTER TABLE public.frota_manutencao
  ADD COLUMN IF NOT EXISTS numero_os integer,
  ADD COLUMN IF NOT EXISTS ano_os integer,
  ADD COLUMN IF NOT EXISTS os_classificacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS solicitante text,
  ADD COLUMN IF NOT EXISTS ocorrido_solicitacao text,
  ADD COLUMN IF NOT EXISTS compra_solucao text,
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_termino date,
  ADD COLUMN IF NOT EXISTS assinatura_autorizado_nome text,
  ADD COLUMN IF NOT EXISTS assinatura_execucao_nome text,
  ADD COLUMN IF NOT EXISTS assinatura_solicitacao_nome text;

ALTER TABLE public.frota_manutencao
  ALTER COLUMN titulo DROP NOT NULL;

ALTER TABLE public.frota_manutencao
  ALTER COLUMN titulo SET DEFAULT '';

CREATE TABLE IF NOT EXISTS public.frota_os_sequencia (
  ano integer PRIMARY KEY,
  ultimo_numero integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.frota_manutencao_atribuir_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano integer;
  v_num integer;
BEGIN
  IF NEW.numero_os IS NOT NULL AND NEW.ano_os IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_ano := COALESCE(
    NEW.ano_os,
    EXTRACT(YEAR FROM COALESCE(NEW.data_inicio, NEW.realizado_em, CURRENT_DATE))::integer
  );

  INSERT INTO public.frota_os_sequencia (ano, ultimo_numero)
  VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE
    SET ultimo_numero = public.frota_os_sequencia.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_num;

  NEW.ano_os := v_ano;
  NEW.numero_os := v_num;

  IF NEW.data_inicio IS NULL THEN
    NEW.data_inicio := COALESCE(NEW.realizado_em, CURRENT_DATE);
  END IF;

  IF trim(coalesce(NEW.titulo, '')) = '' AND NEW.numero_os IS NOT NULL THEN
    NEW.titulo := 'OS ' || NEW.numero_os::text || '/' || NEW.ano_os::text;
  END IF;

  IF NEW.tipo_manutencao IS NULL OR trim(NEW.tipo_manutencao) = '' THEN
    IF COALESCE((NEW.os_classificacao ->> 'corretiva')::boolean, false)
       OR COALESCE((NEW.os_classificacao ->> 'urgencia')::boolean, false) THEN
      NEW.tipo_manutencao := 'corretiva';
    ELSE
      NEW.tipo_manutencao := 'preventiva';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_frota_manutencao_atribuir_os ON public.frota_manutencao;
CREATE TRIGGER trg_frota_manutencao_atribuir_os
  BEFORE INSERT ON public.frota_manutencao
  FOR EACH ROW
  EXECUTE FUNCTION public.frota_manutencao_atribuir_os();

COMMENT ON COLUMN public.frota_manutencao.numero_os IS 'Número sequencial da Ordem de Serviço no ano (ano_os).';
COMMENT ON COLUMN public.frota_manutencao.os_classificacao IS 'Flags: preventiva, planejada, corretiva, urgencia, frota, geral.';
