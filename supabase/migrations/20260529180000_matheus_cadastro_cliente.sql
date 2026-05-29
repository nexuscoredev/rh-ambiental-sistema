-- Matheus (Operação): cadastro de clientes — alinhado ao RBAC no frontend.

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
        OR public.rg_nome_contem_token(public.rg_user_nome(), 'matheus');
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

COMMENT ON FUNCTION public.rg_rbac_pode(text, text) IS
  'RBAC por setor/nome. Cliente: comercial + exceção Matheus (cadastro).';
