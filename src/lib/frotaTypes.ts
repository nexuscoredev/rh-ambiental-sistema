export type TipoMovimentacaoFrota = 'troca' | 'retirada' | 'carregamento_hora' | 'instalacao'
export type TipoManutencaoFrota = 'preventiva' | 'corretiva'

export type FrotaAssinatura = {
  responsavel_nome: string
  responsavel_cargo: string
  assinatura_em: string | null
}

export type EquipamentoClienteCatalogo = {
  cliente_id: string
  cliente_nome: string
  descricao: string
  com_custo: boolean
}

export type FrotaMovimentacaoRow = {
  id: string
  tipo_movimentacao: TipoMovimentacaoFrota
  cliente_id: string | null
  cliente_nome: string | null
  equipamento_descricao: string
  caminhao_id: string | null
  programacao_id: string | null
  km: number | null
  observacoes: string | null
  fotos: string[]
  assinatura_responsavel_nome: string | null
  assinatura_responsavel_cargo: string | null
  assinatura_em: string | null
  created_at: string
}

export type FrotaManutencaoRow = {
  id: string
  caminhao_id: string
  tipo_manutencao: TipoManutencaoFrota
  titulo: string
  descricao: string | null
  km_atual: number | null
  oleo_ultima_troca_km: number | null
  oleo_ultima_troca_data: string | null
  oleo_proxima_troca_km: number | null
  custo: number | null
  realizado_em: string
  status: string
  fotos: string[]
  assinatura_responsavel_nome: string | null
  assinatura_responsavel_cargo: string | null
  assinatura_em: string | null
  created_at: string
  caminhao_placa?: string | null
  caminhao_modelo?: string | null
}

export type FrotaDiarioChecklist = {
  oleo_nivel_ok?: boolean
  pneus_ok?: boolean
  freios_ok?: boolean
  luzes_ok?: boolean
  documentacao_ok?: boolean
  limpeza_ok?: boolean
  anomalias?: string
}

export type FrotaDiarioRow = {
  id: string
  caminhao_id: string
  data_diario: string
  km_odometro: number | null
  ultima_troca_oleo_km: number | null
  ultima_troca_oleo_data: string | null
  checklist: FrotaDiarioChecklist
  observacoes: string | null
  fotos: string[]
  assinatura_responsavel_nome: string | null
  assinatura_responsavel_cargo: string | null
  assinatura_em: string | null
  created_at: string
  caminhao_placa?: string | null
  caminhao_modelo?: string | null
}

export type FrotaResumoDashboard = {
  totalVeiculos: number
  diariosHoje: number
  manutencoesAbertas: number
  movimentacoes7d: number
  alertasOleo: { placa: string; km_atual: number | null; proxima_km: number | null }[]
}
