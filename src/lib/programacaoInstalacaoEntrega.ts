import type { EquipamentoProgramacaoItem } from './programacaoContratoSelecao'
import { hojeIsoLocal, type FrotaDeclaracaoEntregaDados } from './frotaDeclaracaoEntrega'
import { STATUS_LABELS, type ProgramacaoStatus } from './programacaoStatusVisual'

/**
 * Regra de negócio aprovada (instalação/entrega):
 * — Não gera MTR nem ticket; MTR só na coleta de resíduo futura.
 * — Documento oficial: Declaração de Entrega de Equipamento.
 * — Processo encerra na declaração; não entra em faturamento.
 * — Programação pendente → status CONCLUIDA («Finalizado» na UI) ao confirmar a declaração.
 */
export const INSTALACAO_ENTREGA_CHIP_FLUXO = 'Instalação — só declaração, sem faturamento'

export function programacaoInstalacaoFinalizada(status: ProgramacaoStatus): boolean {
  return status === 'CONCLUIDA'
}

export function rotuloStatusProgramacaoExibir(
  status: ProgramacaoStatus,
  tipoServico: string
): string {
  if (programacaoEhInstalacaoEntrega(tipoServico) && status === 'CONCLUIDA') {
    return 'Finalizado'
  }
  return STATUS_LABELS[status]
}

function normalizarTipoServicoKey(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/\//g, '_')
}

/** Instalações/Entregas na programação (e alias Instalação). */
export function programacaoEhInstalacaoEntrega(tipoServico: string): boolean {
  const k = normalizarTipoServicoKey(tipoServico)
  return k === 'instalacao' || k === 'instalacoes_entregas'
}

export function formatarEquipamentosDeclaracao(equipamentos: EquipamentoProgramacaoItem[]): string {
  if (!equipamentos.length) return ''
  return equipamentos
    .map((e) => {
      const desc = e.descricao.trim()
      const q = e.quantidade?.trim()
      if (!desc) return ''
      return q ? `${desc} (${q})` : desc
    })
    .filter(Boolean)
    .join('; ')
}

export function montarDeclaracaoEntregaDeProgramacao(input: {
  clienteNome: string
  razaoSocial: string
  endereco: string
  telefone: string
  equipamentos: EquipamentoProgramacaoItem[]
  dataProgramada: string
}): FrotaDeclaracaoEntregaDados {
  const hoje = hojeIsoLocal()
  const dataProg = (input.dataProgramada || '').slice(0, 10)
  return {
    razaoSocial: input.razaoSocial.trim() || input.clienteNome.trim(),
    endereco: input.endereco.trim(),
    telefone: input.telefone.trim(),
    equipamento: formatarEquipamentosDeclaracao(input.equipamentos),
    dataEntrega: dataProg || hoje,
    dataDocumento: hoje,
    responsavelRecebimento: '',
  }
}
