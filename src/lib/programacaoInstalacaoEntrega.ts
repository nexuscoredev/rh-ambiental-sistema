import type { EquipamentoProgramacaoItem } from './programacaoContratoSelecao'
import { hojeIsoLocal, type FrotaDeclaracaoEntregaDados } from './frotaDeclaracaoEntrega'

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
