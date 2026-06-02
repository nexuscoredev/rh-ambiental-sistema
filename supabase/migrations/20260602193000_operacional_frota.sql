-- Frota operacional RG: transportes (movimentação de equipamentos) e manutenção (diário do veículo).

CREATE OR REPLACE FUNCTION public.rg_pode_acessar_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_admin()
    OR public.rg_is_diretoria()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
    OR public.rg_is_operacional_time_t()
    OR public.rg_is_operadores_time_r()
    OR EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND lower(trim(coalesce(u.status, ''))) = 'ativo'
        AND (
          lower(trim(coalesce(u.cargo, ''))) IN (
            'operacional',
            'logística',
            'logistica',
            'balanceiro',
            'faturamento'
          )
          OR lower(trim(coalesce(u.cargo, ''))) LIKE '%operacion%'
          OR lower(trim(coalesce(u.cargo, ''))) LIKE '%logist%'
        )
    );
$$;

COMMENT ON FUNCTION public.rg_pode_acessar_frota() IS
  'Transportes e manutenção da frota — perfis operacionais, logística e gestão.';

-- Movimentação de equipamentos (contrato do cliente)
CREATE TABLE IF NOT EXISTS public.frota_movimentacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_movimentacao text NOT NULL CHECK (
    tipo_movimentacao IN ('troca', 'retirada', 'carregamento_hora', 'instalacao')
  ),
  cliente_id uuid REFERENCES public.clientes (id) ON DELETE SET NULL,
  cliente_nome text,
  equipamento_descricao text NOT NULL,
  caminhao_id uuid REFERENCES public.caminhoes (id) ON DELETE SET NULL,
  programacao_id uuid REFERENCES public.programacoes (id) ON DELETE SET NULL,
  km numeric,
  observacoes text,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  assinatura_responsavel_nome text,
  assinatura_responsavel_cargo text,
  assinatura_em timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_frota_movimentacao_created ON public.frota_movimentacao (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frota_movimentacao_cliente ON public.frota_movimentacao (cliente_id);
CREATE INDEX IF NOT EXISTS idx_frota_movimentacao_caminhao ON public.frota_movimentacao (caminhao_id);

-- Manutenção preventiva / corretiva
CREATE TABLE IF NOT EXISTS public.frota_manutencao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caminhao_id uuid NOT NULL REFERENCES public.caminhoes (id) ON DELETE CASCADE,
  tipo_manutencao text NOT NULL CHECK (tipo_manutencao IN ('preventiva', 'corretiva')),
  titulo text NOT NULL DEFAULT '',
  descricao text,
  km_atual numeric,
  oleo_ultima_troca_km numeric,
  oleo_ultima_troca_data date,
  oleo_proxima_troca_km numeric,
  custo numeric,
  realizado_em date NOT NULL DEFAULT (CURRENT_DATE),
  status text NOT NULL DEFAULT 'registrada' CHECK (status IN ('registrada', 'concluida', 'cancelada')),
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  assinatura_responsavel_nome text,
  assinatura_responsavel_cargo text,
  assinatura_em timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_frota_manutencao_caminhao ON public.frota_manutencao (caminhao_id, realizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_frota_manutencao_tipo ON public.frota_manutencao (tipo_manutencao);

-- Diário do veículo (controle diário de frota)
CREATE TABLE IF NOT EXISTS public.frota_diario_veiculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caminhao_id uuid NOT NULL REFERENCES public.caminhoes (id) ON DELETE CASCADE,
  data_diario date NOT NULL DEFAULT (CURRENT_DATE),
  km_odometro numeric,
  ultima_troca_oleo_km numeric,
  ultima_troca_oleo_data date,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  assinatura_responsavel_nome text,
  assinatura_responsavel_cargo text,
  assinatura_em timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (caminhao_id, data_diario)
);

CREATE INDEX IF NOT EXISTS idx_frota_diario_data ON public.frota_diario_veiculo (data_diario DESC);

DROP TRIGGER IF EXISTS trg_frota_movimentacao_updated_at ON public.frota_movimentacao;
CREATE TRIGGER trg_frota_movimentacao_updated_at
  BEFORE UPDATE ON public.frota_movimentacao
  FOR EACH ROW EXECUTE FUNCTION public.rg_set_updated_at();

DROP TRIGGER IF EXISTS trg_frota_manutencao_updated_at ON public.frota_manutencao;
CREATE TRIGGER trg_frota_manutencao_updated_at
  BEFORE UPDATE ON public.frota_manutencao
  FOR EACH ROW EXECUTE FUNCTION public.rg_set_updated_at();

DROP TRIGGER IF EXISTS trg_frota_diario_updated_at ON public.frota_diario_veiculo;
CREATE TRIGGER trg_frota_diario_updated_at
  BEFORE UPDATE ON public.frota_diario_veiculo
  FOR EACH ROW EXECUTE FUNCTION public.rg_set_updated_at();

ALTER TABLE public.frota_movimentacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frota_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frota_diario_veiculo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frota_movimentacao_select" ON public.frota_movimentacao;
CREATE POLICY "frota_movimentacao_select"
  ON public.frota_movimentacao FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota() OR public.rg_is_visualizador());

DROP POLICY IF EXISTS "frota_movimentacao_mutate" ON public.frota_movimentacao;
CREATE POLICY "frota_movimentacao_mutate"
  ON public.frota_movimentacao FOR ALL TO authenticated
  USING (public.rg_pode_acessar_frota() AND NOT public.rg_is_visualizador())
  WITH CHECK (public.rg_pode_acessar_frota() AND NOT public.rg_is_visualizador());

DROP POLICY IF EXISTS "frota_manutencao_select" ON public.frota_manutencao;
CREATE POLICY "frota_manutencao_select"
  ON public.frota_manutencao FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota() OR public.rg_is_visualizador());

DROP POLICY IF EXISTS "frota_manutencao_mutate" ON public.frota_manutencao;
CREATE POLICY "frota_manutencao_mutate"
  ON public.frota_manutencao FOR ALL TO authenticated
  USING (public.rg_pode_acessar_frota() AND NOT public.rg_is_visualizador())
  WITH CHECK (public.rg_pode_acessar_frota() AND NOT public.rg_is_visualizador());

DROP POLICY IF EXISTS "frota_diario_select" ON public.frota_diario_veiculo;
CREATE POLICY "frota_diario_select"
  ON public.frota_diario_veiculo FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota() OR public.rg_is_visualizador());

DROP POLICY IF EXISTS "frota_diario_mutate" ON public.frota_diario_veiculo;
CREATE POLICY "frota_diario_mutate"
  ON public.frota_diario_veiculo FOR ALL TO authenticated
  USING (public.rg_pode_acessar_frota() AND NOT public.rg_is_visualizador())
  WITH CHECK (public.rg_pode_acessar_frota() AND NOT public.rg_is_visualizador());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.frota_movimentacao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frota_manutencao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frota_diario_veiculo TO authenticated;
