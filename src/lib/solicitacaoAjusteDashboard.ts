import {
  chatListarHistoricoPedidosAjuste,
  nomeSolicitantePedidoAjuste,
  type PedidoAjusteHistoricoItem,
} from './chatPedidoAjuste'

export type PeriodoDashboardSolicitacoes = 'dia' | 'semana' | 'mes' | 'ano'

export type TipoEntregaSolicitacao = 'melhoria' | 'atualizacao' | 'outro'

export type DashboardSolicitacoesDados = {
  totalAtendidas: number
  melhorias: number
  atualizacoes: number
  outros: number
  serieTemporal: { rotulo: string; quantidade: number }[]
  porColaboradorDev: { nome: string; quantidade: number }[]
  porSolicitante: { nome: string; quantidade: number }[]
  versaoSistema: string
}

type UsuarioNomeLookup = Map<string, { nome?: string | null; email?: string | null }>

const CORES_DONUT = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#0f766e', '#115e59', '#134e4a']

export function coresDonutSolicitacoes(): string[] {
  return CORES_DONUT
}

export function classificarTipoEntregaSolicitacao(descricao: string): TipoEntregaSolicitacao {
  const t = descricao.trim().toLowerCase()
  if (!t) return 'outro'
  if (
    /(melhoria|nova funcionalidade|implementar|adicionar|criar|incluir|novo m[oó]dulo|novo fluxo)/.test(t)
  ) {
    return 'melhoria'
  }
  if (
    /(atualiza|ajust|corrig|correção|fix|bug|erro|alterar|mudan|vers[aã]o|deploy|padroniz|refator)/.test(t)
  ) {
    return 'atualizacao'
  }
  return 'outro'
}

function chavePeriodo(iso: string, periodo: PeriodoDashboardSolicitacoes): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  if (periodo === 'dia') return `${day}/${m}/${y}`
  if (periodo === 'ano') return String(y)
  if (periodo === 'mes') {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${meses[d.getMonth()]}/${y}`
  }
  const onejan = new Date(y, 0, 1)
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
  return `Sem ${week}/${y}`
}

function ordenarChavesPeriodo(a: string, b: string, periodo: PeriodoDashboardSolicitacoes): number {
  if (periodo === 'dia') {
    const [da, ma, ya] = a.split('/').map(Number)
    const [db, mb, yb] = b.split('/').map(Number)
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime()
  }
  if (periodo === 'ano') return Number(a) - Number(b)
  if (periodo === 'mes') {
    const parse = (s: string) => {
      const [mes, ano] = s.split('/')
      const idx = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].indexOf(
        mes
      )
      return new Date(Number(ano), idx, 1).getTime()
    }
    return parse(a) - parse(b)
  }
  const pa = a.match(/Sem (\d+)\/(\d+)/)
  const pb = b.match(/Sem (\d+)\/(\d+)/)
  if (!pa || !pb) return 0
  return Number(pa[2]) * 100 + Number(pa[1]) - (Number(pb[2]) * 100 + Number(pb[1]))
}

function limiteBuckets(periodo: PeriodoDashboardSolicitacoes): number {
  switch (periodo) {
    case 'dia':
      return 30
    case 'semana':
      return 16
    case 'mes':
      return 12
    case 'ano':
      return 6
    default:
      return 12
  }
}

export function montarDashboardSolicitacoes(
  historico: PedidoAjusteHistoricoItem[],
  usuariosPorId: UsuarioNomeLookup,
  periodo: PeriodoDashboardSolicitacoes,
  versaoSistema: string
): DashboardSolicitacoesDados {
  const atendidas = historico.filter((h) => h.evento === 'resolvido_dev')

  let melhorias = 0
  let atualizacoes = 0
  let outros = 0

  const buckets = new Map<string, number>()
  const porDev = new Map<string, number>()
  const porSolicitante = new Map<string, number>()

  for (const h of atendidas) {
    const desc = h.parseado?.descricao ?? h.texto ?? ''
    const tipo = classificarTipoEntregaSolicitacao(desc)
    if (tipo === 'melhoria') melhorias += 1
    else if (tipo === 'atualizacao') atualizacoes += 1
    else outros += 1

    const chave = chavePeriodo(h.createdAt, periodo)
    buckets.set(chave, (buckets.get(chave) ?? 0) + 1)

    const devNome =
      usuariosPorId.get(h.actorId)?.nome?.trim() ||
      usuariosPorId.get(h.actorId)?.email?.trim() ||
      'Desenvolvedor'
    porDev.set(devNome, (porDev.get(devNome) ?? 0) + 1)

    const solNome = nomeSolicitantePedidoAjuste(h.solicitanteId, h.parseado ?? null, usuariosPorId)
    porSolicitante.set(solNome, (porSolicitante.get(solNome) ?? 0) + 1)
  }

  const serieOrdenada = [...buckets.entries()]
    .sort(([a], [b]) => ordenarChavesPeriodo(a, b, periodo))
    .slice(-limiteBuckets(periodo))
    .map(([rotulo, quantidade]) => ({ rotulo, quantidade }))

  const topDev = [...porDev.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nome, quantidade]) => ({ nome, quantidade }))

  const topSol = [...porSolicitante.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nome, quantidade]) => ({ nome, quantidade }))

  return {
    totalAtendidas: atendidas.length,
    melhorias,
    atualizacoes,
    outros,
    serieTemporal: serieOrdenada,
    porColaboradorDev: topDev,
    porSolicitante: topSol,
    versaoSistema,
  }
}

export async function carregarDashboardSolicitacoes(
  usuariosPorId: UsuarioNomeLookup,
  periodo: PeriodoDashboardSolicitacoes,
  versaoSistema: string,
  limiteHistorico = 1500
): Promise<DashboardSolicitacoesDados> {
  const historico = await chatListarHistoricoPedidosAjuste(limiteHistorico)
  return montarDashboardSolicitacoes(historico, usuariosPorId, periodo, versaoSistema)
}
