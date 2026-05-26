-- SQL Editor: marcar pedidos de ajuste do chat como resolvidos.
-- Conteúdo igual a supabase/migrations/20260526160000_chat_pedido_ajuste_resolvido.sql

CREATE TABLE IF NOT EXISTS public.chat_pedido_ajuste_resolvido (
  mensagem_id uuid PRIMARY KEY REFERENCES public.chat_mensagens (id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas (id) ON DELETE CASCADE,
  resolvido_por uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  resolvido_em timestamptz NOT NULL DEFAULT now(),
  resposta_mensagem_id uuid REFERENCES public.chat_mensagens (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_pedido_ajuste_resolvido_conversa
  ON public.chat_pedido_ajuste_resolvido (conversa_id, resolvido_em DESC);

ALTER TABLE public.chat_pedido_ajuste_resolvido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_pedido_ajuste_resolvido_select_participant" ON public.chat_pedido_ajuste_resolvido;
CREATE POLICY "chat_pedido_ajuste_resolvido_select_participant"
  ON public.chat_pedido_ajuste_resolvido FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participantes cp
      WHERE cp.conversa_id = chat_pedido_ajuste_resolvido.conversa_id
        AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_pedido_ajuste_resolvido_insert_dev" ON public.chat_pedido_ajuste_resolvido;
CREATE POLICY "chat_pedido_ajuste_resolvido_insert_dev"
  ON public.chat_pedido_ajuste_resolvido FOR INSERT TO authenticated
  WITH CHECK (
    public.rg_is_desenvolvedor()
    AND resolvido_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_participantes cp
      WHERE cp.conversa_id = chat_pedido_ajuste_resolvido.conversa_id
        AND cp.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON public.chat_pedido_ajuste_resolvido TO authenticated;
