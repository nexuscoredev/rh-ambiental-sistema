import type { SupabaseClient } from '@supabase/supabase-js'
import { payloadFaturamentoEmitidoAguardaFinalizacaoEsteira } from './coletaFluxoAtualizacao'
import {
  montarPayloadsFaturamentoRegistro,
  persistirFaturamentoRegistro,
} from './faturamentoRegistrosPersist'
import {
  criarResumoFinanceiroDoOperacional,
  parseNumeroCampo,
  parseResumoFinanceiroJson,
  resumoFinanceiroParaJsonb,
  type ResumoFinanceiroDesvinculado,
} from './faturamentoDesvinculacao'
import {
  formatarResiduosListaResumo,
  montarTicketResumoConsolidadoMtr,
  rotulosResiduoFromTextoColeta,
} from './faturamentoResumoTicket'
import {
  calcularPrecoContratoColetaMtr,
  type ResultadoPrecoContrato,
} from './faturamentoPrecoContrato'
import { coletaElegivelParaFaturar } from './faturamentoElegibilidade'
import { coletaHistoricoFaturamentoEmitido } from './faturamentoOperacionalFila'
import { marcarEsteiraPosFaturamentoEmitido } from './faturamentoEsteira'
import { aplicarResumoFinanceiroNaOperacional } from './faturamentoOperacionalSync'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'

export type ItemFilaFaturamento =
  | { kind: 'unico'; row: FaturamentoResumoViewRow }
  | {
      kind: 'mtr'
      mtr_id: string
      mtr_numero: string
      cliente_nome: string
      coletas: FaturamentoResumoViewRow[]
      coleta_lider: FaturamentoResumoViewRow
    }

function ordenarColetasFaturamento(a: FaturamentoResumoViewRow, b: FaturamentoResumoViewRow) {
  const na = a.numero_coleta ?? (Number(a.numero) || 0)
  const nb = b.numero_coleta ?? (Number(b.numero) || 0)
  if (na !== nb) return na - nb
  return String(a.numero).localeCompare(String(b.numero), 'pt-BR', { numeric: true })
}

export function escolherColetaLiderFaturamento(
  coletas: FaturamentoResumoViewRow[]
): FaturamentoResumoViewRow {
  return [...coletas].sort(ordenarColetasFaturamento)[0]!
}

/** Coleta líder do faturamento consolidado (uma cobrança por MTR). */
export function liderColetaIdResumoConsolidado(
  coletaId: string,
  resumo: ResumoFinanceiroDesvinculado | null
): string | null {
  const id = coletaId.trim()
  const lider = (resumo?.consolidacao_mtr?.coleta_lider_id ?? '').trim()
  if (!lider || lider === id) return null
  return lider
}

type RegistroConsolidacaoRef = {
  valor: unknown
  observacoes?: string | null
  resumo_financeiro?: unknown
}

function valorRegistroPositivo(valor: unknown): boolean {
  const v = Number(valor)
  return Number.isFinite(v) && v > 0
}

/**
 * Se a coleta é ticket irmão na MTR consolidada, devolve o id da coleta líder (sem título próprio).
 */
export function coletaIrmaConsolidadaMtr(
  coletaId: string,
  reg: RegistroConsolidacaoRef | null | undefined
): string | null {
  if (!reg) return null
  const resumo = parseResumoFinanceiroJson(reg.resumo_financeiro) as ResumoFinanceiroDesvinculado | null
  const lider = liderColetaIdResumoConsolidado(coletaId, resumo)
  if (lider) return lider
  if (valorRegistroPositivo(reg.valor)) return null
  if (/consolidado na coleta/i.test(String(reg.observacoes ?? ''))) {
    return resumo?.consolidacao_mtr?.coleta_lider_id?.trim() || null
  }
  return null
}

/** Agrupa a fila: uma linha por MTR quando há 2+ coletas elegíveis na mesma MTR. */
export function agruparFilaFaturamentoPorMtr(
  linhas: FaturamentoResumoViewRow[]
): ItemFilaFaturamento[] {
  const semMtr: FaturamentoResumoViewRow[] = []
  const porMtr = new Map<string, FaturamentoResumoViewRow[]>()

  for (const r of linhas) {
    const mid = (r.mtr_id ?? '').trim()
    if (!mid) {
      semMtr.push(r)
      continue
    }
    const lista = porMtr.get(mid) ?? []
    lista.push(r)
    porMtr.set(mid, lista)
  }

  const itens: ItemFilaFaturamento[] = semMtr.map((row) => ({ kind: 'unico', row }))

  for (const [mtr_id, coletas] of porMtr) {
    const sorted = [...coletas].sort(ordenarColetasFaturamento)
    if (sorted.length === 1) {
      itens.push({ kind: 'unico', row: sorted[0]! })
    } else {
      const lider = sorted[0]!
      itens.push({
        kind: 'mtr',
        mtr_id,
        mtr_numero: (lider.mtr_numero ?? '').trim() || mtr_id.slice(0, 8),
        cliente_nome: (lider.cliente_nome ?? '').trim() || '—',
        coletas: sorted,
        coleta_lider: lider,
      })
    }
  }

  itens.sort((a, b) => {
    const ta = new Date(
      (a.kind === 'mtr' ? a.coleta_lider : a.row).created_at
    ).getTime()
    const tb = new Date(
      (b.kind === 'mtr' ? b.coleta_lider : b.row).created_at
    ).getTime()
    return tb - ta
  })

  return itens
}

export type GrupoHistoricoFaturamento =
  | { kind: 'unico'; row: FaturamentoResumoViewRow }
  | {
      kind: 'mtr'
      mtr_id: string
      mtr_numero: string
      cliente_nome: string
      coleta_lider: FaturamentoResumoViewRow
      coletas: FaturamentoResumoViewRow[]
    }

function itemFilaParaGrupoHistorico(item: ItemFilaFaturamento): GrupoHistoricoFaturamento {
  if (item.kind === 'unico') return { kind: 'unico', row: item.row }
  return {
    kind: 'mtr',
    mtr_id: item.mtr_id,
    mtr_numero: item.mtr_numero,
    cliente_nome: item.cliente_nome,
    coleta_lider: item.coleta_lider,
    coletas: item.coletas,
  }
}

/** Uma linha por faturamento: tickets da mesma MTR consolidados no histórico emitido. */
export function agruparHistoricoFaturamentoEmitido(
  linhas: FaturamentoResumoViewRow[]
): GrupoHistoricoFaturamento[] {
  const emitidas = linhas.filter(coletaHistoricoFaturamentoEmitido)
  return agruparFilaFaturamentoPorMtr(emitidas).map(itemFilaParaGrupoHistorico)
}

export function chaveGrupoHistoricoFaturamento(g: GrupoHistoricoFaturamento): string {
  return g.kind === 'unico' ? g.row.coleta_id : `mtr-${g.mtr_id}`
}

export function linhaLiderGrupoHistoricoFaturamento(g: GrupoHistoricoFaturamento): FaturamentoResumoViewRow {
  return g.kind === 'unico' ? g.row : g.coleta_lider
}

export function valorFaturamentoLinhaHistorico(row: FaturamentoResumoViewRow): number {
  const v = row.faturamento_registro_valor ?? row.valor_coleta
  return v != null && Number.isFinite(Number(v)) ? Number(v) : 0
}

/** Valor do faturamento consolidado (não soma tickets irmãos com valor repetido na view). */
export function valorGrupoHistoricoFaturamento(g: GrupoHistoricoFaturamento): number {
  if (g.kind === 'unico') return valorFaturamentoLinhaHistorico(g.row)
  const liderVal = valorFaturamentoLinhaHistorico(g.coleta_lider)
  if (liderVal > 0) return liderVal
  for (const c of g.coletas) {
    const v = valorFaturamentoLinhaHistorico(c)
    if (v > 0) return v
  }
  return 0
}

export function pesoLiquidoGrupoHistoricoFaturamento(g: GrupoHistoricoFaturamento): number | null {
  const rows = g.kind === 'unico' ? [g.row] : g.coletas
  let s = 0
  let has = false
  for (const r of rows) {
    const p = Number(r.peso_liquido)
    if (Number.isFinite(p)) {
      s += p
      has = true
    }
  }
  return has ? s : null
}

export function rotuloColetasGrupoHistoricoFaturamento(g: GrupoHistoricoFaturamento): string {
  const rows = g.kind === 'unico' ? [g.row] : g.coletas
  return rows.map((r) => String(r.numero_coleta ?? r.numero)).join(', ')
}

export function rotuloResiduoGrupoHistoricoFaturamento(g: GrupoHistoricoFaturamento): string {
  if (g.kind === 'unico') return (g.row.tipo_residuo || '—').trim() || '—'
  return (
    g.coletas
      .map((c) => {
        const n = String(c.numero_coleta ?? c.numero)
        const r = (c.tipo_residuo || '—').trim() || '—'
        return `${n}: ${r}`
      })
      .join(' · ') || '—'
  )
}

export function somarValorHistoricoFaturamentoSemDuplicar(linhas: FaturamentoResumoViewRow[]): number {
  return agruparHistoricoFaturamentoEmitido(linhas).reduce(
    (s, g) => s + valorGrupoHistoricoFaturamento(g),
    0
  )
}

export function contarGruposHistoricoFaturamentoEmitido(linhas: FaturamentoResumoViewRow[]): number {
  return agruparHistoricoFaturamentoEmitido(linhas).length
}

export function resolverGrupoFaturamentoNaFila(
  coletaId: string,
  fila: FaturamentoResumoViewRow[]
): FaturamentoResumoViewRow[] {
  const row = fila.find((r) => r.coleta_id === coletaId)
  if (!row) return []
  const mid = (row.mtr_id ?? '').trim()
  if (!mid) return [row]
  const irmas = fila.filter((r) => (r.mtr_id ?? '').trim() === mid)
  return irmas.length > 1 ? [...irmas].sort(ordenarColetasFaturamento) : [row]
}

type InputPrecoContrato = Parameters<typeof calcularPrecoContratoColetaMtr>[0]

export type ColetaPesoContratoRef = Pick<FaturamentoResumoViewRow, 'tipo_residuo' | 'peso_liquido'>

/** Pesos por ticket a partir do resumo (consolidado) ou linhas da view. */
export function coletasPesoParaContratoFromResumo(
  grupo: FaturamentoResumoViewRow[],
  resumo: ResumoFinanceiroDesvinculado | null
): ColetaPesoContratoRef[] {
  const linhas = resumo?.ticket.linhas_tickets ?? []
  if (linhas.length > 1) {
    return grupo.map((r) => {
      const num = String(r.numero_coleta ?? r.numero).trim()
      const lt = linhas.find(
        (l) =>
          String(l.coleta_numero).trim() === num ||
          String(l.ticket_numero).trim() === String(r.ticket_comprovante ?? '').trim()
      )
      const pesoLinha = lt ? parseNumeroCampo(lt.peso_liquido_kg) : 0
      return {
        tipo_residuo: (lt?.residuo || r.tipo_residuo) ?? null,
        peso_liquido: pesoLinha > 0 ? pesoLinha : r.peso_liquido,
      }
    })
  }
  const pesoMtr = resumo ? parseNumeroCampo(resumo.mtr.peso_liquido_kg || resumo.mtr.residuo_quantidade) : 0
  if (grupo.length === 1 && pesoMtr > 0) {
    return [{ tipo_residuo: grupo[0]!.tipo_residuo, peso_liquido: pesoMtr }]
  }
  return grupo
}

/**
 * Um faturamento por MTR: caminhão e equipamento uma vez; soma de cada resíduo/ticket.
 */
export function calcularPrecoContratoMtrConsolidado(
  input: InputPrecoContrato,
  coletas: Pick<FaturamentoResumoViewRow, 'tipo_residuo' | 'peso_liquido'>[]
): ResultadoPrecoContrato {
  if (coletas.length === 0) {
    return calcularPrecoContratoColetaMtr({
      ...input,
      tipoResiduoColeta: null,
      pesoLiquidoKg: null,
    })
  }
  if (coletas.length === 1) {
    const c = coletas[0]!
    return calcularPrecoContratoColetaMtr({
      ...input,
      tipoResiduoColeta: c.tipo_residuo,
      pesoLiquidoKg: c.peso_liquido,
    })
  }

  const primeira = calcularPrecoContratoColetaMtr({
    ...input,
    tipoResiduoColeta: coletas[0]!.tipo_residuo,
    pesoLiquidoKg: coletas[0]!.peso_liquido,
  })

  const linhas = primeira.linhas.filter(
    (l) =>
      l.chave === 'caminhao' ||
      l.chave.startsWith('equipamento') ||
      l.chave.startsWith('mao-obra')
  )
  const linhasResiduo = primeira.linhas.filter(
    (l) =>
      l.chave !== 'caminhao' &&
      !l.chave.startsWith('equipamento') &&
      !l.chave.startsWith('mao-obra')
  )
  let valorResiduo = primeira.valorResiduo

  for (let i = 1; i < coletas.length; i++) {
    const c = coletas[i]!
    const part = calcularPrecoContratoColetaMtr({
      ...input,
      veiculosContratoRaw: [],
      equipamentosContratoRaw: [],
      maoObraContratoRaw: [],
      descricaoVeiculoLegado: null,
      equipamentosTextoLegado: null,
      tipoCaminhaoMtr: input.tipoCaminhaoMtr,
      acondicionamentoMtr: input.acondicionamentoMtr,
      tipoResiduoColeta: c.tipo_residuo,
      pesoLiquidoKg: c.peso_liquido,
    })
    valorResiduo += part.valorResiduo
    for (const l of part.linhas) {
      if (l.chave === 'caminhao' || l.chave.startsWith('equipamento') || l.chave.startsWith('mao-obra'))
        continue
      linhasResiduo.push({
        ...l,
        rotulo: `${(c.tipo_residuo || 'Resíduo').trim()} — ${l.rotulo}`,
      })
    }
  }

  valorResiduo = Math.round(valorResiduo * 100) / 100
  const todasLinhas = [...linhas, ...linhasResiduo]
  const total = Math.round(
    (primeira.valorCaminhao + primeira.valorEquipamentos + primeira.valorMaoObra + valorResiduo) * 100
  ) / 100

  return {
    ...primeira,
    total,
    linhas: todasLinhas,
    origem: total > 0 ? 'contrato_cliente_mtr_consolidado' : primeira.origem,
    valorResiduo,
  }
}

export function criarResumoFinanceiroConsolidado(
  lider: FaturamentoResumoViewRow,
  coletas: FaturamentoResumoViewRow[],
  sugestao: ResultadoPrecoContrato | null,
  ctx?: { tipoCaminhao?: string | null; acondicionamento?: string | null }
): ResumoFinanceiroDesvinculado {
  const base = criarResumoFinanceiroDoOperacional(lider, sugestao, ctx)
  const pesoTotal = coletas.reduce((s, c) => s + (Number(c.peso_liquido) || 0), 0)
  const rotulosResiduo = coletas.flatMap((c) => rotulosResiduoFromTextoColeta(c.tipo_residuo ?? ''))
  const ticketPeso = coletas
    .map((c) => `${c.numero_coleta ?? c.numero}: ${c.peso_liquido ?? '—'} kg`)
    .join(' · ')
  const ticketMontado = montarTicketResumoConsolidadoMtr(coletas)

  return {
    ...base,
    ticket: {
      ...base.ticket,
      ...ticketMontado,
    },
    mtr: {
      ...base.mtr,
      residuo_rotulo:
        rotulosResiduo.length > 1
          ? formatarResiduosListaResumo(rotulosResiduo)
          : base.mtr.residuo_rotulo,
      residuo_quantidade: pesoTotal > 0 ? String(Math.round(pesoTotal * 1000) / 1000) : base.mtr.residuo_quantidade,
      peso_liquido_kg: pesoTotal > 0 ? String(Math.round(pesoTotal * 1000) / 1000) : base.mtr.peso_liquido_kg,
    },
    consolidacao_mtr: {
      mtr_id: (lider.mtr_id ?? '').trim(),
      mtr_numero: (lider.mtr_numero ?? '').trim(),
      coleta_lider_id: lider.coleta_id,
      coleta_ids: coletas.map((c) => c.coleta_id),
      tickets_resumo: ticketPeso,
    },
  }
}

export type EmitirFaturamentoConsolidadoInput = {
  coletas: FaturamentoResumoViewRow[]
  valorTotal: number
  resumoFinanceiro: ResumoFinanceiroDesvinculado
  observacoes: string
  dataVencimentoIso: string
  registroIdLider: string | null
  valorAdicionais: number | null
}

export async function emitirFaturamentoConsolidadoMtr(
  supabase: SupabaseClient,
  input: EmitirFaturamentoConsolidadoInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const coletas = [...input.coletas].sort(ordenarColetasFaturamento)
  if (coletas.length === 0) return { ok: false, message: 'Nenhuma coleta no grupo.' }

  for (const c of coletas) {
    const el = coletaElegivelParaFaturar(c, coletas)
    if (!el.ok) {
      return {
        ok: false,
        message: `A coleta ${c.numero_coleta ?? c.numero} não está elegível para faturamento.`,
      }
    }
  }

  const lider = coletas[0]!
  const agora = new Date().toISOString()
  const valorTotal = input.valorTotal
  const resumoJson = {
    ...resumoFinanceiroParaJsonb(input.resumoFinanceiro),
    consolidacao_mtr: input.resumoFinanceiro.consolidacao_mtr ?? null,
  }

  const obsLider = input.observacoes.trim() || null
  const payloadsLider = montarPayloadsFaturamentoRegistro({
    valor: valorTotal,
    valorAdicionais: input.valorAdicionais,
    resumoFinanceiro: resumoJson,
    observacoes: obsLider,
    status: 'emitido',
    updatedAt: agora,
  })

  const resLider = await persistirFaturamentoRegistro(supabase, {
    coletaId: lider.coleta_id,
    registroId: input.registroIdLider,
    payloads: payloadsLider,
  })
  if (!resLider.ok) {
    return { ok: false, message: resLider.message }
  }

  const obsIrma = `Consolidado na coleta ${lider.numero_coleta ?? lider.numero} (mesma MTR).`
  const payloadsIrma = montarPayloadsFaturamentoRegistro({
    valor: null,
    resumoFinanceiro: resumoJson,
    observacoes: obsIrma,
    status: 'emitido',
    updatedAt: agora,
  })

  for (let i = 1; i < coletas.length; i++) {
    const c = coletas[i]!
    const { data: existente } = await supabase
      .from('faturamento_registros')
      .select('id')
      .eq('coleta_id', c.coleta_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const resIrma = await persistirFaturamentoRegistro(supabase, {
      coletaId: c.coleta_id,
      registroId: existente?.id ?? null,
      payloads: payloadsIrma,
    })
    if (!resIrma.ok) {
      return {
        ok: false,
        message: resIrma.message || `Falha ao consolidar coleta ${c.numero_coleta ?? c.numero}.`,
      }
    }
  }

  const payloadColeta = {
    ...payloadFaturamentoEmitidoAguardaFinalizacaoEsteira({
      valorColeta: valorTotal,
    }),
    data_vencimento: input.dataVencimentoIso.trim() || null,
  }

  for (const c of coletas) {
    const { error: errColeta } = await supabase
      .from('coletas')
      .update(
        c.coleta_id === lider.coleta_id
          ? payloadColeta
          : {
              ...payloadColeta,
              valor_coleta: null,
            }
      )
      .eq('id', c.coleta_id)
    if (errColeta) {
      return {
        ok: false,
        message: `Registro gravado, mas falhou ao atualizar a coleta ${c.numero_coleta ?? c.numero}.`,
      }
    }
  }

  for (const c of coletas) {
    await marcarEsteiraPosFaturamentoEmitido(c.coleta_id)
  }

  const syncOp = await aplicarResumoFinanceiroNaOperacional(lider.coleta_id, input.resumoFinanceiro)
  if (!syncOp.ok) return syncOp

  return { ok: true }
}
