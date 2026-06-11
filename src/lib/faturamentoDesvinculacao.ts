import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { tipoResiduoExibicaoColeta } from './faturamentoResumoTicket'
import type { ResultadoPrecoContrato } from './faturamentoPrecoContrato'
import type { LinhaTicketResumoFinanceiro } from './faturamentoResumoTicket'
import {
  formatarResiduosListaResumo,
  montarTicketResumoUnicoColeta,
  rotulosResiduoFromTextoColeta,
} from './faturamentoResumoTicket'

export type { LinhaTicketResumoFinanceiro }

/** Snapshot financeiro do ticket (não altera controle de massa / coleta). */
export type ResumoTicketFinanceiro = {
  peso_tara_kg: string
  peso_bruto_kg: string
  peso_liquido_kg: string
  /** Texto completo com todos os resíduos do(s) ticket(s). */
  tipo_residuo: string
  valor_total: string
  /** Uma linha por ticket (consolidado MTR ou ticket único). */
  linhas_tickets?: LinhaTicketResumoFinanceiro[]
  eh_consolidado_mtr?: boolean
}

/** Snapshot financeiro da MTR: caminhão + equipamento + resíduo. */
export type ResumoMtrFinanceiro = {
  caminhao_rotulo: string
  caminhao_valor: string
  equipamento_rotulo: string
  equipamento_valor: string
  residuo_rotulo: string
  residuo_quantidade: string
  residuo_unidade: string
  residuo_valor_unitario: string
  residuo_valor: string
  peso_liquido_kg: string
}

export type AjustesFinanceirosFaturamento = {
  acrescimo: string
  desconto: string
}

export type ConsolidacaoMtrResumo = {
  mtr_id: string
  mtr_numero: string
  coleta_lider_id: string
  coleta_ids: string[]
  tickets_resumo?: string
}

export type ResumoFinanceiroDesvinculado = {
  v: 1
  /** Permite edição local; quando sincronizado, espelha também MTR e coletas (ticket). */
  desvinculado_operacional: boolean
  ticket: ResumoTicketFinanceiro
  mtr: ResumoMtrFinanceiro
  /** Acréscimo / desconto aplicados só no faturamento (Operacional (Time T)). */
  ajustes: AjustesFinanceirosFaturamento
  /** Ticket conferido e fechado para edição na tela de faturamento. */
  ticket_encerrado_definitivo: boolean
  ticket_encerrado_em?: string | null
  /** Vários tickets da mesma MTR → um único faturamento. */
  consolidacao_mtr?: ConsolidacaoMtrResumo
}

export function ajustesFinanceirosVazios(): AjustesFinanceirosFaturamento {
  return { acrescimo: '', desconto: '' }
}

export function parseNumeroCampo(s: string): number {
  const t = s.replace(/\s/g, '').replace(',', '.').trim()
  if (!t) return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

export function pesoParaCampo(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return ''
  return String(v)
}

/**
 * Peso em kg para cálculo do contrato: prioriza o campo editado na MTR (mesmo vazio durante digitação).
 * Só usa coleta operacional quando o campo de peso MTR nunca foi preenchido no resumo.
 */
export function pesoLiquidoKgDoResumoMtr(mtr: ResumoMtrFinanceiro): number | null {
  const campo = mtr.peso_liquido_kg.trim()
  if (campo === '') return null
  const n = parseNumeroCampo(campo)
  return n > 0 ? n : 0
}

export function moedaParaCampo(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return ''
  return String(Math.round(Number(v) * 100) / 100)
}

/** Caminhão, equipamento e resíduo sem valor informado (para aplicar contrato automaticamente). */
export function resumoMtrPrecosVazios(m: ResumoMtrFinanceiro): boolean {
  return (
    parseNumeroCampo(m.caminhao_valor) <= 0 &&
    parseNumeroCampo(m.equipamento_valor) <= 0 &&
    parseNumeroCampo(m.residuo_valor) <= 0 &&
    parseNumeroCampo(m.residuo_valor_unitario) <= 0
  )
}

export function totalResumoFinanceiro(r: ResumoFinanceiroDesvinculado): number {
  const ticket = parseNumeroCampo(r.ticket.valor_total)
  const mtr =
    parseNumeroCampo(r.mtr.caminhao_valor) +
    parseNumeroCampo(r.mtr.equipamento_valor) +
    parseNumeroCampo(r.mtr.residuo_valor)
  const acrescimo = parseNumeroCampo(r.ajustes?.acrescimo ?? '')
  const desconto = parseNumeroCampo(r.ajustes?.desconto ?? '')
  return Math.round((ticket + mtr + acrescimo - desconto) * 100) / 100
}

export function totalResumoMtr(m: ResumoMtrFinanceiro): number {
  return Math.round(
    (parseNumeroCampo(m.caminhao_valor) +
      parseNumeroCampo(m.equipamento_valor) +
      parseNumeroCampo(m.residuo_valor)) *
      100
  ) / 100
}

export function criarResumoFinanceiroDoOperacional(
  row: FaturamentoResumoViewRow,
  sugestao: ResultadoPrecoContrato | null,
  ctx?: { tipoCaminhao?: string | null; acondicionamento?: string | null }
): ResumoFinanceiroDesvinculado {
  const ticketBase = montarTicketResumoUnicoColeta(row)
  const ticket: ResumoTicketFinanceiro = {
    ...ticketBase,
    valor_total: '0',
  }

  const camRot =
    sugestao?.veiculoContrato?.tipo_veiculo?.trim() ||
    (ctx?.tipoCaminhao ?? '').trim() ||
    'Caminhão'
  const eqRot =
    sugestao?.equipamentosContrato?.[0]?.descricao?.trim() ||
    (ctx?.acondicionamento ?? '').trim() ||
    'Equipamento'
  const tipoColeta = tipoResiduoExibicaoColeta(row)
  const rotulosColeta = rotulosResiduoFromTextoColeta(tipoColeta)
  const resRot =
    sugestao?.residuoContrato?.tipo_residuo?.trim() ||
    formatarResiduosListaResumo(rotulosColeta) ||
    tipoColeta
  const unidade = sugestao?.unidadeMedida ?? 'kg'
  const qtd =
    sugestao && sugestao.quantidadeFaturada > 0
      ? sugestao.quantidadeFaturada
      : row.peso_liquido != null
        ? Number(row.peso_liquido)
        : 0

  const mtr: ResumoMtrFinanceiro = {
    caminhao_rotulo: camRot,
    caminhao_valor: moedaParaCampo(sugestao?.valorCaminhao),
    equipamento_rotulo: eqRot,
    equipamento_valor: moedaParaCampo(sugestao?.valorEquipamentos),
    residuo_rotulo: resRot,
    residuo_quantidade: qtd > 0 ? String(qtd) : pesoParaCampo(row.peso_liquido),
    residuo_unidade: unidade,
    residuo_valor_unitario: moedaParaCampo(sugestao?.valorUnitario),
    residuo_valor: moedaParaCampo(sugestao?.valorResiduo),
    peso_liquido_kg: pesoParaCampo(row.peso_liquido),
  }

  return {
    v: 1,
    desvinculado_operacional: true,
    ticket,
    mtr,
    ajustes: ajustesFinanceirosVazios(),
    ticket_encerrado_definitivo: false,
    ticket_encerrado_em: null,
  }
}

function parseLinhaTicketRaw(raw: unknown): LinhaTicketResumoFinanceiro | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const residuo = typeof o.residuo === 'string' ? o.residuo : ''
  if (!residuo.trim()) return null
  return {
    coleta_numero: typeof o.coleta_numero === 'string' ? o.coleta_numero : '—',
    ticket_numero: typeof o.ticket_numero === 'string' ? o.ticket_numero : '—',
    residuo,
    peso_tara_kg:
      typeof o.peso_tara_kg === 'string' ? o.peso_tara_kg : pesoParaCampo(o.peso_tara_kg as number),
    peso_bruto_kg:
      typeof o.peso_bruto_kg === 'string' ? o.peso_bruto_kg : pesoParaCampo(o.peso_bruto_kg as number),
    peso_liquido_kg:
      typeof o.peso_liquido_kg === 'string'
        ? o.peso_liquido_kg
        : pesoParaCampo(o.peso_liquido_kg as number),
  }
}

function parseTicketRaw(o: Record<string, unknown>): ResumoTicketFinanceiro {
  const linhasRaw = o.linhas_tickets
  const linhas_tickets = Array.isArray(linhasRaw)
    ? linhasRaw.map(parseLinhaTicketRaw).filter((x): x is LinhaTicketResumoFinanceiro => x != null)
    : undefined

  return {
    peso_tara_kg: typeof o.peso_tara_kg === 'string' ? o.peso_tara_kg : pesoParaCampo(o.peso_tara_kg as number),
    peso_bruto_kg:
      typeof o.peso_bruto_kg === 'string' ? o.peso_bruto_kg : pesoParaCampo(o.peso_bruto_kg as number),
    peso_liquido_kg:
      typeof o.peso_liquido_kg === 'string' ? o.peso_liquido_kg : pesoParaCampo(o.peso_liquido_kg as number),
    tipo_residuo: typeof o.tipo_residuo === 'string' ? o.tipo_residuo : '',
    valor_total:
      typeof o.valor_total === 'string' ? o.valor_total : moedaParaCampo(o.valor_total as number),
    linhas_tickets: linhas_tickets?.length ? linhas_tickets : undefined,
    eh_consolidado_mtr: o.eh_consolidado_mtr === true,
  }
}

function parseMtrRaw(o: Record<string, unknown>): ResumoMtrFinanceiro {
  return {
    caminhao_rotulo: typeof o.caminhao_rotulo === 'string' ? o.caminhao_rotulo : '',
    caminhao_valor:
      typeof o.caminhao_valor === 'string' ? o.caminhao_valor : moedaParaCampo(o.caminhao_valor as number),
    equipamento_rotulo: typeof o.equipamento_rotulo === 'string' ? o.equipamento_rotulo : '',
    equipamento_valor:
      typeof o.equipamento_valor === 'string'
        ? o.equipamento_valor
        : moedaParaCampo(o.equipamento_valor as number),
    residuo_rotulo: typeof o.residuo_rotulo === 'string' ? o.residuo_rotulo : '',
    residuo_quantidade:
      typeof o.residuo_quantidade === 'string'
        ? o.residuo_quantidade
        : pesoParaCampo(o.residuo_quantidade as number),
    residuo_unidade: typeof o.residuo_unidade === 'string' ? o.residuo_unidade : 'kg',
    residuo_valor_unitario:
      typeof o.residuo_valor_unitario === 'string'
        ? o.residuo_valor_unitario
        : moedaParaCampo(o.residuo_valor_unitario as number),
    residuo_valor:
      typeof o.residuo_valor === 'string' ? o.residuo_valor : moedaParaCampo(o.residuo_valor as number),
    peso_liquido_kg:
      typeof o.peso_liquido_kg === 'string' ? o.peso_liquido_kg : pesoParaCampo(o.peso_liquido_kg as number),
  }
}

export function parseResumoFinanceiroJson(raw: unknown): ResumoFinanceiroDesvinculado | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null
  const ticket = o.ticket
  const mtr = o.mtr
  if (!ticket || typeof ticket !== 'object' || !mtr || typeof mtr !== 'object') return null
  const ajustesRaw = o.ajustes
  let ajustes = ajustesFinanceirosVazios()
  if (ajustesRaw && typeof ajustesRaw === 'object') {
    const aj = ajustesRaw as Record<string, unknown>
    ajustes = {
      acrescimo:
        typeof aj.acrescimo === 'string' ? aj.acrescimo : moedaParaCampo(aj.acrescimo as number),
      desconto:
        typeof aj.desconto === 'string' ? aj.desconto : moedaParaCampo(aj.desconto as number),
    }
  }

  let consolidacao_mtr: ConsolidacaoMtrResumo | undefined
  const cons = o.consolidacao_mtr
  if (cons && typeof cons === 'object') {
    const c = cons as Record<string, unknown>
    const ids = Array.isArray(c.coleta_ids)
      ? c.coleta_ids.filter((x): x is string => typeof x === 'string')
      : []
    if (typeof c.mtr_id === 'string' && typeof c.coleta_lider_id === 'string' && ids.length > 0) {
      consolidacao_mtr = {
        mtr_id: c.mtr_id,
        mtr_numero: typeof c.mtr_numero === 'string' ? c.mtr_numero : '',
        coleta_lider_id: c.coleta_lider_id,
        coleta_ids: ids,
        tickets_resumo: typeof c.tickets_resumo === 'string' ? c.tickets_resumo : undefined,
      }
    }
  }

  return {
    v: 1,
    desvinculado_operacional: o.desvinculado_operacional !== false,
    ticket: parseTicketRaw(ticket as Record<string, unknown>),
    mtr: parseMtrRaw(mtr as Record<string, unknown>),
    ajustes,
    ticket_encerrado_definitivo: o.ticket_encerrado_definitivo === true,
    ticket_encerrado_em:
      typeof o.ticket_encerrado_em === 'string' ? o.ticket_encerrado_em : null,
    consolidacao_mtr,
  }
}

export function resumoFinanceiroParaJsonb(r: ResumoFinanceiroDesvinculado): Record<string, unknown> {
  return {
    v: 1,
    desvinculado_operacional: true,
    consolidacao_mtr: r.consolidacao_mtr ?? null,
    ticket: { ...r.ticket },
    mtr: { ...r.mtr },
    ajustes: { ...r.ajustes },
    ticket_encerrado_definitivo: r.ticket_encerrado_definitivo,
    ticket_encerrado_em: r.ticket_encerrado_em ?? null,
  }
}

export function marcarTicketEncerradoDefinitivoResumo(
  resumo: ResumoFinanceiroDesvinculado
): ResumoFinanceiroDesvinculado {
  return {
    ...resumo,
    ticket_encerrado_definitivo: true,
    ticket_encerrado_em: new Date().toISOString(),
  }
}

/**
 * Atualiza peso líquido MTR, espelha em qtd. faturada (kg) e, se consolidado, redistribui peso nos tickets.
 */
export function aplicarPesoLiquidoMtrNoResumo(
  resumo: ResumoFinanceiroDesvinculado,
  pesoStr: string
): ResumoFinanceiroDesvinculado {
  const peso = parseNumeroCampo(pesoStr)
  const linhas = resumo.ticket.linhas_tickets ?? []
  const consolidado = Boolean(resumo.consolidacao_mtr) || linhas.length > 1

  if (consolidado && linhas.length > 0 && peso > 0) {
    const pesosAntigos = linhas.map((l) => parseNumeroCampo(l.peso_liquido_kg))
    const totalAntigo = pesosAntigos.reduce((a, b) => a + b, 0)
    let restante = peso
    const novasLinhas = linhas.map((l, i) => {
      const isLast = i === linhas.length - 1
      const novoPeso = isLast
        ? Math.round(restante * 1000) / 1000
        : totalAntigo > 0
          ? Math.round(((pesosAntigos[i]! / totalAntigo) * peso) * 1000) / 1000
          : Math.round((peso / linhas.length) * 1000) / 1000
      if (!isLast) restante -= novoPeso
      return { ...l, peso_liquido_kg: pesoParaCampo(novoPeso) }
    })
    const mtr = recalcularResiduoMtr({
      ...resumo.mtr,
      peso_liquido_kg: pesoStr.trim(),
      residuo_quantidade: pesoParaCampo(peso),
    })
    return {
      ...resumo,
      ticket: {
        ...resumo.ticket,
        linhas_tickets: novasLinhas,
        peso_liquido_kg: pesoParaCampo(peso),
      },
      mtr,
    }
  }

  const mtr = recalcularResiduoMtr({
    ...resumo.mtr,
    peso_liquido_kg: pesoStr.trim(),
    residuo_quantidade: peso > 0 ? pesoParaCampo(peso) : resumo.mtr.residuo_quantidade,
  })
  const ticket =
    peso > 0 && !consolidado
      ? { ...resumo.ticket, peso_liquido_kg: pesoParaCampo(peso) }
      : resumo.ticket
  return { ...resumo, mtr, ticket }
}

/** Recalcula valor do resíduo na MTR a partir de quantidade × unitário (mínimo contratual já no valor unitário efetivo). */
export function recalcularResiduoMtr(m: ResumoMtrFinanceiro): ResumoMtrFinanceiro {
  const qtd = parseNumeroCampo(m.residuo_quantidade)
  const unit = parseNumeroCampo(m.residuo_valor_unitario)
  if (qtd > 0 && unit > 0) {
    return { ...m, residuo_valor: moedaParaCampo(qtd * unit) }
  }
  return m
}

export function aplicarSugestaoContratoNoResumoMtr(
  resumo: ResumoFinanceiroDesvinculado,
  sugestao: ResultadoPrecoContrato | null,
  ctx?: { tipoCaminhao?: string | null; acondicionamento?: string | null }
): ResumoFinanceiroDesvinculado {
  if (!sugestao) return resumo
  const mtr: ResumoMtrFinanceiro = {
    ...resumo.mtr,
    caminhao_rotulo:
      sugestao.veiculoContrato?.tipo_veiculo?.trim() ||
      resumo.mtr.caminhao_rotulo ||
      (ctx?.tipoCaminhao ?? '').trim() ||
      'Caminhão',
    caminhao_valor: moedaParaCampo(sugestao.valorCaminhao) || resumo.mtr.caminhao_valor,
    equipamento_rotulo:
      sugestao.equipamentosContrato?.[0]?.descricao?.trim() ||
      resumo.mtr.equipamento_rotulo ||
      (ctx?.acondicionamento ?? '').trim() ||
      'Equipamento',
    equipamento_valor: moedaParaCampo(sugestao.valorEquipamentos) || resumo.mtr.equipamento_valor,
    residuo_rotulo: sugestao.residuoContrato?.tipo_residuo?.trim() || resumo.mtr.residuo_rotulo,
    residuo_quantidade:
      sugestao.quantidadeFaturada > 0
        ? String(sugestao.quantidadeFaturada)
        : resumo.mtr.residuo_quantidade,
    residuo_unidade: sugestao.unidadeMedida || resumo.mtr.residuo_unidade,
    residuo_valor_unitario: moedaParaCampo(sugestao.valorUnitario) || resumo.mtr.residuo_valor_unitario,
    residuo_valor: moedaParaCampo(sugestao.valorResiduo) || resumo.mtr.residuo_valor,
    /** Nunca repõe do ticket — evita travar o peso ao reaplicar contrato durante a edição. */
    peso_liquido_kg: resumo.mtr.peso_liquido_kg,
  }
  return { ...resumo, mtr }
}

export { faturamentoRegistrosErroResumoFinanceiro } from './faturamentoRegistrosPersist'
