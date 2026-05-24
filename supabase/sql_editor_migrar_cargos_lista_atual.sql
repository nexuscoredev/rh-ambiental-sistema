-- =============================================================================
-- Migrar cargos — lista actual (localhost / RG Ambiental PRO)
-- Execute no SQL Editor do projeto ligado ao .env (Ctrl+A → Run).
-- Depois: F5 na página Usuários.
-- =============================================================================

-- Antes
SELECT nome, email, cargo FROM public.usuarios ORDER BY nome;

-- Desenvolvedor
UPDATE public.usuarios SET cargo = 'Desenvolvedor'
WHERE lower(btrim(email)) IN (
  'rafael.cavalcante@nexus.com',
  'vinicius@nexus.com'
);

-- Diretoria/Financeiro
UPDATE public.usuarios SET cargo = 'Diretoria'
WHERE lower(btrim(email)) IN (
  'ezequiel@rgambiental.com',
  'ana.novaes@rgambiental.com'
);

-- Comercial Adm (Thais — única com cargo diferenciado)
UPDATE public.usuarios SET cargo = 'Comercial Adm'
WHERE lower(btrim(email)) = 'thais.pichirilli@rgambiental.com.br';

-- Comercial (mesmo acesso que Thais)
UPDATE public.usuarios SET cargo = 'Comercial'
WHERE lower(btrim(email)) IN (
  'rafaela.thomaz@rgambiental.com.br',
  'rose.mendes@rgambiental.com.br',
  'raquel.novaes@rgambiental.com.br'
);

-- Operação
UPDATE public.usuarios SET cargo = 'Operacional'
WHERE lower(btrim(email)) IN (
  'matheus.maciel@rgambiental.com.br',
  'gabriel@rgambiental.com.br',
  'heberson@rgambiental.com.br'
);

-- Rafael operação (se existir conta @rgambiental sem ser Cavalcante)
UPDATE public.usuarios SET cargo = 'Operacional'
WHERE lower(btrim(nome)) LIKE '%rafael%'
  AND lower(btrim(nome)) NOT LIKE '%cavalcante%'
  AND lower(btrim(nome)) NOT LIKE '%rafaela%'
  AND lower(btrim(email)) NOT LIKE '%nexus.com%';

-- Resíduos legados
UPDATE public.usuarios SET cargo = 'Comercial Adm'
WHERE cargo IN ('Operacional (Time T)', 'Gerente do Time')
  AND cargo IS DISTINCT FROM 'Comercial Adm';

UPDATE public.usuarios SET cargo = 'Operacional'
WHERE cargo IN ('Operadores (Time R)', 'Operadores', 'Os meninos');

UPDATE public.usuarios SET cargo = 'Diretoria'
WHERE cargo = 'Administrador'
  AND lower(btrim(email)) NOT LIKE '%nexus.com%';

-- 9) Menu: lista de páginas restrita esconde o sidebar (só Bem-vindo)
UPDATE public.usuarios
SET paginas_permitidas = NULL
WHERE lower(btrim(email)) = 'thais.pichirilli@rgambiental.com.br';

-- Depois (resultado esperado)
SELECT nome, email, cargo, paginas_permitidas FROM public.usuarios ORDER BY cargo, nome;
