export const CLINICA_GRUPO_NOME_PADRAO = 'CLINICA'

export type ClinicaGrupo = {
  id: string
  nome: string
  ativo: boolean
}

export type ClinicaUnidade = {
  id: string
  grupo_id: string
  razao_social: string
  cnpj: string | null
  cpf: string | null
  endereco_coleta: string | null
  emite_nota: boolean
  pagamento_pix: boolean
  ativo: boolean
  created_at?: string | null
}

export type ClinicaUnidadeForm = {
  razao_social: string
  cnpj: string
  cpf: string
  endereco_coleta: string
  emite_nota: boolean
  pagamento_pix: boolean
  ativo: boolean
}

export type ClinicaOrdemServicoGerada = {
  unidade_id: string
  ordem_id: string
  numero_os: string
}

export type ClinicaOrdemServicoLista = {
  id: string
  numero_os: string
  status: string
  data_servico: string
  created_at: string
  unidade_id: string
  razao_social: string
  faturamento_valor: number | null
  faturamento_status: string | null
}

export type ClinicaOrdemServicoDetalhe = ClinicaOrdemServicoLista & {
  cnpj: string | null
  cpf: string | null
  emite_nota_snapshot: boolean
  pagamento_pix_snapshot: boolean
  referencia_nf: string | null
  nf_registrada_em: string | null
  enviado_financeiro_em: string | null
  conta_receber_id: string | null
  conta_status_pagamento: string | null
  conta_data_pagamento: string | null
  conta_valor_pago: number | null
}

export type ClinicaContaReceberFilaRow = {
  conta_id: string
  ordem_servico_id: string
  numero_os: string
  razao_social: string
  data_servico: string
  valor: number
  valor_pago: number
  status_pagamento: string
  data_vencimento: string | null
  data_pagamento: string | null
  referencia_nf: string | null
  enviado_financeiro_em: string | null
}

export type ListarOsClinicasFiltros = {
  status?: string | string[]
  dataServicoDe?: string
  dataServicoAte?: string
  limite?: number
}

export type ClinicaFilaFaturamentoRow = {
  ordem_servico_id: string
  numero_os: string
  os_status: string
  data_servico: string
  emite_nota_snapshot: boolean
  pagamento_pix_snapshot: boolean
  os_observacoes: string | null
  referencia_nf: string | null
  nf_registrada_em: string | null
  os_created_at: string
  unidade_id: string
  razao_social: string
  cnpj: string | null
  cpf: string | null
  endereco_coleta: string | null
  grupo_nome: string
  faturamento_registro_id: string | null
  faturamento_valor: number | null
  faturamento_observacoes: string | null
  faturamento_status: string | null
  conta_receber_id: string | null
  status_pagamento: string | null
  meio_cobranca: 'nf' | 'pix' | 'outro'
}

export type ClinicaRelatorio30dRow = {
  unidade_id: string
  razao_social: string
  cnpj: string | null
  grupo_nome: string
  qtd_os: number
  valor_emitido_total: number
  valor_pendente_total: number
  primeira_data: string | null
  ultima_data: string | null
}
