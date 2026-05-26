import type { SupabaseClient } from '@supabase/supabase-js'
import { escolherColetaLiderFaturamento } from './faturamentoConsolidacaoMtr'
import {
  passoUiEsteiraDaColeta,
  ROTULO_PASSO_UI_ESTEIRA,
  type PassoUiEsteiraFaturamento,
} from './faturamentoEsteira'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { fetchVwFaturamentoResumoPorMtrId } from './faturamentoResumoFetch'
import { supabase } from './supabase'

export type MtrResumoBuscaEsteira = {
  id: string
  numero: string
}

export type ColetaEtapaEsteiraLinha = {
  coleta_id: string
  numero_exibicao: string
  passo: PassoUiEsteiraFaturamento | null
  rotulo_passo: string
}

export type ResultadoConsultaEsteiraMtr =
  | { status: 'vazio' }
  | { status: 'erro'; mensagem: string }
  | { status: 'nao_encontrado'; termo: string }
  | { status: 'multiplos_mtrs'; termo: string; mtrs: MtrResumoBuscaEsteira[] }
  | {
      status: 'ok'
      mtr: MtrResumoBuscaEsteira
      coletas: ColetaEtapaEsteiraLinha[]
      /** Quando todas as coletas partilham o mesmo passo, ou passo da coleta líder. */
      passo_principal: PassoUiEsteiraFaturamento | null
      rotulo_passo_principal: string
      passos_distintos: boolean
    }

export function rotuloPassoEsteira(passo: PassoUiEsteiraFaturamento | null): string {
  if (passo == null) return 'Fora da esteira de faturamento'
  return `${passo}. ${ROTULO_PASSO_UI_ESTEIRA[passo]}`
}

export function linhasEtapaPorColetas(
  linhas: FaturamentoResumoViewRow[],
  linhasContexto?: FaturamentoResumoViewRow[]
): ColetaEtapaEsteiraLinha[] {
  const ctx = linhasContexto ?? linhas
  return [...linhas]
    .sort((a, b) => {
      const na = Number(a.numero_coleta ?? a.numero ?? 0)
      const nb = Number(b.numero_coleta ?? b.numero ?? 0)
      if (na !== nb) return na - nb
      return a.coleta_id.localeCompare(b.coleta_id)
    })
    .map((r) => {
      const passo = passoUiEsteiraDaColeta(r, ctx)
      return {
        coleta_id: r.coleta_id,
        numero_exibicao: String(r.numero_coleta ?? r.numero ?? r.coleta_id),
        passo,
        rotulo_passo: rotuloPassoEsteira(passo),
      }
    })
}

export function resumirPassoPrincipal(
  linhas: ColetaEtapaEsteiraLinha[],
  linhasVw: FaturamentoResumoViewRow[]
): {
  passo_principal: PassoUiEsteiraFaturamento | null
  rotulo_passo_principal: string
  passos_distintos: boolean
} {
  if (linhas.length === 0) {
    return {
      passo_principal: null,
      rotulo_passo_principal: 'Sem coleta vinculada — ainda não entrou na esteira',
      passos_distintos: false,
    }
  }

  const passos = new Set(linhas.map((l) => l.passo))
  const passos_distintos = passos.size > 1

  if (!passos_distintos) {
    const p = linhas[0]!.passo
    return {
      passo_principal: p,
      rotulo_passo_principal: rotuloPassoEsteira(p),
      passos_distintos: false,
    }
  }

  const lider = escolherColetaLiderFaturamento(linhasVw)
  const linhaLider = lider
    ? linhas.find((l) => l.coleta_id === lider.coleta_id)
    : linhas[0]
  const p = linhaLider?.passo ?? linhas[0]!.passo
  return {
    passo_principal: p,
    rotulo_passo_principal: rotuloPassoEsteira(p),
    passos_distintos: true,
  }
}

export async function buscarMtrsPorNumeroConsulta(
  client: SupabaseClient,
  termo: string,
  limit = 12
): Promise<MtrResumoBuscaEsteira[]> {
  const n = termo.trim()
  if (!n) return []

  const cols = 'id, numero'
  const exato = await client.from('mtrs').select(cols).eq('numero', n).limit(limit)
  if (!exato.error && exato.data?.length) {
    return (exato.data as { id: string; numero: string }[]).map((r) => ({
      id: String(r.id),
      numero: String(r.numero ?? '').trim() || '—',
    }))
  }

  const padrao = `%${n.replace(/%/g, '')}%`
  const parcial = await client.from('mtrs').select(cols).ilike('numero', padrao).limit(limit)
  if (parcial.error || !parcial.data?.length) return []

  const rows = parcial.data as { id: string; numero: string }[]
  const ordenados = [...rows].sort((a, b) =>
    String(a.numero ?? '').localeCompare(String(b.numero ?? ''), 'pt-BR')
  )
  return ordenados.map((r) => ({
    id: String(r.id),
    numero: String(r.numero ?? '').trim() || '—',
  }))
}

export async function consultarEtapaEsteiraPorMtrNumero(
  termo: string,
  client: SupabaseClient = supabase
): Promise<ResultadoConsultaEsteiraMtr> {
  const n = termo.trim()
  if (!n) return { status: 'vazio' }

  const mtrs = await buscarMtrsPorNumeroConsulta(client, n)
  if (mtrs.length === 0) {
    return { status: 'nao_encontrado', termo: n }
  }

  const exato = mtrs.filter((m) => m.numero === n)
  const candidatos = exato.length === 1 ? exato : exato.length > 1 ? exato : mtrs.length === 1 ? mtrs : mtrs

  if (candidatos.length > 1 && exato.length !== 1) {
    return { status: 'multiplos_mtrs', termo: n, mtrs: candidatos }
  }

  const mtr = candidatos[0]!
  const { data: linhasVw, error } = await fetchVwFaturamentoResumoPorMtrId(client, mtr.id)
  if (error) {
    return { status: 'erro', mensagem: error.message }
  }

  const coletas = linhasEtapaPorColetas(linhasVw, linhasVw)
  const resumo = resumirPassoPrincipal(coletas, linhasVw)

  return {
    status: 'ok',
    mtr,
    coletas,
    ...resumo,
  }
}

export async function consultarEtapaEsteiraPorMtrId(
  mtrId: string,
  client: SupabaseClient = supabase
): Promise<ResultadoConsultaEsteiraMtr> {
  const mid = mtrId.trim()
  if (!mid) return { status: 'vazio' }

  const { data: mtrRow, error: errMtr } = await client
    .from('mtrs')
    .select('id, numero')
    .eq('id', mid)
    .maybeSingle()

  if (errMtr) {
    return { status: 'erro', mensagem: errMtr.message || 'Erro ao ler MTR.' }
  }
  if (!mtrRow) {
    return { status: 'nao_encontrado', termo: mid }
  }

  const mtr: MtrResumoBuscaEsteira = {
    id: String(mtrRow.id),
    numero: String(mtrRow.numero ?? '').trim() || '—',
  }

  const { data: linhasVw, error } = await fetchVwFaturamentoResumoPorMtrId(client, mtr.id)
  if (error) {
    return { status: 'erro', mensagem: error.message }
  }

  const coletas = linhasEtapaPorColetas(linhasVw, linhasVw)
  const resumo = resumirPassoPrincipal(coletas, linhasVw)

  return {
    status: 'ok',
    mtr,
    coletas,
    ...resumo,
  }
}
