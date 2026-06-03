-- =============================================================================
-- SQL provável pendente (jun/2026 em diante) — cole no SQL Editor do Supabase
-- Ordem: do mais antigo ao mais recente (já ordenado abaixo).
-- Antes: rode o bloco de VERIFICACAO em supabase/scripts/VERIFICAR_MIGRATIONS_PENDENTES.sql
-- =============================================================================

-- >>> BEGIN 20260601120000_chat_pedido_ajuste_feedback.sql

-- Ciclo solicitante: aprovar / negar ajuste; reabertura na fila do desenvolvedor; histórico.

ALTER TABLE public.chat_pedido_ajuste_resolvido
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando_solicitante',
  ADD COLUMN IF NOT EXISTS justificativa_solicitante text,
  ADD COLUMN IF NOT EXISTS decidido_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS ciclo int NOT NULL DEFAULT 1;

-- Pedidos já fechados antes desta funcionalidade tratam-se como aprovados.
UPDATE public.chat_pedido_ajuste_resolvido
SET status = 'aprovado'
WHERE status = 'aguardando_solicitante'
  AND decidido_por IS NULL
  AND justificativa_solicitante IS NULL;

ALTER TABLE public.chat_pedido_ajuste_resolvido
  DROP CONSTRAINT IF EXISTS chat_pedido_ajuste_resolvido_status_check;

ALTER TABLE public.chat_pedido_ajuste_resolvido
  ADD CONSTRAINT chat_pedido_ajuste_resolvido_status_check
  CHECK (status IN ('aguardando_solicitante', 'reaberto', 'aprovado'));

CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_pedido_id uuid NOT NULL REFERENCES public.chat_mensagens (id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas (id) ON DELETE CASCADE,
  evento text NOT NULL CHECK (evento IN ('resolvido_dev', 'aprovado_solicitante', 'negado_solicitante')),
  actor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  texto text,
  ciclo int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_historico_pedido
  ON public.chat_pedido_ajuste_historico (mensagem_pedido_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_historico_created
  ON public.chat_pedido_ajuste_historico (created_at DESC);

ALTER TABLE public.chat_pedido_ajuste_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_pedido_ajuste_historico_select_participant" ON public.chat_pedido_ajuste_historico;
CREATE POLICY "chat_pedido_ajuste_historico_select_participant"
  ON public.chat_pedido_ajuste_historico FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participantes cp
      WHERE cp.conversa_id = chat_pedido_ajuste_historico.conversa_id
        AND cp.user_id = auth.uid()
    )
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  );

GRANT SELECT ON public.chat_pedido_ajuste_historico TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_registar_historico_pedido_ajuste(
  p_mensagem_pedido_id uuid,
  p_conversa_id uuid,
  p_evento text,
  p_actor_id uuid,
  p_texto text,
  p_ciclo int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_pedido_ajuste_historico (
    mensagem_pedido_id,
    conversa_id,
    evento,
    actor_id,
    texto,
    ciclo
  )
  VALUES (
    p_mensagem_pedido_id,
    p_conversa_id,
    p_evento,
    p_actor_id,
    nullif(trim(coalesce(p_texto, '')), ''),
    greatest(coalesce(p_ciclo, 1), 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_marcar_pedido_ajuste_resolvido(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid,
  p_resposta text DEFAULT 'Ajustamos conforme a sua solicitação, pode testar por gentileza?'
)
RETURNS SETOF public.chat_mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_resposta public.chat_mensagens%ROWTYPE;
  v_texto text := trim(coalesce(p_resposta, ''));
  v_existente public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_ciclo int := 1;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Sem permissão para marcar pedidos de ajuste como resolvidos.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = p_conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id
    AND m.conversa_id = p_conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  SELECT r.*
  INTO v_existente
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND THEN
    IF v_existente.status <> 'reaberto' THEN
      RAISE EXCEPTION 'Este pedido já foi tratado (aguarda o solicitante ou está encerrado).';
    END IF;
    v_ciclo := coalesce(v_existente.ciclo, 1) + 1;
  END IF;

  IF length(v_texto) = 0 THEN
    RAISE EXCEPTION 'Resposta vazia.';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (p_conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  IF v_existente.mensagem_id IS NOT NULL THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      conversa_id = p_conversa_id,
      resolvido_por = v_me,
      resolvido_em = now(),
      resposta_mensagem_id = v_resposta.id,
      status = 'aguardando_solicitante',
      justificativa_solicitante = NULL,
      decidido_por = NULL,
      decidido_em = NULL,
      ciclo = v_ciclo
    WHERE mensagem_id = p_mensagem_pedido_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_resolvido (
      mensagem_id,
      conversa_id,
      resolvido_por,
      resposta_mensagem_id,
      status,
      ciclo
    )
    VALUES (
      p_mensagem_pedido_id,
      p_conversa_id,
      v_me,
      v_resposta.id,
      'aguardando_solicitante',
      1
    );
    v_ciclo := 1;
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'resolvido_dev',
    v_me,
    v_texto,
    v_ciclo
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_decidir_pedido_ajuste_solicitante(
  p_mensagem_pedido_id uuid,
  p_aprovado boolean,
  p_justificativa text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_just text := trim(coalesce(p_justificativa, ''));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  IF v_pedido.remetente_id <> v_me THEN
    RAISE EXCEPTION 'Apenas quem abriu o pedido pode aprovar ou negar o ajuste.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = v_pedido.conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF NOT FOUND OR v_reg.status <> 'aguardando_solicitante' THEN
    RAISE EXCEPTION 'Não há ajuste pendente da sua confirmação para este pedido.';
  END IF;

  IF coalesce(p_aprovado, false) THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      status = 'aprovado',
      decidido_por = v_me,
      decidido_em = now(),
      justificativa_solicitante = NULL
    WHERE mensagem_id = p_mensagem_pedido_id;

    PERFORM public.chat_registar_historico_pedido_ajuste(
      p_mensagem_pedido_id,
      v_pedido.conversa_id,
      'aprovado_solicitante',
      v_me,
      NULL,
      coalesce(v_reg.ciclo, 1)
    );
    RETURN;
  END IF;

  IF length(v_just) = 0 THEN
    RAISE EXCEPTION 'Indique a justificativa ao negar o ajuste.';
  END IF;

  UPDATE public.chat_pedido_ajuste_resolvido
  SET
    status = 'reaberto',
    decidido_por = v_me,
    decidido_em = now(),
    justificativa_solicitante = v_just
  WHERE mensagem_id = p_mensagem_pedido_id;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    v_pedido.conversa_id,
    'negado_solicitante',
    v_me,
    v_just,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chat_registar_historico_pedido_ajuste(uuid, uuid, text, uuid, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_marcar_pedido_ajuste_resolvido(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_decidir_pedido_ajuste_solicitante(uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_marcar_pedido_ajuste_resolvido(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_decidir_pedido_ajuste_solicitante(uuid, boolean, text) TO authenticated;

-- <<< END 20260601120000_chat_pedido_ajuste_feedback.sql

-- >>> BEGIN 20260601140000_rbac_visualizador_nao_revoga_comercial.sql

-- Cargo «Visualizador» legado não bloqueia quem o organograma classifica como comercial/diretoria.

CREATE OR REPLACE FUNCTION public.rg_rbac_pode(p_recurso text, p_acao text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text := public.rg_rbac_setor_usuario();
BEGIN
  IF public.rg_is_desenvolvedor_master() THEN
    RETURN true;
  END IF;

  IF public.rg_is_visualizador()
     AND s NOT IN ('comercial', 'diretoria_financeiro')
  THEN
    RETURN false;
  END IF;

  CASE p_recurso
    WHEN 'cliente' THEN
      RETURN s = 'comercial';
    WHEN 'motorista', 'veiculo' THEN
      RETURN s IN ('comercial', 'operacao');
    WHEN 'representante' THEN
      IF p_acao = 'ler' THEN
        RETURN s IN ('comercial', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'programacao' THEN
      IF p_acao = 'ler' THEN RETURN true; END IF;
      RETURN s = 'comercial';
    WHEN 'mtr' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'pesagem_ticket' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'comprovante_descarte' THEN
      RETURN s = 'comercial';
    WHEN 'conferencia_transporte' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN s = 'operacao';
    WHEN 'faturamento' THEN
      IF p_acao IN ('ler', 'criar', 'editar', 'excluir') THEN RETURN s = 'comercial'; END IF;
    ELSE
      NULL;
  END CASE;

  RETURN false;
END;
$$;

-- <<< END 20260601140000_rbac_visualizador_nao_revoga_comercial.sql

-- >>> BEGIN 20260602193000_operacional_frota.sql

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

-- <<< END 20260602193000_operacional_frota.sql

-- >>> BEGIN 20260602220000_frota_acessos_rbac.sql

-- Frota operacional: acessos restritos (Operacional, Comercial, Comercial Adm, Diretoria; exclusão Thais).

CREATE OR REPLACE FUNCTION public.rg_cargo_eh_operacional_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND lower(trim(coalesce(u.status, ''))) = 'ativo'
      AND lower(trim(coalesce(u.cargo, ''))) LIKE '%operacional%'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%operadores%'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%time r%'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%time t%'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%visualizador%'
  );
$$;

COMMENT ON FUNCTION public.rg_cargo_eh_operacional_frota() IS
  'Cargo Operacional (sem Operadores / Time T/R) — transportes e manutenção da frota.';

CREATE OR REPLACE FUNCTION public.rg_pode_acessar_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_desenvolvedor_master()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_admin()
    OR public.rg_is_diretoria()
    OR public.rg_is_equipe_comercial()
    OR public.rg_cargo_eh_operacional_frota();
$$;

COMMENT ON FUNCTION public.rg_pode_acessar_frota() IS
  'Ler frota: Operacional, Comercial (incl. Adm), Diretoria e Desenvolvedor.';

CREATE OR REPLACE FUNCTION public.rg_pode_mutar_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_desenvolvedor_master()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_admin()
      OR public.rg_rbac_pode('frota_operacional', 'editar')
    );
$$;

COMMENT ON FUNCTION public.rg_pode_mutar_frota() IS
  'Incluir/editar frota e gerar relatório para assinatura.';

CREATE OR REPLACE FUNCTION public.rg_pode_excluir_frota()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_desenvolvedor_master()
    OR public.rg_is_diretoria()
    OR public.rg_is_thais()
    OR public.rg_is_comercial_adm()
    OR public.rg_rbac_pode('frota_operacional', 'excluir');
$$;

COMMENT ON FUNCTION public.rg_pode_excluir_frota() IS
  'Excluir registos da frota — Comercial Adm (Thais), Diretoria e Desenvolvedor.';

CREATE OR REPLACE FUNCTION public.rg_rbac_pode(p_recurso text, p_acao text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text := public.rg_rbac_setor_usuario();
BEGIN
  IF public.rg_is_visualizador() THEN
    RETURN false;
  END IF;

  IF public.rg_is_desenvolvedor_master() THEN
    RETURN true;
  END IF;

  CASE p_recurso
    WHEN 'cliente' THEN
      RETURN s = 'comercial'
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'matheus')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'gabriel');
    WHEN 'motorista', 'veiculo' THEN
      RETURN s IN ('comercial', 'operacao')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'matheus')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'gabriel');
    WHEN 'representante' THEN
      IF p_acao = 'ler' THEN
        RETURN s IN ('comercial', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'programacao' THEN
      IF p_acao = 'ler' THEN RETURN true; END IF;
      IF p_acao IN ('criar', 'editar') THEN
        RETURN s IN ('comercial', 'operacao', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'mtr' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'pesagem_ticket' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      IF p_acao IN ('criar', 'editar') THEN
        RETURN s IN ('comercial', 'operacao', 'diretoria_financeiro');
      END IF;
      RETURN true;
    WHEN 'comprovante_descarte' THEN
      RETURN s = 'comercial';
    WHEN 'conferencia_transporte' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN s = 'operacao';
    WHEN 'faturamento' THEN
      IF p_acao IN ('ler', 'criar', 'editar', 'excluir') THEN RETURN s = 'comercial'; END IF;
    WHEN 'frota_operacional' THEN
      IF p_acao = 'excluir' THEN
        RETURN public.rg_is_comercial_adm() OR s = 'diretoria_financeiro';
      END IF;
      IF p_acao IN ('ler', 'criar', 'editar') THEN
        RETURN s IN ('comercial', 'diretoria_financeiro')
          OR public.rg_cargo_eh_operacional_frota();
      END IF;
    ELSE
      NULL;
  END CASE;

  RETURN false;
END;
$$;

INSERT INTO public.rbac_matriz (recurso, acao, descricao) VALUES
  ('frota_operacional', 'ler', 'Operacional, Comercial, Diretoria'),
  ('frota_operacional', 'criar', 'Operacional, Comercial, Diretoria'),
  ('frota_operacional', 'editar', 'Operacional, Comercial, Diretoria — inclui relatório assinatura'),
  ('frota_operacional', 'excluir', 'Comercial Adm (Thais), Diretoria')
ON CONFLICT (recurso, acao) DO UPDATE SET descricao = EXCLUDED.descricao;

DROP POLICY IF EXISTS "frota_movimentacao_select" ON public.frota_movimentacao;
CREATE POLICY "frota_movimentacao_select"
  ON public.frota_movimentacao FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota());

DROP POLICY IF EXISTS "frota_movimentacao_mutate" ON public.frota_movimentacao;
DROP POLICY IF EXISTS "frota_movimentacao_insert" ON public.frota_movimentacao;
DROP POLICY IF EXISTS "frota_movimentacao_update" ON public.frota_movimentacao;
DROP POLICY IF EXISTS "frota_movimentacao_delete" ON public.frota_movimentacao;

CREATE POLICY "frota_movimentacao_insert"
  ON public.frota_movimentacao FOR INSERT TO authenticated
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_movimentacao_update"
  ON public.frota_movimentacao FOR UPDATE TO authenticated
  USING (public.rg_pode_mutar_frota())
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_movimentacao_delete"
  ON public.frota_movimentacao FOR DELETE TO authenticated
  USING (public.rg_pode_excluir_frota());

DROP POLICY IF EXISTS "frota_manutencao_select" ON public.frota_manutencao;
CREATE POLICY "frota_manutencao_select"
  ON public.frota_manutencao FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota());

DROP POLICY IF EXISTS "frota_manutencao_mutate" ON public.frota_manutencao;
DROP POLICY IF EXISTS "frota_manutencao_insert" ON public.frota_manutencao;
DROP POLICY IF EXISTS "frota_manutencao_update" ON public.frota_manutencao;
DROP POLICY IF EXISTS "frota_manutencao_delete" ON public.frota_manutencao;

CREATE POLICY "frota_manutencao_insert"
  ON public.frota_manutencao FOR INSERT TO authenticated
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_manutencao_update"
  ON public.frota_manutencao FOR UPDATE TO authenticated
  USING (public.rg_pode_mutar_frota())
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_manutencao_delete"
  ON public.frota_manutencao FOR DELETE TO authenticated
  USING (public.rg_pode_excluir_frota());

DROP POLICY IF EXISTS "frota_diario_select" ON public.frota_diario_veiculo;
CREATE POLICY "frota_diario_select"
  ON public.frota_diario_veiculo FOR SELECT TO authenticated
  USING (public.rg_pode_acessar_frota());

DROP POLICY IF EXISTS "frota_diario_mutate" ON public.frota_diario_veiculo;
DROP POLICY IF EXISTS "frota_diario_insert" ON public.frota_diario_veiculo;
DROP POLICY IF EXISTS "frota_diario_update" ON public.frota_diario_veiculo;
DROP POLICY IF EXISTS "frota_diario_delete" ON public.frota_diario_veiculo;

CREATE POLICY "frota_diario_insert"
  ON public.frota_diario_veiculo FOR INSERT TO authenticated
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_diario_update"
  ON public.frota_diario_veiculo FOR UPDATE TO authenticated
  USING (public.rg_pode_mutar_frota())
  WITH CHECK (public.rg_pode_mutar_frota());

CREATE POLICY "frota_diario_delete"
  ON public.frota_diario_veiculo FOR DELETE TO authenticated
  USING (public.rg_pode_excluir_frota());

-- <<< END 20260602220000_frota_acessos_rbac.sql

-- >>> BEGIN 20260602230000_login_reset_senha_chat.sql

-- Pedido de reset de senha no ecrã de login → mensagem no chat para o desenvolvedor.

CREATE OR REPLACE FUNCTION public.rg_resolver_id_desenvolvedor_sistema()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev uuid;
BEGIN
  SELECT u.id INTO v_dev
  FROM public.usuarios u
  WHERE lower(trim(coalesce(u.status, ''))) = 'ativo'
    AND lower(trim(coalesce(u.nome, ''))) LIKE '%rafael%cavalcante%'
  ORDER BY
    CASE WHEN lower(trim(coalesce(u.cargo, ''))) LIKE '%desenvolvedor%' THEN 0 ELSE 1 END,
    u.created_at NULLS LAST
  LIMIT 1;

  IF v_dev IS NOT NULL THEN
    RETURN v_dev;
  END IF;

  SELECT u.id INTO v_dev
  FROM public.usuarios u
  WHERE lower(trim(coalesce(u.status, ''))) = 'ativo'
    AND lower(trim(coalesce(u.cargo, ''))) LIKE '%desenvolvedor%'
  ORDER BY u.created_at NULLS LAST
  LIMIT 1;

  RETURN v_dev;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_solicitar_reset_senha_login(
  p_email text,
  p_nome text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_solicitante uuid;
  v_dev uuid;
  v_low uuid;
  v_high uuid;
  v_conversa uuid;
  v_nome text;
  v_corpo text;
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  SELECT u.id, coalesce(nullif(trim(p_nome), ''), nullif(trim(u.nome), ''), u.email)
  INTO v_solicitante, v_nome
  FROM public.usuarios u
  WHERE lower(trim(coalesce(u.email, ''))) = v_email
    AND lower(trim(coalesce(u.status, ''))) = 'ativo'
  LIMIT 1;

  IF v_solicitante IS NULL THEN
    RAISE EXCEPTION 'E-mail não encontrado no cadastro activo. Confira o endereço ou contacte a gestão.';
  END IF;

  v_dev := public.rg_resolver_id_desenvolvedor_sistema();
  IF v_dev IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar o desenvolvedor do sistema.';
  END IF;

  IF v_solicitante = v_dev THEN
    RAISE EXCEPTION 'Esta conta é do desenvolvedor; use outro canal para alterar a senha.';
  END IF;

  IF v_solicitante < v_dev THEN
    v_low := v_solicitante;
    v_high := v_dev;
  ELSE
    v_low := v_dev;
    v_high := v_solicitante;
  END IF;

  INSERT INTO public.chat_conversas (participant_low, participant_high)
  VALUES (v_low, v_high)
  ON CONFLICT (participant_low, participant_high) DO UPDATE
  SET updated_at = now();

  SELECT c.id INTO STRICT v_conversa
  FROM public.chat_conversas c
  WHERE c.participant_low = v_low AND c.participant_high = v_high;

  INSERT INTO public.chat_participantes (conversa_id, user_id)
  VALUES (v_conversa, v_low), (v_conversa, v_high)
  ON CONFLICT DO NOTHING;

  v_corpo :=
    '[Pedido de reset de senha — ecrã de login]' || E'\n\n'
    || 'E-mail: ' || v_email || E'\n'
    || 'Nome: ' || coalesce(nullif(trim(p_nome), ''), v_nome, '—');

  IF nullif(trim(coalesce(p_observacao, '')), '') IS NOT NULL THEN
    v_corpo := v_corpo || E'\n\nObservação: ' || trim(p_observacao);
  END IF;

  v_corpo := v_corpo || E'\n\n— ' || coalesce(v_nome, v_email);

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (v_conversa, v_solicitante, v_corpo);

  RETURN jsonb_build_object(
    'conversa_id', v_conversa,
    'desenvolvedor_id', v_dev,
    'solicitante_id', v_solicitante
  );
END;
$$;

COMMENT ON FUNCTION public.rg_solicitar_reset_senha_login(text, text, text) IS
  'Login sem sessão: envia pedido de reset de senha ao chat com o desenvolvedor.';

REVOKE ALL ON FUNCTION public.rg_solicitar_reset_senha_login(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rg_solicitar_reset_senha_login(text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.rg_resolver_id_desenvolvedor_sistema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rg_resolver_id_desenvolvedor_sistema() TO authenticated;

-- <<< END 20260602230000_login_reset_senha_chat.sql

-- >>> BEGIN 20260602240000_usuario_senha_pessoal_confirmacao.sql

-- Confirmação «Já configurei» na boas-vindas + estatísticas para Desenvolvedor.

CREATE TABLE IF NOT EXISTS public.usuario_senha_pessoal_confirmacao (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  confirmado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuario_senha_pessoal_confirmacao_em
  ON public.usuario_senha_pessoal_confirmacao (confirmado_em DESC);

COMMENT ON TABLE public.usuario_senha_pessoal_confirmacao IS
  'Utilizadores que confirmaram ter configurado senha pessoal (boas-vindas).';

ALTER TABLE public.usuario_senha_pessoal_confirmacao ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rg_usuario_elegivel_aviso_senha_pessoal(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_user_id
      AND lower(trim(coalesce(u.status, ''))) = 'ativo'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%desenvolvedor%'
  );
$$;

CREATE OR REPLACE FUNCTION public.rg_senha_pessoal_ja_confirmada()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_senha_pessoal_confirmacao c
    WHERE c.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.rg_senha_pessoal_ja_confirmada() TO authenticated;

CREATE OR REPLACE FUNCTION public.rg_confirmar_senha_pessoal_configurada()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_em timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT public.rg_usuario_elegivel_aviso_senha_pessoal(v_uid) THEN
    RAISE EXCEPTION 'Perfil não elegível para este registo.';
  END IF;

  INSERT INTO public.usuario_senha_pessoal_confirmacao (user_id, confirmado_em)
  VALUES (v_uid, now())
  ON CONFLICT (user_id) DO UPDATE
  SET confirmado_em = EXCLUDED.confirmado_em
  RETURNING confirmado_em INTO v_em;

  RETURN v_em;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rg_confirmar_senha_pessoal_configurada() TO authenticated;

CREATE OR REPLACE FUNCTION public.rg_stats_senha_pessoal_acompanhamento()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Acesso restrito ao Desenvolvedor.';
  END IF;

  SELECT jsonb_build_object(
    'confirmados', coalesce(agg.confirmados, 0),
    'pendentes', coalesce(agg.pendentes, 0),
    'total_elegiveis', coalesce(agg.total_elegiveis, 0),
    'usuarios_confirmados', coalesce(agg.lista_confirmados, '[]'::jsonb),
    'usuarios_pendentes', coalesce(agg.lista_pendentes, '[]'::jsonb)
  )
  INTO v_result
  FROM (
    SELECT
      count(*) FILTER (WHERE c.user_id IS NOT NULL)::int AS confirmados,
      count(*) FILTER (WHERE c.user_id IS NULL)::int AS pendentes,
      count(*)::int AS total_elegiveis,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'nome', u.nome,
            'email', u.email,
            'cargo', u.cargo,
            'confirmado_em', c.confirmado_em
          )
          ORDER BY c.confirmado_em DESC
        ) FILTER (WHERE c.user_id IS NOT NULL),
        '[]'::jsonb
      ) AS lista_confirmados,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'nome', u.nome,
            'email', u.email,
            'cargo', u.cargo
          )
          ORDER BY u.nome NULLS LAST, u.email
        ) FILTER (WHERE c.user_id IS NULL),
        '[]'::jsonb
      ) AS lista_pendentes
    FROM public.usuarios u
    LEFT JOIN public.usuario_senha_pessoal_confirmacao c ON c.user_id = u.id
    WHERE lower(trim(coalesce(u.status, ''))) = 'ativo'
      AND lower(trim(coalesce(u.cargo, ''))) NOT LIKE '%desenvolvedor%'
  ) agg;

  RETURN coalesce(v_result, jsonb_build_object(
    'confirmados', 0,
    'pendentes', 0,
    'total_elegiveis', 0,
    'usuarios_confirmados', '[]'::jsonb,
    'usuarios_pendentes', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rg_stats_senha_pessoal_acompanhamento() TO authenticated;

COMMENT ON FUNCTION public.rg_stats_senha_pessoal_acompanhamento() IS
  'Desenvolvedor: totais e listas de quem confirmou senha pessoal na boas-vindas.';

-- <<< END 20260602240000_usuario_senha_pessoal_confirmacao.sql

-- >>> BEGIN 20260603130000_chat_pedido_ajuste_pedir_detalhes.sql

-- Devolve pedido ao solicitante pedindo mais detalhes (sem encerrar como resolvido).

ALTER TABLE public.chat_pedido_ajuste_resolvido
  DROP CONSTRAINT IF EXISTS chat_pedido_ajuste_resolvido_status_check;

ALTER TABLE public.chat_pedido_ajuste_resolvido
  ADD CONSTRAINT chat_pedido_ajuste_resolvido_status_check
  CHECK (status IN ('aguardando_solicitante', 'aguardando_detalhes', 'reaberto', 'aprovado'));

ALTER TABLE public.chat_pedido_ajuste_historico
  DROP CONSTRAINT IF EXISTS chat_pedido_ajuste_historico_evento_check;

ALTER TABLE public.chat_pedido_ajuste_historico
  ADD CONSTRAINT chat_pedido_ajuste_historico_evento_check
  CHECK (
    evento IN (
      'resolvido_dev',
      'aprovado_solicitante',
      'negado_solicitante',
      'enviado_fila_thais',
      'aprovado_fila_thais',
      'detalhes_solicitados_dev',
      'detalhes_respondidos_solicitante'
    )
  );

CREATE OR REPLACE FUNCTION public.chat_pedir_detalhes_pedido_ajuste(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid,
  p_mensagem text DEFAULT NULL
)
RETURNS SETOF public.chat_mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_resposta public.chat_mensagens%ROWTYPE;
  v_texto text;
  v_existente public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
  v_ciclo int := 1;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Sem permissão para pedir detalhes no pedido de ajuste.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = p_conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id
    AND m.conversa_id = p_conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND v_esc.status = 'aguardando' THEN
    RAISE EXCEPTION 'Este pedido está na fila da Thais. Aguarde a aprovação antes de pedir detalhes.';
  END IF;

  SELECT r.*
  INTO v_existente
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND v_existente.status NOT IN ('reaberto') THEN
    RAISE EXCEPTION 'Este pedido já foi tratado ou aguarda resposta do solicitante.';
  END IF;

  IF FOUND THEN
    v_ciclo := coalesce(v_existente.ciclo, 1);
  END IF;

  v_texto := trim(coalesce(p_mensagem, ''));
  IF length(v_texto) = 0 THEN
    v_texto :=
      'Precisamos de mais detalhes sobre o seu pedido para conseguir tratar o caso. '
      || 'Pode complementar com passos para reproduzir, exemplos ou o que esperava ver no sistema?';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (p_conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  IF v_existente.mensagem_id IS NOT NULL THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      conversa_id = p_conversa_id,
      resolvido_por = v_me,
      resolvido_em = now(),
      resposta_mensagem_id = v_resposta.id,
      status = 'aguardando_detalhes',
      justificativa_solicitante = NULL,
      decidido_por = NULL,
      decidido_em = NULL,
      ciclo = v_ciclo
    WHERE mensagem_id = p_mensagem_pedido_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_resolvido (
      mensagem_id,
      conversa_id,
      resolvido_por,
      resposta_mensagem_id,
      status,
      ciclo
    )
    VALUES (
      p_mensagem_pedido_id,
      p_conversa_id,
      v_me,
      v_resposta.id,
      'aguardando_detalhes',
      1
    );
    v_ciclo := 1;
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'detalhes_solicitados_dev',
    v_me,
    v_texto,
    v_ciclo
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_responder_detalhes_pedido_ajuste(
  p_mensagem_pedido_id uuid,
  p_complemento text
)
RETURNS SETOF public.chat_mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_resposta public.chat_mensagens%ROWTYPE;
  v_texto text := trim(coalesce(p_complemento, ''));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  IF v_pedido.remetente_id <> v_me THEN
    RAISE EXCEPTION 'Apenas quem abriu o pedido pode enviar o complemento.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = v_pedido.conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF NOT FOUND OR v_reg.status <> 'aguardando_detalhes' THEN
    RAISE EXCEPTION 'Não há pedido de detalhes pendente para este caso.';
  END IF;

  IF length(v_texto) < 3 THEN
    RAISE EXCEPTION 'Descreva o complemento com pelo menos 3 caracteres.';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (v_pedido.conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  UPDATE public.chat_pedido_ajuste_resolvido
  SET
    status = 'reaberto',
    justificativa_solicitante = v_texto,
    decidido_por = v_me,
    decidido_em = now()
  WHERE mensagem_id = p_mensagem_pedido_id;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    v_pedido.conversa_id,
    'detalhes_respondidos_solicitante',
    v_me,
    v_texto,
    coalesce(v_reg.ciclo, 1)
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_pedir_detalhes_pedido_ajuste(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_responder_detalhes_pedido_ajuste(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_pedir_detalhes_pedido_ajuste(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_responder_detalhes_pedido_ajuste(uuid, text) TO authenticated;

-- <<< END 20260603130000_chat_pedido_ajuste_pedir_detalhes.sql

-- >>> BEGIN 20260627120000_comercial_lancar_pesagem_tickets.sql

-- Equipe Comercial: lançar pesagem (controle_massa), ticket operacional e espelho na coleta.

CREATE OR REPLACE FUNCTION public.rg_pode_lancar_pesagem_controle_massa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_equipe_comercial()
      OR public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    );
$$;

COMMENT ON FUNCTION public.rg_pode_lancar_pesagem_controle_massa() IS
  'Quem pode gravar pesagem no Controle de Massa (inclui equipe Comercial).';

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;

CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_equipe_comercial()
      OR public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
    )
  )
  WITH CHECK (
    public.rg_is_equipe_comercial()
    OR public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
  );

DROP POLICY IF EXISTS "tickets_operacionais_mutate_roles" ON public.tickets_operacionais;

CREATE POLICY "tickets_operacionais_mutate_roles"
  ON public.tickets_operacionais FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_equipe_comercial()
      OR public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    )
  )
  WITH CHECK (
    public.rg_is_equipe_comercial()
    OR public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
  );

DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;

CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_is_equipe_comercial()
    OR public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_is_diretoria()
  );

-- <<< END 20260627120000_comercial_lancar_pesagem_tickets.sql

-- >>> BEGIN 20260627140000_operacao_programacao_pesagem_lancar.sql

-- Operação: lançar programação e pesagem/ticket (alinhado ao RBAC no frontend).

/** Operadores (Time R) — pesagem / ticket padrão (Matheus, Gabriel, etc.). */
CREATE OR REPLACE FUNCTION public.rg_is_operadores_time_r()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_cargo_like('operadores')
    AND (
      public.rg_cargo_like('time r')
      OR public.rg_cargo_like('rafael')
      OR public.rg_cargo_like('operadores time rafael')
    )
    OR public.rg_cargo_like('meninos')
    OR lower(btrim(public.rg_user_cargo())) = 'operadores';
$$;

COMMENT ON FUNCTION public.rg_is_operadores_time_r() IS
  'Perfil Operadores (Time R) — lançamento de pesagem e ticket no Controle de Massa.';

CREATE OR REPLACE FUNCTION public.rg_rbac_pode(p_recurso text, p_acao text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text := public.rg_rbac_setor_usuario();
BEGIN
  IF public.rg_is_visualizador() THEN
    RETURN false;
  END IF;

  IF public.rg_is_desenvolvedor_master() THEN
    RETURN true;
  END IF;

  CASE p_recurso
    WHEN 'cliente' THEN
      RETURN s = 'comercial';
    WHEN 'motorista', 'veiculo' THEN
      RETURN s IN ('comercial', 'operacao');
    WHEN 'representante' THEN
      IF p_acao = 'ler' THEN
        RETURN s IN ('comercial', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'programacao' THEN
      IF p_acao = 'ler' THEN RETURN true; END IF;
      IF p_acao IN ('criar', 'editar') THEN
        RETURN s IN ('comercial', 'operacao', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'mtr' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'pesagem_ticket' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      IF p_acao IN ('criar', 'editar') THEN
        RETURN s IN ('comercial', 'operacao', 'diretoria_financeiro');
      END IF;
      RETURN true;
    WHEN 'comprovante_descarte' THEN
      RETURN s = 'comercial';
    WHEN 'conferencia_transporte' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN s = 'operacao';
    WHEN 'faturamento' THEN
      IF p_acao IN ('ler', 'criar', 'editar', 'excluir') THEN RETURN s = 'comercial'; END IF;
    ELSE
      NULL;
  END CASE;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.rg_pode_lancar_pesagem_controle_massa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.rg_is_visualizador()
    AND (
      public.rg_rbac_pode('pesagem_ticket', 'criar')
      OR public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operadores_time_r()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    );
$$;

DROP POLICY IF EXISTS "controle_massa_mutate_pesagem" ON public.controle_massa;

CREATE POLICY "controle_massa_mutate_pesagem"
  ON public.controle_massa FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_rbac_pode('pesagem_ticket', 'criar')
      OR public.rg_is_admin()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_is_operadores_time_r()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
    )
  )
  WITH CHECK (
    public.rg_rbac_pode('pesagem_ticket', 'criar')
    OR public.rg_is_admin()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_is_operadores_time_r()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
  );

DROP POLICY IF EXISTS "tickets_operacionais_mutate_roles" ON public.tickets_operacionais;

CREATE POLICY "tickets_operacionais_mutate_roles"
  ON public.tickets_operacionais FOR ALL TO authenticated
  USING (
    NOT public.rg_is_visualizador()
    AND (
      public.rg_rbac_pode('pesagem_ticket', 'criar')
      OR public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operadores_time_r()
      OR public.rg_is_operacional_time_t()
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('balanceiro')
      OR public.rg_cargo_like('pesagem')
      OR public.rg_cargo_like('logistica')
      OR public.rg_cargo_like('operacional')
      OR public.rg_cargo_like('faturamento')
    )
  )
  WITH CHECK (
    public.rg_rbac_pode('pesagem_ticket', 'criar')
    OR public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operadores_time_r()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('faturamento')
  );

DROP POLICY IF EXISTS "coletas_update_roles_fluxo" ON public.coletas;

CREATE POLICY "coletas_update_roles_fluxo"
  ON public.coletas FOR UPDATE TO authenticated
  USING (NOT public.rg_is_visualizador())
  WITH CHECK (
    public.rg_rbac_pode('pesagem_ticket', 'criar')
    OR public.rg_is_admin()
    OR public.rg_is_desenvolvedor()
    OR public.rg_is_operadores_time_r()
    OR public.rg_is_operacional_time_t()
    OR public.rg_cargo_vazio_compat()
    OR public.rg_cargo_like('operacional')
    OR public.rg_cargo_like('logistica')
    OR public.rg_cargo_like('balanceiro')
    OR public.rg_cargo_like('pesagem')
    OR public.rg_cargo_like('faturamento')
    OR public.rg_cargo_like('financeiro')
    OR public.rg_is_diretoria()
  );

-- <<< END 20260627140000_operacao_programacao_pesagem_lancar.sql

-- >>> BEGIN 20260701120000_clientes_gerenciador_mtr_peso_valor.sql

-- Linhas MTR do Gerenciador: peso e valor total calculado

ALTER TABLE public.clientes_gerenciador_mtr_linhas
  ADD COLUMN IF NOT EXISTS peso_kg numeric(12, 3),
  ADD COLUMN IF NOT EXISTS valor_unitario numeric(14, 4),
  ADD COLUMN IF NOT EXISTS valor_total numeric(14, 2);

COMMENT ON COLUMN public.clientes_gerenciador_mtr_linhas.peso_kg IS 'Peso em kg (linha MTR baixada no Gerenciador).';
COMMENT ON COLUMN public.clientes_gerenciador_mtr_linhas.valor_unitario IS 'Valor unitário R$/kg (manual ou espelho do contrato).';
COMMENT ON COLUMN public.clientes_gerenciador_mtr_linhas.valor_total IS 'Valor total da linha (peso × valor unitário).';

-- <<< END 20260701120000_clientes_gerenciador_mtr_peso_valor.sql

-- >>> BEGIN 20260702120000_chat_pedido_ajuste_aprovacao_thais.sql

-- Escalacao de pedidos de ajuste para aprovação da Thais (desenvolvedores).

CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_aprovacao_thais (
  mensagem_id uuid PRIMARY KEY REFERENCES public.chat_mensagens (id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas (id) ON DELETE CASCADE,
  dev_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aguardando',
  enviado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_em timestamptz,
  aprovado_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT chat_pedido_ajuste_aprovacao_thais_status_check
    CHECK (status IN ('aguardando', 'aprovado'))
);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_aprovacao_thais_status
  ON public.chat_pedido_ajuste_aprovacao_thais (status, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_aprovacao_thais_dev
  ON public.chat_pedido_ajuste_aprovacao_thais (dev_id, status);

ALTER TABLE public.chat_pedido_ajuste_aprovacao_thais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_pedido_ajuste_aprovacao_thais_select" ON public.chat_pedido_ajuste_aprovacao_thais;
CREATE POLICY "chat_pedido_ajuste_aprovacao_thais_select"
  ON public.chat_pedido_ajuste_aprovacao_thais FOR SELECT TO authenticated
  USING (
    public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
    OR public.rg_is_thais()
    OR dev_id = auth.uid()
  );

GRANT SELECT ON public.chat_pedido_ajuste_aprovacao_thais TO authenticated;

ALTER TABLE public.chat_pedido_ajuste_historico
  DROP CONSTRAINT IF EXISTS chat_pedido_ajuste_historico_evento_check;

ALTER TABLE public.chat_pedido_ajuste_historico
  ADD CONSTRAINT chat_pedido_ajuste_historico_evento_check
  CHECK (
    evento IN (
      'resolvido_dev',
      'aprovado_solicitante',
      'negado_solicitante',
      'enviado_fila_thais',
      'aprovado_fila_thais'
    )
  );

CREATE OR REPLACE FUNCTION public.chat_enviar_pedido_fila_thais(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Apenas desenvolvedores podem enviar pedidos para a fila da Thais.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id
    AND m.conversa_id = p_conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND coalesce(v_reg.status, 'aguardando_solicitante') NOT IN ('reaberto') THEN
    RAISE EXCEPTION 'Este pedido já foi tratado ou aguarda confirmação do solicitante.';
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND v_esc.status = 'aguardando' THEN
    RAISE EXCEPTION 'Este pedido já está na fila da Thais.';
  END IF;

  IF FOUND AND v_esc.status = 'aprovado' THEN
    RAISE EXCEPTION 'Este pedido já foi aprovado pela Thais. Trate-o na sua fila.';
  END IF;

  INSERT INTO public.chat_pedido_ajuste_aprovacao_thais (
    mensagem_id,
    conversa_id,
    dev_id,
    status,
    enviado_em,
    aprovado_em,
    aprovado_por
  )
  VALUES (
    p_mensagem_pedido_id,
    p_conversa_id,
    v_me,
    'aguardando',
    now(),
    NULL,
    NULL
  );

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'enviado_fila_thais',
    v_me,
    NULL,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_aprovar_pedido_fila_thais(
  p_mensagem_pedido_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT public.rg_is_thais() THEN
    RAISE EXCEPTION 'Apenas a Thais pode aprovar pedidos desta fila.';
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF NOT FOUND OR v_esc.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Pedido não encontrado na fila de aprovação ou já foi decidido.';
  END IF;

  UPDATE public.chat_pedido_ajuste_aprovacao_thais
  SET
    status = 'aprovado',
    aprovado_em = now(),
    aprovado_por = v_me
  WHERE mensagem_id = p_mensagem_pedido_id;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    v_esc.conversa_id,
    'aprovado_fila_thais',
    v_me,
    NULL,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chat_enviar_pedido_fila_thais(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_aprovar_pedido_fila_thais(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_enviar_pedido_fila_thais(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_aprovar_pedido_fila_thais(uuid) TO authenticated;

COMMENT ON TABLE public.chat_pedido_ajuste_aprovacao_thais IS
  'Pedidos de ajuste escalados por desenvolvedores para aprovação da Thais antes do tratamento.';

-- <<< END 20260702120000_chat_pedido_ajuste_aprovacao_thais.sql

-- >>> BEGIN 20260726130000_mtr_baixa_comercial_adm.sql

-- Baixar/cancelar MTR: Comercial Adm (Thais) e lista por nome alinhada ao frontend.

CREATE OR REPLACE FUNCTION public._rg_pode_cancelar_baixar_mtr_por_nome()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rg_is_desenvolvedor_master()
    OR public.rg_is_comercial_adm()
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'thais')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'ezequiel')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'ezequeil')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'ana')
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'raquel')
    OR public.rg_normalizar_nome(public.rg_user_nome()) LIKE '%cavalcante%'
    OR public.rg_nome_contem_token(public.rg_user_nome(), 'vinicius');
$$;

CREATE OR REPLACE FUNCTION public._rg_pode_mutar_mtr_ciclo_vida()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.rg_is_visualizador()
    AND (
      public.rg_is_admin()
      OR public.rg_is_desenvolvedor()
      OR public.rg_is_operacional_time_t()
      OR public.rg_is_comercial_adm()
      OR public.rg_cargo_like('operacional (time t)')
      OR public.rg_cargo_like('gerente do time')
      OR public.rg_cargo_like('faturamento')
      OR public.rg_cargo_like('financeiro')
      OR public.rg_cargo_vazio_compat()
      OR public.rg_cargo_like('operacional')
      OR public._rg_pode_cancelar_baixar_mtr_por_nome()
    );
$$;

-- <<< END 20260726130000_mtr_baixa_comercial_adm.sql

-- >>> BEGIN 20260801120000_operacao_time_r_cadastro_matheus_gabriel.sql

-- Matheus e Gabriel (Operação Time R): cadastro de clientes, motoristas e veículos.

CREATE OR REPLACE FUNCTION public.rg_rbac_pode(p_recurso text, p_acao text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text := public.rg_rbac_setor_usuario();
BEGIN
  IF public.rg_is_visualizador() THEN
    RETURN false;
  END IF;

  IF public.rg_is_desenvolvedor_master() THEN
    RETURN true;
  END IF;

  CASE p_recurso
    WHEN 'cliente' THEN
      RETURN s = 'comercial'
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'matheus')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'gabriel');
    WHEN 'motorista', 'veiculo' THEN
      RETURN s IN ('comercial', 'operacao')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'matheus')
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'gabriel');
    WHEN 'representante' THEN
      IF p_acao = 'ler' THEN
        RETURN s IN ('comercial', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'programacao' THEN
      IF p_acao = 'ler' THEN RETURN true; END IF;
      IF p_acao IN ('criar', 'editar') THEN
        RETURN s IN ('comercial', 'operacao', 'diretoria_financeiro');
      END IF;
      RETURN s = 'comercial';
    WHEN 'mtr' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN true;
    WHEN 'pesagem_ticket' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      IF p_acao IN ('criar', 'editar') THEN
        RETURN s IN ('comercial', 'operacao', 'diretoria_financeiro');
      END IF;
      RETURN true;
    WHEN 'comprovante_descarte' THEN
      RETURN s = 'comercial';
    WHEN 'conferencia_transporte' THEN
      IF p_acao = 'excluir' THEN RETURN s = 'comercial'; END IF;
      RETURN s = 'operacao';
    WHEN 'faturamento' THEN
      IF p_acao IN ('ler', 'criar', 'editar', 'excluir') THEN RETURN s = 'comercial'; END IF;
    ELSE
      NULL;
  END CASE;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.rg_rbac_pode(text, text) IS
  'RBAC por setor/nome. Cliente/motorista/veículo: comercial + operação + exceção Matheus/Gabriel (Time R).';

-- <<< END 20260801120000_operacao_time_r_cadastro_matheus_gabriel.sql

-- >>> BEGIN 20260802120000_chat_pedido_ajuste_config.sql

-- Configuração central das respostas automáticas e destino dos pedidos de ajuste (desenvolvedores).

CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_config (
  id int PRIMARY KEY DEFAULT 1,
  resposta_fallback text NOT NULL,
  resposta_intro text NOT NULL,
  rotulo_referente text NOT NULL DEFAULT 'Referente a: ',
  rotulo_pagina text NOT NULL DEFAULT 'Página: ',
  rotulo_solicitante text NOT NULL DEFAULT 'Solicitado por: ',
  destinatario_dev_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT chat_pedido_ajuste_config_singleton CHECK (id = 1)
);

COMMENT ON TABLE public.chat_pedido_ajuste_config IS
  'Configuração única (linha id=1) das respostas automáticas ao marcar pedido de ajuste como resolvido.';

INSERT INTO public.chat_pedido_ajuste_config (
  id,
  resposta_fallback,
  resposta_intro,
  rotulo_referente,
  rotulo_pagina,
  rotulo_solicitante
)
VALUES (
  1,
  'Ajustamos conforme a sua solicitação, pode testar por gentileza?',
  'Ajustamos conforme a solicitação indicada abaixo, pode testar por gentileza?',
  'Referente a: ',
  'Página: ',
  'Solicitado por: '
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.chat_pedido_ajuste_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_pedido_ajuste_config_select_dev" ON public.chat_pedido_ajuste_config;
CREATE POLICY "chat_pedido_ajuste_config_select_dev"
  ON public.chat_pedido_ajuste_config FOR SELECT TO authenticated
  USING (
    public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  );

DROP POLICY IF EXISTS "chat_pedido_ajuste_config_mutate_dev" ON public.chat_pedido_ajuste_config;
CREATE POLICY "chat_pedido_ajuste_config_mutate_dev"
  ON public.chat_pedido_ajuste_config FOR ALL TO authenticated
  USING (
    public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  )
  WITH CHECK (
    public.rg_is_desenvolvedor()
    OR public.rg_is_desenvolvedor_master()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_pedido_ajuste_config TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_obter_config_pedido_ajuste()
RETURNS public.chat_pedido_ajuste_config
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.chat_pedido_ajuste_config c
  WHERE c.id = 1;
$$;

CREATE OR REPLACE FUNCTION public.chat_atualizar_config_pedido_ajuste(
  p_resposta_fallback text,
  p_resposta_intro text,
  p_rotulo_referente text DEFAULT NULL,
  p_rotulo_pagina text DEFAULT NULL,
  p_rotulo_solicitante text DEFAULT NULL,
  p_destinatario_dev_id uuid DEFAULT NULL
)
RETURNS public.chat_pedido_ajuste_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.chat_pedido_ajuste_config;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Apenas desenvolvedores podem alterar a configuração.';
  END IF;

  IF length(trim(coalesce(p_resposta_fallback, ''))) = 0 THEN
    RAISE EXCEPTION 'Texto fallback é obrigatório.';
  END IF;

  IF length(trim(coalesce(p_resposta_intro, ''))) = 0 THEN
    RAISE EXCEPTION 'Texto introdutório é obrigatório.';
  END IF;

  IF p_destinatario_dev_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = p_destinatario_dev_id
        AND u.status = 'ativo'
    ) THEN
      RAISE EXCEPTION 'Destinatário inválido ou inactivo.';
    END IF;
  END IF;

  UPDATE public.chat_pedido_ajuste_config
  SET
    resposta_fallback = trim(p_resposta_fallback),
    resposta_intro = trim(p_resposta_intro),
    rotulo_referente = coalesce(nullif(trim(p_rotulo_referente), ''), rotulo_referente),
    rotulo_pagina = coalesce(nullif(trim(p_rotulo_pagina), ''), rotulo_pagina),
    rotulo_solicitante = coalesce(nullif(trim(p_rotulo_solicitante), ''), rotulo_solicitante),
    destinatario_dev_id = p_destinatario_dev_id,
    updated_at = now(),
    updated_by = v_me
  WHERE id = 1
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_montar_resposta_pedido_ajuste_resolvido(p_conteudo_pedido text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.chat_pedido_ajuste_config;
  v_raw text := trim(coalesce(p_conteudo_pedido, ''));
  v_body text;
  v_lines text[];
  v_last text;
  v_penult text;
  v_solicitante text;
  v_pagina text;
  v_descricao text;
  v_out text := '';
BEGIN
  SELECT * INTO v_cfg FROM public.chat_pedido_ajuste_config WHERE id = 1;

  IF NOT starts_with(v_raw, '[Solicitação de ajuste no sistema]') THEN
    RETURN coalesce(v_cfg.resposta_fallback, 'Ajustamos conforme a sua solicitação, pode testar por gentileza?');
  END IF;

  v_body := trim(substring(v_raw from length('[Solicitação de ajuste no sistema]') + 1));
  v_lines := string_to_array(v_body, E'\n');

  IF array_length(v_lines, 1) IS NULL OR array_length(v_lines, 1) = 0 THEN
    RETURN coalesce(v_cfg.resposta_fallback, 'Ajustamos conforme a sua solicitação, pode testar por gentileza?');
  END IF;

  v_last := trim(v_lines[array_length(v_lines, 1)]);
  IF v_last ~ '^—\s*' THEN
    v_solicitante := trim(regexp_replace(v_last, '^—\s*', ''));
    v_lines := v_lines[1:array_length(v_lines, 1) - 1];
  END IF;

  IF array_length(v_lines, 1) IS NOT NULL AND array_length(v_lines, 1) > 0 THEN
    v_penult := trim(v_lines[array_length(v_lines, 1)]);
    IF v_penult ~* '^Página:\s*' THEN
      v_pagina := trim(regexp_replace(v_penult, '^Página:\s*', '', 'i'));
      IF v_pagina = '—' OR v_pagina = '' THEN
        v_pagina := NULL;
      END IF;
      v_lines := v_lines[1:array_length(v_lines, 1) - 1];
    END IF;
  END IF;

  v_descricao := trim(array_to_string(v_lines, E'\n'));

  IF v_descricao = '' THEN
    RETURN coalesce(v_cfg.resposta_fallback, 'Ajustamos conforme a sua solicitação, pode testar por gentileza?');
  END IF;

  v_out := coalesce(v_cfg.resposta_intro, 'Ajustamos conforme a solicitação indicada abaixo, pode testar por gentileza?');
  v_out := v_out || E'\n\n' || coalesce(v_cfg.rotulo_referente, 'Referente a: ') || v_descricao;

  IF v_pagina IS NOT NULL THEN
    v_out := v_out || E'\n' || coalesce(v_cfg.rotulo_pagina, 'Página: ') || v_pagina;
  END IF;

  IF v_solicitante IS NOT NULL AND v_solicitante <> '' THEN
    v_out := v_out || E'\n' || coalesce(v_cfg.rotulo_solicitante, 'Solicitado por: ') || v_solicitante;
  END IF;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_marcar_pedido_ajuste_resolvido(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid,
  p_resposta text DEFAULT NULL
)
RETURNS SETOF public.chat_mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_resposta public.chat_mensagens%ROWTYPE;
  v_texto text;
  v_existente public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_ciclo int := 1;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Sem permissão para marcar pedidos de ajuste como resolvidos.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = p_conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id
    AND m.conversa_id = p_conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  SELECT r.*
  INTO v_existente
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND THEN
    IF v_existente.status <> 'reaberto' THEN
      RAISE EXCEPTION 'Este pedido já foi tratado (aguarda o solicitante ou está encerrado).';
    END IF;
    v_ciclo := coalesce(v_existente.ciclo, 1) + 1;
  END IF;

  v_texto := trim(coalesce(p_resposta, ''));
  IF length(v_texto) = 0 THEN
    v_texto := public.chat_montar_resposta_pedido_ajuste_resolvido(v_pedido.conteudo);
  END IF;

  IF length(v_texto) = 0 THEN
    RAISE EXCEPTION 'Resposta vazia.';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (p_conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  IF v_existente.mensagem_id IS NOT NULL THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      conversa_id = p_conversa_id,
      resolvido_por = v_me,
      resolvido_em = now(),
      resposta_mensagem_id = v_resposta.id,
      status = 'aguardando_solicitante',
      justificativa_solicitante = NULL,
      decidido_por = NULL,
      decidido_em = NULL,
      ciclo = v_ciclo
    WHERE mensagem_id = p_mensagem_pedido_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_resolvido (
      mensagem_id,
      conversa_id,
      resolvido_por,
      resposta_mensagem_id,
      status,
      ciclo
    )
    VALUES (
      p_mensagem_pedido_id,
      p_conversa_id,
      v_me,
      v_resposta.id,
      'aguardando_solicitante',
      1
    );
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'resolvido_dev',
    v_me,
    v_texto,
    v_ciclo
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_obter_config_pedido_ajuste() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_atualizar_config_pedido_ajuste(text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_montar_resposta_pedido_ajuste_resolvido(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chat_obter_config_pedido_ajuste() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_atualizar_config_pedido_ajuste(text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_montar_resposta_pedido_ajuste_resolvido(text) TO authenticated;

COMMENT ON FUNCTION public.chat_obter_config_pedido_ajuste() IS
  'Dev: lê configuração das respostas automáticas (singleton id=1).';
COMMENT ON FUNCTION public.chat_atualizar_config_pedido_ajuste(text, text, text, text, text, uuid) IS
  'Dev: actualiza textos das respostas automáticas e destinatário opcional dos novos pedidos.';
COMMENT ON FUNCTION public.chat_montar_resposta_pedido_ajuste_resolvido(text) IS
  'Monta resposta automática citando descrição/página/solicitante conforme configuração.';

-- <<< END 20260802120000_chat_pedido_ajuste_config.sql

-- >>> BEGIN 20260803120000_chat_pedido_ajuste_escalacao_automatica_thais.sql

-- Todo pedido de ajuste passa automaticamente pela fila da Thais antes do desenvolvedor resolver.

CREATE OR REPLACE FUNCTION public.chat_resolver_dev_destino_pedido_ajuste(
  p_conversa_id uuid,
  p_remetente_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.user_id
  FROM public.chat_participantes cp
  WHERE cp.conversa_id = p_conversa_id
    AND cp.user_id <> p_remetente_id
  ORDER BY cp.user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.chat_escalar_pedido_ajuste_thais_interno(
  p_mensagem_id uuid,
  p_conversa_id uuid,
  p_dev_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_ciclo int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
  v_actor uuid := coalesce(p_actor_id, p_dev_id);
BEGIN
  IF p_dev_id IS NULL THEN
    RETURN;
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_id;

  IF FOUND AND v_esc.status = 'aguardando' THEN
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE public.chat_pedido_ajuste_aprovacao_thais
    SET
      conversa_id = p_conversa_id,
      dev_id = p_dev_id,
      status = 'aguardando',
      enviado_em = now(),
      aprovado_em = NULL,
      aprovado_por = NULL
    WHERE mensagem_id = p_mensagem_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_aprovacao_thais (
      mensagem_id,
      conversa_id,
      dev_id,
      status,
      enviado_em,
      aprovado_em,
      aprovado_por
    )
    VALUES (
      p_mensagem_id,
      p_conversa_id,
      p_dev_id,
      'aguardando',
      now(),
      NULL,
      NULL
    );
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_id,
    p_conversa_id,
    'enviado_fila_thais',
    v_actor,
    NULL,
    coalesce(p_ciclo, 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_trg_escalar_pedido_ajuste_thais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev uuid;
BEGIN
  IF NOT starts_with(trim(coalesce(NEW.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RETURN NEW;
  END IF;

  v_dev := public.chat_resolver_dev_destino_pedido_ajuste(NEW.conversa_id, NEW.remetente_id);

  PERFORM public.chat_escalar_pedido_ajuste_thais_interno(
    NEW.id,
    NEW.conversa_id,
    v_dev,
    NEW.remetente_id,
    1
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_trg_escalar_pedido_ajuste_thais ON public.chat_mensagens;
CREATE TRIGGER chat_trg_escalar_pedido_ajuste_thais
  AFTER INSERT ON public.chat_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_trg_escalar_pedido_ajuste_thais();

-- Pedidos abertos sem escalacao (legado) entram na fila da Thais.
INSERT INTO public.chat_pedido_ajuste_aprovacao_thais (
  mensagem_id,
  conversa_id,
  dev_id,
  status,
  enviado_em
)
SELECT
  m.id,
  m.conversa_id,
  public.chat_resolver_dev_destino_pedido_ajuste(m.conversa_id, m.remetente_id),
  'aguardando',
  coalesce(m.created_at, now())
FROM public.chat_mensagens m
LEFT JOIN public.chat_pedido_ajuste_resolvido r ON r.mensagem_id = m.id
WHERE starts_with(trim(coalesce(m.conteudo, '')), '[Solicitação de ajuste no sistema]')
  AND (r.mensagem_id IS NULL OR r.status = 'reaberto')
  AND NOT EXISTS (
    SELECT 1
    FROM public.chat_pedido_ajuste_aprovacao_thais a
    WHERE a.mensagem_id = m.id
  )
  AND public.chat_resolver_dev_destino_pedido_ajuste(m.conversa_id, m.remetente_id) IS NOT NULL
ON CONFLICT (mensagem_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.chat_decidir_pedido_ajuste_solicitante(
  p_mensagem_pedido_id uuid,
  p_aprovado boolean,
  p_justificativa text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_dev uuid;
  v_just text := trim(coalesce(p_justificativa, ''));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  IF v_pedido.remetente_id <> v_me THEN
    RAISE EXCEPTION 'Apenas quem abriu o pedido pode aprovar ou negar o ajuste.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = v_pedido.conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF NOT FOUND OR v_reg.status <> 'aguardando_solicitante' THEN
    RAISE EXCEPTION 'Não há ajuste pendente da sua confirmação para este pedido.';
  END IF;

  IF coalesce(p_aprovado, false) THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      status = 'aprovado',
      decidido_por = v_me,
      decidido_em = now(),
      justificativa_solicitante = NULL
    WHERE mensagem_id = p_mensagem_pedido_id;

    PERFORM public.chat_registar_historico_pedido_ajuste(
      p_mensagem_pedido_id,
      v_pedido.conversa_id,
      'aprovado_solicitante',
      v_me,
      NULL,
      coalesce(v_reg.ciclo, 1)
    );
    RETURN;
  END IF;

  IF length(v_just) = 0 THEN
    RAISE EXCEPTION 'Indique a justificativa ao negar o ajuste.';
  END IF;

  UPDATE public.chat_pedido_ajuste_resolvido
  SET
    status = 'reaberto',
    decidido_por = v_me,
    decidido_em = now(),
    justificativa_solicitante = v_just
  WHERE mensagem_id = p_mensagem_pedido_id;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    v_pedido.conversa_id,
    'negado_solicitante',
    v_me,
    v_just,
    coalesce(v_reg.ciclo, 1)
  );

  v_dev := public.chat_resolver_dev_destino_pedido_ajuste(v_pedido.conversa_id, v_pedido.remetente_id);

  PERFORM public.chat_escalar_pedido_ajuste_thais_interno(
    p_mensagem_pedido_id,
    v_pedido.conversa_id,
    v_dev,
    v_me,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_marcar_pedido_ajuste_resolvido(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid,
  p_resposta text DEFAULT NULL
)
RETURNS SETOF public.chat_mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_resposta public.chat_mensagens%ROWTYPE;
  v_texto text;
  v_existente public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
  v_ciclo int := 1;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Sem permissão para marcar pedidos de ajuste como resolvidos.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = p_conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id
    AND m.conversa_id = p_conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF NOT FOUND OR v_esc.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Este pedido aguarda aprovação da Thais antes de ser tratado.';
  END IF;

  IF v_esc.dev_id <> v_me THEN
    RAISE EXCEPTION 'Este pedido foi aprovado para outro desenvolvedor tratar.';
  END IF;

  SELECT r.*
  INTO v_existente
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND THEN
    IF v_existente.status <> 'reaberto' THEN
      RAISE EXCEPTION 'Este pedido já foi tratado (aguarda o solicitante ou está encerrado).';
    END IF;
    v_ciclo := coalesce(v_existente.ciclo, 1) + 1;
  END IF;

  v_texto := trim(coalesce(p_resposta, ''));
  IF length(v_texto) = 0 THEN
    v_texto := public.chat_montar_resposta_pedido_ajuste_resolvido(v_pedido.conteudo);
  END IF;

  IF length(v_texto) = 0 THEN
    RAISE EXCEPTION 'Resposta vazia.';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (p_conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  IF v_existente.mensagem_id IS NOT NULL THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      conversa_id = p_conversa_id,
      resolvido_por = v_me,
      resolvido_em = now(),
      resposta_mensagem_id = v_resposta.id,
      status = 'aguardando_solicitante',
      justificativa_solicitante = NULL,
      decidido_por = NULL,
      decidido_em = NULL,
      ciclo = v_ciclo
    WHERE mensagem_id = p_mensagem_pedido_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_resolvido (
      mensagem_id,
      conversa_id,
      resolvido_por,
      resposta_mensagem_id,
      status,
      ciclo
    )
    VALUES (
      p_mensagem_pedido_id,
      p_conversa_id,
      v_me,
      v_resposta.id,
      'aguardando_solicitante',
      1
    );
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'resolvido_dev',
    v_me,
    v_texto,
    v_ciclo
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

COMMENT ON FUNCTION public.chat_escalar_pedido_ajuste_thais_interno(uuid, uuid, uuid, uuid, int) IS
  'Escala (ou re-escala) pedido para aprovação da Thais; usado pelo trigger e ao reabrir pedido negado.';

-- <<< END 20260803120000_chat_pedido_ajuste_escalacao_automatica_thais.sql

-- >>> BEGIN 20260804120000_chat_pedido_ajuste_sem_escalacao_automatica.sql

-- Pedidos de ajuste: chegam primeiro ao desenvolvedor; escalação para a Thais só manual.

DROP TRIGGER IF EXISTS chat_trg_escalar_pedido_ajuste_thais ON public.chat_mensagens;
DROP FUNCTION IF EXISTS public.chat_trg_escalar_pedido_ajuste_thais();

-- Pedidos presos em «aguardando» (escalação automática antiga) voltam à fila do dev.
DELETE FROM public.chat_pedido_ajuste_aprovacao_thais
WHERE status = 'aguardando';

CREATE OR REPLACE FUNCTION public.chat_decidir_pedido_ajuste_solicitante(
  p_mensagem_pedido_id uuid,
  p_aprovado boolean,
  p_justificativa text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_just text := trim(coalesce(p_justificativa, ''));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  IF v_pedido.remetente_id <> v_me THEN
    RAISE EXCEPTION 'Apenas quem abriu o pedido pode aprovar ou negar o ajuste.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = v_pedido.conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF NOT FOUND OR v_reg.status <> 'aguardando_solicitante' THEN
    RAISE EXCEPTION 'Não há ajuste pendente da sua confirmação para este pedido.';
  END IF;

  IF coalesce(p_aprovado, false) THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      status = 'aprovado',
      decidido_por = v_me,
      decidido_em = now(),
      justificativa_solicitante = NULL
    WHERE mensagem_id = p_mensagem_pedido_id;

    PERFORM public.chat_registar_historico_pedido_ajuste(
      p_mensagem_pedido_id,
      v_pedido.conversa_id,
      'aprovado_solicitante',
      v_me,
      NULL,
      coalesce(v_reg.ciclo, 1)
    );
    RETURN;
  END IF;

  IF length(v_just) = 0 THEN
    RAISE EXCEPTION 'Indique a justificativa ao negar o ajuste.';
  END IF;

  UPDATE public.chat_pedido_ajuste_resolvido
  SET
    status = 'reaberto',
    decidido_por = v_me,
    decidido_em = now(),
    justificativa_solicitante = v_just
  WHERE mensagem_id = p_mensagem_pedido_id;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    v_pedido.conversa_id,
    'negado_solicitante',
    v_me,
    v_just,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_marcar_pedido_ajuste_resolvido(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid,
  p_resposta text DEFAULT NULL
)
RETURNS SETOF public.chat_mensagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_resposta public.chat_mensagens%ROWTYPE;
  v_texto text;
  v_existente public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
  v_ciclo int := 1;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Sem permissão para marcar pedidos de ajuste como resolvidos.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participantes cp
    WHERE cp.conversa_id = p_conversa_id AND cp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Não pertence a esta conversa.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id
    AND m.conversa_id = p_conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND v_esc.status = 'aguardando' THEN
    RAISE EXCEPTION 'Este pedido está na fila da Thais. Aguarde a aprovação dela ou trate-o depois da aprovação.';
  END IF;

  IF FOUND AND v_esc.status = 'aprovado' AND v_esc.dev_id <> v_me THEN
    RAISE EXCEPTION 'Este pedido foi aprovado para outro desenvolvedor tratar.';
  END IF;

  SELECT r.*
  INTO v_existente
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND THEN
    IF v_existente.status <> 'reaberto' THEN
      RAISE EXCEPTION 'Este pedido já foi tratado (aguarda o solicitante ou está encerrado).';
    END IF;
    v_ciclo := coalesce(v_existente.ciclo, 1) + 1;
  END IF;

  v_texto := trim(coalesce(p_resposta, ''));
  IF length(v_texto) = 0 THEN
    v_texto := public.chat_montar_resposta_pedido_ajuste_resolvido(v_pedido.conteudo);
  END IF;

  IF length(v_texto) = 0 THEN
    RAISE EXCEPTION 'Resposta vazia.';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, remetente_id, conteudo)
  VALUES (p_conversa_id, v_me, v_texto)
  RETURNING * INTO v_resposta;

  IF v_existente.mensagem_id IS NOT NULL THEN
    UPDATE public.chat_pedido_ajuste_resolvido
    SET
      conversa_id = p_conversa_id,
      resolvido_por = v_me,
      resolvido_em = now(),
      resposta_mensagem_id = v_resposta.id,
      status = 'aguardando_solicitante',
      justificativa_solicitante = NULL,
      decidido_por = NULL,
      decidido_em = NULL,
      ciclo = v_ciclo
    WHERE mensagem_id = p_mensagem_pedido_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_resolvido (
      mensagem_id,
      conversa_id,
      resolvido_por,
      resposta_mensagem_id,
      status,
      ciclo
    )
    VALUES (
      p_mensagem_pedido_id,
      p_conversa_id,
      v_me,
      v_resposta.id,
      'aguardando_solicitante',
      1
    );
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'resolvido_dev',
    v_me,
    v_texto,
    v_ciclo
  );

  RETURN QUERY SELECT v_resposta.*;
END;
$$;

COMMENT ON FUNCTION public.chat_marcar_pedido_ajuste_resolvido(uuid, uuid, text) IS
  'Dev resolve pedido na sua fila; se escalado à Thais, só após aprovação (ou sem escalação).';

-- <<< END 20260804120000_chat_pedido_ajuste_sem_escalacao_automatica.sql

-- >>> BEGIN 20260805120000_chat_fila_thais_listar_pedidos.sql

-- Thais vê pedidos escalados mesmo sem ser participante da conversa dev↔solicitante.

DROP POLICY IF EXISTS "chat_mensagens_select_thais_pedido_escalado" ON public.chat_mensagens;
CREATE POLICY "chat_mensagens_select_thais_pedido_escalado"
  ON public.chat_mensagens FOR SELECT TO authenticated
  USING (
    public.rg_is_thais()
    AND starts_with(trim(coalesce(conteudo, '')), '[Solicitação de ajuste no sistema]')
    AND EXISTS (
      SELECT 1
      FROM public.chat_pedido_ajuste_aprovacao_thais a
      WHERE a.mensagem_id = chat_mensagens.id
        AND a.status = 'aguardando'
    )
  );

CREATE OR REPLACE FUNCTION public.chat_listar_pedidos_ajuste_fila_thais()
RETURNS TABLE (
  mensagem_id uuid,
  conversa_id uuid,
  remetente_id uuid,
  conteudo text,
  created_at timestamptz,
  dev_id uuid,
  enviado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.mensagem_id,
    a.conversa_id,
    m.remetente_id,
    m.conteudo,
    m.created_at,
    a.dev_id,
    a.enviado_em
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  INNER JOIN public.chat_mensagens m ON m.id = a.mensagem_id
  WHERE a.status = 'aguardando'
  ORDER BY a.enviado_em ASC;
$$;

REVOKE ALL ON FUNCTION public.chat_listar_pedidos_ajuste_fila_thais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_listar_pedidos_ajuste_fila_thais() TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_enviar_pedido_fila_thais(
  p_conversa_id uuid,
  p_mensagem_pedido_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pedido public.chat_mensagens%ROWTYPE;
  v_reg public.chat_pedido_ajuste_resolvido%ROWTYPE;
  v_esc public.chat_pedido_ajuste_aprovacao_thais%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NOT (public.rg_is_desenvolvedor() OR public.rg_is_desenvolvedor_master()) THEN
    RAISE EXCEPTION 'Apenas desenvolvedores podem enviar pedidos para a fila da Thais.';
  END IF;

  SELECT m.*
  INTO v_pedido
  FROM public.chat_mensagens m
  WHERE m.id = p_mensagem_pedido_id
    AND m.conversa_id = p_conversa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  IF NOT starts_with(trim(coalesce(v_pedido.conteudo, '')), '[Solicitação de ajuste no sistema]') THEN
    RAISE EXCEPTION 'Esta mensagem não é um pedido de ajuste.';
  END IF;

  SELECT r.*
  INTO v_reg
  FROM public.chat_pedido_ajuste_resolvido r
  WHERE r.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND coalesce(v_reg.status, 'aguardando_solicitante') NOT IN ('reaberto') THEN
    RAISE EXCEPTION 'Este pedido já foi tratado ou aguarda confirmação do solicitante.';
  END IF;

  SELECT a.*
  INTO v_esc
  FROM public.chat_pedido_ajuste_aprovacao_thais a
  WHERE a.mensagem_id = p_mensagem_pedido_id;

  IF FOUND AND v_esc.status = 'aguardando' THEN
    RAISE EXCEPTION 'Este pedido já está na fila da Thais.';
  END IF;

  IF FOUND THEN
    UPDATE public.chat_pedido_ajuste_aprovacao_thais
    SET
      conversa_id = p_conversa_id,
      dev_id = v_me,
      status = 'aguardando',
      enviado_em = now(),
      aprovado_em = NULL,
      aprovado_por = NULL
    WHERE mensagem_id = p_mensagem_pedido_id;
  ELSE
    INSERT INTO public.chat_pedido_ajuste_aprovacao_thais (
      mensagem_id,
      conversa_id,
      dev_id,
      status,
      enviado_em,
      aprovado_em,
      aprovado_por
    )
    VALUES (
      p_mensagem_pedido_id,
      p_conversa_id,
      v_me,
      'aguardando',
      now(),
      NULL,
      NULL
    );
  END IF;

  PERFORM public.chat_registar_historico_pedido_ajuste(
    p_mensagem_pedido_id,
    p_conversa_id,
    'enviado_fila_thais',
    v_me,
    NULL,
    coalesce(v_reg.ciclo, 1)
  );
END;
$$;

-- <<< END 20260805120000_chat_fila_thais_listar_pedidos.sql

