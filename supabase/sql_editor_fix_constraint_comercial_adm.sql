-- =============================================================================
-- CORREÇÃO RÁPIDA — erro 23514 (Thais com cargo «Comercial Adm»)
-- Selecione TUDO (Ctrl+A) neste ficheiro e execute de uma vez.
-- NÃO execute só as últimas linhas.
-- =============================================================================

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

-- Confirmar que Thais passa no CHECK:
SELECT id, nome, cargo
FROM public.usuarios
WHERE nome ILIKE '%thais%';
