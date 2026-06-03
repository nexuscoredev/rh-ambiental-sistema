-- Cole no SQL Editor do Supabase (produção) para ver o que ainda falta.
-- true = já existe | false = provavelmente precisa aplicar a migration indicada

SELECT 'chat_pedido_ajuste_feedback (20260601120000)' AS item,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname = 'chat_decidir_pedido_ajuste_solicitante'
  ) AS ok;

SELECT 'frota_movimentacao (20260602193000)' AS item,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'frota_movimentacao'
  ) AS ok;

SELECT 'frota_acessos_rbac (20260602220000)' AS item,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname = 'rg_pode_excluir_frota'
  ) AS ok;

SELECT 'usuario_senha_pessoal_confirmacao (20260602240000)' AS item,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usuario_senha_pessoal_confirmacao'
  ) AS ok;

SELECT 'chat_pedir_detalhes (20260603130000)' AS item,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname = 'chat_pedir_detalhes_pedido_ajuste'
  ) AS ok;

SELECT 'chat_aprovacao_thais (20260702120000)' AS item,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_pedido_ajuste_aprovacao_thais'
  ) AS ok;

SELECT 'chat_fila_thais_listar (20260805120000)' AS item,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname = 'chat_listar_pedidos_ajuste_fila_thais'
  ) AS ok;

-- Histórico oficial (se usar supabase db push / CLI linkado):
-- SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 30;
