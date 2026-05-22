-- SIGOR no cadastro de clientes: cliente | rg | nao_tem (texto; migra boolean legado se existir).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'mtr_sigor'
      AND udt_name = 'bool'
  ) THEN
    ALTER TABLE public.clientes
      ALTER COLUMN mtr_sigor TYPE text
      USING (
        CASE
          WHEN mtr_sigor IS TRUE THEN 'cliente'
          WHEN mtr_sigor IS FALSE THEN 'nao_tem'
          ELSE NULL
        END
      );
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'mtr_sigor'
  ) THEN
    ALTER TABLE public.clientes ADD COLUMN mtr_sigor text;
  END IF;
END $$;

COMMENT ON COLUMN public.clientes.mtr_sigor IS 'SIGOR: cliente | rg | nao_tem (null = não informado).';
