import type { SupabaseClient } from '@supabase/supabase-js'
import { payloadFaturamentoEmitidoAguardaFinalizacaoEsteira } from './coletaFluxoAtualizacao'
import {
  montarPayloadsFaturamentoRegistro,
  persistirFaturamentoRegistro,
} from './faturamentoRegistrosPersist'
import {
  criarResumoFinanceiroDoOperacional,
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
import { marcarEsteiraPosFaturamentoEmitido } from './faturamentoEsteira'
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
  const na = a.numero_coleta ?? Number(a.numero) ?? 0
  const nb = b.numero_coleta ?? Number(b.numero) ?? 0
  if (na !== nb) return na - nb
  return String(a.numero).localeCompare(String(b.numero), 'pt-BR', { numeric: true })
}

export function escolherColetaLiderFaturamento(
  coletas: FaturamentoResumoViewRow[]
): FaturamentoResumoViewRow {
  return [...coletas].sort(ordenarColetasFaturamento)[0]!
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
    (l) => l.chave === 'caminhao' || l.chave.startsWith('equipamento')
  )
  const linhasResiduo = primeira.linhas.filter(
    (l) => l.chave !== 'caminhao' && !l.chave.startsWith('equipamento')
  )
  let valorResiduo = primeira.valorResiduo

  for (let i = 1; i < coletas.length; i++) {
    const c = coletas[i]!
    const part = calcularPrecoContratoColetaMtr({
      ...input,
      veiculosContratoRaw: [],
      equipamentosContratoRaw: [],
      descricaoVeiculoLegado: null,
      equipamentosTextoLegado: null,
      tipoCaminhaoMtr: input.tipoCaminhaoMtr,
      acondicionamentoMtr: input.acondicionamentoMtr,
      tipoResiduoColeta: c.tipo_residuo,
      pesoLiquidoKg: c.peso_liquido,
    })
    valorResiduo += part.valorResiduo
    for (const l of part.linhas) {
      if (l.chave === 'caminhao' || l.chave.startsWith('equipamento')) continue
      linhasResiduo.push({
        ...l,
        rotulo: `${(c.tipo_residuo || 'Resíduo').trim()} — ${l.rotulo}`,
      })
    }
  }

  valorResiduo = Math.round(valorResiduo * 100) / 100
  const todasLinhas = [...linhas, ...linhasResiduo]
  const total = Math.round(
    (primeira.valorCaminhao + primeira.valorEquipamentos + valorResiduo) * 100
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
    const el = coletaElegivelParaFaturar(c)
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

  return { ok: true }
}
