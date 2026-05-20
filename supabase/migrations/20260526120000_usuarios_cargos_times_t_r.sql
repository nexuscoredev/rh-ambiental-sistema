-- Cargos dos times: Operacional (Time T) e Operadores (Time R).
-- Ordem obrigatória: remover constraint → migrar dados → recriar constraint.

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_canonico_chk;

UPDATE public.usuarios
SET cargo = 'Operacional (Time T)'
WHERE cargo IN ('Gerente do Time', 'Operacional (Time Thais)');

UPDATE public.usuarios
SET cargo = 'Operadores (Time R)'
WHERE cargo IN ('Os Meninos', 'Operadores', 'Operadores (Time Rafael)');

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
      'Operacional (Time T)',
      'Logística',
      'Balanceiro',
      'Operadores (Time R)',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

COMMENT ON CONSTRAINT usuarios_cargo_canonico_chk ON public.usuarios IS
  'Cargos canónicos: Time T = admin+faturamento; Time R = prog+MTR+pesagem+chat; Operacional = fluxo geral.';