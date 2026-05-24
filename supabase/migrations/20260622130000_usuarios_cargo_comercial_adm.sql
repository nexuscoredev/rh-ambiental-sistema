-- Cargo canónico «Comercial Adm» + normalização de legados antes do CHECK.
-- Executar no SQL Editor se o CHECK falhar com 23514.

-- 1) Diagnóstico (opcional — descomente para ver cargos fora da lista)
-- SELECT btrim(cargo) AS cargo, count(*)::int AS qtd
-- FROM public.usuarios
-- WHERE cargo IS NOT NULL AND btrim(cargo) <> ''
-- GROUP BY 1
-- ORDER BY 2 DESC;

-- 2) Normalizar legados → cargos do organograma atual
UPDATE public.usuarios
SET cargo = 'Comercial Adm'
WHERE btrim(coalesce(cargo, '')) IN (
  'Operacional (Time T)',
  'Gerente do Time',
  'Operacional time thais'
)
OR (
  lower(btrim(cargo)) LIKE '%operacional%'
  AND lower(btrim(cargo)) LIKE '%time t%'
)
OR (
  lower(btrim(cargo)) LIKE '%gerente%'
  AND lower(btrim(cargo)) LIKE '%time%'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rg_nome_contem_token'
  ) THEN
    UPDATE public.usuarios
    SET cargo = 'Comercial Adm'
    WHERE public.rg_nome_contem_token(coalesce(nome, ''), 'thais')
      AND btrim(coalesce(cargo, '')) NOT IN ('Desenvolvedor', 'Comercial Adm');

    UPDATE public.usuarios
    SET cargo = 'Comercial'
    WHERE (
      public.rg_nome_contem_token(coalesce(nome, ''), 'rafaela')
      OR public.rg_nome_contem_token(coalesce(nome, ''), 'rose')
      OR public.rg_nome_contem_token(coalesce(nome, ''), 'raquel')
    )
    AND btrim(coalesce(cargo, '')) NOT IN ('Desenvolvedor', 'Comercial Adm', 'Comercial');
  END IF;
END $$;

-- Operação: legado Time R → Operacional (RBAC resolve pelo nome)
UPDATE public.usuarios
SET cargo = 'Operacional'
WHERE btrim(coalesce(cargo, '')) IN (
  'Operadores (Time R)',
  'Operadores',
  'Os meninos'
);

-- 3) CHECK — inclui canónicos + legados ainda aceites na UI/RLS
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_cargo_canonico_chk;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_cargo_canonico_chk
  CHECK (
    cargo IS NULL
    OR btrim(cargo) = ''
    OR cargo IN (
      'Administrador',
      'Diretoria',
      'Comercial',
      'Comercial Adm',
      'Operacional',
      'Operadores (Time R)',
      'Operacional (Time T)',
      'Logística',
      'Balanceiro',
      'Faturamento',
      'Financeiro',
      'Visualizador',
      'Desenvolvedor'
    )
  );

COMMENT ON CONSTRAINT usuarios_cargo_canonico_chk ON public.usuarios IS
  'Cargos aceites; Thais → Comercial Adm; comercial Rafaela/Rose/Raquel → Comercial; legados Time T/R e Desenvolvedor mantidos até migração manual.';
