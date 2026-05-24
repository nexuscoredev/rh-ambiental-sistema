-- Clínicas: envio ao financeiro, exclusão de O.S. emitida, data de pagamento e fila dedicada.

ALTER TABLE public.clinicas_ordens_servico
  ADD COLUMN IF NOT EXISTS enviado_financeiro_em timestamptz;

COMMENT ON COLUMN public.clinicas_ordens_servico.enviado_financeiro_em IS
  'Preenchido quando a O.S. entra na fila de Contas a receber (clínicas).';

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS data_pagamento date;

COMMENT ON COLUMN public.contas_receber.data_pagamento IS
  'Data em que o título foi quitado (uso destacado na fila de clínicas).';

-- O.S. que já tinham conta a receber passam a constar como enviadas ao financeiro.
UPDATE public.clinicas_ordens_servico os
SET enviado_financeiro_em = cr.created_at
FROM public.contas_receber cr
WHERE cr.referencia_clinica_os_id = os.id
  AND os.enviado_financeiro_em IS NULL;

-- Emissão no faturamento: encerra O.S. sem criar conta a receber (envio é passo separado).
CREATE OR REPLACE FUNCTION public.emitir_faturamento_clinica_os(
  p_ordem_id uuid,
  p_valor numeric,
  p_data_vencimento date DEFAULT NULL,
  p_referencia_nf text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  osrow public.clinicas_ordens_servico%ROWTYPE;
  urow public.clinicas_unidades%ROWTYPE;
  frid uuid;
  nf_txt text;
BEGIN
  SELECT * INTO osrow FROM public.clinicas_ordens_servico WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O.S. não encontrada.';
  END IF;

  SELECT * INTO urow FROM public.clinicas_unidades WHERE id = osrow.unidade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unidade da O.S. não encontrada.';
  END IF;

  IF osrow.status <> 'aguardando_faturamento' THEN
    RAISE EXCEPTION 'O.S. já foi emitida ou cancelada.';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor de faturamento inválido.';
  END IF;

  nf_txt := NULLIF(trim(p_referencia_nf), '');

  IF osrow.emite_nota_snapshot AND nf_txt IS NULL THEN
    RAISE EXCEPTION 'Esta unidade emite nota fiscal — informe o número da NF na emissão.';
  END IF;

  IF NOT osrow.emite_nota_snapshot AND nf_txt IS NOT NULL THEN
    nf_txt := NULL;
  END IF;

  UPDATE public.clinicas_faturamento_registros
  SET valor = p_valor, status = 'emitido', updated_at = now()
  WHERE ordem_servico_id = p_ordem_id AND status = 'pendente'
  RETURNING id INTO frid;

  IF frid IS NULL THEN
    INSERT INTO public.clinicas_faturamento_registros (ordem_servico_id, valor, status)
    VALUES (p_ordem_id, p_valor, 'emitido')
    RETURNING id INTO frid;
  END IF;

  UPDATE public.clinicas_ordens_servico
  SET
    status = 'emitida',
    referencia_nf = nf_txt,
    nf_registrada_em = CASE WHEN nf_txt IS NOT NULL THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_ordem_id;

  RETURN p_ordem_id;
END;
$$;

-- Envia O.S. emitida para Contas a receber (fila clínicas).
CREATE OR REPLACE FUNCTION public.enviar_clinica_os_ao_financeiro(
  p_ordem_id uuid,
  p_data_vencimento date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  osrow public.clinicas_ordens_servico%ROWTYPE;
  urow public.clinicas_unidades%ROWTYPE;
  fr public.clinicas_faturamento_registros%ROWTYPE;
  crid uuid;
  venc date;
  obs text;
  v_valor numeric;
BEGIN
  SELECT * INTO osrow FROM public.clinicas_ordens_servico WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O.S. não encontrada.';
  END IF;

  IF osrow.status <> 'emitida' THEN
    RAISE EXCEPTION 'Só é possível enviar ao financeiro O.S. já emitidas no faturamento.';
  END IF;

  SELECT * INTO fr FROM public.clinicas_faturamento_registros
  WHERE ordem_servico_id = p_ordem_id AND status = 'emitido'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND OR fr.valor IS NULL OR fr.valor <= 0 THEN
    RAISE EXCEPTION 'Registo de faturamento emitido sem valor válido.';
  END IF;

  v_valor := fr.valor;

  SELECT * INTO urow FROM public.clinicas_unidades WHERE id = osrow.unidade_id;

  venc := COALESCE(p_data_vencimento, CURRENT_DATE + 7);

  obs := format(
    'Clínica: %s | OS: %s | CNPJ: %s | %s',
    urow.razao_social,
    osrow.numero_os,
    COALESCE(urow.cnpj, '—'),
    CASE
      WHEN osrow.pagamento_pix_snapshot AND NOT osrow.emite_nota_snapshot THEN 'Cobrança: PIX (sem NF)'
      WHEN osrow.emite_nota_snapshot THEN 'Cobrança: NF'
      ELSE 'Cobrança: padrão'
    END
  );

  INSERT INTO public.contas_receber (
    cliente_id,
    valor,
    data_emissao,
    data_vencimento,
    status_pagamento,
    referencia_clinica_os_id,
    observacoes,
    valor_pago,
    valor_travado,
    updated_at
  )
  VALUES (
    NULL,
    v_valor,
    CURRENT_DATE,
    venc,
    'Pendente',
    p_ordem_id,
    obs,
    0,
    true,
    now()
  )
  ON CONFLICT (referencia_clinica_os_id) WHERE referencia_clinica_os_id IS NOT NULL
  DO UPDATE SET
    valor = EXCLUDED.valor,
    data_vencimento = EXCLUDED.data_vencimento,
    observacoes = EXCLUDED.observacoes,
    valor_travado = true,
    updated_at = now()
  RETURNING id INTO crid;

  UPDATE public.clinicas_ordens_servico
  SET enviado_financeiro_em = now(), updated_at = now()
  WHERE id = p_ordem_id;

  RETURN crid;
END;
$$;

-- Exclui O.S. emitida (remove conta a receber se ainda não paga).
CREATE OR REPLACE FUNCTION public.excluir_clinica_ordem_servico_emitida(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cr public.contas_receber%ROWTYPE;
BEGIN
  IF p_ordem_id IS NULL THEN
    RAISE EXCEPTION 'O.S. inválida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinicas_ordens_servico
    WHERE id = p_ordem_id AND status = 'emitida'
  ) THEN
    RAISE EXCEPTION 'Só é possível excluir O.S. já emitidas no faturamento.';
  END IF;

  SELECT * INTO cr FROM public.contas_receber
  WHERE referencia_clinica_os_id = p_ordem_id;

  IF FOUND THEN
    IF COALESCE(cr.valor_pago, 0) > 0 OR cr.status_pagamento = 'Pago' THEN
      RAISE EXCEPTION 'O.S. com pagamento registado no financeiro — não pode ser excluída.';
    END IF;
    DELETE FROM public.contas_receber_baixas WHERE conta_receber_id = cr.id;
    DELETE FROM public.contas_receber WHERE id = cr.id;
  END IF;

  DELETE FROM public.clinicas_faturamento_registros WHERE ordem_servico_id = p_ordem_id;
  DELETE FROM public.clinicas_ordens_servico WHERE id = p_ordem_id;
END;
$$;

-- Marca pagamento na fila de clínicas (conta a receber).
CREATE OR REPLACE FUNCTION public.salvar_pagamento_conta_clinica(
  p_conta_id uuid,
  p_pago boolean,
  p_data_pagamento date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cr public.contas_receber%ROWTYPE;
  v_pago numeric;
  st text;
BEGIN
  SELECT * INTO cr FROM public.contas_receber WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta a receber não encontrada.';
  END IF;

  IF cr.referencia_clinica_os_id IS NULL THEN
    RAISE EXCEPTION 'Esta conta não é de clínica.';
  END IF;

  IF p_pago THEN
    v_pago := cr.valor;
    st := 'Pago';
    IF p_data_pagamento IS NULL THEN
      RAISE EXCEPTION 'Informe a data de pagamento.';
    END IF;
  ELSE
    v_pago := 0;
    st := 'Pendente';
  END IF;

  UPDATE public.contas_receber
  SET
    valor_pago = v_pago,
    status_pagamento = st,
    data_pagamento = CASE WHEN p_pago THEN p_data_pagamento ELSE NULL END,
    updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_clinica_os_ao_financeiro(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_clinica_os_ao_financeiro(uuid, date) TO authenticated;

REVOKE ALL ON FUNCTION public.excluir_clinica_ordem_servico_emitida(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_clinica_ordem_servico_emitida(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.salvar_pagamento_conta_clinica(uuid, boolean, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_pagamento_conta_clinica(uuid, boolean, date) TO authenticated;
