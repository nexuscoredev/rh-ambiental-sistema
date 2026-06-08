import { RG_AMBIENTAL_DADOS_CORPORATIVOS } from './rgAmbientalDadosCorporativos'
import type { FrotaManutencaoRow, FrotaOsClassificacao } from './frotaTypes'

export const FROTA_OS_EMAIL_LOGISTICA = 'logistica@rgambiental.com.br'
export const FROTA_OS_RESP_PADRAO = 'Operacional'
export const FROTA_OS_PLANILHA = 'Controle de Compras'

export const FROTA_OS_CLASSIFICACOES: { key: keyof FrotaOsClassificacao; label: string }[] = [
  { key: 'preventiva', label: 'Preventiva' },
  { key: 'planejada', label: 'Planejada' },
  { key: 'corretiva', label: 'Corretiva' },
  { key: 'urgencia', label: 'Urgência' },
  { key: 'frota', label: 'Frota' },
  { key: 'geral', label: 'Geral' },
]

export function parseOsClassificacao(raw: unknown): FrotaOsClassificacao {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: FrotaOsClassificacao = {}
  for (const { key } of FROTA_OS_CLASSIFICACOES) {
    if (o[key] === true) out[key] = true
  }
  return out
}

export function inferirTipoManutencaoOs(cl: FrotaOsClassificacao): 'preventiva' | 'corretiva' {
  if (cl.corretiva || cl.urgencia) return 'corretiva'
  return 'preventiva'
}

export function formatarDataOsBr(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

export type FrotaOrdemServicoPrintData = {
  numeroOs: string
  ano: string
  empresa: string
  cnpj: string
  planilha: string
  email: string
  responsavelSetor: string
  placa: string
  classificacao: FrotaOsClassificacao
  solicitante: string
  ocorrido: string
  compraSolucao: string
  dataInicio: string
  dataTermino: string
  autorizado: string
  responsavelExecucao: string
  responsavelSolicitacao: string
}

export function montarDadosImpressaoOs(
  row: FrotaManutencaoRow,
  placa: string
): FrotaOrdemServicoPrintData {
  return {
    numeroOs: row.numero_os != null ? String(row.numero_os) : '—',
    ano: row.ano_os != null ? String(row.ano_os) : new Date().getFullYear().toString(),
    empresa: 'RG Ambiental Transporte',
    cnpj: RG_AMBIENTAL_DADOS_CORPORATIVOS.cnpj,
    planilha: FROTA_OS_PLANILHA,
    email: FROTA_OS_EMAIL_LOGISTICA,
    responsavelSetor: FROTA_OS_RESP_PADRAO,
    placa: placa.trim(),
    classificacao: row.os_classificacao ?? {},
    solicitante: row.solicitante?.trim() ?? '',
    ocorrido: row.ocorrido_solicitacao?.trim() ?? row.descricao?.trim() ?? '',
    compraSolucao: row.compra_solucao?.trim() ?? '',
    dataInicio: formatarDataOsBr(row.data_inicio ?? row.realizado_em),
    dataTermino: formatarDataOsBr(row.data_termino),
    autorizado: row.assinatura_autorizado_nome?.trim() ?? '',
    responsavelExecucao: row.assinatura_execucao_nome?.trim() ?? row.assinatura_responsavel_nome?.trim() ?? '',
    responsavelSolicitacao: row.assinatura_solicitacao_nome?.trim() ?? row.solicitante?.trim() ?? '',
  }
}
