import { payloadFaturamentoEmitidoAguardaFinalizacaoEsteira } from './coletaFluxoAtualizacao'
import { coletaElegivelParaFaturar, rotuloMotivoInelegivel } from './faturamentoElegibilidade'
import {
  escolherColetaLiderFaturamento,
  emitirFaturamentoConsolidadoMtr,
  resolverGrupoFaturamentoNaFila,
} from './faturamentoConsolidacaoMtr'
import {
  parseResumoFinanceiroJson,
  totalResumoFinanceiro,
  type ResumoFinanceiroDesvinculado,
} from './faturamentoDesvinculacao'
import { marcarEsteiraPosFaturamentoEmitido } from './faturamentoEsteira'
import {
  montarPayloadsFaturamentoRegistro,
  persistirFaturamentoRegistro,
} from './faturamentoRegistrosPersist'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { sugerirDataVencimentoIso } from '../services/financeiroReceber'
import { supabase } from './supabase'

type RegistroPendente = {
  id: string
  valor: number | null
  valor_adicionais: number | null
  resumo_financeiro: unknown
  observacoes: string | null
}

async function carregarRegistroPendente(
  coletaId: string
): Promise<{ ok: true; reg: RegistroPendente } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('faturamento_registros')
    .select('id, valor, valor_adicionais, resumo_financeiro, observacoes, status')
    .eq('coleta_id', coletaId.trim())
    .eq('status', 'pendente')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message || 'Não foi possível ler o registo de faturamento.' }
  }
  if (!data?.id) {
    return {
      ok: false,
      message:
        'Não há valores preparados para esta coleta. Conclua a etapa «Ajuste de valores» na esteira antes de faturar.',
    }
  }
  return { ok: true, reg: data as RegistroPendente }
}

function valorEmitirDoRegistro(reg: RegistroPendente, resumo: ResumoFinanceiroDesvinculado | null): number {
  const vReg = reg.valor != null ? Number(reg.valor) : 0
  if (vReg > 0) return vReg
  if (resumo) {
    const t = totalResumoFinanceiro(resumo)
    if (t > 0) return t
  }
  return 0
}

function dataVencimentoParaEmitir(row: FaturamentoResumoViewRow): string {
  const raw = row.data_vencimento
  if (raw) {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
    const s = String(raw).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  }
  return sugerirDataVencimentoIso(7)
}

async function emitirColetaUnica(
  row: FaturamentoResumoViewRow
): Promise<{ ok: true } | { ok: false; message: string }> {
  const el = coletaElegivelParaFaturar(row)
  if (!el.ok) {
    return {
      ok: false,
      message: el.motivos.map(rotuloMotivoInelegivel).join(' '),
    }
  }

  const carregado = await carregarRegistroPendente(row.coleta_id)
  if (!carregado.ok) return carregado

  const { reg } = carregado
  const resumo = parseResumoFinanceiroJson(reg.resumo_financeiro)
  const valorTotal = valorEmitirDoRegistro(reg, resumo)
  if (valorTotal <= 0) {
    return {
      ok: false,
      message:
        'O registo pendente não tem valor total. Volte à etapa «Ajuste de valores» e guarde os cálculos antes de faturar.',
    }
  }

  const agora = new Date().toISOString()
  const acrescimo =
    reg.valor_adicionais != null && Number(reg.valor_adicionais) > 0
      ? Number(reg.valor_adicionais)
      : null

  const payloads = montarPayloadsFaturamentoRegistro({
    valor: valorTotal,
    valorAdicionais: acrescimo,
    resumoFinanceiro: reg.resumo_financeiro as Record<string, unknown> | null,
    observacoes: reg.observacoes,
    status: 'emitido',
    updatedAt: agora,
  })

  const resPersist = await persistirFaturamentoRegistro(supabase, {
    coletaId: row.coleta_id,
    registroId: reg.id,
    payloads,
  })
  if (!resPersist.ok) return resPersist

  const vencIso = dataVencimentoParaEmitir(row)
  const { error: errColeta } = await supabase
    .from('coletas')
    .update({
      ...payloadFaturamentoEmitidoAguardaFinalizacaoEsteira({ valorColeta: valorTotal }),
      data_vencimento: vencIso,
    })
    .eq('id', row.coleta_id)

  if (errColeta) {
    return {
      ok: false,
      message: errColeta.message || 'Registo emitido, mas falhou ao atualizar a coleta.',
    }
  }

  await marcarEsteiraPosFaturamentoEmitido(row.coleta_id)
  return { ok: true }
}

async function emitirGrupoMtr(
  grupo: FaturamentoResumoViewRow[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const c of grupo) {
    const el = coletaElegivelParaFaturar(c, grupo)
    if (!el.ok) {
      return {
        ok: false,
        message: `Coleta ${c.numero_coleta ?? c.numero}: ${el.motivos.map(rotuloMotivoInelegivel).join(' ')}`,
      }
    }
  }

  const lider = escolherColetaLiderFaturamento(grupo)
  const carregado = await carregarRegistroPendente(lider.coleta_id)
  if (!carregado.ok) return carregado

  const { reg } = carregado
  const resumo = parseResumoFinanceiroJson(reg.resumo_financeiro)
  if (!resumo) {
    return {
      ok: false,
      message:
        'Registo pendente sem resumo financeiro. Conclua «Ajuste de valores» na coleta líder do grupo (MTR consolidada).',
    }
  }

  const valorTotal = valorEmitirDoRegistro(reg, resumo)
  if (valorTotal <= 0) {
    return {
      ok: false,
      message: 'Valor total inválido no registo pendente. Revise «Ajuste de valores» antes de faturar.',
    }
  }

  const acrescimo =
    reg.valor_adicionais != null && Number(reg.valor_adicionais) > 0
      ? Number(reg.valor_adicionais)
      : null

  return emitirFaturamentoConsolidadoMtr(supabase, {
    coletas: grupo,
    valorTotal,
    resumoFinanceiro: resumo,
    observacoes: reg.observacoes ?? '',
    dataVencimentoIso: dataVencimentoParaEmitir(lider),
    registroIdLider: reg.id,
    valorAdicionais: acrescimo,
  })
}

/**
 * Etapa «Faturar»: emite o registo pendente (ajuste de valores) e avança a esteira — sem reabrir o formulário de edição.
 */
export async function emitirFaturamentoPelaEsteira(
  coletaId: string,
  linhasFila: FaturamentoResumoViewRow[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'Coleta inválida.' }

  const grupo = resolverGrupoFaturamentoNaFila(id, linhasFila)
  const row = grupo.find((c) => c.coleta_id === id) ?? linhasFila.find((c) => c.coleta_id === id)
  if (!row) return { ok: false, message: 'Coleta não encontrada na fila.' }

  if (grupo.length > 1) {
    return emitirGrupoMtr(grupo)
  }
  return emitirColetaUnica(row)
}

export function mensagemConfirmacaoEmitirEsteira(
  coletaId: string,
  linhasFila: FaturamentoResumoViewRow[]
): string {
  const grupo = resolverGrupoFaturamentoNaFila(coletaId, linhasFila)
  const lider = grupo.length > 1 ? escolherColetaLiderFaturamento(grupo) : grupo[0]
  const row = lider ?? linhasFila.find((c) => c.coleta_id === coletaId)
  if (!row) return 'Confirmar faturamento e avançar na esteira?'

  const valorFmt =
    row.faturamento_registro_valor != null && Number(row.faturamento_registro_valor) > 0
      ? Number(row.faturamento_registro_valor).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      : row.valor_coleta != null && Number(row.valor_coleta) > 0
        ? Number(row.valor_coleta).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })
        : null

  if (grupo.length > 1) {
    const nums = grupo.map((c) => c.numero_coleta ?? c.numero).join(', ')
    return (
      `Confirmar faturamento consolidado (${grupo.length} coletas: ${nums})?\n\n` +
      `Usa os valores já guardados na etapa de ajuste (coleta ${lider?.numero_coleta ?? lider?.numero}).` +
      (valorFmt ? `\nValor estimado: ${valorFmt}.` : '') +
      '\n\nA esteira segue para envio de NF / boleto (Mala Direta).'
    )
  }

  return (
    `Confirmar faturamento da coleta ${row.numero_coleta ?? row.numero} (${row.cliente_nome ?? '—'})?\n\n` +
    'Os valores definidos no ajuste de valores serão emitidos; não é necessário alterar ticket ou MTR aqui.' +
    (valorFmt ? `\nValor: ${valorFmt}.` : '') +
    '\n\nPróximo passo na esteira: Mala Direta (NF e boleto).'
  )
}
