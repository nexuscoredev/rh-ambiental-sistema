/**
 * Espelha alterações da MTR nas coletas/tickets vinculados (resíduo, placa, motorista, peso, cliente, endereço).
 * Direção inversa à `sincronizarColetaParaMtr` em faturamentoOperacionalSync.
 */
import { parseNumeroCampo } from './faturamentoDesvinculacao'
import { sincronizarPesoEmResumoPendente } from './faturamentoOperacionalSync'
import {
  listaResiduosFromDetalhesMtr,
  residuoDetalhesVazio,
  type MtrResiduoDetalhesCampos,
} from './mtrClienteContratoAutofill'
import {
  extrairHerancaMtrParaPesagem,
  mesclarLinhasResiduoHerancaMtr,
  type MtrHerancaPesagem,
} from './mtrHerancaTicketPesagem'
import { supabase } from './supabase'
import { coletaCorrespondeResiduo, deveSegmentarTicketsPorMtr } from './ticketCardinalidadeResiduo'
import {
  isErroColunaResiduosItens,
  linhaVaziaResiduoPesagem,
  linhasComConteudo,
  parseResiduosItensJson,
  serializarResiduosItensDb,
  type ResiduoPesagemItem,
} from './residuosPesagem'

export type MtrSnapshotParaSync = {
  programacao_id?: string | null
  cliente?: string | null
  gerador?: string | null
  endereco?: string | null
  cidade?: string | null
  tipo_residuo?: string | null
  quantidade?: number | null
  unidade?: string | null
  detalhes?: unknown
}

export type SincronizarMtrParaColetasResult = {
  ok: boolean
  coletasAtualizadas: number
  message?: string
}

type ColetaSyncRow = {
  id: string
  numero_coleta: number | null
  tipo_residuo: string | null
  residuos_itens?: unknown
  peso_liquido: number | null
  motorista: string | null
  motorista_nome: string | null
  placa: string | null
  mtr_id: string | null
  cliente?: string | null
  endereco?: string | null
  cidade?: string | null
}

const COLETA_SYNC_SELECT =
  'id, numero_coleta, tipo_residuo, residuos_itens, peso_liquido, motorista, motorista_nome, placa, mtr_id, cliente, endereco, cidade'

function ordenarColetas(rows: ColetaSyncRow[]): ColetaSyncRow[] {
  return [...rows].sort((a, b) => (Number(a.numero_coleta) || 0) - (Number(b.numero_coleta) || 0))
}

function residuoCamposFromDetalhesJson(det: Record<string, unknown>): MtrResiduoDetalhesCampos {
  const r = det.residuo
  if (!r || typeof r !== 'object') return residuoDetalhesVazio()
  const o = r as Record<string, unknown>
  return {
    fonte_origem: String(o.fonte_origem ?? '').trim() || 'Industrial',
    caracterizacao: String(o.caracterizacao ?? '').trim(),
    estado_fisico: String(o.estado_fisico ?? '').trim() || 'SÓLIDO',
    acondicionamento: String(o.acondicionamento ?? '').trim(),
    quantidade_aproximada: String(o.quantidade_aproximada ?? '').trim(),
    onu: String(o.onu ?? '').trim(),
  }
}

function listaCamposFromMtrRow(mtr: Record<string, unknown>): MtrResiduoDetalhesCampos[] {
  const det = mtr.detalhes
  if (!det || typeof det !== 'object') return [residuoDetalhesVazio()]
  const d = det as Record<string, unknown>
  return listaResiduosFromDetalhesMtr({
    residuo: residuoCamposFromDetalhesJson(d),
    residuos_lista: Array.isArray(d.residuos_lista)
      ? (d.residuos_lista as MtrResiduoDetalhesCampos[])
      : undefined,
  })
}

function mtrRowFromSnapshot(snapshot: MtrSnapshotParaSync): Record<string, unknown> {
  return {
    tipo_residuo: snapshot.tipo_residuo,
    quantidade: snapshot.quantidade,
    unidade: snapshot.unidade,
    detalhes: snapshot.detalhes,
    programacao_id: snapshot.programacao_id,
  }
}

/** Garante ao menos uma linha de resíduo (detalhes ou tipo no topo da MTR). */
export function linhasResiduoMtrParaSync(mtrRow: Record<string, unknown>): ResiduoPesagemItem[] {
  const heranca = extrairHerancaMtrParaPesagem(mtrRow)
  const comConteudo = linhasComConteudo(heranca.linhas_residuo)
  if (comConteudo.length > 0) return comConteudo

  const topo = String(mtrRow.tipo_residuo ?? heranca.tipo_residuo ?? '').trim()
  if (topo) {
    return [{ ...linhaVaziaResiduoPesagem(), texto: topo }]
  }
  return []
}

export function patchDadosComunsColetaDesdeMtr(mtrRow: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const cliente = String(mtrRow.cliente ?? '').trim()
  const gerador = String(mtrRow.gerador ?? '').trim()
  if (cliente) patch.cliente = cliente
  const endereco = String(mtrRow.endereco ?? '').trim()
  if (endereco) patch.endereco = endereco
  const cidade = String(mtrRow.cidade ?? '').trim()
  if (cidade) patch.cidade = cidade
  if (gerador && !cliente) patch.cliente = gerador
  return patch
}

function pesoKgFromMtrResiduo(
  campos: MtrResiduoDetalhesCampos | null,
  quantidadeTopo: number | null,
  segmentar: boolean,
  totalLinhas: number
): number | null {
  const q = campos ? parseNumeroCampo(campos.quantidade_aproximada) : 0
  if (q > 0) return q
  if (
    !segmentar &&
    quantidadeTopo != null &&
    Number.isFinite(quantidadeTopo) &&
    quantidadeTopo > 0
  ) {
    return quantidadeTopo
  }
  if (
    segmentar &&
    quantidadeTopo != null &&
    Number.isFinite(quantidadeTopo) &&
    quantidadeTopo > 0 &&
    totalLinhas === 1
  ) {
    return quantidadeTopo
  }
  return null
}

/** Escolhe a linha da MTR que alimenta o ticket da coleta. */
export function resolverLinhaMtrParaColeta(
  coleta: {
    tipo_residuo?: string | null
    residuos_itens?: ResiduoPesagemItem[] | null | unknown
  },
  linhasMtr: ResiduoPesagemItem[],
  listaCampos: MtrResiduoDetalhesCampos[],
  indiceFallback: number,
  segmentar: boolean
): { linha: ResiduoPesagemItem; campos: MtrResiduoDetalhesCampos | null } {
  const comConteudo = linhasComConteudo(linhasMtr)
  if (comConteudo.length === 0) {
    return { linha: linhaVaziaResiduoPesagem(), campos: null }
  }

  if (segmentar) {
    const coletaMatch = {
      tipo_residuo: coleta.tipo_residuo,
      residuos_itens: parseResiduosItensJson(coleta.residuos_itens) ?? null,
    }
    const encontrada = comConteudo.find((l) => coletaCorrespondeResiduo(coletaMatch, l.texto))
    const idx = encontrada
      ? comConteudo.indexOf(encontrada)
      : Math.min(indiceFallback, comConteudo.length - 1)
    const linha = encontrada ?? comConteudo[idx]!
    const campos = listaCampos[idx] ?? listaCampos[0] ?? null
    return { linha, campos }
  }

  const linha = comConteudo[Math.min(indiceFallback, comConteudo.length - 1)]!
  return { linha, campos: listaCampos[Math.min(indiceFallback, listaCampos.length - 1)] ?? listaCampos[0] ?? null }
}

export function montarPatchColetaDesdeMtr(
  coleta: Pick<
    ColetaSyncRow,
    'tipo_residuo' | 'residuos_itens' | 'peso_liquido' | 'motorista' | 'placa'
  >,
  linhaMtr: ResiduoPesagemItem,
  campos: MtrResiduoDetalhesCampos | null,
  heranca: Pick<MtrHerancaPesagem, 'placa' | 'motorista'>,
  quantidadeTopo: number | null,
  segmentar: boolean,
  totalLinhasMtr: number,
  patchComum?: Record<string, unknown>
): Record<string, unknown> {
  const existentes = parseResiduosItensJson(coleta.residuos_itens) ?? []
  const merged = mesclarLinhasResiduoHerancaMtr(
    existentes.length > 0 ? existentes : [linhaVaziaResiduoPesagem()],
    [linhaMtr]
  )
  const texto = linhaMtr.texto.trim()
  const patch: Record<string, unknown> = { ...(patchComum ?? {}) }

  if (texto) patch.tipo_residuo = texto

  const motorista = heranca.motorista.trim()
  if (motorista) {
    patch.motorista = motorista
    patch.motorista_nome = motorista
  }
  if (heranca.placa.trim()) patch.placa = heranca.placa.trim()

  const pesoKg = pesoKgFromMtrResiduo(campos, quantidadeTopo, segmentar, totalLinhasMtr)
  const mergedComPeso = [...merged]
  if (pesoKg != null && pesoKg > 0) {
    const temPesoOperacional = mergedComPeso.some((l) => {
      const pl = l.peso_liquido.trim()
      return pl && parseNumeroCampo(pl) > 0
    })
    if (!temPesoOperacional) {
      mergedComPeso[0] = {
        ...(mergedComPeso[0] ?? linhaVaziaResiduoPesagem()),
        peso_liquido: String(pesoKg),
      }
      patch.peso_liquido = pesoKg
    }
  }

  const linhasGravar = linhasComConteudo(mergedComPeso)
  if (linhasGravar.length > 0) {
    patch.residuos_itens = serializarResiduosItensDb(linhasGravar)
  } else if (texto) {
    patch.residuos_itens = serializarResiduosItensDb([{ ...linhaMtr, texto }])
  }

  return patch
}

async function vincularColetasProgramacaoSemMtr(mtrId: string, programacaoId: string): Promise<void> {
  const { error } = await supabase
    .from('coletas')
    .update({ mtr_id: mtrId })
    .eq('programacao_id', programacaoId)
    .is('mtr_id', null)
  if (error) console.warn('[mtr→ticket] vincular coletas:', error.message)
}

async function listarColetasParaSync(
  mtrId: string,
  programacaoId: string | null | undefined
): Promise<ColetaSyncRow[]> {
  const { data, error } = await supabase
    .from('coletas')
    .select(COLETA_SYNC_SELECT)
    .eq('mtr_id', mtrId)
    .order('numero_coleta', { ascending: true })

  if (error) {
    console.warn('[mtr→ticket] listar coletas:', error.message)
    return []
  }

  let rows = (data ?? []) as ColetaSyncRow[]
  const pid = (programacaoId ?? '').trim()

  if (rows.length === 0 && pid) {
    await vincularColetasProgramacaoSemMtr(mtrId, pid)
    const retry = await supabase
      .from('coletas')
      .select(COLETA_SYNC_SELECT)
      .eq('mtr_id', mtrId)
      .order('numero_coleta', { ascending: true })
    if (retry.error) {
      console.warn('[mtr→ticket] listar coletas (retry):', retry.error.message)
      return []
    }
    rows = (retry.data ?? []) as ColetaSyncRow[]
  }

  return ordenarColetas(rows)
}

async function aplicarPatchColetaEControleMassa(
  coletaId: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  if (Object.keys(patch).length === 0) return true

  let { error: errColeta } = await supabase.from('coletas').update(patch).eq('id', coletaId)

  if (errColeta && patch.residuos_itens && isErroColunaResiduosItens(errColeta)) {
    const { residuos_itens, ...semItens } = patch
    void residuos_itens
    const retry = await supabase.from('coletas').update(semItens).eq('id', coletaId)
    errColeta = retry.error
  }

  if (errColeta) {
    console.warn('[mtr→ticket] coleta:', errColeta.message)
    return false
  }

  const patchMassa: Record<string, unknown> = {}
  if (patch.cliente != null) patchMassa.cliente = patch.cliente
  if (patch.endereco != null) patchMassa.endereco = patch.endereco
  if (patch.cidade != null) patchMassa.cidade = patch.cidade
  if (patch.peso_liquido != null) patchMassa.peso_liquido = patch.peso_liquido
  if (patch.tipo_residuo != null) patchMassa.tipo_residuo = patch.tipo_residuo
  if (patch.residuos_itens != null) patchMassa.residuos_itens = patch.residuos_itens
  if (patch.motorista != null) patchMassa.motorista = patch.motorista
  if (patch.placa != null) patchMassa.placa = patch.placa
  if (patch.cliente != null) patchMassa.empresa = patch.cliente

  if (Object.keys(patchMassa).length === 0) return true

  let { error: errMassa } = await supabase
    .from('controle_massa')
    .update(patchMassa)
    .eq('coleta_id', coletaId)

  if (errMassa && patchMassa.residuos_itens && isErroColunaResiduosItens(errMassa)) {
    const { residuos_itens, ...semItens } = patchMassa
    void residuos_itens
    const retry = await supabase.from('controle_massa').update(semItens).eq('coleta_id', coletaId)
    errMassa = retry.error
  }

  if (errMassa) {
    console.warn('[mtr→ticket] controle_massa:', errMassa.message)
  }

  return true
}

/**
 * Após gravar/editar MTR: atualiza todas as coletas/tickets com `mtr_id` (ou da mesma programação).
 * Usa `snapshot` do formulário quando informado (evita ler versão antiga do banco).
 */
export async function sincronizarMtrParaColetasVinculadas(
  mtrId: string,
  opts?: { programacaoId?: string | null; snapshot?: MtrSnapshotParaSync }
): Promise<SincronizarMtrParaColetasResult> {
  const mid = (mtrId ?? '').trim()
  if (!mid) {
    return { ok: false, coletasAtualizadas: 0, message: 'MTR sem identificador.' }
  }

  let mtrRow: Record<string, unknown>

  if (opts?.snapshot) {
    mtrRow = {
      ...mtrRowFromSnapshot(opts.snapshot),
      cliente: opts.snapshot.cliente,
      gerador: opts.snapshot.gerador,
      endereco: opts.snapshot.endereco,
      cidade: opts.snapshot.cidade,
    }
  } else {
    const { data: mtr, error } = await supabase
      .from('mtrs')
      .select(
        'id, tipo_residuo, quantidade, unidade, programacao_id, cliente, gerador, endereco, cidade, detalhes'
      )
      .eq('id', mid)
      .maybeSingle()

    if (error || !mtr) {
      const msg = error?.message ?? 'MTR não encontrada.'
      if (error) console.warn('[mtr→ticket] carregar MTR:', msg)
      return { ok: false, coletasAtualizadas: 0, message: msg }
    }
    mtrRow = mtr as Record<string, unknown>
  }

  const heranca = extrairHerancaMtrParaPesagem(mtrRow)
  const linhasMtr = linhasResiduoMtrParaSync(mtrRow)
  if (linhasMtr.length === 0) {
    return {
      ok: true,
      coletasAtualizadas: 0,
      message: 'MTR sem resíduo para espelhar no ticket.',
    }
  }

  const listaCampos = listaCamposFromMtrRow(mtrRow)
  const segmentar = deveSegmentarTicketsPorMtr(mid, heranca.linhas_residuo)
  const quantidadeTopo =
    mtrRow.quantidade != null && Number.isFinite(Number(mtrRow.quantidade))
      ? Number(mtrRow.quantidade)
      : null

  const progId =
    (opts?.programacaoId ?? opts?.snapshot?.programacao_id ?? mtrRow.programacao_id ?? '')
      .toString()
      .trim() || null
  const coletas = await listarColetasParaSync(mid, progId)

  if (coletas.length === 0) {
    return {
      ok: true,
      coletasAtualizadas: 0,
      message:
        'Nenhum ticket/coleta vinculado a esta MTR ainda. Gere o ticket no Controle de Massa após a pesagem.',
    }
  }

  const patchComum = patchDadosComunsColetaDesdeMtr(mtrRow)
  let atualizadas = 0

  for (let i = 0; i < coletas.length; i++) {
    const coleta = coletas[i]!
    const { linha, campos } = resolverLinhaMtrParaColeta(
      coleta,
      linhasMtr,
      listaCampos,
      i,
      segmentar
    )
    if (!linha.texto.trim() && !patchComum.tipo_residuo) continue

    const patch = montarPatchColetaDesdeMtr(
      coleta,
      linha.texto.trim() ? linha : { ...linhaVaziaResiduoPesagem(), texto: String(mtrRow.tipo_residuo ?? '') },
      campos,
      heranca,
      quantidadeTopo,
      segmentar,
      linhasMtr.length,
      patchComum
    )

    const ok = await aplicarPatchColetaEControleMassa(coleta.id, patch)
    if (ok) {
      atualizadas += 1
      const syncResumo = await sincronizarPesoEmResumoPendente(coleta.id)
      if (!syncResumo.ok) {
        console.warn('[mtr→ticket] resumo pendente:', syncResumo.message)
      }
    }
  }

  return { ok: true, coletasAtualizadas: atualizadas }
}
