/**
 * Sincroniza alterações operacionais (peso, resíduo, ticket) entre coleta, controle_massa, MTR e resumo financeiro pendente.
 */
import {
  equipamentoContratoInicial,
  parseEquipamentosContratoJsonb,
  parseVeiculosContratoJsonb,
  veiculoContratoInicial,
  type EquipamentoContratoItem,
  type VeiculoContratoItem,
} from './clienteContratoCadastro'
import {
  listaResiduosFromDetalhesMtr,
  type MtrResiduoDetalhesCampos,
} from './mtrClienteContratoAutofill'
import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import {
  criarResumoFinanceiroDoOperacional,
  parseNumeroCampo,
  parseResumoFinanceiroJson,
  pesoParaCampo,
  resumoFinanceiroParaJsonb,
  type ResumoFinanceiroDesvinculado,
} from './faturamentoDesvinculacao'
import type { ResultadoPrecoContrato } from './faturamentoPrecoContrato'
import {
  criarResumoFinanceiroConsolidado,
  escolherColetaLiderFaturamento,
} from './faturamentoConsolidacaoMtr'
import { montarLinhaTicketResumo } from './faturamentoResumoTicket'

type ColetaOperacionalRow = {
  id: string
  mtr_id: string | null
  peso_liquido: number | null
  peso_tara: number | null
  peso_bruto: number | null
  tipo_residuo: string | null
  numero_coleta: number | null
  numero: string
  /** Número do ticket na tabela `coletas` (`ticket_numero`). */
  ticket_numero: string | null
}

const COLETAS_OPERACIONAL_SELECT =
  'id, mtr_id, peso_liquido, peso_tara, peso_bruto, tipo_residuo, numero_coleta, numero, ticket_numero'

function mapColetaOperacionalRow(raw: Record<string, unknown>): ColetaOperacionalRow {
  return {
    id: String(raw.id),
    mtr_id: raw.mtr_id != null ? String(raw.mtr_id) : null,
    peso_liquido: raw.peso_liquido as number | null,
    peso_tara: raw.peso_tara as number | null,
    peso_bruto: raw.peso_bruto as number | null,
    tipo_residuo: raw.tipo_residuo != null ? String(raw.tipo_residuo) : null,
    numero_coleta: raw.numero_coleta as number | null,
    numero: String(raw.numero ?? ''),
    ticket_numero:
      typeof raw.ticket_numero === 'string' && raw.ticket_numero.trim()
        ? raw.ticket_numero.trim()
        : null,
  }
}

function viewRowMinima(c: ColetaOperacionalRow, coletaId: string): FaturamentoResumoViewRow {
  return {
    coleta_id: coletaId,
    numero_coleta: c.numero_coleta,
    numero: c.numero,
    tipo_residuo: c.tipo_residuo,
    peso_tara: c.peso_tara,
    peso_bruto: c.peso_bruto,
    peso_liquido: c.peso_liquido,
    ticket_comprovante: c.ticket_numero,
  } as FaturamentoResumoViewRow
}

async function lerColetaOperacional(
  coletaId: string
): Promise<{ ok: true; row: ColetaOperacionalRow } | { ok: false; message: string }> {
  const id = coletaId.trim()
  if (!id) return { ok: false, message: 'ID da coleta inválido.' }

  const { data, error } = await supabase
    .from('coletas')
    .select(COLETAS_OPERACIONAL_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message || 'Não foi possível carregar a coleta.' }
  }
  if (!data?.id) {
    return { ok: false, message: 'Coleta não encontrada.' }
  }
  return { ok: true, row: mapColetaOperacionalRow(data as Record<string, unknown>) }
}

async function lerColetasMesmaMtr(
  coletaId: string
): Promise<{ ok: true; grupo: ColetaOperacionalRow[] } | { ok: false; message: string }> {
  const base = await lerColetaOperacional(coletaId)
  if (!base.ok) return base

  const row = base.row
  const mid = (row.mtr_id ?? '').trim()
  if (!mid) return { ok: true, grupo: [row] }

  const { data, error } = await supabase
    .from('coletas')
    .select(COLETAS_OPERACIONAL_SELECT)
    .eq('mtr_id', mid)
    .not('ticket_impresso_em', 'is', null)

  if (error) {
    return { ok: false, message: error.message || 'Não foi possível carregar coletas da MTR.' }
  }

  const lista = ((data ?? []) as Record<string, unknown>[]).map(mapColetaOperacionalRow)
  return { ok: true, grupo: lista.length > 0 ? lista : [row] }
}

/** Espelha peso/tipo na MTR ligada à coleta. */
export async function sincronizarColetaParaMtr(coletaId: string): Promise<void> {
  const res = await lerColetaOperacional(coletaId)
  if (!res.ok || !res.row.mtr_id) return
  const row = res.row

  const patch: { quantidade?: number; tipo_residuo?: string; unidade?: string } = {}
  if (row.peso_liquido != null && Number.isFinite(Number(row.peso_liquido))) {
    patch.quantidade = Number(row.peso_liquido)
  }
  if ((row.tipo_residuo ?? '').trim()) {
    patch.tipo_residuo = row.tipo_residuo!.trim()
    patch.unidade = 'kg'
  }

  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('mtrs').update(patch).eq('id', row.mtr_id)
  if (error) {
    console.warn('[faturamento] sync MTR:', error.message)
  }
}

/** Atualiza pesos no `resumo_financeiro` pendente (mantém valores já editados no faturamento). */
export async function sincronizarPesoEmResumoPendente(
  coletaId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const resGrupo = await lerColetasMesmaMtr(coletaId)
  if (!resGrupo.ok) return resGrupo
  const grupo = resGrupo.grupo

  const pesoTotal = grupo.reduce((s, c) => s + (Number(c.peso_liquido) || 0), 0)
  const liderId = escolherColetaLiderFaturamento(
    grupo.map((c) => viewRowMinima(c, c.id))
  ).coleta_id

  for (const cRow of grupo) {
    const id = cRow.id
    const { data: reg } = await supabase
      .from('faturamento_registros')
      .select('id, resumo_financeiro, status')
      .eq('coleta_id', id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!reg?.id || reg.status !== 'pendente') continue

    const resumo = parseResumoFinanceiroJson(reg.resumo_financeiro)
    if (!resumo) continue

    const linha = montarLinhaTicketResumo(viewRowMinima(cRow, id))

    const linhasTickets = (resumo.ticket.linhas_tickets ?? []).map((lt) =>
      lt.coleta_numero === linha.coleta_numero || lt.ticket_numero === linha.ticket_numero
        ? { ...lt, ...linha }
        : lt
    )
    if (linhasTickets.length === 0) linhasTickets.push(linha)

    const ehLider = id === liderId
    const next: ResumoFinanceiroDesvinculado = {
      ...resumo,
      ticket: {
        ...resumo.ticket,
        linhas_tickets: linhasTickets,
        ...(ehLider && grupo.length > 1
          ? {
              peso_liquido_kg: pesoParaCampo(pesoTotal),
              peso_tara_kg: linha.peso_tara_kg,
              peso_bruto_kg: linha.peso_bruto_kg,
            }
          : {
              peso_tara_kg: linha.peso_tara_kg,
              peso_bruto_kg: linha.peso_bruto_kg,
              peso_liquido_kg: linha.peso_liquido_kg,
            }),
      },
      mtr:
        ehLider || !resumo.consolidacao_mtr
          ? {
              ...resumo.mtr,
              peso_liquido_kg: pesoParaCampo(
                grupo.length > 1 && ehLider ? pesoTotal : cRow.peso_liquido
              ),
              residuo_quantidade: pesoParaCampo(
                grupo.length > 1 && ehLider ? pesoTotal : cRow.peso_liquido
              ),
            }
          : resumo.mtr,
    }

    const { error } = await supabase
      .from('faturamento_registros')
      .update({
        resumo_financeiro: resumoFinanceiroParaJsonb(next),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reg.id)

    if (error) {
      return {
        ok: false,
        message: error.message || 'Não foi possível atualizar o resumo de faturamento.',
      }
    }
  }

  return { ok: true }
}

function valorParaCampoContrato(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(Math.round(n * 100) / 100)
}

function normalizarNumeroColeta(v: string | number | null | undefined): string {
  return String(v ?? '').trim()
}

function patchVeiculoContrato(
  lista: VeiculoContratoItem[],
  rotulo: string,
  valor: number
): VeiculoContratoItem[] {
  const base = lista.length > 0 ? [...lista] : [veiculoContratoInicial()]
  const primeiro = base[0]!
  base[0] = {
    ...primeiro,
    tipo_veiculo: rotulo.trim() || primeiro.tipo_veiculo,
    sem_custo: valor <= 0,
    valor: valorParaCampoContrato(valor) || primeiro.valor,
  }
  return base
}

function patchEquipamentoContrato(
  lista: EquipamentoContratoItem[],
  rotulo: string,
  valor: number
): EquipamentoContratoItem[] {
  const base = lista.length > 0 ? [...lista] : [equipamentoContratoInicial()]
  const primeiro = base[0]!
  base[0] = {
    ...primeiro,
    descricao: rotulo.trim() || primeiro.descricao,
    com_custo: valor > 0,
    valor: valorParaCampoContrato(valor) || primeiro.valor,
  }
  return base
}

function atualizarQuantidadesResiduosLista(
  lista: MtrResiduoDetalhesCampos[],
  quantidades: string[]
): MtrResiduoDetalhesCampos[] {
  if (lista.length === 0) return lista
  return lista.map((l, i) => ({
    ...l,
    quantidade_aproximada: (quantidades[i] ?? quantidades[0] ?? '').trim() || l.quantidade_aproximada,
  }))
}

async function aplicarTicketResumoNasColetas(
  grupo: ColetaOperacionalRow[],
  resumo: ResumoFinanceiroDesvinculado
): Promise<string | null> {
  const linhas = resumo.ticket.linhas_tickets ?? []
  const valorTicketUnico = parseNumeroCampo(resumo.ticket.valor_total)

  if (linhas.length > 0) {
    for (const lt of linhas) {
      const alvo = grupo.find(
        (c) =>
          normalizarNumeroColeta(c.numero_coleta) === normalizarNumeroColeta(lt.coleta_numero) ||
          normalizarNumeroColeta(c.numero) === normalizarNumeroColeta(lt.coleta_numero)
      )
      if (!alvo) continue

      const patch: Record<string, unknown> = {}
      const pl = parseNumeroCampo(lt.peso_liquido_kg)
      const pt = parseNumeroCampo(lt.peso_tara_kg)
      const pb = parseNumeroCampo(lt.peso_bruto_kg)
      if (pl > 0) patch.peso_liquido = pl
      if (pt > 0) patch.peso_tara = pt
      if (pb > 0) patch.peso_bruto = pb
      if (lt.residuo.trim()) patch.tipo_residuo = lt.residuo.trim()
      if (!resumo.ticket.eh_consolidado_mtr && valorTicketUnico > 0) {
        patch.valor_coleta = valorTicketUnico
      }

      if (Object.keys(patch).length === 0) continue
      const { error } = await supabase.from('coletas').update(patch).eq('id', alvo.id)
      if (error) return error.message
    }
    return null
  }

  const unica = grupo[0]
  if (!unica) return null
  const patch: Record<string, unknown> = {}
  const pl = parseNumeroCampo(resumo.ticket.peso_liquido_kg)
  const pt = parseNumeroCampo(resumo.ticket.peso_tara_kg)
  const pb = parseNumeroCampo(resumo.ticket.peso_bruto_kg)
  if (pl > 0) patch.peso_liquido = pl
  if (pt > 0) patch.peso_tara = pt
  if (pb > 0) patch.peso_bruto = pb
  if (resumo.ticket.tipo_residuo.trim()) patch.tipo_residuo = resumo.ticket.tipo_residuo.trim()
  if (valorTicketUnico > 0) patch.valor_coleta = valorTicketUnico
  if (Object.keys(patch).length === 0) return null
  const { error } = await supabase.from('coletas').update(patch).eq('id', unica.id)
  return error?.message ?? null
}

/**
 * Espelha o resumo editado no faturamento na MTR (`mtrs` + `detalhes`) e nas coletas (ticket/pesagem).
 */
export async function aplicarResumoFinanceiroNaOperacional(
  coletaIdReferencia: string,
  resumo: ResumoFinanceiroDesvinculado
): Promise<{ ok: true } | { ok: false; message: string }> {
  const resGrupo = await lerColetasMesmaMtr(coletaIdReferencia)
  if (!resGrupo.ok) return resGrupo
  const grupo = resGrupo.grupo

  const errColetas = await aplicarTicketResumoNasColetas(grupo, resumo)
  if (errColetas) {
    return { ok: false, message: `Ticket/coleta: ${errColetas}` }
  }

  const lider =
    grupo.find((c) => c.id === coletaIdReferencia.trim()) ??
    [...grupo].sort((a, b) => (a.numero_coleta ?? 0) - (b.numero_coleta ?? 0))[0]
  if (!lider?.mtr_id) {
    return { ok: true }
  }

  const m = resumo.mtr
  const camVal = parseNumeroCampo(m.caminhao_valor)
  const eqVal = parseNumeroCampo(m.equipamento_valor)
  const qtd = parseNumeroCampo(m.residuo_quantidade || m.peso_liquido_kg)
  const unidade = (m.residuo_unidade || 'kg').trim() || 'kg'

  const { data: mtrRow, error: errLoad } = await supabase
    .from('mtrs')
    .select('detalhes, tipo_residuo, quantidade, unidade')
    .eq('id', lider.mtr_id)
    .maybeSingle()

  if (errLoad) {
    return { ok: false, message: errLoad.message || 'Não foi possível carregar a MTR.' }
  }

  const detRaw = mtrRow?.detalhes
  const detBase =
    detRaw && typeof detRaw === 'object' && !Array.isArray(detRaw)
      ? ({ ...(detRaw as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const veiculos = patchVeiculoContrato(
    parseVeiculosContratoJsonb(detBase.contrato_veiculos),
    m.caminhao_rotulo,
    camVal
  )
  const equipamentos = patchEquipamentoContrato(
    parseEquipamentosContratoJsonb(detBase.contrato_equipamentos),
    m.equipamento_rotulo,
    eqVal
  )

  const residuoPrincipal =
    detBase.residuo && typeof detBase.residuo === 'object'
      ? (detBase.residuo as MtrResiduoDetalhesCampos)
      : {
          fonte_origem: 'Industrial',
          caracterizacao: '',
          estado_fisico: 'SÓLIDO',
          acondicionamento: '',
          quantidade_aproximada: '',
          onu: '',
        }

  const listaAtual = listaResiduosFromDetalhesMtr({
    residuo: residuoPrincipal,
    residuos_lista: Array.isArray(detBase.residuos_lista)
      ? (detBase.residuos_lista as MtrResiduoDetalhesCampos[])
      : undefined,
  })

  const qtdsPorColeta =
    (resumo.ticket.linhas_tickets ?? []).length > 0
      ? (resumo.ticket.linhas_tickets ?? []).map((lt) => lt.peso_liquido_kg)
      : grupo.map((c) => pesoParaCampo(c.peso_liquido))

  const listaNova = atualizarQuantidadesResiduosLista(listaAtual, qtdsPorColeta)

  const patchMtr: Record<string, unknown> = {
    detalhes: {
      ...detBase,
      contrato_veiculos: veiculos,
      contrato_equipamentos: equipamentos,
      residuo: listaNova[0] ?? residuoPrincipal,
      residuos_lista: listaNova.length > 1 ? listaNova : undefined,
      faturamento_espelho_mtr: {
        caminhao_valor: m.caminhao_valor,
        equipamento_valor: m.equipamento_valor,
        residuo_valor: m.residuo_valor,
        residuo_valor_unitario: m.residuo_valor_unitario,
        residuo_quantidade: m.residuo_quantidade,
        residuo_unidade: m.residuo_unidade,
        atualizado_em: new Date().toISOString(),
      },
    },
  }

  if (qtd > 0) patchMtr.quantidade = qtd
  if (unidade) patchMtr.unidade = unidade
  const tipoTopo = m.residuo_rotulo.trim()
  if (tipoTopo) patchMtr.tipo_residuo = tipoTopo

  const { error: errMtr } = await supabase.from('mtrs').update(patchMtr).eq('id', lider.mtr_id)
  if (errMtr) {
    return { ok: false, message: errMtr.message || 'Não foi possível atualizar a MTR.' }
  }

  return { ok: true }
}

/** Após gravar peso / alterar coleta: MTR + resumo pendente. */
export async function sincronizarAposAlteracaoOperacionalColeta(
  coletaId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await sincronizarColetaParaMtr(coletaId)
    const resumo = await sincronizarPesoEmResumoPendente(coletaId)
    if (!resumo.ok) return resumo
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao sincronizar dados operacionais.'
    return { ok: false, message: msg }
  }
}

/** Recalcula resumo a partir dos dados atuais da coleta + contrato. */
export function recalcularResumoDesdeOperacional(
  lider: FaturamentoResumoViewRow,
  grupo: FaturamentoResumoViewRow[] | undefined,
  sugestao: ResultadoPrecoContrato | null,
  ctx?: { tipoCaminhao?: string | null; acondicionamento?: string | null }
): ResumoFinanceiroDesvinculado {
  if (grupo && grupo.length > 1) {
    return criarResumoFinanceiroConsolidado(lider, grupo, sugestao, ctx)
  }
  return criarResumoFinanceiroDoOperacional(lider, sugestao, ctx)
}

/** Grava resumo pendente na líder e sincroniza pesos nas coletas do grupo. */
export async function persistirResumoPendenteGrupoMtr(
  lider: FaturamentoResumoViewRow,
  grupo: FaturamentoResumoViewRow[],
  resumo: ResumoFinanceiroDesvinculado
): Promise<{ ok: true } | { ok: false; message: string }> {
  const agora = new Date().toISOString()
  const json = resumoFinanceiroParaJsonb(resumo)
  const liderId = lider.coleta_id

  const { data: regLider } = await supabase
    .from('faturamento_registros')
    .select('id')
    .eq('coleta_id', liderId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (regLider?.id) {
    const { error } = await supabase
      .from('faturamento_registros')
      .update({ resumo_financeiro: json, status: 'pendente', updated_at: agora })
      .eq('id', regLider.id)
    if (error) return { ok: false, message: error.message }
  } else {
    const { error } = await supabase.from('faturamento_registros').insert({
      coleta_id: liderId,
      status: 'pendente',
      resumo_financeiro: json,
      updated_at: agora,
    })
    if (error) return { ok: false, message: error.message }
  }

  for (const c of grupo) {
    if (c.coleta_id !== liderId) {
      await sincronizarPesoEmResumoPendente(c.coleta_id)
    }
  }

  const syncOp = await aplicarResumoFinanceiroNaOperacional(liderId, resumo)
  if (!syncOp.ok) return syncOp

  return { ok: true }
}

/** Após gravar MTR: espelha tipo/quantidade nas coletas da mesma programação. */
export async function sincronizarColetasProgramacaoDesdeMtr(
  programacaoId: string | null | undefined,
  patch: { tipo_residuo?: string | null; quantidade?: number | null }
): Promise<void> {
  const pid = (programacaoId ?? '').trim()
  if (!pid) return

  const { data: coletas } = await supabase.from('coletas').select('id').eq('programacao_id', pid)

  const patchColeta: { tipo_residuo?: string; peso_liquido?: number } = {}
  if ((patch.tipo_residuo ?? '').trim()) patchColeta.tipo_residuo = patch.tipo_residuo!.trim()
  if (patch.quantidade != null && Number.isFinite(Number(patch.quantidade))) {
    patchColeta.peso_liquido = Number(patch.quantidade)
  }
  if (Object.keys(patchColeta).length === 0) return

  for (const c of coletas ?? []) {
    const id = String(c.id)
    await supabase.from('coletas').update(patchColeta).eq('id', id)
    await sincronizarAposAlteracaoOperacionalColeta(id)
  }
}
