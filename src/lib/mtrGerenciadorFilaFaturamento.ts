import { listarColetaIdsPorMtr } from './excluirOperacionalCascata'
import { escolherColetaLiderFaturamento } from './faturamentoConsolidacaoMtr'
import {
  coletaFinalizadaEsteira,
  coletaLiberadaFinanceiroEsteira,
  coletaNaFilaAjusteValoresMedicao,
  esteiraDaLinha,
  MENSAGEM_MIGRACAO_ESTEIRA,
  ORDEM_ESTEIRA_UI,
  passoUiEsteiraDaColeta,
  ROTULO_ESTEIRA,
  ROTULO_PASSO_UI_ESTEIRA,
  type FaturamentoEsteiraStatus,
} from './faturamentoEsteira'
import { coletaHistoricoFaturamentoEmitido } from './faturamentoOperacionalFila'
import { fetchVwFaturamentoResumoPorColetaIds } from './faturamentoResumoFetch'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { supabase } from './supabase'

function indiceEsteiraExplicita(row: FaturamentoResumoViewRow): number {
  const e = esteiraDaLinha(row)
  if (!e) return -1
  return ORDEM_ESTEIRA_UI.indexOf(e)
}

export type EnviarFilaAjusteElegibilidade = {
  pode: boolean
  motivo: string
}

/** Se a linha do relatório pode usar «Enviar para fila do faturamento» (esteira passo 2). */
export function coletaPodeEnviarParaFilaAjusteFaturamento(
  row: FaturamentoResumoViewRow | null,
  linhasContexto?: FaturamentoResumoViewRow[]
): EnviarFilaAjusteElegibilidade {
  if (!row?.coleta_id) {
    return { pode: false, motivo: 'Sem coleta vinculada à MTR' }
  }

  const mtrSt = (row.mtr_status ?? '').trim()
  if (mtrSt === 'Cancelado' || (row.status_conferencia ?? '').trim() === 'MTR_CANCELADA') {
    return { pode: false, motivo: 'MTR cancelada' }
  }

  if (coletaHistoricoFaturamentoEmitido(row)) {
    return { pode: false, motivo: 'Faturamento já emitido para esta coleta' }
  }

  if (coletaFinalizadaEsteira(row) || coletaLiberadaFinanceiroEsteira(row)) {
    return { pode: false, motivo: 'Coleta já encerrada na esteira (financeiro)' }
  }

  if (coletaNaFilaAjusteValoresMedicao(row)) {
    return { pode: false, motivo: 'Já está na fila de ajuste de valores (passo 2)' }
  }

  const idxEsteira = indiceEsteiraExplicita(row)
  if (idxEsteira > 0) {
    const e = esteiraDaLinha(row) as FaturamentoEsteiraStatus
    return { pode: false, motivo: `Já na esteira: ${ROTULO_ESTEIRA[e]}` }
  }

  const passo = passoUiEsteiraDaColeta(row, linhasContexto)
  if (passo != null && passo >= 3) {
    return {
      pode: false,
      motivo: `Já na esteira — ${ROTULO_PASSO_UI_ESTEIRA[passo as keyof typeof ROTULO_PASSO_UI_ESTEIRA]}`,
    }
  }

  if (passo === 2) {
    return { pode: false, motivo: 'Já está na fila de ajuste de valores (passo 2)' }
  }

  return {
    pode: true,
    motivo: 'Enviar para ajuste de valores na esteira de faturamento (passo 2)',
  }
}

function erroColunasEsteiraAusentes(error: { message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    msg.includes('faturamento_esteira_status') ||
    msg.includes('faturamento_ticket_aprovado') ||
    msg.includes('medicao_') ||
    msg.includes('schema cache') ||
    (msg.includes('column') && msg.includes('coletas'))
  )
}

/**
 * Encaminha todas as coletas elegíveis da MTR para `AJUSTE_VALORES_MEDICAO` (passo 2),
 * aprovando o ticket automaticamente quando ainda não conferido — atalho a partir do Gerenciador MTR.
 */
export async function enviarMtrColetasParaFilaFaturamentoAjuste(
  mtrId: string
): Promise<
  | { ok: true; coletaIds: string[]; urlFaturamento: string | null }
  | { ok: false; message: string }
> {
  const mid = mtrId.trim()
  if (!mid) return { ok: false, message: 'MTR inválida.' }

  const coletaIds = await listarColetaIdsPorMtr(supabase, mid)
  if (!coletaIds.length) {
    return { ok: false, message: 'Nenhuma coleta vinculada a esta MTR.' }
  }

  const { data: vwRows, error: errVw } = await fetchVwFaturamentoResumoPorColetaIds(
    supabase,
    coletaIds
  )
  if (errVw) {
    return { ok: false, message: errVw.message || 'Não foi possível carregar o estado das coletas.' }
  }

  const porId = new Map((vwRows ?? []).map((r) => [r.coleta_id, r]))
  const elegiveis: FaturamentoResumoViewRow[] = []
  for (const id of coletaIds) {
    const row = porId.get(id)
    if (!row) continue
    if (coletaPodeEnviarParaFilaAjusteFaturamento(row, vwRows).pode) elegiveis.push(row)
  }

  if (!elegiveis.length) {
    const primeira = porId.get(coletaIds[0]!)
    if (primeira) {
      const { motivo } = coletaPodeEnviarParaFilaAjusteFaturamento(primeira, vwRows)
      return { ok: false, message: motivo || 'Nenhuma coleta elegível para enviar à esteira.' }
    }
    return { ok: false, message: 'Coletas sem dados na vista de faturamento.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const agora = new Date().toISOString()
  const userId = user?.id ?? null

  const semTicketAprovado = elegiveis
    .filter((r) => !r.faturamento_ticket_aprovado_em)
    .map((r) => r.coleta_id)
  const comTicketAprovado = elegiveis
    .filter((r) => !!r.faturamento_ticket_aprovado_em)
    .map((r) => r.coleta_id)

  if (semTicketAprovado.length > 0) {
    const { error } = await supabase
      .from('coletas')
      .update({
        faturamento_ticket_aprovado_em: agora,
        faturamento_ticket_aprovado_por_user_id: userId,
        faturamento_esteira_status: 'AJUSTE_VALORES_MEDICAO',
      })
      .in('id', semTicketAprovado)
    if (error) {
      if (erroColunasEsteiraAusentes(error)) {
        return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
      }
      return { ok: false, message: error.message || 'Não foi possível enviar coletas à esteira.' }
    }
  }

  if (comTicketAprovado.length > 0) {
    const { error } = await supabase
      .from('coletas')
      .update({ faturamento_esteira_status: 'AJUSTE_VALORES_MEDICAO' })
      .in('id', comTicketAprovado)
    if (error) {
      if (erroColunasEsteiraAusentes(error)) {
        return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
      }
      return { ok: false, message: error.message || 'Não foi possível atualizar a esteira.' }
    }
  }

  const idsAtualizados = elegiveis.map((r) => r.coleta_id)
  const lider = escolherColetaLiderFaturamento(elegiveis)
  const urlFaturamento = lider?.coleta_id
    ? `/faturamento?coleta=${encodeURIComponent(lider.coleta_id)}`
    : null

  return { ok: true, coletaIds: idsAtualizados, urlFaturamento }
}
