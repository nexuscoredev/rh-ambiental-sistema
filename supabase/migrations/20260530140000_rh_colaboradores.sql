-- Departamento Pessoal — cadastro base de colaboradores (Fase 1 RH)

CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text,
  data_admissao date,
  cargo_funcao text,
  departamento text,
  status text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  email text,
  telefone text,
  observacoes text,
  motorista_id uuid REFERENCES public.motoristas (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.rh_colaboradores IS
  'Cadastro de colaboradores (RH). Vínculo opcional com motoristas para quem também opera veículos.';

CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_nome ON public.rh_colaboradores (nome);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_status ON public.rh_colaboradores (status);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_departamento ON public.rh_colaboradores (departamento)
  WHERE departamento IS NOT NULL AND btrim(departamento) <> '';
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_motorista_id ON public.rh_colaboradores (motorista_id)
  WHERE motorista_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_colaboradores_cpf_unico
  ON public.rh_colaboradores (cpf)
  WHERE cpf IS NOT NULL AND btrim(cpf) <> '';

DROP TRIGGER IF EXISTS trg_rh_colaboradores_updated_at ON public.rh_colaboradores;
CREATE TRIGGER trg_rh_colaboradores_updated_at
  BEFORE UPDATE ON public.rh_colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.rg_set_updated_at();

ALTER TABLE public.rh_colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_colaboradores_select_rh" ON public.rh_colaboradores;
CREATE POLICY "rh_colaboradores_select_rh"
  ON public.rh_colaboradores FOR SELECT TO authenticated
  USING (
    public.rg_is_admin()
    OR public.rg_is_diretoria()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  );

DROP POLICY IF EXISTS "rh_colaboradores_mutate_rh" ON public.rh_colaboradores;
CREATE POLICY "rh_colaboradores_mutate_rh"
  ON public.rh_colaboradores FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_diretoria()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_desenvolvedor_master()
    )
  )
  WITH CHECK (
    public.rg_is_admin()
    OR public.rg_is_diretoria()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_colaboradores TO authenticated;
