-- Login: cada utilizador lê o próprio registo (qualquer status) + RPC rápida para o bootstrap da app.

DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
CREATE POLICY "usuarios_select_own"
  ON public.usuarios FOR SELECT TO authenticated
  USING (auth.uid() = id);

COMMENT ON POLICY "usuarios_select_own" ON public.usuarios IS
  'Permite ler o próprio perfil (login / permissões), independentemente de status=ativo.';

DROP FUNCTION IF EXISTS public.obter_meu_perfil_usuario();

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
  SELECT
    u.id,
    u.nome,
    u.email,
    u.cargo,
    u.status,
    u.foto_url,
    u.paginas_permitidas
  FROM public.usuarios u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.obter_meu_perfil_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_meu_perfil_usuario() TO authenticated;

COMMENT ON FUNCTION public.obter_meu_perfil_usuario() IS
  'Perfil do utilizador autenticado (bootstrap UI; ignora RLS de diretório só-ativos).';
