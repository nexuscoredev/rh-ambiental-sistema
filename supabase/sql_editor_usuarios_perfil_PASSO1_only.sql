-- Só PASSO 1 (policy). Use se o ficheiro completo der timeout no SQL Editor.
-- Alternativa no PC: npm run db:apply:usuarios-perfil-login (com .env e senha da BD)

DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
CREATE POLICY "usuarios_select_own"
  ON public.usuarios FOR SELECT TO authenticated
  USING (auth.uid() = id);
