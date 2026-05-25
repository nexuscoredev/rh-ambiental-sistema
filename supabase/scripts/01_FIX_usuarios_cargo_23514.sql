-- =============================================================================
-- Corrige erro 23514: usuarios_cargo_canonico_chk
-- Execute no SQL Editor ANTES de continuar o script grande (ou sozinho).
-- Depois: Retry na migração que falhou ou continue PENDING_MIGRATIONS.
-- =============================================================================

-- 1) Ver quais cargos quebram o CHECK (deve ficar vazio antes do passo 3)
SELECT btrim(cargo) AS cargo, count(*)::int AS qtd
FROM public.usuarios
WHERE cargo IS NOT NULL AND btrim(cargo) <> ''
GROUP BY 1
ORDER BY 2 DESC;

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_canonico_chk;

UPDATE public.usuarios
SET cargo = 'Operacional (Time T)'
WHERE btrim(coalesce(cargo, '')) IN (
  'Gerente do Time',
  'Operacional (Time Thais)',
  'Operacional time thais'
);

UPDATE public.usuarios
SET cargo = 'Operadores (Time R)'
WHERE btrim(coalesce(cargo, '')) IN (
  'Os Meninos',
  'Os meninos',
  'Operadores',
  'Operadores (Time Rafael)'
);

UPDATE public.usuarios
SET cargo = 'Comercial Adm'
WHERE btrim(coalesce(cargo, '')) IN ('Comercial Adm', 'Comercial adm')
   OR (
     lower(btrim(cargo)) LIKE '%operacional%'
     AND lower(btrim(cargo)) LIKE '%time t%'
   )
   OR (
     lower(btrim(cargo)) LIKE '%gerente%'
     AND lower(btrim(cargo)) LIKE '%time%'
   );

UPDATE public.usuarios
SET cargo = 'Operacional'
WHERE cargo IS NOT NULL
  AND btrim(cargo) <> ''
  AND btrim(cargo) NOT IN (
    'Desenvolvedor',
    'Administrador',
    'Diretoria',
    'Comercial',
    'Comercial Adm',
    'Operacional',
    'Operacional (Time T)',
    'Logística',
    'Balanceiro',
    'Operadores (Time R)',
    'Faturamento',
    'Financeiro',
    'Visualizador'
  );

-- 2) Ainda inválidos? (0 linhas = OK)
SELECT id, nome, cargo
FROM public.usuarios
WHERE cargo IS NOT NULL
  AND btrim(cargo) <> ''
  AND cargo NOT IN (
    'Desenvolvedor',
    'Administrador',
    'Diretoria',
    'Comercial',
    'Comercial Adm',
    'Operacional',
    'Operacional (Time T)',
    'Logística',
    'Balanceiro',
    'Operadores (Time R)',
    'Faturamento',
    'Financeiro',
    'Visualizador'
  );

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_cargo_canonico_chk
  CHECK (
    cargo IS NULL
    OR btrim(cargo) = ''
    OR cargo IN (
      'Desenvolvedor',
      'Administrador',
      'Diretoria',
      'Comercial',
      'Comercial Adm',
      'Operacional',
      'Operacional (Time T)',
      'Logística',
      'Balanceiro',
      'Operadores (Time R)',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );
