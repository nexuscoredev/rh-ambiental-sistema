/** Tipos e helpers do cadastro de clientes — veículos, equipamentos e resíduos de contrato. */

/** Converte valores do DB/JSON/rascunho para texto seguro (evita crash em inputs React). */
export function asTextoFormulario(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (Array.isArray(val)) {
    return val.map(asTextoFormulario).filter(Boolean).join(' | ')
  }
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>
    const codigo = asTextoFormulario(o.codigo)
    const nome = asTextoFormulario(o.nome)
    if (codigo && nome) return `${codigo} — ${nome}`
    const tipo = asTextoFormulario(o.tipo_residuo)
    if (tipo) return tipo
    const desc =
      asTextoFormulario(o.descricao) ||
      asTextoFormulario(o.tipo_veiculo) ||
      asTextoFormulario(o.label)
    if (desc) return desc
    try {
      return JSON.stringify(val)
    } catch {
      return ''
    }
  }
  return ''
}

export const UNIDADES_MEDIDA_RESIDUO = [
  { value: 'kg', label: 'kg' },
  { value: 'ton', label: 'ton' },
  { value: 'm3', label: 'm³' },
  { value: 'litros', label: 'litros' },
] as const

/** Cadastro de clientes: faturamento por peso sempre em kg (sem tonelada). */
export const UNIDADES_MEDIDA_RESIDUO_CLIENTES = UNIDADES_MEDIDA_RESIDUO.filter((u) => u.value !== 'ton')

export function unidadeMedidaEhTonelada(unidade: string | null | undefined): boolean {
  const u = (unidade ?? '').trim().toLowerCase()
  return u === 'ton' || u === 'tonelada' || u === 't' || u === 'ton.'
}

/** Limite: abaixo disso, faturamento mínimo legado com unidade ton era em toneladas (não kg). */
const FATURAMENTO_MINIMO_LEGADO_TON_MAX = 100

/**
 * Mínimo legado gravado em toneladas (1, 10, 12…) → kg para exibição/gravação.
 * Com unidade já em kg, só converte valores típicos de ton (≤ 20) para não confundir 50 kg reais.
 */
const FATURAMENTO_MINIMO_TON_LEGADO_COM_UNIDADE_KG_MAX = 20

export function faturamentoMinimoLegadoParaKgCampo(
  minimoRaw: string,
  unidadeRaw: string
): string {
  const t = minimoRaw.trim()
  const minimoNum = parseNumeroPeso(t)
  if (minimoNum == null || minimoNum <= 0) return t

  const unidadeTon = unidadeMedidaEhTonelada(unidadeRaw)
  const unidadeKg =
    (unidadeRaw.trim().toLowerCase() === 'kg' || !unidadeRaw.trim()) && !unidadeTon

  if (unidadeTon && minimoNum < FATURAMENTO_MINIMO_LEGADO_TON_MAX) {
    return pesoParaCampo(minimoNum * 1000)
  }

  if (
    unidadeKg &&
    minimoNum >= 1 &&
    minimoNum <= FATURAMENTO_MINIMO_TON_LEGADO_COM_UNIDADE_KG_MAX &&
    minimoNum < 1000
  ) {
    return pesoParaCampo(minimoNum * 1000)
  }

  return t || pesoParaCampo(minimoNum)
}

/** Converte contrato legado em tonelada para kg (valor R$/ton → R$/kg; mínimo em ton → kg na MTR). */
export function normalizarResiduoContratoParaKg(item: ResiduoContratoItem): ResiduoContratoItem {
  const unidadeRaw = item.unidade_medida.trim()
  const faturamentoMinimo = faturamentoMinimoLegadoParaKgCampo(
    item.faturamento_minimo,
    unidadeRaw
  )

  if (!unidadeMedidaEhTonelada(unidadeRaw)) {
    return {
      ...item,
      unidade_medida: unidadeRaw || 'kg',
      faturamento_minimo: faturamentoMinimo,
    }
  }
  const valorNum = parseNumeroMoeda(item.valor)
  const valorKg =
    valorNum != null && valorNum > 0
      ? valorNum / 1000
      : null
  return {
    ...item,
    unidade_medida: 'kg',
    faturamento_minimo: faturamentoMinimo,
    valor:
      valorKg != null
        ? valorKg.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })
        : item.valor,
  }
}

/** Formata peso em kg para campos da MTR (ex.: 10000 → 10.000). */
export function formatarPesoKgCampoContrato(valor: string): string {
  const n = parseNumeroPeso(valor)
  if (n == null || n <= 0) return valor.trim()
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/** Quantidade opcional da MTR gravada em ton → kg para exibição e detalhes. */
export function quantidadeMtrLegadaParaKg(
  quantidade: number | null | undefined,
  unidade: string | null | undefined
): number | null {
  if (quantidade == null || Number.isNaN(Number(quantidade))) return null
  const q = Number(quantidade)
  if (q <= 0) return null
  if (unidadeMedidaEhTonelada(unidade)) return q * 1000
  return q
}

export type VeiculoContratoItem = {
  tipo_veiculo: string
  sem_custo: boolean
  valor: string
}

export type EquipamentoContratoItem = {
  descricao: string
  com_custo: boolean
  valor: string
}

export type ResiduoContratoItem = {
  tipo_residuo: string
  classificacao: string
  unidade_medida: string
  valor: string
  frequencia_coleta: string
  faturamento_minimo: string
}

export const veiculoContratoInicial = (): VeiculoContratoItem => ({
  tipo_veiculo: '',
  sem_custo: false,
  valor: '',
})

export const equipamentoContratoInicial = (): EquipamentoContratoItem => ({
  descricao: '',
  com_custo: false,
  valor: '',
})

/** Na MTR só se registam tipo/descrição — valores ficam no cadastro do cliente / faturamento. */
export function veiculosContratoSemValoresMtr(itens: VeiculoContratoItem[]): VeiculoContratoItem[] {
  return itens.map((v) => ({ ...v, valor: '', sem_custo: true }))
}

export function equipamentosContratoSemValoresMtr(
  itens: EquipamentoContratoItem[]
): EquipamentoContratoItem[] {
  return itens.map((e) => ({ ...e, valor: '', com_custo: false }))
}

export const residuoContratoInicial = (): ResiduoContratoItem => ({
  tipo_residuo: '',
  classificacao: '',
  unidade_medida: 'kg',
  valor: '',
  frequencia_coleta: '',
  faturamento_minimo: '',
})

function parseNumeroMoeda(valor: string): number | null {
  const t = valor.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function formatarMoedaBanco(valor: string): number | null {
  const n = parseNumeroMoeda(valor)
  if (n == null || n < 0) return null
  return Math.round(n * 100) / 100
}

function parseNumeroPeso(valor: string): number | null {
  const t = valor.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function formatarPesoKgBanco(valor: string): number | null {
  const n = parseNumeroPeso(valor)
  if (n == null || n < 0) return null
  return Math.round(n * 1000) / 1000
}

function pesoParaCampo(v: unknown): string {
  if (v == null || v === '') return ''
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function itemVeiculoValido(item: VeiculoContratoItem): boolean {
  return Boolean(item.tipo_veiculo.trim())
}

function itemEquipamentoValido(item: EquipamentoContratoItem): boolean {
  return Boolean(item.descricao.trim())
}

function itemResiduoValido(item: ResiduoContratoItem): boolean {
  return Boolean(item.tipo_residuo.trim())
}

function semCustoVeiculoExplicito(raw: unknown): boolean {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  return false
}

/** Veículo com valor preenchido nunca grava como «sem custo». */
function normalizarVeiculoContratoParaGravacao(item: VeiculoContratoItem): VeiculoContratoItem {
  const valorNum = formatarMoedaBanco(item.valor)
  const semCusto = item.sem_custo && valorNum == null
  return {
    ...item,
    sem_custo: semCusto,
    valor: semCusto ? '' : item.valor,
  }
}

export function veiculosContratoParaJsonb(itens: VeiculoContratoItem[]): unknown {
  return itens
    .filter(itemVeiculoValido)
    .map(normalizarVeiculoContratoParaGravacao)
    .map((item) => ({
      tipo_veiculo: item.tipo_veiculo.trim(),
      sem_custo: item.sem_custo,
      valor: item.sem_custo ? null : formatarMoedaBanco(item.valor),
    }))
}

export function equipamentosContratoParaJsonb(itens: EquipamentoContratoItem[]): unknown {
  return itens.filter(itemEquipamentoValido).map((item) => ({
    descricao: item.descricao.trim(),
    com_custo: item.com_custo,
    valor: item.com_custo ? formatarMoedaBanco(item.valor) : null,
  }))
}

export function residuosContratoParaJsonb(itens: ResiduoContratoItem[]): unknown {
  return itens
    .filter(itemResiduoValido)
    .map((item) => normalizarResiduoContratoParaKg(item))
    .map((item) => ({
      tipo_residuo: item.tipo_residuo.trim(),
      classificacao: item.classificacao.trim() || null,
      unidade_medida: item.unidade_medida.trim() || 'kg',
      valor: formatarMoedaBanco(item.valor),
      frequencia_coleta: item.frequencia_coleta.trim() || null,
      faturamento_minimo: formatarPesoKgBanco(item.faturamento_minimo),
    }))
}

function moedaParaCampo(v: unknown): string {
  if (v == null || v === '') return ''
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function parseVeiculosContratoJsonb(raw: unknown, descricaoLegado?: string | null): VeiculoContratoItem[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((row) => {
      const o = row as Record<string, unknown>
      const valorCampo = moedaParaCampo(o.valor)
      const semCusto = semCustoVeiculoExplicito(o.sem_custo) && !valorCampo
      return {
        tipo_veiculo: asTextoFormulario(o.tipo_veiculo).trim(),
        sem_custo: semCusto,
        valor: semCusto ? '' : valorCampo,
      }
    })
  }
  const leg = (descricaoLegado ?? '').trim()
  if (leg) return [{ tipo_veiculo: leg, sem_custo: true, valor: '' }]
  return [veiculoContratoInicial()]
}

export function parseEquipamentosContratoJsonb(
  raw: unknown,
  textoLegado?: string | null
): EquipamentoContratoItem[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((row) => {
      const o = row as Record<string, unknown>
      const valorCampo = moedaParaCampo(o.valor)
      const comCusto =
        o.com_custo === true || o.com_custo === 'true' || o.com_custo === 1 || Boolean(valorCampo)
      return {
        descricao: asTextoFormulario(o.descricao).trim(),
        com_custo: comCusto,
        valor: comCusto ? valorCampo : '',
      }
    })
  }
  const leg = (textoLegado ?? '').trim()
  if (!leg) return [equipamentoContratoInicial()]
  const partes = leg.split(/\n|[|;]/).map((p) => p.trim()).filter(Boolean)
  if (partes.length === 0) return [equipamentoContratoInicial()]
  return partes.map((descricao) => ({
    descricao,
    com_custo: false,
    valor: '',
  }))
}

export function dividirListaPipe(valor: string | null | undefined | unknown): string[] {
  const texto = asTextoFormulario(valor).trim()
  if (!texto) return []
  return texto
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
}

export function parseResiduosContratoJsonb(
  raw: unknown,
  legado?: {
    tipo_residuo?: string | null
    classificacao?: string | null
    unidade_medida?: string | null
    frequencia_coleta?: string | null
  }
): ResiduoContratoItem[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((row) => {
      const o = row as Record<string, unknown>
      const unidadeRaw = asTextoFormulario(o.unidade_medida).trim()
      return normalizarResiduoContratoParaKg({
        tipo_residuo: asTextoFormulario(o.tipo_residuo).trim(),
        classificacao: asTextoFormulario(o.classificacao).trim(),
        unidade_medida: unidadeRaw,
        valor: moedaParaCampo(o.valor),
        frequencia_coleta: asTextoFormulario(o.frequencia_coleta).trim(),
        faturamento_minimo: faturamentoMinimoLegadoParaKgCampo(
          pesoParaCampo(o.faturamento_minimo),
          unidadeRaw
        ),
      })
    })
  }
  const tipos = dividirListaPipe(legado?.tipo_residuo)
  const classes = dividirListaPipe(legado?.classificacao)
  const unidades = dividirListaPipe(legado?.unidade_medida)
  const frequencias = dividirListaPipe(legado?.frequencia_coleta)
  const total = Math.max(tipos.length, classes.length, unidades.length, frequencias.length, 1)
  return Array.from({ length: total }).map((_, i) =>
    normalizarResiduoContratoParaKg({
      tipo_residuo: tipos[i] || '',
      classificacao: classes[i] || '',
      unidade_medida: unidades[i] || '',
      valor: '',
      frequencia_coleta: frequencias[i] || '',
      faturamento_minimo: '',
    })
  )
}

/** Sincroniza colunas legadas (planilha / MTR) a partir dos itens de resíduo. */
export function serializarResiduosLegadoPipe(itens: ResiduoContratoItem[]) {
  const validos = itens.filter(itemResiduoValido)
  const join = (fn: (r: ResiduoContratoItem) => string) =>
    validos
      .map((r) => fn(r).trim())
      .filter(Boolean)
      .join(' | ')
  return {
    tipo_residuo: join((r) => r.tipo_residuo),
    classificacao: join((r) => r.classificacao),
    unidade_medida: join((r) => r.unidade_medida),
    frequencia_coleta: join((r) => r.frequencia_coleta),
  }
}

export function descricaoVeiculoLegadoDeItens(itens: VeiculoContratoItem[]): string | null {
  const t = itens
    .filter(itemVeiculoValido)
    .map((i) => i.tipo_veiculo.trim())
    .join(' | ')
  return t || null
}

export function equipamentosTextoLegadoDeItens(itens: EquipamentoContratoItem[]): string | null {
  const t = itens
    .filter(itemEquipamentoValido)
    .map((i) => i.descricao.trim())
    .join(' | ')
  return t || null
}

export type RotuloContratoResumoOpts = {
  /** Manifesto impresso/PDF: só tipo/descrição, sem R$ nem «sem/com custo». */
  ocultarValores?: boolean
}

export function rotuloVeiculosContratoResumo(
  raw: unknown,
  descricaoLegado?: string | null,
  opts?: RotuloContratoResumoOpts
): string {
  const itens = parseVeiculosContratoJsonb(raw, descricaoLegado).filter(itemVeiculoValido)
  if (itens.length === 0) return '—'
  if (opts?.ocultarValores) {
    const nomes = itens.map((v) => v.tipo_veiculo.trim()).filter(Boolean)
    return nomes.length > 0 ? nomes.join(' · ') : '—'
  }
  return itens
    .map((v) => {
      const tipo = v.tipo_veiculo.trim()
      if (v.sem_custo) return `${tipo} (sem custo)`
      const val = v.valor.trim()
      return val ? `${tipo} — R$ ${val}` : tipo
    })
    .join(' · ')
}

export function rotuloEquipamentosContratoResumo(
  raw: unknown,
  textoLegado?: string | null,
  opts?: RotuloContratoResumoOpts
): string {
  const itens = parseEquipamentosContratoJsonb(raw, textoLegado).filter(itemEquipamentoValido)
  if (itens.length === 0) return '—'
  if (opts?.ocultarValores) {
    const nomes = itens.map((e) => e.descricao.trim()).filter(Boolean)
    return nomes.length > 0 ? nomes.join(' · ') : '—'
  }
  return itens
    .map((e) => {
      const d = e.descricao.trim()
      if (!e.com_custo) return d
      const val = e.valor.trim()
      return val ? `${d} — R$ ${val}` : `${d} (com custo)`
    })
    .join(' · ')
}

/** Reidrata listas de contrato após rascunho em sessionStorage (evita objetos em campos de texto). */
export function normalizarListasContratoForm<T extends {
  veiculos_contrato: VeiculoContratoItem[]
  equipamentos_contrato: EquipamentoContratoItem[]
  residuos: ResiduoContratoItem[]
  descricao_veiculo?: string
  equipamentos?: string
  tipo_residuo?: string | null
  classificacao?: string | null
  unidade_medida?: string | null
  frequencia_coleta?: string | null
}>(form: T): T {
  return {
    ...form,
    veiculos_contrato: parseVeiculosContratoJsonb(form.veiculos_contrato, form.descricao_veiculo),
    equipamentos_contrato: parseEquipamentosContratoJsonb(
      form.equipamentos_contrato,
      form.equipamentos
    ),
    residuos: parseResiduosContratoJsonb(form.residuos, {
      tipo_residuo: form.tipo_residuo,
      classificacao: form.classificacao,
      unidade_medida: form.unidade_medida,
      frequencia_coleta: form.frequencia_coleta,
    }),
  }
}

export function isMissingClienteContratoColumnsError(error: { message?: string } | null | undefined): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  if (!msg) return false
  return (
    msg.includes('veiculos_contrato') ||
    msg.includes('equipamentos_contrato') ||
    msg.includes('residuos_contrato') ||
    (msg.includes('schema cache') && msg.includes('clientes'))
  )
}
