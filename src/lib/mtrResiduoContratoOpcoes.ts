import type { ResiduoContratoItem } from './clienteContratoCadastro'
import {
  residuoContratoTemConteudo,
  rotuloResiduoContrato,
} from './mtrClienteContratoAutofill'

export type OpcaoResiduoContratoMtr = {
  value: string
  label: string
  item: ResiduoContratoItem
}

export function opcoesResiduoContratoMtr(
  residuos: ResiduoContratoItem[]
): OpcaoResiduoContratoMtr[] {
  const vistos = new Set<string>()
  const out: OpcaoResiduoContratoMtr[] = []

  for (const item of residuos) {
    if (!residuoContratoTemConteudo(item)) continue
    const value = rotuloResiduoContrato(item)
    if (!value) continue
    const key = value.toLowerCase()
    if (vistos.has(key)) continue
    vistos.add(key)
    out.push({ value, label: value, item })
  }

  return out
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** Valor atual pertence a uma opção do contrato (inclui resumo legado com vários resíduos). */
export function valorTipoResiduoCorrespondeContrato(
  valor: string,
  residuos: ResiduoContratoItem[]
): boolean {
  const v = valor.trim()
  if (!v) return false
  const opcoes = opcoesResiduoContratoMtr(residuos)
  if (opcoes.some((o) => norm(o.value) === norm(v))) return true
  return opcoes.some((o) => v.includes(o.value) || o.value.includes(v))
}

export function residuoContratoPorRotulo(
  residuos: ResiduoContratoItem[],
  rotulo: string
): ResiduoContratoItem | null {
  const alvo = norm(rotulo)
  if (!alvo) return null
  for (const r of residuos) {
    if (norm(rotuloResiduoContrato(r)) === alvo) return r
  }
  return null
}

/** Escolhe um único tipo para o campo topo da MTR (não concatena todos do contrato). */
export function escolherTipoResiduoContratoMtr(
  residuos: ResiduoContratoItem[],
  opts?: {
    preferencia?: string | null
    valorAtual?: string | null
  }
): string {
  const opcoes = opcoesResiduoContratoMtr(residuos)
  if (!opcoes.length) return (opts?.preferencia ?? opts?.valorAtual ?? '').trim()

  const atual = (opts?.valorAtual ?? '').trim()
  if (atual && valorTipoResiduoCorrespondeContrato(atual, residuos)) {
    const hit = opcoes.find((o) => norm(o.value) === norm(atual))
    if (hit) return hit.value
    const parcial = opcoes.find((o) => atual.includes(o.value) || o.value.includes(atual))
    if (parcial) return parcial.value
  }

  const pref = (opts?.preferencia ?? '').trim()
  if (pref) {
    const exato = opcoes.find((o) => norm(o.value) === norm(pref))
    if (exato) return exato.value
    const parcial = opcoes.find(
      (o) => norm(o.label).includes(norm(pref)) || norm(pref).includes(norm(o.label))
    )
    if (parcial) return parcial.value
  }

  return opcoes[0]!.value
}
