import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import {
  dataLancamentoColetaMedicao,
  diasAbsolutosEntreDatasIso,
  formatarDataCurta,
  JANELA_CONSOLIDACAO_RELATORIO_MEDICAO_DIAS,
} from './faturamentoRelatorioMedicao'
import {
  coletaAguardandoImpressaoTicketFaturamento,
  coletaHistoricoFaturamentoEmitido,
  coletaNaFilaAprovacaoTicketFaturamento,
  coletaNaFilaFaturamento,
} from './faturamentoOperacionalFila'

/** Etapas da esteira pós-conferência do ticket. */
export const FATURAMENTO_ESTEIRA_STATUS = [
  'AJUSTE_VALORES_MEDICAO',
  'MEDICAO_PENDENTE',
  'MEDICAO_EMAIL_PENDENTE',
  'MEDICAO_AGUARDANDO_CLIENTE',
  'LIBERADO_FATURAMENTO',
  'LIBERADO_FINANCEIRO',
  'FINALIZADO',
] as const

export type FaturamentoEsteiraStatus = (typeof FATURAMENTO_ESTEIRA_STATUS)[number]

export const ROTULO_ESTEIRA: Record<FaturamentoEsteiraStatus, string> = {
  AJUSTE_VALORES_MEDICAO: 'Ajuste de valores (medição)',
  MEDICAO_PENDENTE: 'Relatório de medição',
  MEDICAO_EMAIL_PENDENTE: 'Envio do relatório (e-mail)',
  MEDICAO_AGUARDANDO_CLIENTE: 'Aprovação do cliente',
  LIBERADO_FATURAMENTO: 'Liberado faturamento',
  LIBERADO_FINANCEIRO: 'Liberado para o Financeiro',
  FINALIZADO: 'Finalizado',
}

export const ORDEM_ESTEIRA_UI: FaturamentoEsteiraStatus[] = [
  'AJUSTE_VALORES_MEDICAO',
  'MEDICAO_PENDENTE',
  'MEDICAO_EMAIL_PENDENTE',
  'MEDICAO_AGUARDANDO_CLIENTE',
  'LIBERADO_FATURAMENTO',
  'LIBERADO_FINANCEIRO',
  'FINALIZADO',
]

/** Passos 1–8 do indicador visual em Faturamento operacional. */
export type PassoUiEsteiraFaturamento = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const ROTULO_PASSO_UI_ESTEIRA: Record<PassoUiEsteiraFaturamento, string> = {
  1: 'Conferência ticket',
  2: 'Ajuste de valores',
  3: 'Relatório medição',
  4: 'Mala Direta (medição)',
  5: 'Aprovação cliente',
  6: 'Faturar',
  7: 'Mala Direta (NF / boleto)',
  8: 'Financeiro (Contas a Receber)',
}

/** Em que passo da UI (1–8) está esta coleta. */
export function passoUiEsteiraDaColeta(
  row: FaturamentoResumoViewRow,
  linhasContexto?: FaturamentoResumoViewRow[]
): PassoUiEsteiraFaturamento | null {
  if (
    coletaNaFilaAprovacaoTicketFaturamento(row) ||
    coletaAguardandoImpressaoTicketFaturamento(row)
  ) {
    return 1
  }

  const e = esteiraDaLinha(row)
  if (e === 'AJUSTE_VALORES_MEDICAO') return 2
  if (e === 'MEDICAO_PENDENTE') return 3
  if (e === 'MEDICAO_EMAIL_PENDENTE') return 4
  if (e === 'MEDICAO_AGUARDANDO_CLIENTE') return 5

  if (coletaAguardandoConfirmacaoNfBoleto(row)) return 7
  if (coletaLiberadaFinanceiroEsteira(row) || coletaFinalizadaEsteira(row)) return 8
  if (coletaNaFilaFaturamento(row, linhasContexto) || e === 'LIBERADO_FATURAMENTO') return 6

  return null
}

function erroColunasEsteiraAusentes(error: { message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    msg.includes('faturamento_esteira_status') ||
    msg.includes('medicao_') ||
    msg.includes('schema cache') ||
    (msg.includes('column') && msg.includes('coletas'))
  )
}

export const MENSAGEM_MIGRACAO_ESTEIRA =
  'A esteira de medição ainda não está ativa neste Supabase. Execute supabase/migrations/20260601120000_faturamento_esteira_medicoes.sql no SQL Editor.'

export function normalizarEsteiraStatus(
  raw: string | null | undefined
): FaturamentoEsteiraStatus | null {
  const s = (raw ?? '').trim().toUpperCase()
  if (!s) return null
  return (FATURAMENTO_ESTEIRA_STATUS as readonly string[]).includes(s)
    ? (s as FaturamentoEsteiraStatus)
    : null
}

/** Inferência quando a coluna ainda não existe ou está vazia. */
export function inferirEsteiraStatus(row: FaturamentoResumoViewRow): FaturamentoEsteiraStatus | null {
  const expl = normalizarEsteiraStatus(row.faturamento_esteira_status)
  if (expl) return expl

  if (row.conta_receber_nf_enviada_em) return 'FINALIZADO'
  if (row.faturamento_registro_status === 'emitido' || coletaHistoricoFaturamentoEmitido(row)) {
    return 'LIBERADO_FINANCEIRO'
  }
  if (row.medicao_cliente_aprovado_em) return 'LIBERADO_FATURAMENTO'
  if (row.medicao_email_enviado_em) return 'MEDICAO_AGUARDANDO_CLIENTE'
  if (row.medicao_relatorio_gerado_em) return 'MEDICAO_EMAIL_PENDENTE'
  if (row.faturamento_ticket_aprovado_em) return 'AJUSTE_VALORES_MEDICAO'
  return null
}

export function esteiraDaLinha(row: FaturamentoResumoViewRow): FaturamentoEsteiraStatus | null {
  return inferirEsteiraStatus(row)
}

export function rotuloEsteiraLinha(row: FaturamentoResumoViewRow): string {
  const e = esteiraDaLinha(row)
  return e ? ROTULO_ESTEIRA[e] : '—'
}

/** Ticket aprovado e ainda na fase de medição (antes de liberar faturamento). */
export function coletaNaEsteiraMedicao(row: FaturamentoResumoViewRow): boolean {
  if (!row.faturamento_ticket_aprovado_em) return false
  if (coletaHistoricoFaturamentoEmitido(row)) return false
  const e = esteiraDaLinha(row)
  return (
    e === 'AJUSTE_VALORES_MEDICAO' ||
    e === 'MEDICAO_PENDENTE' ||
    e === 'MEDICAO_EMAIL_PENDENTE' ||
    e === 'MEDICAO_AGUARDANDO_CLIENTE'
  )
}

export function coletaNaFilaAjusteValoresMedicao(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'AJUSTE_VALORES_MEDICAO'
}

export function coletaNaFilaRelatorioMedicao(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'MEDICAO_PENDENTE'
}

export function coletaNaFilaMedicaoEmail(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'MEDICAO_EMAIL_PENDENTE'
}

export function coletaNaFilaMedicaoAprovacaoCliente(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'MEDICAO_AGUARDANDO_CLIENTE'
}

/** Coletas da mesma MTR presentes na lista carregada (ex.: `linhasView`). */
export function irmaosMesmaMtrNaLista(
  row: FaturamentoResumoViewRow,
  linhas: FaturamentoResumoViewRow[]
): FaturamentoResumoViewRow[] {
  const mid = (row.mtr_id ?? '').trim()
  if (!mid) return [row]
  return linhas.filter((r) => (r.mtr_id ?? '').trim() === mid)
}

/** Algum ticket do mesmo cliente (janela 30 dias) ainda está nas etapas 3–5 da esteira de medição. */
export function mtrComIrmaNaEsteiraMedicao(
  row: FaturamentoResumoViewRow,
  linhas: FaturamentoResumoViewRow[]
): boolean {
  return clienteComIrmaNaEsteiraMedicao(row, linhas)
}

export function clienteComIrmaNaEsteiraMedicao(
  row: FaturamentoResumoViewRow,
  linhas: FaturamentoResumoViewRow[]
): boolean {
  return linhas.some(
    (r) =>
      r.coleta_id !== row.coleta_id &&
      coletasMesmoGrupoMedicaoCliente(row, r) &&
      coletaNaEsteiraMedicao(r)
  )
}

/** Inclui tickets do mesmo lote (cliente + 30 dias) que ainda não iniciaram medição mas têm irmão na esteira. */
export function coletaPertenceGrupoMedicaoMtr(
  row: FaturamentoResumoViewRow,
  linhas: FaturamentoResumoViewRow[]
): boolean {
  if (coletaNaEsteiraMedicao(row)) return true
  if (!row.faturamento_ticket_aprovado_em || coletaHistoricoFaturamentoEmitido(row)) return false
  return clienteComIrmaNaEsteiraMedicao(row, linhas)
}

export function coletaLiberadaParaFaturarEsteira(
  row: FaturamentoResumoViewRow,
  linhasContexto?: FaturamentoResumoViewRow[]
): boolean {
  const e = esteiraDaLinha(row)
  if (e === 'LIBERADO_FATURAMENTO') return true
  /** Legado: migração da esteira ainda não aplicada — mantém fluxo anterior (aprovação → faturar). */
  const legado =
    !row.faturamento_esteira_status?.trim() &&
    !row.medicao_relatorio_gerado_em &&
    !row.medicao_email_enviado_em &&
    !row.medicao_cliente_aprovado_em &&
    !!row.faturamento_ticket_aprovado_em
  if (!legado) return false
  if (linhasContexto?.length && mtrComIrmaNaEsteiraMedicao(row, linhasContexto)) return false
  return true
}

export function coletaLiberadaFinanceiroEsteira(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'LIBERADO_FINANCEIRO'
}

export function coletaFinalizadaEsteira(row: FaturamentoResumoViewRow): boolean {
  return esteiraDaLinha(row) === 'FINALIZADO'
}

/** Pós-faturamento: emitido, aguarda registo do número da NF/boleto antes de Contas a Receber. */
export function coletaAguardandoConfirmacaoNfBoleto(row: FaturamentoResumoViewRow): boolean {
  if (!coletaHistoricoFaturamentoEmitido(row)) return false
  if (coletaFinalizadaEsteira(row)) return false
  if (row.conta_receber_nf_enviada_em) return false
  const nfRegistada = (row.numero_nf_coleta ?? row.faturamento_referencia_nf ?? '').trim()
  if (nfRegistada && row.liberado_financeiro === true) return false
  const e = esteiraDaLinha(row)
  if (e === 'LIBERADO_FINANCEIRO') return true
  if (!row.faturamento_esteira_status?.trim()) return true
  return false
}

/** Encerrada na esteira operacional — só permanece no histórico de faturadas. */
export function coletaEncerradaNaEsteiraFaturamento(row: FaturamentoResumoViewRow): boolean {
  if (!coletaHistoricoFaturamentoEmitido(row)) return false
  return !coletaAguardandoConfirmacaoNfBoleto(row)
}

/** @deprecated Use `coletaAguardandoConfirmacaoNfBoleto`. */
export const coletaAguardandoEnvioNfCliente = coletaAguardandoConfirmacaoNfBoleto

export type GrupoMedicaoCliente = {
  cliente_id: string
  cliente_nome: string
  cliente_email_nf: string | null
  mtr_id: string | null
  mtr_numero: string
  /** Primeira data de lançamento do lote (ISO). */
  periodo_inicio: string
  /** Última data de lançamento do lote (ISO). */
  periodo_fim: string
  /** Ex.: «20/04/2026 a 15/05/2026» ou mês único. */
  rotulo_periodo: string
  linhas: FaturamentoResumoViewRow[]
}

export type EtapaGrupoMedicao = 'relatorio' | 'email' | 'aprovacao'

export function chaveGrupoMedicaoMtr(row: FaturamentoResumoViewRow): string {
  const cid = row.cliente_id?.trim() || '_'
  const mtr = (row.mtr_id ?? row.mtr_numero ?? row.coleta_id).trim()
  return `${cid}|${mtr}`
}

/** Mesmo cliente e lançamentos a ≤30 dias de intervalo (mesmo relatório consolidado). */
export function coletasMesmoGrupoMedicaoCliente(
  a: FaturamentoResumoViewRow,
  b: FaturamentoResumoViewRow
): boolean {
  const ca = (a.cliente_id ?? '').trim()
  const cb = (b.cliente_id ?? '').trim()
  if (!ca || ca !== cb) return false
  const da = dataLancamentoColetaMedicao(a)
  const db = dataLancamentoColetaMedicao(b)
  if (!da || !db) return false
  return diasAbsolutosEntreDatasIso(da, db) <= JANELA_CONSOLIDACAO_RELATORIO_MEDICAO_DIAS
}

function rotuloPeriodoGrupoMedicao(inicio: string, fim: string): string {
  if (!inicio && !fim) return '—'
  if (!fim || inicio === fim) return formatarDataCurta(inicio)
  return `${formatarDataCurta(inicio)} a ${formatarDataCurta(fim)}`
}

function resumoMtrsGrupoMedicao(linhas: FaturamentoResumoViewRow[]): {
  mtr_id: string | null
  mtr_numero: string
} {
  const numeros = [
    ...new Set(
      linhas
        .map((r) => (r.mtr_numero ?? '').trim())
        .filter((n) => n && n !== '—')
    ),
  ]
  if (numeros.length === 0) {
    return { mtr_id: linhas[0]?.mtr_id ?? null, mtr_numero: '—' }
  }
  if (numeros.length === 1) {
    const linha = linhas.find((r) => (r.mtr_numero ?? '').trim() === numeros[0])
    return {
      mtr_id: linha?.mtr_id ?? linhas[0]?.mtr_id ?? null,
      mtr_numero: numeros[0]!,
    }
  }
  return {
    mtr_id: null,
    mtr_numero: `${numeros.length} MTRs`,
  }
}

function clusterizarLinhasCliente30Dias(
  linhasCliente: FaturamentoResumoViewRow[]
): FaturamentoResumoViewRow[][] {
  const ordenada = [...linhasCliente].sort((a, b) => {
    const da = dataLancamentoColetaMedicao(a)
    const db = dataLancamentoColetaMedicao(b)
    if (da !== db) return da.localeCompare(db)
    return String(a.numero_coleta ?? a.numero).localeCompare(String(b.numero_coleta ?? b.numero))
  })

  const lotes: FaturamentoResumoViewRow[][] = []
  let lote: FaturamentoResumoViewRow[] = []
  let ancora = ''

  for (const row of ordenada) {
    const d = dataLancamentoColetaMedicao(row)
    if (!lote.length) {
      lote = [row]
      ancora = d
      continue
    }
    const diasDesdeAncora = diasAbsolutosEntreDatasIso(ancora, d)
    if (diasDesdeAncora > JANELA_CONSOLIDACAO_RELATORIO_MEDICAO_DIAS) {
      lotes.push(lote)
      lote = [row]
      ancora = d
    } else {
      lote.push(row)
    }
  }
  if (lote.length) lotes.push(lote)
  return lotes
}

/** Etapa única do grupo: todos os tickets da mesma MTR avançam juntos (relatório consolidado). */
export function etapaUnificadaGrupoMedicao(
  linhasGrupo: FaturamentoResumoViewRow[]
): EtapaGrupoMedicao | null {
  const ativas = linhasGrupo.filter((r) => coletaNaEsteiraMedicao(r))
  if (ativas.length === 0) return null
  if (ativas.some((r) => esteiraDaLinha(r) === 'MEDICAO_PENDENTE')) return 'relatorio'
  if (ativas.some((r) => esteiraDaLinha(r) === 'MEDICAO_EMAIL_PENDENTE')) return 'email'
  if (ativas.some((r) => esteiraDaLinha(r) === 'MEDICAO_AGUARDANDO_CLIENTE')) return 'aprovacao'
  return null
}

function ordenarLinhasGrupoMedicao(a: FaturamentoResumoViewRow, b: FaturamentoResumoViewRow): number {
  const na = String(a.numero_coleta ?? a.numero)
  const nb = String(b.numero_coleta ?? b.numero)
  return na.localeCompare(nb, 'pt-BR', { numeric: true })
}

/**
 * Relatório de medição consolidado: mesmo cliente e lançamentos num intervalo de até 30 dias.
 * Várias MTRs/tickets entram na mesma tabela e no mesmo PDF.
 */
export function agruparGruposMedicaoPorMtr(
  linhas: FaturamentoResumoViewRow[]
): GrupoMedicaoCliente[] {
  const elegiveis = linhas.filter((r) => coletaPertenceGrupoMedicaoMtr(r, linhas))
  const porCliente = new Map<string, FaturamentoResumoViewRow[]>()
  for (const row of elegiveis) {
    const cid = row.cliente_id?.trim()
    if (!cid) continue
    const lista = porCliente.get(cid) ?? []
    lista.push(row)
    porCliente.set(cid, lista)
  }

  const grupos: GrupoMedicaoCliente[] = []
  for (const [cid, listaCliente] of porCliente) {
    const lotes = clusterizarLinhasCliente30Dias(listaCliente)
    for (const lote of lotes) {
      if (lote.length === 0) continue
      const datas = lote.map((r) => dataLancamentoColetaMedicao(r)).filter((d) => d.length >= 10)
      const inicio = [...datas].sort()[0] ?? ''
      const fim = [...datas].sort().at(-1) ?? inicio
      const mtrResumo = resumoMtrsGrupoMedicao(lote)
      const ref = lote[0]!
      grupos.push({
        cliente_id: cid,
        cliente_nome: ref.cliente_nome || ref.cliente_razao_social || '—',
        cliente_email_nf: ref.cliente_email_nf ?? null,
        mtr_id: mtrResumo.mtr_id,
        mtr_numero: mtrResumo.mtr_numero,
        periodo_inicio: inicio,
        periodo_fim: fim,
        rotulo_periodo: rotuloPeriodoGrupoMedicao(inicio, fim),
        linhas: [...lote].sort(ordenarLinhasGrupoMedicao),
      })
    }
  }

  return grupos.sort((a, b) => {
    const c = a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
    if (c !== 0) return c
    return a.periodo_inicio.localeCompare(b.periodo_inicio, 'pt-BR')
  })
}

export type GrupoNfBoletoEsteira = {
  cliente_id: string
  cliente_nome: string
  mtr_id: string | null
  mtr_numero: string
  linhas: FaturamentoResumoViewRow[]
}

/** Uma NF/boleto por MTR (vários tickets no mesmo faturamento). */
export function agruparGruposNfBoletoPorMtr(
  linhas: FaturamentoResumoViewRow[]
): GrupoNfBoletoEsteira[] {
  const map = new Map<string, GrupoNfBoletoEsteira>()
  for (const row of linhas) {
    if (!coletaAguardandoConfirmacaoNfBoleto(row)) continue
    const cid = row.cliente_id?.trim()
    if (!cid) continue
    const k = chaveGrupoMedicaoMtr(row)
    let g = map.get(k)
    if (!g) {
      g = {
        cliente_id: cid,
        cliente_nome: row.cliente_nome || row.cliente_razao_social || '—',
        mtr_id: row.mtr_id ?? null,
        mtr_numero: (row.mtr_numero ?? '—').trim() || '—',
        linhas: [],
      }
      map.set(k, g)
    }
    g.linhas.push(row)
  }
  for (const g of map.values()) {
    g.linhas.sort(ordenarLinhasGrupoMedicao)
  }
  return [...map.values()].sort((a, b) => {
    const c = a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
    if (c !== 0) return c
    return a.mtr_numero.localeCompare(b.mtr_numero, 'pt-BR')
  })
}

/** @deprecated Preferir `agruparGruposMedicaoPorMtr` (consolidado cliente + 30 dias). */
export function agruparPorClienteMedicao(
  linhas: FaturamentoResumoViewRow[],
  filtro?: (row: FaturamentoResumoViewRow) => boolean
): GrupoMedicaoCliente[] {
  const filtradas = filtro ? linhas.filter(filtro) : linhas
  return agruparGruposMedicaoPorMtr(filtradas)
}

async function atualizarEsteiraColeta(
  coletaId: string,
  patch: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('coletas').update(patch).eq('id', coletaId.trim())
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Não foi possível atualizar a esteira.' }
  }
  return { ok: true }
}

const ESTEIRA_STATUS_FIM = new Set(['LIBERADO_FINANCEIRO', 'FINALIZADO'])

const VW_EXPANDIR_MEDICAO =
  'coleta_id, cliente_id, data_execucao, data_agendada, created_at, faturamento_esteira_status, faturamento_registro_status, fluxo_status, etapa_operacional, faturamento_ticket_aprovado_em'

function coletaElegivelExpandirEsteiraMedicao(r: FaturamentoResumoViewRow): boolean {
  const st = (r.faturamento_esteira_status ?? '').trim().toUpperCase()
  if (ESTEIRA_STATUS_FIM.has(st)) return false
  if (coletaHistoricoFaturamentoEmitido(r)) return false
  if (!r.faturamento_ticket_aprovado_em) return false
  return true
}

/** Expande IDs para todos os tickets do mesmo lote de medição (cliente + ≤30 dias de lançamento). */
export async function expandirColetaIdsEsteiraMesmaMtr(
  coletaIds: string[]
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  const base = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (base.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }

  const { data: seeds, error: errSeeds } = await supabase
    .from('vw_faturamento_resumo')
    .select(VW_EXPANDIR_MEDICAO)
    .in('coleta_id', base)

  if (errSeeds) {
    return { ok: false, message: errSeeds.message || 'Não foi possível localizar as coletas.' }
  }

  const seedRows = (seeds ?? []) as FaturamentoResumoViewRow[]
  const clienteIds = [...new Set(seedRows.map((r) => (r.cliente_id ?? '').trim()).filter(Boolean))]
  if (clienteIds.length === 0) {
    return { ok: true, ids: base }
  }

  const { data: todas, error: errTodas } = await supabase
    .from('vw_faturamento_resumo')
    .select(VW_EXPANDIR_MEDICAO)
    .in('cliente_id', clienteIds)
    .not('faturamento_ticket_aprovado_em', 'is', null)

  if (errTodas) {
    return { ok: false, message: errTodas.message || 'Não foi possível localizar tickets do cliente.' }
  }

  const porCliente = new Map<string, FaturamentoResumoViewRow[]>()
  for (const r of (todas ?? []) as FaturamentoResumoViewRow[]) {
    if (!coletaElegivelExpandirEsteiraMedicao(r)) continue
    const cid = (r.cliente_id ?? '').trim()
    if (!cid) continue
    const lista = porCliente.get(cid) ?? []
    lista.push(r)
    porCliente.set(cid, lista)
  }

  const all = new Set(base)
  for (const seed of seedRows) {
    const cid = (seed.cliente_id ?? '').trim()
    if (!cid) continue
    const lista = porCliente.get(cid) ?? []
    const lotes = clusterizarLinhasCliente30Dias(lista)
    const loteSeed = lotes.find((l) => l.some((r) => r.coleta_id === seed.coleta_id))
    if (!loteSeed) continue
    for (const r of loteSeed) {
      if (coletaElegivelExpandirEsteiraMedicao(r)) all.add(r.coleta_id)
    }
  }

  return { ok: true, ids: [...all] }
}

/** Expande IDs para todos os tickets da mesma MTR aguardando registo de NF/boleto (etapa 7). */
export async function expandirColetaIdsNfBoletoMesmaMtr(
  coletaIds: string[]
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  const base = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (base.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }

  const mtrIds = new Set<string>()
  for (const id of base) {
    const { data, error } = await supabase.from('coletas').select('mtr_id').eq('id', id).maybeSingle()
    if (error) {
      return { ok: false, message: error.message || 'Não foi possível localizar a coleta.' }
    }
    const mid = (data?.mtr_id ?? '').trim()
    if (mid) mtrIds.add(mid)
  }

  const all = new Set(base)
  for (const mid of mtrIds) {
    const { data: rows, error } = await supabase
      .from('vw_faturamento_resumo')
      .select(
        'coleta_id, faturamento_esteira_status, faturamento_registro_status, fluxo_status, etapa_operacional, conta_receber_nf_enviada_em'
      )
      .eq('mtr_id', mid)

    if (error) {
      return { ok: false, message: error.message || 'Não foi possível localizar tickets da MTR.' }
    }
    for (const r of rows ?? []) {
      const rid = (r.coleta_id ?? '').trim()
      if (!rid) continue
      if (!coletaAguardandoConfirmacaoNfBoleto(r as FaturamentoResumoViewRow)) continue
      all.add(rid)
    }
  }

  return { ok: true, ids: [...all] }
}

export async function marcarRelatorioMedicaoGerado(
  coletaIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const exp = await expandirColetaIdsEsteiraMesmaMtr(coletaIds)
  if (!exp.ok) return exp
  const ids = exp.ids
  if (ids.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('coletas')
    .update({
      medicao_relatorio_gerado_em: agora,
      faturamento_esteira_status: 'MEDICAO_EMAIL_PENDENTE',
    })
    .in('id', ids)
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Erro ao registar relatório de medição.' }
  }
  return { ok: true }
}

export async function confirmarEmailMedicaoEnviado(
  coletaIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const exp = await expandirColetaIdsEsteiraMesmaMtr(coletaIds)
  if (!exp.ok) return exp
  const ids = exp.ids
  if (ids.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('coletas')
    .update({
      medicao_email_enviado_em: agora,
      medicao_email_enviado_por_user_id: user?.id ?? null,
      faturamento_esteira_status: 'MEDICAO_AGUARDANDO_CLIENTE',
    })
    .in('id', ids)
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Erro ao registar envio do e-mail.' }
  }
  return { ok: true }
}

export async function aprovarMedicaoCliente(
  coletaIds: string[],
  observacao?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const exp = await expandirColetaIdsEsteiraMesmaMtr(coletaIds)
  if (!exp.ok) return exp
  const ids = exp.ids
  if (ids.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('coletas')
    .update({
      medicao_cliente_aprovado_em: agora,
      medicao_cliente_aprovado_por_user_id: user?.id ?? null,
      medicao_cliente_aprovacao_obs: (observacao ?? '').trim() || null,
      faturamento_esteira_status: 'LIBERADO_FATURAMENTO',
    })
    .in('id', ids)
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Erro ao registar aprovação do cliente.' }
  }
  return { ok: true }
}

/** Devolve o grupo (mesma MTR) à etapa 2 — Ajuste de valores, antes do relatório/e-mail. */
export async function voltarGrupoMedicaoParaAjusteValores(
  coletaIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const exp = await expandirColetaIdsEsteiraMesmaMtr(coletaIds)
  if (!exp.ok) return exp
  const ids = exp.ids
  if (ids.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }

  const { error } = await supabase
    .from('coletas')
    .update({
      faturamento_esteira_status: 'AJUSTE_VALORES_MEDICAO',
      medicao_relatorio_gerado_em: null,
      medicao_email_enviado_em: null,
      medicao_email_enviado_por_user_id: null,
      medicao_cliente_aprovado_em: null,
      medicao_cliente_aprovado_por_user_id: null,
      medicao_cliente_aprovacao_obs: null,
    })
    .in('id', ids)

  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Não foi possível voltar para o ajuste de valores.' }
  }
  return { ok: true }
}

export async function marcarEsteiraPosFaturamentoEmitido(
  coletaId: string
): Promise<void> {
  await atualizarEsteiraColeta(coletaId, { faturamento_esteira_status: 'LIBERADO_FINANCEIRO' })
}

export async function marcarRelatorioFaturamentoClienteGerado(
  coletaId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  return atualizarEsteiraColeta(coletaId, {
    faturamento_relatorio_cliente_em: new Date().toISOString(),
  })
}

export async function marcarEsteiraFinalizadaPorNf(
  coletaId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  return atualizarEsteiraColeta(coletaId, { faturamento_esteira_status: 'FINALIZADO' })
}

/** Ao aprovar ticket: primeiro ajuste de valores, depois medição. */
export async function marcarEsteiraAposAprovacaoTicket(
  coletaId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  return atualizarEsteiraColeta(coletaId, { faturamento_esteira_status: 'AJUSTE_VALORES_MEDICAO' })
}

/** Valores do ticket/MTR revisados — libera geração do relatório de medição. */
export async function marcarValoresMedicaoRevisados(
  coletaIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { ok: false, message: 'Nenhuma coleta selecionada.' }
  const { error } = await supabase
    .from('coletas')
    .update({ faturamento_esteira_status: 'MEDICAO_PENDENTE' })
    .in('id', ids)
  if (error) {
    if (erroColunasEsteiraAusentes(error)) {
      return { ok: false, message: MENSAGEM_MIGRACAO_ESTEIRA }
    }
    return { ok: false, message: error.message || 'Erro ao liberar etapa de medição.' }
  }
  return { ok: true }
}

/** Coletas do cliente aguardando envio do relatório de medição por e-mail (mala direta). */
export function coletaAguardandoEmailMedicaoCliente(
  row: FaturamentoResumoViewRow,
  clienteId?: string
): boolean {
  if (clienteId && row.cliente_id !== clienteId) return false
  return esteiraDaLinha(row) === 'MEDICAO_EMAIL_PENDENTE'
}

export function resumoEsteiraPasso1(row: FaturamentoResumoViewRow): boolean {
  return (
    coletaNaFilaAprovacaoTicketFaturamento(row) ||
    coletaAguardandoImpressaoTicketFaturamento(row)
  )
}
