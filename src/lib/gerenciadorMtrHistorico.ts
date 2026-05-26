import { buscarNomeGeradorPorProgramacaoMtr } from './mtrCadastroClienteAutofill'
import { resolverNomeGeradorMtr } from './mtrNomeGerador'
import { supabase } from './supabase'
import { mensagemErroSupabase } from './supabaseErrors'

export type MtrBaixadaHistoricoRow = {
  id: string
  numero: string
  gerador: string
  residuo: string
  quantidade: string
  data: string
  cliente: string
}

function formatarQuantidadeMtr(q: number | null, unidade: string | null): string {
  if (q == null || Number.isNaN(Number(q))) return ''
  const u = (unidade ?? '').trim()
  return u ? `${q} ${u}` : String(q)
}

export async function listarHistoricoMtrsBaixadas(): Promise<{
  rows: MtrBaixadaHistoricoRow[]
  erro: string | null
}> {
  const selectCols =
    'id, numero, gerador, tipo_residuo, quantidade, unidade, baixada_em, cliente, status'

  type MtrBaixadaDb = {
    id: string
    numero: string | null
    gerador: string | null
    tipo_residuo: string | null
    quantidade: number | null
    unidade: string | null
    baixada_em?: string | null
    cliente: string | null
    status: string | null
  }

  const queryPrincipal = () =>
    supabase
      .from('mtrs')
      .select(selectCols)
      .or('status.eq.Baixada,status.eq.baixada,baixada_em.not.is.null')
      .order('baixada_em', { ascending: false, nullsFirst: false })
      .limit(500)

  const principal = await queryPrincipal()
  let error = principal.error
  let linhasDb = (principal.data ?? []) as unknown as MtrBaixadaDb[]

  if (error) {
    const msg = String(error.message ?? '')
    const colBaixadaAusente =
      msg.includes('baixada_em') && (msg.includes('column') || msg.includes('does not exist'))
    if (colBaixadaAusente) {
      const fallback = await supabase
        .from('mtrs')
        .select(selectCols.replace(', baixada_em', ''))
        .or('status.eq.Baixada,status.eq.baixada')
        .order('numero', { ascending: false })
        .limit(500)
      linhasDb = (fallback.data ?? []) as unknown as MtrBaixadaDb[]
      error = fallback.error
    }
  }

  if (error) {
    return {
      rows: [],
      erro: mensagemErroSupabase(error, 'Não foi possível carregar o histórico de MTRs baixadas.'),
    }
  }

  const filtradas = linhasDb.filter((r) => {
    const st = String(r.status ?? '')
      .trim()
      .toLowerCase()
    return st === 'baixada' || r.baixada_em != null
  })

  const rows = filtradas.map((r) => {
    const dataIso = r.baixada_em ? String(r.baixada_em).slice(0, 10) : ''
    return {
      id: String(r.id),
      numero: String(r.numero ?? ''),
      gerador: resolverNomeGeradorMtr({
        gerador: r.gerador,
        cliente: r.cliente,
        tipoResiduo: r.tipo_residuo,
      }),
      residuo: String(r.tipo_residuo ?? ''),
      quantidade: formatarQuantidadeMtr(
        r.quantidade != null ? Number(r.quantidade) : null,
        r.unidade != null ? String(r.unidade) : null
      ),
      data: dataIso,
      cliente: String(r.cliente ?? ''),
    }
  })

  return { rows, erro: null }
}

export type MtrResumoGerenciador = {
  id: string
  numero: string
  baixada: boolean
}

export function mtrResumoEstaBaixada(status: string | null | undefined, baixadaEm?: string | null): boolean {
  const st = String(status ?? '')
    .trim()
    .toLowerCase()
  return st === 'baixada' || baixadaEm != null
}

export function rotaGerenciadorHistoricoMtr(mtrId: string, mtrNumero: string): string {
  const p = new URLSearchParams()
  p.set('historico', '1')
  p.set('baixarMtr', mtrId)
  p.set('mtrNumero', mtrNumero)
  return `/mtr/gerenciador?${p.toString()}`
}

/** MTR já baixada: abre relatório com destaque na linha (sem painel de baixa). */
export function rotaGerenciadorRelatorioMtr(mtrId: string, mtrNumero: string): string {
  const p = new URLSearchParams()
  p.set('historico', '1')
  p.set('focusMtr', mtrId)
  if (mtrNumero.trim()) p.set('mtrNumero', mtrNumero.trim())
  return `/mtr/gerenciador?${p.toString()}`
}

export function rotaMtrGerenciadorEnvio(mtr: MtrResumoGerenciador): string {
  return mtr.baixada
    ? rotaGerenciadorRelatorioMtr(mtr.id, mtr.numero)
    : rotaGerenciadorHistoricoMtr(mtr.id, mtr.numero)
}

export function rotaGerenciadorHistorico(): string {
  return '/mtr/gerenciador?historico=1'
}

function rowParaResumo(row: {
  id: string
  numero?: string | null
  status?: string | null
  baixada_em?: string | null
}): MtrResumoGerenciador {
  const numero = String(row.numero ?? '')
  return {
    id: String(row.id),
    numero,
    baixada: mtrResumoEstaBaixada(row.status, row.baixada_em),
  }
}

type MtrBuscaRow = {
  id: string
  numero: string | null
  status: string | null
  baixada_em?: string | null
}

function colunaBaixadaEmAusente(message: string): boolean {
  return message.includes('baixada_em') && (message.includes('column') || message.includes('does not exist'))
}

async function buscarMtrRowsPorNumeroExato(
  numero: string,
  cols: string
): Promise<{ rows: MtrBuscaRow[]; colsUsados: string }> {
  const res = await supabase.from('mtrs').select(cols).eq('numero', numero).limit(1)
  if (!res.error && res.data?.length) {
    return { rows: res.data as unknown as MtrBuscaRow[], colsUsados: cols }
  }
  if (res.error && cols.includes('baixada_em') && colunaBaixadaEmAusente(String(res.error.message ?? ''))) {
    const colsSem = 'id, numero, status'
    const retry = await supabase.from('mtrs').select(colsSem).eq('numero', numero).limit(1)
    if (!retry.error && retry.data?.length) {
      return { rows: retry.data as unknown as MtrBuscaRow[], colsUsados: colsSem }
    }
  }
  return { rows: [], colsUsados: cols }
}

export type DadosLinhaMtrGerenciador = {
  gerador: string
  residuo: string
  quantidade: string
  data: string
}

/** Preenche linha do cadastro Gerenciador a partir da MTR no sistema. */
export async function buscarDadosLinhaMtrPorNumero(
  numero: string
): Promise<DadosLinhaMtrGerenciador | null> {
  const n = numero.trim()
  if (!n) return null

  const cols =
    'numero, gerador, cliente, tipo_residuo, quantidade, unidade, data_emissao, baixada_em, programacao_id'

  let row: Record<string, unknown> | null = null
  const exato = await supabase.from('mtrs').select(cols).eq('numero', n).maybeSingle()
  if (!exato.error && exato.data) row = exato.data as Record<string, unknown>
  if (!row) {
    const fb = await supabase.from('mtrs').select(cols).ilike('numero', n).limit(5)
    if (!fb.error && fb.data?.length) {
      const match = (fb.data as Record<string, unknown>[]).find(
        (r) => String(r.numero ?? '').trim() === n
      )
      row = match ?? (fb.data[0] as Record<string, unknown>)
    }
  }
  if (!row) return null

  const q = row.quantidade != null ? Number(row.quantidade) : null
  const u = row.unidade != null ? String(row.unidade) : null

  const dataIso = row.baixada_em
    ? String(row.baixada_em).slice(0, 10)
    : row.data_emissao
      ? String(row.data_emissao).slice(0, 10)
      : ''

  let gerador = resolverNomeGeradorMtr({
    gerador: row.gerador as string | null,
    cliente: row.cliente as string | null,
    tipoResiduo: row.tipo_residuo as string | null,
  })

  const programacaoId = row.programacao_id ? String(row.programacao_id).trim() : ''
  if (programacaoId) {
    const { data: prog } = await supabase
      .from('programacoes')
      .select('cliente_id, cliente')
      .eq('id', programacaoId)
      .maybeSingle()
    if (prog) {
      const nomeCad = await buscarNomeGeradorPorProgramacaoMtr(supabase, prog)
      if (nomeCad.trim()) gerador = nomeCad
    }
  }

  return {
    gerador,
    residuo: String(row.tipo_residuo ?? '').trim(),
    quantidade: formatarQuantidadeMtr(q, u),
    data: dataIso,
  }
}

/** Resolve MTR do sistema pelo número exibido na linha do gerenciador. */
export async function buscarMtrPorNumero(numero: string): Promise<MtrResumoGerenciador | null> {
  const n = numero.trim()
  if (!n) return null

  const cols = 'id, numero, status, baixada_em'
  const exato = await buscarMtrRowsPorNumeroExato(n, cols)
  if (exato.rows[0]) return rowParaResumo(exato.rows[0])

  const fallback = await supabase.from('mtrs').select(exato.colsUsados).ilike('numero', n).limit(10)
  if (fallback.error || !fallback.data?.length) return null

  const rows = fallback.data as unknown as MtrBuscaRow[]
  const match = rows.find((r) => String(r.numero ?? '').trim() === n)
  if (match) return rowParaResumo(match)
  if (rows.length === 1) return rowParaResumo(rows[0]!)
  return null
}
