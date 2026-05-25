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
      gerador: String(r.gerador ?? ''),
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

export function rotaGerenciadorHistoricoMtr(mtrId: string, mtrNumero: string): string {
  const p = new URLSearchParams()
  p.set('historico', '1')
  p.set('baixarMtr', mtrId)
  p.set('mtrNumero', mtrNumero)
  return `/clientes/gerenciador?${p.toString()}`
}
