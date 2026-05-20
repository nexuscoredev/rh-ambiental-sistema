import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { SEPARADOR_RESIDUOS_TEXTO } from './residuosPesagem'

function pesoParaCampo(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return ''
  return String(v)
}

/** Uma linha por ticket/coleta no resumo financeiro do bloco «ticket». */
export type LinhaTicketResumoFinanceiro = {
  coleta_numero: string
  ticket_numero: string
  residuo: string
  peso_tara_kg: string
  peso_bruto_kg: string
  peso_liquido_kg: string
}

/** Extrai rótulos de resíduo a partir do texto gravado na coleta (tipo_residuo). */
export function rotulosResiduoFromTextoColeta(texto: string): string[] {
  const t = texto.trim()
  if (!t) return []
  if (t.includes(SEPARADOR_RESIDUOS_TEXTO)) {
    return t
      .split(SEPARADOR_RESIDUOS_TEXTO)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return [t]
}

/** Texto legível para lista de resíduos (alinha ao formato da MTR). */
export function formatarResiduosListaResumo(rotulos: string[]): string {
  const limpos = rotulos.map((r) => r.trim()).filter(Boolean)
  if (limpos.length === 0) return ''
  if (limpos.length === 1) return limpos[0]!
  return `${limpos.length} resíduos (${limpos.join(SEPARADOR_RESIDUOS_TEXTO)})`
}

export function montarLinhaTicketResumo(row: FaturamentoResumoViewRow): LinhaTicketResumoFinanceiro {
  const rotulos = rotulosResiduoFromTextoColeta(row.tipo_residuo ?? '')
  const residuoFormatado = formatarResiduosListaResumo(rotulos) || (row.tipo_residuo ?? '').trim() || '—'
  return {
    coleta_numero: String(row.numero_coleta ?? row.numero ?? '—'),
    ticket_numero: (row.ticket_comprovante ?? '').trim() || '—',
    residuo: residuoFormatado,
    peso_tara_kg: pesoParaCampo(row.peso_tara),
    peso_bruto_kg: pesoParaCampo(row.peso_bruto),
    peso_liquido_kg: pesoParaCampo(row.peso_liquido),
  }
}

export function montarTicketResumoUnicoColeta(row: FaturamentoResumoViewRow): {
  tipo_residuo: string
  linhas_tickets: LinhaTicketResumoFinanceiro[]
  eh_consolidado_mtr: boolean
  peso_tara_kg: string
  peso_bruto_kg: string
  peso_liquido_kg: string
} {
  const linha = montarLinhaTicketResumo(row)
  const rotulos = rotulosResiduoFromTextoColeta(row.tipo_residuo ?? '')
  return {
    eh_consolidado_mtr: false,
    peso_tara_kg: linha.peso_tara_kg,
    peso_bruto_kg: linha.peso_bruto_kg,
    peso_liquido_kg: linha.peso_liquido_kg,
    tipo_residuo: formatarResiduosListaResumo(rotulos) || linha.residuo,
    linhas_tickets: [linha],
  }
}

export function montarTicketResumoConsolidadoMtr(
  coletas: FaturamentoResumoViewRow[]
): {
  tipo_residuo: string
  linhas_tickets: LinhaTicketResumoFinanceiro[]
  eh_consolidado_mtr: boolean
  peso_tara_kg: string
  peso_bruto_kg: string
  peso_liquido_kg: string
} {
  const linhas = coletas.map(montarLinhaTicketResumo)
  const pesoTotal = coletas.reduce((s, c) => s + (Number(c.peso_liquido) || 0), 0)

  const tipo_residuo =
    linhas.length > 1
      ? linhas
          .map(
            (l) =>
              `Ticket ${l.ticket_numero} (coleta ${l.coleta_numero}): ${l.residuo}${
                l.peso_liquido_kg ? ` — ${l.peso_liquido_kg} kg líq.` : ''
              }`
          )
          .join('\n')
      : linhas[0]?.residuo ?? ''

  return {
    eh_consolidado_mtr: true,
    peso_tara_kg: '',
    peso_bruto_kg: '',
    peso_liquido_kg: pesoTotal > 0 ? String(Math.round(pesoTotal * 1000) / 1000) : '',
    tipo_residuo,
    linhas_tickets: linhas,
  }
}
