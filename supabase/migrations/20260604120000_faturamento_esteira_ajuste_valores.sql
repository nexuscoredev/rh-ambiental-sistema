-- Esteira: passo de ajuste de valores antes do relatório de medição.

COMMENT ON COLUMN public.coletas.faturamento_esteira_status IS
  'AJUSTE_VALORES_MEDICAO | MEDICAO_PENDENTE | MEDICAO_EMAIL_PENDENTE | MEDICAO_AGUARDANDO_CLIENTE | LIBERADO_FATURAMENTO | LIBERADO_FINANCEIRO | FINALIZADO';

-- Coletas com ticket aprovado, sem relatório e ainda em medição pendente → ajuste de valores.
UPDATE public.coletas c
SET faturamento_esteira_status = 'AJUSTE_VALORES_MEDICAO'
WHERE c.faturamento_ticket_aprovado_em IS NOT NULL
  AND c.medicao_relatorio_gerado_em IS NULL
  AND c.medicao_email_enviado_em IS NULL
  AND c.medicao_cliente_aprovado_em IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.faturamento_registros fr
    WHERE fr.coleta_id = c.id AND fr.status = 'emitido'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.contas_receber cr
    WHERE cr.referencia_coleta_id = c.id AND cr.nf_enviada_em IS NOT NULL
  )
  AND COALESCE(c.faturamento_esteira_status, '') IN ('', 'MEDICAO_PENDENTE');
