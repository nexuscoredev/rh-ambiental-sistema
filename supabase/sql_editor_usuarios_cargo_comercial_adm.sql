-- =============================================================================
-- SQL Editor — corrigir erro 23514 em usuarios_cargo_canonico_chk
--
-- Se Thais já tem «Comercial Adm» e o erro cita essa linha:
--   use o ficheiro sql_editor_fix_constraint_comercial_adm.sql (só DROP + CHECK).
--
-- Este ficheiro: pacote completo (diagnóstico + UPDATEs + CHECK).
-- Selecione TUDO (Ctrl+A) e execute — não copie só o ALTER TABLE do fim.
-- =============================================================================

-- Ver cargos que quebram o CHECK (execute primeiro se quiser)
SELECT btrim(cargo) AS cargo, count(*)::int AS qtd
FROM public.usuarios
WHERE cargo IS NOT NULL AND btrim(cargo) <> ''
GROUP BY 1
ORDER BY 2 DESC;

-- Normalização
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

UPDATE public.usuarios
SET cargo = 'Operacional'
WHERE btrim(coalesce(cargo, '')) IN (
  'Operadores (Time R)',
  'Operadores',
  'Os meninos'
);

-- Ainda inválidos? (deve voltar 0 linhas antes do CHECK)
SELECT id, nome, cargo
FROM public.usuarios
WHERE cargo IS NOT NULL
  AND btrim(cargo) <> ''
  AND cargo NOT IN (
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
  );

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
  'Cargos aceites; Thais → Comercial Adm; equipe Comercial → Comercial.';
