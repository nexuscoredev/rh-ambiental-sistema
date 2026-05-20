-- Rename perfil «Os Meninos» → «Operadores» (pesagem / ticket padrão).

UPDATE public.usuarios
SET cargo = 'Operadores'
WHERE cargo = 'Os Meninos';

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_cargo_canonico_chk;

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
      'Operacional',
      'Logística',
      'Balanceiro',
      'Operadores',
      'Gerente do Time',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

COMMENT ON CONSTRAINT usuarios_cargo_canonico_chk ON public.usuarios IS
  'Cargos canónicos (Operadores = pesagem/ticket padrão; distinto de Operacional).';
