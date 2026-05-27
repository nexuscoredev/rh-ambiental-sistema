import {
  asTextoFormulario,
  parseEquipamentosContratoJsonb,
  parseResiduosContratoJsonb,
  type EquipamentoContratoItem,
  type ResiduoContratoItem,
} from './clienteContratoCadastro'
import { rotuloResiduoContrato } from './mtrClienteContratoAutofill'

export type ResiduoProgramacaoItem = ResiduoContratoItem & {
  quantidade: string
}

export type EquipamentoProgramacaoItem = EquipamentoContratoItem & {
  quantidade: string
}

export function chaveResiduoContrato(r: ResiduoContratoItem): string {
  return [r.tipo_residuo, r.classificacao, r.unidade_medida]
    .map((s) => s.trim().toLowerCase())
    .join('|')
}

export function chaveEquipamentoContrato(e: EquipamentoContratoItem): string {
  return e.descricao.trim().toLowerCase()
}

function quantidadeDoJsonRow(row: unknown): string {
  if (!row || typeof row !== 'object') return ''
  return asTextoFormulario((row as Record<string, unknown>).quantidade).trim()
}

export function parseResiduosProgramacaoJson(raw: unknown): ResiduoProgramacaoItem[] {
  if (!Array.isArray(raw)) return []
  return parseResiduosContratoJsonb(raw)
    .map((r, i) => ({
      ...r,
      quantidade: quantidadeDoJsonRow(raw[i]),
    }))
    .filter((r) => r.tipo_residuo.trim() || r.classificacao.trim())
}

export function parseEquipamentosProgramacaoJson(raw: unknown): EquipamentoProgramacaoItem[] {
  if (!Array.isArray(raw)) return []
  return parseEquipamentosContratoJsonb(raw)
    .map((e, i) => ({
      ...e,
      quantidade: quantidadeDoJsonRow(raw[i]),
    }))
    .filter((e) => e.descricao.trim())
}

export function residuoProgramacaoSelecionado(
  lista: ResiduoProgramacaoItem[],
  item: ResiduoContratoItem
): boolean {
  const k = chaveResiduoContrato(item)
  return lista.some((r) => chaveResiduoContrato(r) === k)
}

export function equipamentoProgramacaoSelecionado(
  lista: EquipamentoProgramacaoItem[],
  item: EquipamentoContratoItem
): boolean {
  const k = chaveEquipamentoContrato(item)
  return lista.some((e) => chaveEquipamentoContrato(e) === k)
}

export function quantidadeResiduoProgramacao(
  lista: ResiduoProgramacaoItem[],
  item: ResiduoContratoItem
): string {
  const k = chaveResiduoContrato(item)
  return lista.find((r) => chaveResiduoContrato(r) === k)?.quantidade ?? ''
}

export function quantidadeEquipamentoProgramacao(
  lista: EquipamentoProgramacaoItem[],
  item: EquipamentoContratoItem
): string {
  const k = chaveEquipamentoContrato(item)
  return lista.find((e) => chaveEquipamentoContrato(e) === k)?.quantidade ?? ''
}

export function alternarResiduoProgramacao(
  lista: ResiduoProgramacaoItem[],
  item: ResiduoContratoItem
): ResiduoProgramacaoItem[] {
  const k = chaveResiduoContrato(item)
  if (lista.some((r) => chaveResiduoContrato(r) === k)) {
    return lista.filter((r) => chaveResiduoContrato(r) !== k)
  }
  return [...lista, { ...item, quantidade: '' }]
}

export function alternarEquipamentoProgramacao(
  lista: EquipamentoProgramacaoItem[],
  item: EquipamentoContratoItem
): EquipamentoProgramacaoItem[] {
  const k = chaveEquipamentoContrato(item)
  if (lista.some((e) => chaveEquipamentoContrato(e) === k)) {
    return lista.filter((e) => chaveEquipamentoContrato(e) !== k)
  }
  return [...lista, { ...item, quantidade: '' }]
}

export function atualizarQuantidadeResiduoProgramacao(
  lista: ResiduoProgramacaoItem[],
  item: ResiduoContratoItem,
  quantidade: string
): ResiduoProgramacaoItem[] {
  const k = chaveResiduoContrato(item)
  return lista.map((r) =>
    chaveResiduoContrato(r) === k ? { ...r, quantidade } : r
  )
}

export function atualizarQuantidadeEquipamentoProgramacao(
  lista: EquipamentoProgramacaoItem[],
  item: EquipamentoContratoItem,
  quantidade: string
): EquipamentoProgramacaoItem[] {
  const k = chaveEquipamentoContrato(item)
  return lista.map((e) =>
    chaveEquipamentoContrato(e) === k ? { ...e, quantidade } : e
  )
}

/** Primeiro resíduo selecionado como texto legado em `tipo_residuo`. */
export function tipoResiduoLegadoProgramacao(residuos: ResiduoProgramacaoItem[]): string | null {
  const primeiro = residuos.find((r) => rotuloResiduoContrato(r).trim())
  if (!primeiro) return null
  return rotuloResiduoContrato(primeiro).trim()
}

export function isMissingProgramacaoContratoJsonColumnsError(
  error: { message?: string } | null | undefined
): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  if (!msg) return false
  return msg.includes('residuos_programacao') || msg.includes('equipamentos_programacao')
}
