-- =============================================================================
-- Se o script completo dá «Connection timeout», execute UM bloco de cada vez
-- (selecione só o bloco → Run). Espere «Success» antes do próximo.
-- Se o projeto mostra «exhausting resources», resolva isso no Dashboard primeiro.
-- =============================================================================

-- PASSO 1 — só a policy (mais importante para o login)
DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
CREATE POLICY "usuarios_select_own"
  ON public.usuarios FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- PASSO 2 — apagar função antiga (se existir)
DROP FUNCTION IF EXISTS public.obter_meu_perfil_usuario();

-- PASSO 3 — criar RPC (copie e execute só este bloco)
CREATE OR REPLACE FUNCTION public.obter_meu_perfil_usuario()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  cargo text,
  status text,
  foto_url text,
  paginas_permitidas text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nome, u.email, u.cargo, u.status, u.foto_url, u.paginas_permitidas
  FROM public.usuarios u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

-- PASSO 4 — permissões da função
REVOKE ALL ON FUNCTION public.obter_meu_perfil_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_meu_perfil_usuario() TO authenticated;
