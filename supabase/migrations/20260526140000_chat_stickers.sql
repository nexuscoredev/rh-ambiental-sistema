-- Figurinhas do chat interno (packs + catálogo em storage).
-- Aplicar também: npm run db:apply:chat-stickers

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-stickers',
  'chat-stickers',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.chat_sticker_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.chat_sticker_packs (id) ON DELETE CASCADE,
  titulo text,
  storage_path text NOT NULL UNIQUE,
  mime text NOT NULL DEFAULT 'image/png',
  animado boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_stickers_pack_ordem ON public.chat_stickers (pack_id, ordem, created_at);

INSERT INTO public.chat_sticker_packs (id, nome, ordem, ativo)
VALUES ('a0000000-0000-4000-8000-000000000001', 'RG Ambiental', 0, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.chat_sticker_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_stickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_sticker_packs_select_auth" ON public.chat_sticker_packs;
CREATE POLICY "chat_sticker_packs_select_auth"
  ON public.chat_sticker_packs FOR SELECT TO authenticated
  USING (ativo = true);

DROP POLICY IF EXISTS "chat_stickers_select_auth" ON public.chat_stickers;
CREATE POLICY "chat_stickers_select_auth"
  ON public.chat_stickers FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "chat_sticker_packs_insert_dev" ON public.chat_sticker_packs;
CREATE POLICY "chat_sticker_packs_insert_dev"
  ON public.chat_sticker_packs FOR INSERT TO authenticated
  WITH CHECK (public.rg_is_desenvolvedor());

DROP POLICY IF EXISTS "chat_stickers_insert_dev" ON public.chat_stickers;
CREATE POLICY "chat_stickers_insert_dev"
  ON public.chat_stickers FOR INSERT TO authenticated
  WITH CHECK (public.rg_is_desenvolvedor());

GRANT SELECT ON public.chat_sticker_packs TO authenticated;
GRANT SELECT ON public.chat_stickers TO authenticated;
GRANT INSERT ON public.chat_sticker_packs TO authenticated;
GRANT INSERT ON public.chat_stickers TO authenticated;

DROP POLICY IF EXISTS "chat_stickers_storage_select_auth" ON storage.objects;
CREATE POLICY "chat_stickers_storage_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-stickers');

DROP POLICY IF EXISTS "chat_stickers_storage_insert_dev" ON storage.objects;
CREATE POLICY "chat_stickers_storage_insert_dev"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-stickers' AND public.rg_is_desenvolvedor());
