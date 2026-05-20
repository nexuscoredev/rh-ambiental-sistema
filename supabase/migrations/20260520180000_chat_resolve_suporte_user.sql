-- Destinatário do balão «Suporte técnico» quando VITE não define UUID/e-mail válidos.
CREATE OR REPLACE FUNCTION public.chat_resolve_suporte_user_id(p_caller uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_caller IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT u.id INTO v_id
  FROM public.usuarios u
  WHERE lower(coalesce(u.status, '')) = 'ativo'
    AND lower(coalesce(u.cargo, '')) LIKE '%desenvolvedor%'
    AND u.id IS DISTINCT FROM p_caller
  ORDER BY u.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT u.id INTO v_id
  FROM public.usuarios u
  WHERE lower(coalesce(u.status, '')) = 'ativo'
    AND lower(coalesce(u.cargo, '')) LIKE '%administrador%'
    AND u.id IS DISTINCT FROM p_caller
  ORDER BY u.created_at ASC NULLS LAST
  LIMIT 1;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.chat_resolve_suporte_user_id(uuid) IS
  'Resolve utilizador activo para receber pedidos do balão Suporte técnico (Desenvolvedor, depois Administrador).';

GRANT EXECUTE ON FUNCTION public.chat_resolve_suporte_user_id(uuid) TO authenticated;
