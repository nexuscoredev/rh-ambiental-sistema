import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { calcularPrecoContratoColetaMtr } from './faturamentoPrecoContrato'

export type ContratoRelatorioMedicao = {
  residuos_contrato: unknown
  veiculos_contrato: unknown
  equipamentos_contrato: unknown
  tipo_residuo_legado?: string | null
  descricao_veiculo_legado?: string | null
  equipamentos_texto_legado?: string | null
}

export type ContextoMtrMedicao = {
  tipoCaminhao?: string | null
  acondicionamento?: string | null
}

export type LinhaRelatorioMedicao = {
  coleta_id: string
  /** N.º ticket/coleta (só na esteira; o PDF impresso não traz esta coluna). */
  numeroColeta?: string | number | null
  data: string
  mtr: string
  gerador: string
  tipoResiduo: string
  placa: string
  quantViagens: number
  valorFrete: number
  pesoKg: number
  valorTaxa: number
  total: number
}

export type TotaisRelatorioMedicao = {
  valorFrete: number
  pesoKg: number
  total: number
}

const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Janela para um único relatório de medição por cliente (dias de calendário). */
export const JANELA_CONSOLIDACAO_RELATORIO_MEDICAO_DIAS = 30

function isoDataLinha(row: FaturamentoResumoViewRow): string {
  const raw = row.data_execucao || row.data_agendada || row.created_at
  if (!raw) return ''
  return raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10)
}

/** Data de lançamento operacional da coleta (pesagem / execução). */
export function dataLancamentoColetaMedicao(
  row: Pick<FaturamentoResumoViewRow, 'data_execucao' | 'data_agendada' | 'created_at'>
): string {
  return isoDataLinha(row as FaturamentoResumoViewRow)
}

export function parseIsoDataMedicao(iso: string): Date | null {
  if (iso.length < 10) return null
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return Number.isFinite(d.getTime()) ? d : null
}

function parseIso(iso: string): Date | null {
  return parseIsoDataMedicao(iso)
}

/** Diferença em dias de calendário entre duas datas ISO (YYYY-MM-DD). */
export function diasAbsolutosEntreDatasIso(isoA: string, isoB: string): number {
  const a = parseIsoDataMedicao(isoA)
  const b = parseIsoDataMedicao(isoB)
  if (!a || !b) return Number.MAX_SAFE_INTEGER
  return Math.abs(Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

/** Primeira coleta de cada MTR (por data) recebe frete + equipamentos no relatório. */
export function coletasComFretePorMtr(
  linhas: FaturamentoResumoViewRow[]
): Set<string> {
  const porMtr = new Map<string, FaturamentoResumoViewRow[]>()
  for (const r of linhas) {
    const mtr = (r.mtr_id ?? r.mtr_numero ?? r.coleta_id).trim()
    const lista = porMtr.get(mtr) ?? []
    lista.push(r)
    porMtr.set(mtr, lista)
  }
  const ids = new Set<string>()
  for (const grupo of porMtr.values()) {
    const ordenado = [...grupo].sort((a, b) => isoDataLinha(a).localeCompare(isoDataLinha(b)))
    const lider = ordenado[0]
    if (lider) ids.add(lider.coleta_id)
  }
  return ids
}

export function montarLinhasRelatorioMedicao(
  linhas: FaturamentoResumoViewRow[],
  contrato: ContratoRelatorioMedicao,
  ctxPorColetaId: Record<string, ContextoMtrMedicao | undefined>
): LinhaRelatorioMedicao[] {
  const comFrete = coletasComFretePorMtr(linhas)
  const geradorPadrao =
    (linhas[0]?.cliente_razao_social ?? linhas[0]?.cliente_nome ?? '').trim() || '—'

  const ordenadas = [...linhas].sort((a, b) => {
    const da = isoDataLinha(a)
    const db = isoDataLinha(b)
    if (da !== db) return da.localeCompare(db)
    return String(a.numero_coleta ?? a.numero).localeCompare(String(b.numero_coleta ?? b.numero))
  })

  return ordenadas.map((row) => {
    const ctx = ctxPorColetaId[row.coleta_id]
    const preco = calcularPrecoContratoColetaMtr({
      veiculosContratoRaw: contrato.veiculos_contrato,
      equipamentosContratoRaw: contrato.equipamentos_contrato,
      residuosContratoRaw: contrato.residuos_contrato,
      legadoTipoResiduo: contrato.tipo_residuo_legado,
      descricaoVeiculoLegado: contrato.descricao_veiculo_legado,
      equipamentosTextoLegado: contrato.equipamentos_texto_legado,
      tipoCaminhaoMtr: ctx?.tipoCaminhao ?? null,
      acondicionamentoMtr: ctx?.acondicionamento ?? null,
      tipoResiduoColeta: row.tipo_residuo,
      pesoLiquidoKg: row.peso_liquido,
    })

    const aplicaFrete = comFrete.has(row.coleta_id)
    const valorFrete = aplicaFrete
      ? Math.round((preco.valorCaminhao + preco.valorEquipamentos) * 100) / 100
      : 0
    const total = aplicaFrete
      ? preco.total
      : Math.round(preco.valorResiduo * 100) / 100
    const pesoKg = Number(row.peso_liquido) || 0

    return {
      coleta_id: row.coleta_id,
      numeroColeta: row.numero_coleta ?? row.numero,
      data: isoDataLinha(row),
      mtr: (row.mtr_numero ?? '—').trim() || '—',
      gerador: (row.cliente_razao_social ?? row.cliente_nome ?? geradorPadrao).trim() || geradorPadrao,
      tipoResiduo: (row.tipo_residuo ?? '—').trim() || '—',
      placa: (row.placa ?? '—').trim() || '—',
      quantViagens: 1,
      valorFrete,
      pesoKg,
      valorTaxa: preco.valorUnitario,
      total,
    }
  })
}

export function totaisRelatorioMedicao(linhas: LinhaRelatorioMedicao[]): TotaisRelatorioMedicao {
  return linhas.reduce(
    (acc, l) => ({
      valorFrete: acc.valorFrete + l.valorFrete,
      pesoKg: acc.pesoKg + l.pesoKg,
      total: acc.total + l.total,
    }),
    { valorFrete: 0, pesoKg: 0, total: 0 }
  )
}

/** Ex.: «abril-26» ou intervalo quando há mais de um mês. */
export function rotuloPeriodoRelatorioMedicao(linhas: LinhaRelatorioMedicao[]): string {
  const datas = linhas.map((l) => l.data).filter((d) => d.length >= 10)
  if (datas.length === 0) return ''

  const mesAno = new Set(
    datas.map((d) => {
      const dt = parseIso(d)
      if (!dt) return ''
      return `${dt.getFullYear()}-${dt.getMonth()}`
    })
  )
  mesAno.delete('')

  if (mesAno.size === 1) {
    const dt = parseIso(datas[0]!)!
    const mes = MESES_PT[dt.getMonth()] ?? ''
    const ano = String(dt.getFullYear()).slice(-2)
    return `${mes}-${ano}`
  }

  const sorted = [...datas].sort()
  const ini = formatarDataCurta(sorted[0]!)
  const fim = formatarDataCurta(sorted[sorted.length - 1]!)
  return `${ini} a ${fim}`
}

/** Vencimento padrão: dia 20 do mês seguinte à última data do período. */
export function vencimentoRelatorioMedicao(linhas: LinhaRelatorioMedicao[]): string {
  const datas = linhas.map((l) => l.data).filter((d) => d.length >= 10)
  if (datas.length === 0) return ''
  const maxIso = [...datas].sort().at(-1)!
  const dt = parseIso(maxIso)
  if (!dt) return ''
  const v = new Date(dt.getFullYear(), dt.getMonth() + 1, 20)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
}

export function formatarDataCurta(iso: string): string {
  if (iso.length < 10) return iso
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatarMoedaMedicao(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarPesoMedicao(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatarTaxaMedicao(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
