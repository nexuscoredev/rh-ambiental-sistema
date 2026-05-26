import { listarColetaIdsPorMtr } from './excluirOperacionalCascata'
import {
  sincronizarMtrParaColetasVinculadas,
  vincularColetasProgramacaoAMtr,
} from './mtrOperacionalSync'
import { supabase } from './supabase'
import { mensagemErroSupabase } from './supabaseErrors'

export type MtrVinculoContexto = {
  mtrId: string
  mtrNumero: string
  programacaoId: string | null
  cliente: string
}

export type ColetaCandidataVinculo = {
  id: string
  numeroColeta: string
  cliente: string
  programacaoId: string | null
  podeVincular: boolean
  motivoBloqueio: string | null
}

type ColetaCandidataRow = {
  id: string
  numero: string | null
  numero_coleta: number | null
  cliente: string | null
  programacao_id: string | null
  mtr_id: string | null
  created_at?: string | null
}

/** Separa IDs elegíveis (sem MTR ou já desta MTR) dos bloqueados (outra MTR). */
export function separarColetasParaVinculo(
  coletaIds: string[],
  rows: { id: string; mtr_id: string | null }[],
  mtrId: string
): { elegiveis: string[]; bloqueadas: string[] } {
  const mid = mtrId.trim()
  const porId = new Map(rows.map((r) => [r.id, r]))
  const elegiveis: string[] = []
  const bloqueadas: string[] = []

  for (const id of coletaIds) {
    const row = porId.get(id)
    if (!row) continue
    const vinc = (row.mtr_id ?? '').trim()
    if (!vinc || vinc === mid) elegiveis.push(id)
    else bloqueadas.push(id)
  }

  return { elegiveis, bloqueadas }
}

export async function carregarContextoVinculoMtr(
  mtrId: string
): Promise<MtrVinculoContexto | null> {
  const mid = mtrId.trim()
  if (!mid) return null

  const { data, error } = await supabase
    .from('mtrs')
    .select('id, numero, programacao_id, cliente')
    .eq('id', mid)
    .maybeSingle()

  if (error || !data) return null

  return {
    mtrId: String(data.id),
    mtrNumero: String(data.numero ?? ''),
    programacaoId: data.programacao_id ? String(data.programacao_id) : null,
    cliente: String(data.cliente ?? '').trim(),
  }
}

export async function vincularColetasPorProgramacaoDaMtr(
  mtrId: string
): Promise<{ ok: true; vinculadas: number } | { ok: false; message: string }> {
  const ctx = await carregarContextoVinculoMtr(mtrId)
  if (!ctx) return { ok: false, message: 'MTR não encontrada.' }
  if (!ctx.programacaoId) {
    return {
      ok: false,
      message: 'Esta MTR não tem programação vinculada — escolha a coleta manualmente.',
    }
  }

  const res = await vincularColetasProgramacaoAMtr(ctx.mtrId, ctx.programacaoId)
  if (!res.ok) {
    return { ok: false, message: res.message ?? 'Não foi possível vincular coletas da programação.' }
  }
  if (res.vinculadas > 0) {
    await sincronizarMtrParaColetasVinculadas(ctx.mtrId, {
      programacaoId: ctx.programacaoId,
    })
  }
  return { ok: true, vinculadas: res.vinculadas }
}

export async function listarColetasCandidatasVinculo(mtrId: string): Promise<{
  contexto: MtrVinculoContexto | null
  candidatas: ColetaCandidataVinculo[]
  erro: string | null
}> {
  const ctx = await carregarContextoVinculoMtr(mtrId)
  if (!ctx) {
    return { contexto: null, candidatas: [], erro: 'MTR não encontrada.' }
  }

  let query = supabase
    .from('coletas')
    .select('id, numero, numero_coleta, cliente, programacao_id, mtr_id, created_at')
    .order('created_at', { ascending: false })
    .limit(80)

  if (ctx.programacaoId) {
    query = query.eq('programacao_id', ctx.programacaoId)
  } else {
    query = query.is('mtr_id', null)
  }

  const { data, error } = await query
  if (error) {
    return {
      contexto: ctx,
      candidatas: [],
      erro: mensagemErroSupabase(error, 'Não foi possível listar coletas.'),
    }
  }

  let rows = (data ?? []) as ColetaCandidataRow[]

  if (!ctx.programacaoId && ctx.cliente) {
    const alvo = ctx.cliente.toLowerCase()
    rows = rows.filter((r) => (r.cliente ?? '').toLowerCase().includes(alvo) || alvo.includes((r.cliente ?? '').toLowerCase()))
  }

  const candidatas: ColetaCandidataVinculo[] = rows.map((r) => {
    const vinc = (r.mtr_id ?? '').trim()
    const jaEsta = vinc === ctx.mtrId
    const outra = vinc && vinc !== ctx.mtrId
    return {
      id: String(r.id),
      numeroColeta:
        r.numero_coleta != null ? String(r.numero_coleta) : (r.numero ?? '').trim() || '—',
      cliente: (r.cliente ?? '').trim() || '—',
      programacaoId: r.programacao_id ? String(r.programacao_id) : null,
      podeVincular: !outra && !jaEsta,
      motivoBloqueio: jaEsta
        ? 'Já vinculada a esta MTR'
        : outra
          ? 'Vinculada a outra MTR'
          : null,
    }
  })

  candidatas.sort((a, b) => {
    if (a.podeVincular !== b.podeVincular) return a.podeVincular ? -1 : 1
    return a.numeroColeta.localeCompare(b.numeroColeta, 'pt-BR')
  })

  return { contexto: ctx, candidatas, erro: null }
}

export async function vincularColetasSelecionadasAMtr(
  mtrId: string,
  coletaIds: string[]
): Promise<{ ok: true; vinculadas: number } | { ok: false; message: string }> {
  const mid = mtrId.trim()
  const ids = [...new Set(coletaIds.map((id) => id.trim()).filter(Boolean))]
  if (!mid) return { ok: false, message: 'MTR inválida.' }
  if (!ids.length) return { ok: false, message: 'Selecione ao menos uma coleta.' }

  const { data: rows, error: errLoad } = await supabase
    .from('coletas')
    .select('id, mtr_id, programacao_id')
    .in('id', ids)

  if (errLoad) {
    return {
      ok: false,
      message: mensagemErroSupabase(errLoad, 'Não foi possível validar as coletas.'),
    }
  }

  const { elegiveis, bloqueadas } = separarColetasParaVinculo(
    ids,
    (rows ?? []) as { id: string; mtr_id: string | null }[],
    mid
  )

  if (!elegiveis.length) {
    return {
      ok: false,
      message: bloqueadas.length
        ? 'As coletas selecionadas já estão vinculadas a outra MTR.'
        : 'Nenhuma coleta válida para vincular.',
    }
  }

  const { error } = await supabase.from('coletas').update({ mtr_id: mid }).in('id', elegiveis)
  if (error) {
    return {
      ok: false,
      message: mensagemErroSupabase(error, 'Não foi possível vincular as coletas.'),
    }
  }

  const ctx = await carregarContextoVinculoMtr(mid)
  if (ctx?.programacaoId) {
    await sincronizarMtrParaColetasVinculadas(mid, { programacaoId: ctx.programacaoId })
  }

  return { ok: true, vinculadas: elegiveis.length }
}

/** Tenta programação; devolve quantas coletas ficaram ligadas à MTR (antes + depois). */
export async function resolverVinculoMtrGerenciador(mtrId: string): Promise<{
  coletaIds: string[]
  vinculadasAgora: number
  message: string | null
}> {
  const antes = await listarColetaIdsPorMtr(supabase, mtrId)
  if (antes.length) {
    return { coletaIds: antes, vinculadasAgora: 0, message: null }
  }

  const auto = await vincularColetasPorProgramacaoDaMtr(mtrId)
  const depois = await listarColetaIdsPorMtr(supabase, mtrId)

  if (depois.length) {
    return {
      coletaIds: depois,
      vinculadasAgora: auto.ok ? auto.vinculadas : depois.length,
      message: null,
    }
  }

  if (!auto.ok) {
    return { coletaIds: [], vinculadasAgora: 0, message: auto.message }
  }

  return {
    coletaIds: [],
    vinculadasAgora: 0,
    message: 'Nenhuma coleta livre na programação desta MTR.',
  }
}
