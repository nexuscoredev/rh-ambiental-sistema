-- =============================================================================
-- Migrar cargos gravados em public.usuarios → organograma atual
-- Correr no MESMO projeto Supabase que o localhost usa (.env VITE_SUPABASE_URL).
-- Isto NÃO acontece só por atualizar o código — são dados na tabela usuarios.
-- =============================================================================

-- 1) Ver estado actual
SELECT nome, cargo, email
FROM public.usuarios
ORDER BY nome;

-- 2) Desenvolvedor
UPDATE public.usuarios SET cargo = 'Desenvolvedor'
WHERE lower(btrim(nome)) LIKE '%cavalcante%'
   OR lower(btrim(nome)) LIKE 'vinicius%';

-- 3) Diretoria/Financeiro
UPDATE public.usuarios SET cargo = 'Diretoria'
WHERE lower(btrim(nome)) LIKE '%ezequiel%'
   OR lower(btrim(nome)) = 'ana'
   OR lower(btrim(nome)) LIKE 'ana %';

-- 4) Comercial Adm (Thais)
UPDATE public.usuarios SET cargo = 'Comercial Adm'
WHERE lower(btrim(nome)) LIKE '%thais%';

-- 5) Comercial (mesmo acesso que Thais)
UPDATE public.usuarios SET cargo = 'Comercial'
WHERE lower(btrim(nome)) LIKE '%rafaela%'
   OR lower(btrim(nome)) LIKE '%rose%'
   OR lower(btrim(nome)) LIKE '%raquel%';

-- 6) Operação (sem sufixo Time R)
UPDATE public.usuarios SET cargo = 'Operacional'
WHERE lower(btrim(nome)) LIKE '%matheus%'
   OR (
     lower(btrim(nome)) LIKE '%rafael%'
     AND lower(btrim(nome)) NOT LIKE '%cavalcante%'
     AND lower(btrim(nome)) NOT LIKE '%rafaela%'
   )
   OR lower(btrim(nome)) LIKE '%heberson%'
   OR lower(btrim(nome)) LIKE '%gabriel%';

-- 7) Legados sem nome reconhecido → mapeamento por cargo antigo
UPDATE public.usuarios SET cargo = 'Comercial Adm'
WHERE cargo IN ('Operacional (Time T)', 'Gerente do Time');

UPDATE public.usuarios SET cargo = 'Operacional'
WHERE cargo IN ('Operadores (Time R)', 'Operadores', 'Os meninos');

UPDATE public.usuarios SET cargo = 'Diretoria'
WHERE cargo = 'Administrador'
  AND cargo IS DISTINCT FROM 'Desenvolvedor';

-- 8) Confirmar
SELECT nome, cargo, email
FROM public.usuarios
ORDER BY cargo, nome;
