/**
 * Preenche MTR a partir do cadastro do cliente (veículos, equipamentos, resíduos de contrato).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isMissingClienteContratoColumnsError,
  parseEquipamentosContratoJsonb,
  parseResiduosContratoJsonb,
  parseVeiculosContratoJsonb,
  rotuloEquipamentosContratoResumo,
  rotuloVeiculosContratoResumo,
  equipamentosContratoSemValoresMtr,
  veiculosContratoSemValoresMtr,
  formatarPesoKgCampoContrato,
  type EquipamentoContratoItem,
  type ResiduoContratoItem,
  type VeiculoContratoItem,
} from './clienteContratoCadastro'
import { resolverClienteIdProgramacaoMtr } from './mtrCadastroClienteAutofill'
import type { ProgramacaoMtrRow } from './mtrProgramacoesFetch'
import { sanitizeIlikePattern } from './sanitizeIlike'
import {
  linhaVaziaResiduoPesagem,
  linhasComConteudo,
  SEPARADOR_RESIDUOS_TEXTO,
  type ResiduoPesagemItem,
} from './residuosPesagem'

export type ClienteRowContratoMtr = {
  nome?: string | null
  razao_social?: string | null
  tipo_residuo?: string | null
  unidade_medida?: string | null
  classificacao?: string | null
  descricao_veiculo?: string | null
  equipamentos?: string | null
  veiculos_contrato?: unknown
  equipamentos_contrato?: unknown
  residuos_contrato?: unknown
  frequencia_coleta?: string | null
}

export type MtrContratoClienteSnapshot = {
  veiculos: VeiculoContratoItem[]
  equipamentos: EquipamentoContratoItem[]
  residuos: ResiduoContratoItem[]
  rotuloVeiculos: string
  rotuloEquipamentos: string
  rotuloResiduos: string
}

export function parseContratoClienteMtr(row: ClienteRowContratoMtr): MtrContratoClienteSnapshot {
  const veiculos = parseVeiculosContratoJsonb(row.veiculos_contrato, row.descricao_veiculo).filter(
    (v) => v.tipo_veiculo.trim()
  )
  const equipamentos = parseEquipamentosContratoJsonb(row.equipamentos_contrato, row.equipamentos).filter(
    (e) => e.descricao.trim()
  )
  const residuos = parseResiduosContratoJsonb(row.residuos_contrato, {
    tipo_residuo: row.tipo_residuo,
    classificacao: row.classificacao,
    unidade_medida: row.unidade_medida,
    frequencia_coleta: row.frequencia_coleta,
  }).filter(residuoContratoTemConteudo)

  const rotuloResiduos =
    residuos.length > 0
      ? residuos
          .map((r) => {
            const p = [r.tipo_residuo.trim(), r.classificacao.trim()].filter(Boolean).join(' — ')
            const u = r.unidade_medida.trim()
            return u ? `${p} (${u})` : p
          })
          .join(' · ')
      : '—'

  return {
    veiculos: veiculosContratoSemValoresMtr(veiculos),
    equipamentos: equipamentosContratoSemValoresMtr(equipamentos),
    residuos,
    rotuloVeiculos: rotuloVeiculosContratoResumo(row.veiculos_contrato, row.descricao_veiculo),
    rotuloEquipamentos: rotuloEquipamentosContratoResumo(row.equipamentos_contrato, row.equipamentos),
    rotuloResiduos,
  }
}

export function residuoContratoTemConteudo(r: ResiduoContratoItem): boolean {
  return Boolean(r.tipo_residuo.trim() || r.classificacao.trim())
}

/** Rótulo exibido na pesagem / tipo resíduo da MTR. */
export function rotuloResiduoContrato(r: ResiduoContratoItem): string {
  const t = r.tipo_residuo.trim()
  const c = r.classificacao.trim()
  if (t && c) return `${t} — ${c}`
  return t || c || ''
}

/** Linhas de pesagem (sem pesos) para `detalhes.residuos_itens` e herança no Controle de Massa. */
export function residuosContratoParaLinhasPesagem(residuos: ResiduoContratoItem[]): ResiduoPesagemItem[] {
  const validos = residuos.filter(residuoContratoTemConteudo)
  if (validos.length === 0) return [linhaVaziaResiduoPesagem()]
  return validos.map((r) => ({
    ...linhaVaziaResiduoPesagem(),
    texto: rotuloResiduoContrato(r),
  }))
}

function normalizarChaveResiduoTexto(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function linhasPesagemTextoCoincide(a: string, b: string): boolean {
  const na = normalizarChaveResiduoTexto(a)
  const nb = normalizarChaveResiduoTexto(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

/**
 * Abre uma linha de pesagem por resíduo do contrato do cliente, preservando pesos já lançados.
 */
export function expandirLinhasPesagemComContrato(
  linhasAtuais: ResiduoPesagemItem[],
  residuosContrato: ResiduoContratoItem[]
): ResiduoPesagemItem[] {
  const modelo = residuosContratoParaLinhasPesagem(residuosContrato)
  const modeloCom = linhasComConteudo(modelo)
  if (modeloCom.length === 0) {
    return linhasAtuais.length > 0 ? linhasAtuais : [linhaVaziaResiduoPesagem()]
  }

  const atuais = linhasComConteudo(linhasAtuais)

  if (
    modeloCom.length > 1 &&
    atuais.length === 1 &&
    atuais[0]!.texto.trim() &&
    (atuais[0]!.peso_liquido.trim() || atuais[0]!.peso_bruto.trim()) &&
    !modeloCom.some((mod) => linhasPesagemTextoCoincide(atuais[0]!.texto, mod.texto))
  ) {
    return linhasAtuais
  }

  /** Utilizador removeu linhas (tinha várias, ficou com menos) — não repor as do contrato. */
  if (
    modeloCom.length > 1 &&
    atuais.length >= 2 &&
    atuais.length < modeloCom.length &&
    atuais.every((a) => a.texto.trim()) &&
    atuais.some((a) => a.peso_liquido.trim() || a.peso_bruto.trim() || a.peso_tara.trim()) &&
    atuais.every((a) =>
      modeloCom.some((mod) => linhasPesagemTextoCoincide(a.texto, mod.texto))
    )
  ) {
    return atuais
  }

  if (modeloCom.length === 1) {
    const mod = modeloCom[0]!
    const match = atuais[0]
    if (!match) return modeloCom
    return [
      {
        ...mod,
        texto: match.texto.trim() ? match.texto : mod.texto,
        peso_tara: match.peso_tara,
        peso_bruto: match.peso_bruto,
        peso_liquido: match.peso_liquido,
      },
    ]
  }

  return modeloCom.map((mod, i) => {
    const match =
      atuais.find((a) => linhasPesagemTextoCoincide(a.texto, mod.texto)) ?? atuais[i]
    if (!match) return mod
    return {
      ...mod,
      texto: match.texto.trim() ? match.texto : mod.texto,
      peso_tara: match.peso_tara,
      peso_bruto: match.peso_bruto,
      peso_liquido: match.peso_liquido,
    }
  })
}

/** Resolve contrato do cliente pelo nome da empresa (pesagem / ticket). */
export async function fetchContratoClientePorNomeEmpresa(
  client: SupabaseClient,
  empresa: string
): Promise<MtrContratoClienteSnapshot | null> {
  const q = empresa.trim()
  if (q.length < 2) return null

  const s = sanitizeIlikePattern(q)
  const resCompleto = await client
    .from('clientes')
    .select(MTR_SEL_CLIENTE_CONTRATO)
    .or(`nome.ilike.%${s}%,razao_social.ilike.%${s}%`)
    .limit(10)

  let rows: ClienteRowContratoMtr[] | null = (resCompleto.data as ClienteRowContratoMtr[] | null) ?? null
  let fetchError = resCompleto.error

  if (fetchError && isMissingClienteContratoColumnsError(fetchError)) {
    const resLegado = await client
      .from('clientes')
      .select(MTR_SEL_CLIENTE_CONTRATO_LEGADO)
      .or(`nome.ilike.%${s}%,razao_social.ilike.%${s}%`)
      .limit(10)
    rows = (resLegado.data as ClienteRowContratoMtr[] | null) ?? null
    fetchError = resLegado.error
  }

  if (fetchError || !rows?.length) return null

  const norm = (x: string) => x.trim().toLowerCase()
  const nq = norm(q)
  const best =
    rows.find((r) => norm(r.nome ?? '') === nq || norm(r.razao_social ?? '') === nq) ??
    rows.find(
      (r) =>
        norm(r.nome ?? '').includes(nq) ||
        norm(r.razao_social ?? '').includes(nq) ||
        nq.includes(norm(r.nome ?? '')) ||
        nq.includes(norm(r.razao_social ?? ''))
    ) ??
    rows[0]

  if (!best) return null
  return parseContratoClienteMtr(best)
}

export function residuoDetalhesVazio(): MtrResiduoDetalhesCampos {
  return {
    fonte_origem: 'Industrial',
    caracterizacao: '',
    estado_fisico: 'SÓLIDO',
    acondicionamento: '',
    quantidade_aproximada: '',
    onu: '',
  }
}

/** Todos os campos em branco (ex.: botão «Limpar» na MTR — sem defaults Industrial/SÓLIDO). */
export function residuoDetalhesLimpo(): MtrResiduoDetalhesCampos {
  return {
    fonte_origem: '',
    caracterizacao: '',
    estado_fisico: '',
    acondicionamento: '',
    quantidade_aproximada: '',
    onu: '',
  }
}

const MTR_SEL_CLIENTE_CONTRATO =
  'nome, razao_social, cnpj, cep, rua, numero, complemento, bairro, cidade, estado, endereco_coleta, responsavel_nome, telefone, tipo_residuo, unidade_medida, classificacao, licenca_numero, codigo_ibama, destino, mtr_destino, residuo_destino, observacoes_operacionais, observacoes_gerais, link_google_maps, descricao_veiculo, mtr_coleta, equipamentos, veiculos_contrato, equipamentos_contrato, residuos_contrato, frequencia_coleta'

const MTR_SEL_CLIENTE_CONTRATO_LEGADO =
  'nome, razao_social, cnpj, cep, rua, numero, complemento, bairro, cidade, estado, endereco_coleta, responsavel_nome, telefone, tipo_residuo, unidade_medida, classificacao, licenca_numero, codigo_ibama, destino, mtr_destino, residuo_destino, observacoes_operacionais, observacoes_gerais, link_google_maps, descricao_veiculo, mtr_coleta, equipamentos, frequencia_coleta'

/** Carrega linha do cliente com colunas de contrato (resíduos, veículos, equipamentos). */
export async function fetchClienteRowContratoMtr(
  client: SupabaseClient,
  clienteId: string
): Promise<{ row: ClienteRowContratoMtr | null; error: string | null }> {
  const id = clienteId.trim()
  if (!id) return { row: null, error: null }

  let res = await client.from('clientes').select(MTR_SEL_CLIENTE_CONTRATO).eq('id', id).maybeSingle()
  if (res.error && isMissingClienteContratoColumnsError(res.error)) {
    res = await client.from('clientes').select(MTR_SEL_CLIENTE_CONTRATO_LEGADO).eq('id', id).maybeSingle()
  }
  if (res.error) return { row: null, error: res.error.message }
  return { row: (res.data as ClienteRowContratoMtr) ?? null, error: null }
}

export function linhaResiduoMtrTemDadosPreenchidos(l: MtrResiduoDetalhesCampos): boolean {
  return Boolean(
    l.caracterizacao.trim() ||
      l.estado_fisico.trim() ||
      l.acondicionamento.trim() ||
      l.quantidade_aproximada.trim() ||
      (l.fonte_origem.trim() && l.fonte_origem.trim() !== 'Industrial') ||
      l.onu.trim()
  )
}

function mesclarLinhaResiduoMtrComModelo(
  existente: MtrResiduoDetalhesCampos | undefined,
  modelo: MtrResiduoDetalhesCampos,
  opts?: { preservarLinhaGravada?: boolean }
): MtrResiduoDetalhesCampos {
  if (
    opts?.preservarLinhaGravada &&
    existente &&
    linhaResiduoMtrTemDadosPreenchidos(existente)
  ) {
    return { ...existente }
  }
  if (!existente || !linhaResiduoMtrTemDadosPreenchidos(existente)) return modelo
  return {
    fonte_origem: existente.fonte_origem.trim() || modelo.fonte_origem,
    caracterizacao: existente.caracterizacao.trim() || modelo.caracterizacao,
    estado_fisico: existente.estado_fisico.trim() || modelo.estado_fisico,
    acondicionamento: existente.acondicionamento.trim() || modelo.acondicionamento,
    quantidade_aproximada: existente.quantidade_aproximada.trim() || modelo.quantidade_aproximada,
    onu: existente.onu.trim() || modelo.onu,
  }
}

/**
 * Garante uma linha de descrição por resíduo cadastrado no cliente (secção 2 da MTR).
 * Preserva dados já preenchidos na MTR; completa linhas em falta a partir do contrato.
 */
export function expandirListaResiduosMtrParaContrato(
  listaAtual: MtrResiduoDetalhesCampos[],
  residuosContrato: ResiduoContratoItem[],
  acondicionamentoPadrao: string,
  opts?: { preservarLinhasGravadas?: boolean }
): MtrResiduoDetalhesCampos[] {
  const validos = residuosContrato.filter(residuoContratoTemConteudo)
  if (validos.length === 0) {
    return listaAtual.length > 0 ? listaAtual : [residuoDetalhesVazio()]
  }

  const modelo = residuosContratoParaListaDetalhesMtr(validos, acondicionamentoPadrao)
  const mergeOpts = { preservarLinhaGravada: opts?.preservarLinhasGravadas === true }

  if (modelo.length <= 1) {
    const unica = mesclarLinhaResiduoMtrComModelo(listaAtual[0], modelo[0]!, mergeOpts)
    return [unica]
  }

  const mescladas = modelo.map((mod, i) =>
    mesclarLinhaResiduoMtrComModelo(listaAtual[i], mod, mergeOpts)
  )
  if (opts?.preservarLinhasGravadas && listaAtual.length > mescladas.length) {
    return [...mescladas, ...listaAtual.slice(mescladas.length)]
  }
  return mescladas
}

/** Resolve cliente da programação e devolve snapshot de contrato. */
export async function fetchContratoClienteMtrPorProgramacao(
  client: SupabaseClient,
  programacao: ProgramacaoMtrRow | { cliente_id?: string | null; cliente?: string | null }
): Promise<MtrContratoClienteSnapshot | null> {
  const clienteId = await resolverClienteIdProgramacaoMtr(client, programacao)
  if (!clienteId) return null
  const { row, error } = await fetchClienteRowContratoMtr(client, clienteId)
  if (error || !row) return null
  return parseContratoClienteMtr(row)
}

/** Todos os resíduos do contrato → linhas da secção 2 do manifesto. */
export function residuosContratoParaListaDetalhesMtr(
  residuos: ResiduoContratoItem[],
  acondicionamentoPadrao: string
): MtrResiduoDetalhesCampos[] {
  const validos = residuos.filter(residuoContratoTemConteudo)
  if (validos.length === 0) return [residuoDetalhesVazio()]
  return validos.map((r, index) => {
    const qtd = formatarPesoKgCampoContrato(r.faturamento_minimo.trim())
    const classe = r.classificacao.trim()
    const tipo = r.tipo_residuo.trim()
    return {
      fonte_origem: 'Industrial',
      caracterizacao: tipo || classe || '',
      estado_fisico: classe || 'SÓLIDO',
      acondicionamento:
        index === 0
          ? acondicionamentoPadrao.trim() || classe || ''
          : classe || acondicionamentoPadrao.trim() || '',
      quantidade_aproximada: qtd,
      onu: '',
    }
  })
}

/** Divide texto com vários resíduos (pipe, ponto médio, ponto e vírgula). */
export function dividirTextoMultiResiduo(texto: string): string[] {
  const t = texto.trim()
  if (!t) return []
  const porBarra = t.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
  if (porBarra.length > 1) return porBarra
  if (t.includes(SEPARADOR_RESIDUOS_TEXTO)) {
    return t.split(SEPARADOR_RESIDUOS_TEXTO).map((s) => s.trim()).filter(Boolean)
  }
  if (/[;]/.test(t)) {
    return t.split(/[;]/).map((s) => s.trim()).filter(Boolean)
  }
  return [t]
}

export function listaResiduosFromDetalhesMtr(detalhes: {
  residuo: MtrResiduoDetalhesCampos
  residuos_lista?: MtrResiduoDetalhesCampos[]
}): MtrResiduoDetalhesCampos[] {
  if (detalhes.residuos_lista && detalhes.residuos_lista.length > 0) {
    return detalhes.residuos_lista
  }
  return [detalhes.residuo]
}

/** Lista para impressão/formulário: JSON, itens de pesagem ou texto legado com pipe/· */
export function listaResiduosParaDocumentoMtr(
  detalhes: {
    residuo: MtrResiduoDetalhesCampos
    residuos_lista?: MtrResiduoDetalhesCampos[]
    residuos_itens?: Array<ResiduoPesagemItem | { texto: string }>
  },
  tipoResiduoTopo?: string
): MtrResiduoDetalhesCampos[] {
  if (detalhes.residuos_lista && detalhes.residuos_lista.length > 0) {
    return detalhes.residuos_lista
  }

  const itens = detalhes.residuos_itens ?? []
  const textosPesagem = itens.map((l) => l.texto.trim()).filter(Boolean)
  if (textosPesagem.length > 0) {
    const base = detalhes.residuo
    return textosPesagem.map((texto, index) => ({
      fonte_origem: base.fonte_origem.trim() || 'Industrial',
      caracterizacao: texto,
      estado_fisico: index === 0 ? base.estado_fisico : '',
      acondicionamento: index === 0 ? base.acondicionamento : '',
      quantidade_aproximada: index === 0 ? base.quantidade_aproximada : '',
      onu: index === 0 ? base.onu : '',
    }))
  }

  const base = detalhes.residuo
  const merged =
    (tipoResiduoTopo ?? '').trim() ||
    base.caracterizacao.trim() ||
    ''
  const partes = dividirTextoMultiResiduo(merged)
  if (partes.length > 1) {
    return partes.map((caracterizacao, index) => ({
      fonte_origem: base.fonte_origem.trim() || 'Industrial',
      caracterizacao,
      estado_fisico: index === 0 ? base.estado_fisico : '',
      acondicionamento: index === 0 ? base.acondicionamento : '',
      quantidade_aproximada: index === 0 ? base.quantidade_aproximada : '',
      onu: index === 0 ? base.onu : '',
    }))
  }

  const partesCarac = dividirTextoMultiResiduo(base.caracterizacao)
  if (partesCarac.length > 1) {
    return partesCarac.map((caracterizacao, index) => ({
      fonte_origem: base.fonte_origem.trim() || 'Industrial',
      caracterizacao,
      estado_fisico: index === 0 ? base.estado_fisico : '',
      acondicionamento: index === 0 ? base.acondicionamento : '',
      quantidade_aproximada: index === 0 ? base.quantidade_aproximada : '',
      onu: index === 0 ? base.onu : '',
    }))
  }

  return [base]
}

export function syncResiduoPrincipalComLista(
  detalhes: { residuo: MtrResiduoDetalhesCampos; residuos_lista?: MtrResiduoDetalhesCampos[] }
): { residuo: MtrResiduoDetalhesCampos; residuos_lista: MtrResiduoDetalhesCampos[] } {
  const lista =
    detalhes.residuos_lista && detalhes.residuos_lista.length > 0
      ? detalhes.residuos_lista
      : [detalhes.residuo]
  const primeiro = lista[0] ?? residuoDetalhesVazio()
  return { residuo: { ...primeiro }, residuos_lista: lista }
}

export function tipoResiduoResumoContrato(residuos: ResiduoContratoItem[]): string {
  const tipos = residuos.map((r) => rotuloResiduoContrato(r)).filter(Boolean)
  if (tipos.length === 0) return ''
  if (tipos.length === 1) return tipos[0]
  return tipos.join(SEPARADOR_RESIDUOS_TEXTO)
}

export type MtrResiduoDetalhesCampos = {
  fonte_origem: string
  caracterizacao: string
  estado_fisico: string
  acondicionamento: string
  quantidade_aproximada: string
  onu: string
}

/** Primeiro resíduo do contrato → bloco «2. Descrição dos resíduos» do manifesto. */
export function residuoDetalhesFromContrato(
  primeiro: ResiduoContratoItem | undefined,
  fallback: MtrResiduoDetalhesCampos,
  acondicionamentoExtra: string
): MtrResiduoDetalhesCampos {
  if (!primeiro || !residuoContratoTemConteudo(primeiro)) {
    return {
      ...fallback,
      acondicionamento: acondicionamentoExtra.trim() || fallback.acondicionamento,
    }
  }
  const qtd = formatarPesoKgCampoContrato(primeiro.faturamento_minimo.trim())
  const tipo = primeiro.tipo_residuo.trim()
  const classe = primeiro.classificacao.trim()
  return {
    fonte_origem: fallback.fonte_origem.trim() || 'Industrial',
    caracterizacao: tipo || classe || fallback.caracterizacao,
    estado_fisico: classe || fallback.estado_fisico || 'SÓLIDO',
    acondicionamento:
      acondicionamentoExtra.trim() ||
      primeiro.classificacao.trim() ||
      fallback.acondicionamento,
    quantidade_aproximada: qtd || fallback.quantidade_aproximada,
    onu: fallback.onu,
  }
}

export function acondicionamentoFromContratoVeiculoEquipamento(
  contrato: MtrContratoClienteSnapshot,
  tipoCaminhaoProgramacao: string
): string {
  const cam = contrato.veiculos[0]?.tipo_veiculo.trim()
  const eq = contrato.equipamentos[0]?.descricao.trim()
  return (tipoCaminhaoProgramacao || cam || eq || '').trim()
}

/** Reconstrói painel do contrato a partir de `mtrs.detalhes` já gravados. */
export function snapshotContratoFromDetalhesMtr(detalhes: {
  contrato_veiculos?: VeiculoContratoItem[]
  contrato_equipamentos?: EquipamentoContratoItem[]
  residuos_lista?: MtrResiduoDetalhesCampos[]
  residuo?: MtrResiduoDetalhesCampos
  residuos_itens?: ResiduoPesagemItem[]
} | null | undefined): MtrContratoClienteSnapshot | null {
  if (!detalhes) return null
  const veiculos = detalhes.contrato_veiculos ?? []
  const equipamentos = detalhes.contrato_equipamentos ?? []
  const listaDesc = listaResiduosFromDetalhesMtr({
    residuo: detalhes.residuo ?? residuoDetalhesVazio(),
    residuos_lista: detalhes.residuos_lista,
  })
  const residuos: ResiduoContratoItem[] = listaDesc.map((l) => ({
    tipo_residuo: l.caracterizacao.trim(),
    classificacao: l.estado_fisico.trim(),
    unidade_medida: 'kg',
    valor: '',
    frequencia_coleta: '',
    faturamento_minimo: l.quantidade_aproximada.trim(),
  }))
  if (veiculos.length === 0 && equipamentos.length === 0 && residuos.length === 0) return null
  return {
    veiculos,
    equipamentos,
    residuos,
    rotuloVeiculos: rotuloVeiculosContratoResumo(veiculos, null),
    rotuloEquipamentos: rotuloEquipamentosContratoResumo(equipamentos, null),
    rotuloResiduos: residuos.map((r) => rotuloResiduoContrato(r)).join(' · ') || '—',
  }
}
