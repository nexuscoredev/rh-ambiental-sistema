import { listarColetaIdsPorMtr } from './excluirOperacionalCascata'
import {
  coletaElegivelParaFaturar,
  rotuloMotivoInelegivel,
} from './faturamentoElegibilidade'
import {
  coletaAguardandoConfirmacaoNfBoleto,
  passoUiEsteiraDaColeta,
  ROTULO_PASSO_UI_ESTEIRA,
} from './faturamentoEsteira'
import { coletaHistoricoFaturamentoEmitido, coletaNaFilaFaturamento } from './faturamentoOperacionalFila'
import {
  montarParamsFluxoColeta,
  type FaturamentoResumoViewRow,
} from './faturamentoResumo'
import { fetchVwFaturamentoResumoPorColetaIds } from './faturamentoResumoFetch'
import {
  buscarMtrPorNumero,
  listarHistoricoMtrsBaixadas,
  type MtrBaixadaHistoricoRow,
} from './gerenciadorMtrHistorico'
import { supabase } from './supabase'
import { mensagemErroSupabase } from './supabaseErrors'
import { buildUrlEnvioNfMedicao } from './coletaContextoUrl'
import { coletaPodeEnviarParaFilaAjusteFaturamento } from './mtrGerenciadorFilaFaturamento'
import {
  atualizarLinhaPendenteEnvio,
  lerLinhasPendentesEnvio,
  type LinhaPendenteEnvioGerenciador,
} from './gerenciadorMtrEnvio'

export type OrigemLinhaRelatorioMtr = 'sistema' | 'cadastro_manual'

export type MtrGerenciadorRelatorioLinha = {
  chave: string
  origem: OrigemLinhaRelatorioMtr
  /** Linha em `clientes_gerenciador_mtr_linhas` (origem cadastro). */
  linhaCadastroId: string | null
  gerenciadorId: string | null
  gerenciadorNome: string | null
  mtrId: string
  mtrNumero: string
  baixadaEm: string
  baixaJustificativa: string
  cenarioComplexo: boolean
  gerador: string
  residuo: string
  quantidade: string
  /** Valor numérico em `mtrs.quantidade` (edição). */
  quantidadeNum: number | null
  unidade: string
  clienteMtr: string
  coletaId: string | null
  numeroColeta: string
  clienteNome: string
  pesoLiquidoKg: string
  /** Peso em kg na coleta (`coletas.peso_liquido`), quando vinculada. */
  pesoLiquidoNum: number | null
  statusConferencia: string
  pendencias: string
  passoEsteira: string
  naFilaFaturar: boolean
  bloqueios: string[]
  registroFaturamento: string
  urlFaturamento: string | null
  urlMalaDiretaMedicao: string | null
  urlMalaDiretaNf: string | null
  urlMtr: string | null
  urlControleMassa: string | null
  podeEnviarParaFilaFaturamento: boolean
  /** Motivo visível quando o botão «Enviar para fila» está desativado; null se pode enviar. */
  bloqueioEnviarFila: string | null
  tooltipEnviarFilaFaturamento: string
}

type MtrBaixaExtra = MtrBaixadaHistoricoRow & {
  baixaJustificativa: string
  cenarioComplexo: boolean
  quantidadeNum: number | null
  unidade: string
}

export type SalvarLinhaMtrGerenciadorInput = {
  origem?: OrigemLinhaRelatorioMtr
  linhaCadastroId?: string | null
  mtrNumero?: string
  mtrId: string
  coletaId: string | null
  gerador: string
  tipoResiduo: string
  quantidadeTexto: string
  clienteMtr: string
  baixaJustificativa: string
  pesoLiquidoTexto: string
}

/** Normaliza número de MTR para comparação e deduplicação no relatório. */
export function normalizarNumeroMtrRelatorio(numero: string | null | undefined): string {
  return String(numero ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

export type SalvarLinhaMtrGerenciadorResult =
  | { ok: true }
  | { ok: false; message: string }

/** Interpreta «1000 kg» ou «1000» para gravação em `mtrs.quantidade` / `unidade`. */
export function parseQuantidadeGerenciadorRelatorio(texto: string): {
  quantidade: number | null
  unidade: string | null
} {
  const t = texto.trim()
  if (!t || t === '—') return { quantidade: null, unidade: null }
  const m = t.match(/^([\d.,]+)\s*(.*)$/)
  if (!m) return { quantidade: null, unidade: null }
  const num = Number.parseFloat(m[1].replace(',', '.'))
  const unidade = (m[2] ?? '').trim() || null
  return {
    quantidade: Number.isFinite(num) ? num : null,
    unidade,
  }
}

export function formatarQuantidadeGerenciadorRelatorio(
  q: number | null | undefined,
  unidade: string | null | undefined
): string {
  if (q == null || !Number.isFinite(Number(q))) return ''
  const u = (unidade ?? '').trim()
  return u ? `${q} ${u}` : String(q)
}

function parsePesoLiquidoInput(texto: string): number | null {
  const t = texto.trim().replace(/\s*kg\s*$/i, '').replace(',', '.')
  if (!t || t === '—') return null
  const n = Number.parseFloat(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function atualizarMtrSistemaRelatorio(
  mtrId: string,
  input: SalvarLinhaMtrGerenciadorInput
): Promise<SalvarLinhaMtrGerenciadorResult> {
  const { quantidade, unidade: unidadeParse } = parseQuantidadeGerenciadorRelatorio(
    input.quantidadeTexto
  )

  const patchMtr: Record<string, unknown> = {
    gerador: input.gerador.trim() || null,
    tipo_residuo: input.tipoResiduo.trim() || null,
    cliente: input.clienteMtr.trim() || null,
    baixa_justificativa: input.baixaJustificativa.trim() || null,
  }

  if (input.quantidadeTexto.trim() && input.quantidadeTexto.trim() !== '—') {
    patchMtr.quantidade = quantidade
    if (unidadeParse != null) patchMtr.unidade = unidadeParse
  } else {
    patchMtr.quantidade = null
    patchMtr.unidade = ''
  }

  const { error: errMtr } = await supabase.from('mtrs').update(patchMtr).eq('id', mtrId)
  if (errMtr) {
    return {
      ok: false,
      message: mensagemErroSupabase(errMtr, 'Não foi possível salvar os dados da MTR.'),
    }
  }

  const coletaId = (input.coletaId ?? '').trim()
  if (coletaId) {
    const peso = parsePesoLiquidoInput(input.pesoLiquidoTexto)
    const patchColeta: Record<string, unknown> = {}
    if (input.pesoLiquidoTexto.trim() && input.pesoLiquidoTexto.trim() !== '—') {
      patchColeta.peso_liquido = peso
    } else {
      patchColeta.peso_liquido = null
    }

    if (Object.keys(patchColeta).length > 0) {
      const { error: errColeta } = await supabase
        .from('coletas')
        .update(patchColeta)
        .eq('id', coletaId)
      if (errColeta) {
        return {
          ok: false,
          message: mensagemErroSupabase(errColeta, 'MTR salva, mas o peso da coleta não foi atualizado.'),
        }
      }
    }
  }

  return { ok: true }
}

export async function salvarLinhaRelatorioMtrGerenciador(
  input: SalvarLinhaMtrGerenciadorInput
): Promise<SalvarLinhaMtrGerenciadorResult> {
  const origem = input.origem ?? 'sistema'
  const linhaCadastroId = (input.linhaCadastroId ?? '').trim()

  if (origem === 'cadastro_manual') {
    if (!linhaCadastroId) {
      const numero = (input.mtrNumero ?? '').trim()
      const pesoTxt = input.pesoLiquidoTexto.trim()
      if (!numero) {
        return { ok: false, message: 'Número da MTR inválido para salvar.' }
      }
      atualizarLinhaPendenteEnvio(numero, {
        gerador: input.gerador.trim(),
        residuo: input.tipoResiduo.trim(),
        quantidade: input.quantidadeTexto.trim(),
        peso: pesoTxt && pesoTxt !== '—' ? pesoTxt : '',
      })
      return { ok: true }
    }

    const patchCadastro: Record<string, unknown> = {
      gerador: input.gerador.trim() || null,
      residuo: input.tipoResiduo.trim() || null,
      quantidade:
        input.quantidadeTexto.trim() && input.quantidadeTexto.trim() !== '—'
          ? input.quantidadeTexto.trim()
          : null,
    }

    if (input.pesoLiquidoTexto.trim() && input.pesoLiquidoTexto.trim() !== '—') {
      patchCadastro.peso_kg = parsePesoLiquidoInput(input.pesoLiquidoTexto)
    } else {
      patchCadastro.peso_kg = null
    }

    const { error: errCadastro } = await supabase
      .from('clientes_gerenciador_mtr_linhas')
      .update(patchCadastro)
      .eq('id', linhaCadastroId)
    if (errCadastro) {
      return {
        ok: false,
        message: mensagemErroSupabase(
          errCadastro,
          'Não foi possível salvar a linha no cadastro Gerenciador.'
        ),
      }
    }

    const mtrId = input.mtrId.trim()
    if (mtrId) {
      const resMtr = await atualizarMtrSistemaRelatorio(mtrId, input)
      if (!resMtr.ok) return resMtr
    }

    return { ok: true }
  }

  const mtrId = input.mtrId.trim()
  if (!mtrId) return { ok: false, message: 'MTR inválida.' }
  return atualizarMtrSistemaRelatorio(mtrId, input)
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatarPeso(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(Number(p)) || Number(p) <= 0) return '—'
  return `${Number(p)} kg`
}

function montarUrlsAcao(
  row: FaturamentoResumoViewRow | null,
  mtrId: string
): Pick<
  MtrGerenciadorRelatorioLinha,
  'urlFaturamento' | 'urlMalaDiretaMedicao' | 'urlMalaDiretaNf' | 'urlMtr' | 'urlControleMassa'
> {
  if (!row?.coleta_id) {
    return {
      urlFaturamento: null,
      urlMalaDiretaMedicao: null,
      urlMalaDiretaNf: null,
      urlMtr: `/mtr?mtr=${encodeURIComponent(mtrId)}`,
      urlControleMassa: null,
    }
  }
  const passo = passoUiEsteiraDaColeta(row)
  const p = montarParamsFluxoColeta(row)
  return {
    urlFaturamento: `/faturamento?${p.toString()}`,
    urlMalaDiretaMedicao:
      passo != null && passo >= 3 && passo <= 5
        ? buildUrlEnvioNfMedicao({ clienteId: row.cliente_id, coletaId: row.coleta_id })
        : null,
    urlMalaDiretaNf:
      coletaAguardandoConfirmacaoNfBoleto(row) || passo === 7
        ? `/envio-nf?${p.toString()}`
        : null,
    urlMtr: row.mtr_id ? `/mtr?mtr=${encodeURIComponent(row.mtr_id)}` : `/mtr?mtr=${encodeURIComponent(mtrId)}`,
    urlControleMassa: `/controle-massa?${p.toString()}`,
  }
}

function linhaSemColeta(mtr: MtrBaixaExtra): MtrGerenciadorRelatorioLinha {
  const urls = montarUrlsAcao(null, mtr.id)
  const qtdFmt =
    formatarQuantidadeGerenciadorRelatorio(mtr.quantidadeNum, mtr.unidade) ||
    mtr.quantidade ||
    '—'
  return {
    chave: `${mtr.id}-sem-coleta`,
    origem: 'sistema',
    linhaCadastroId: null,
    gerenciadorId: null,
    gerenciadorNome: null,
    mtrId: mtr.id,
    mtrNumero: mtr.numero || '—',
    baixadaEm: mtr.data ? formatarDataHora(`${mtr.data}T12:00:00`) : '—',
    baixaJustificativa: mtr.baixaJustificativa || '—',
    cenarioComplexo: mtr.cenarioComplexo,
    gerador: mtr.gerador || '—',
    residuo: mtr.residuo || '—',
    quantidade: qtdFmt === '' ? '—' : qtdFmt,
    quantidadeNum: mtr.quantidadeNum,
    unidade: mtr.unidade,
    clienteMtr: mtr.cliente || '—',
    coletaId: null,
    numeroColeta: '—',
    clienteNome: '—',
    pesoLiquidoKg: '—',
    pesoLiquidoNum: null,
    statusConferencia: '—',
    pendencias: 'Sem coleta vinculada à MTR',
    passoEsteira: '—',
    naFilaFaturar: false,
    bloqueios: ['Use «Vincular coleta» nas ações desta linha'],
    registroFaturamento: '—',
    ...urls,
    podeEnviarParaFilaFaturamento: false,
    bloqueioEnviarFila: 'Sem coleta vinculada à MTR',
    tooltipEnviarFilaFaturamento: 'Sem coleta vinculada à MTR',
  }
}

function linhaComColeta(
  mtr: MtrBaixaExtra,
  vw: FaturamentoResumoViewRow,
  todasVw: FaturamentoResumoViewRow[]
): MtrGerenciadorRelatorioLinha {
  const eleg = coletaElegivelParaFaturar(vw, todasVw)
  const passo = passoUiEsteiraDaColeta(vw, todasVw)
  const enviarFila = coletaPodeEnviarParaFilaAjusteFaturamento(vw, todasVw)
  const urls = montarUrlsAcao(vw, mtr.id)

  let registro = 'Pendente'
  if (coletaHistoricoFaturamentoEmitido(vw)) registro = 'Emitido'
  else if (vw.faturamento_registro_status) registro = vw.faturamento_registro_status

  return {
    chave: `${mtr.id}-${vw.coleta_id}`,
    origem: 'sistema',
    linhaCadastroId: null,
    gerenciadorId: null,
    gerenciadorNome: null,
    mtrId: mtr.id,
    mtrNumero: mtr.numero || vw.mtr_numero || '—',
    baixadaEm: mtr.data ? formatarDataHora(`${mtr.data}T12:00:00`) : '—',
    baixaJustificativa: mtr.baixaJustificativa || vw.mtr_baixa_justificativa || '—',
    cenarioComplexo: mtr.cenarioComplexo || !!vw.mtr_baixa_cenario_complexo,
    gerador: mtr.gerador || '—',
    residuo: mtr.residuo || vw.tipo_residuo || '—',
    quantidade:
      formatarQuantidadeGerenciadorRelatorio(mtr.quantidadeNum, mtr.unidade) ||
      mtr.quantidade ||
      '—',
    quantidadeNum: mtr.quantidadeNum,
    unidade: mtr.unidade,
    clienteMtr: mtr.cliente || '—',
    coletaId: vw.coleta_id,
    numeroColeta: vw.numero_coleta != null ? String(vw.numero_coleta) : vw.numero || '—',
    clienteNome: vw.cliente_nome || vw.cliente_razao_social || '—',
    pesoLiquidoKg: formatarPeso(vw.peso_liquido),
    pesoLiquidoNum:
      vw.peso_liquido != null && Number.isFinite(Number(vw.peso_liquido)) && Number(vw.peso_liquido) > 0
        ? Number(vw.peso_liquido)
        : null,
    statusConferencia: vw.status_conferencia || '—',
    pendencias: vw.pendencias_resumo || '—',
    passoEsteira: passo ? ROTULO_PASSO_UI_ESTEIRA[passo] : 'Fora da esteira',
    naFilaFaturar: coletaNaFilaFaturamento(vw, todasVw),
    bloqueios: eleg.ok ? [] : eleg.motivos.map(rotuloMotivoInelegivel),
    registroFaturamento: registro,
    ...urls,
    podeEnviarParaFilaFaturamento: enviarFila.pode,
    bloqueioEnviarFila: enviarFila.pode ? null : enviarFila.motivo,
    tooltipEnviarFilaFaturamento: enviarFila.motivo,
  }
}

async function carregarExtrasBaixa(
  mtrs: MtrBaixadaHistoricoRow[]
): Promise<
  Map<
    string,
    {
      baixaJustificativa: string
      cenarioComplexo: boolean
      quantidadeNum: number | null
      unidade: string
    }
  >
> {
  const ids = mtrs.map((m) => m.id)
  if (!ids.length) return new Map()
  const { data, error } = await supabase
    .from('mtrs')
    .select('id, baixa_justificativa, baixa_cenario_complexo, quantidade, unidade')
    .in('id', ids)
  if (error) return new Map()
  const map = new Map<
    string,
    {
      baixaJustificativa: string
      cenarioComplexo: boolean
      quantidadeNum: number | null
      unidade: string
    }
  >()
  for (const r of data ?? []) {
    const qRaw = r.quantidade != null ? Number(r.quantidade) : null
    map.set(String(r.id), {
      baixaJustificativa: String(r.baixa_justificativa ?? ''),
      cenarioComplexo: !!r.baixa_cenario_complexo,
      quantidadeNum: qRaw != null && Number.isFinite(qRaw) ? qRaw : null,
      unidade: String(r.unidade ?? ''),
    })
  }
  return map
}

export async function carregarRelatorioMtrGerenciador(): Promise<{
  linhas: MtrGerenciadorRelatorioLinha[]
  erro: string | null
}> {
  const { rows: mtrsBase, erro: errMtr } = await listarHistoricoMtrsBaixadas()
  if (errMtr) return { linhas: [], erro: errMtr }
  if (!mtrsBase.length) return { linhas: [], erro: null }

  const extras = await carregarExtrasBaixa(mtrsBase)
  const mtrs: MtrBaixaExtra[] = mtrsBase.map((m) => {
    const ex = extras.get(m.id)
    return {
      ...m,
      baixaJustificativa: ex?.baixaJustificativa ?? '',
      cenarioComplexo: ex?.cenarioComplexo ?? false,
      quantidadeNum: ex?.quantidadeNum ?? null,
      unidade: ex?.unidade ?? '',
    }
  })

  const coletaIdsPorMtr = new Map<string, string[]>()
  const todosColetaIds: string[] = []

  await Promise.all(
    mtrs.map(async (m) => {
      const ids = await listarColetaIdsPorMtr(supabase, m.id)
      coletaIdsPorMtr.set(m.id, ids)
      todosColetaIds.push(...ids)
    })
  )

  const uniqColeta = [...new Set(todosColetaIds)]
  let vwRows: FaturamentoResumoViewRow[] = []
  if (uniqColeta.length > 0) {
    const { data, error } = await fetchVwFaturamentoResumoPorColetaIds(supabase, uniqColeta)
    if (error) {
      return {
        linhas: [],
        erro: mensagemErroSupabase(error, 'Não foi possível carregar o estado de faturamento.'),
      }
    }
    vwRows = data
  }

  const vwPorColeta = new Map(vwRows.map((r) => [r.coleta_id, r]))
  const linhas: MtrGerenciadorRelatorioLinha[] = []

  for (const mtr of mtrs) {
    const coletaIds = coletaIdsPorMtr.get(mtr.id) ?? []
    if (!coletaIds.length) {
      linhas.push(linhaSemColeta(mtr))
      continue
    }
    for (const cid of coletaIds) {
      const vw = vwPorColeta.get(cid)
      if (vw) linhas.push(linhaComColeta(mtr, vw, vwRows))
      else {
        linhas.push({
          ...linhaSemColeta(mtr),
          chave: `${mtr.id}-${cid}`,
          coletaId: cid,
          pendencias: 'Coleta sem dados na vista de faturamento',
          podeEnviarParaFilaFaturamento: false,
          bloqueioEnviarFila: 'Coleta sem dados na vista de faturamento',
          tooltipEnviarFilaFaturamento: 'Coleta sem dados na vista de faturamento',
        })
      }
    }
  }

  linhas.sort((a, b) => {
    const da = a.baixadaEm === '—' ? '' : a.baixadaEm
    const db = b.baixadaEm === '—' ? '' : b.baixadaEm
    return db.localeCompare(da, 'pt-BR')
  })

  return { linhas, erro: null }
}

type CadastroMtrLinhaDb = {
  id: string
  gerenciador_id: string
  mtr_baixada: string | null
  data: string | null
  gerador: string | null
  residuo: string | null
  quantidade: string | null
  peso_kg: number | null
  clientes_gerenciador: { nome_exibicao: string | null } | null
}

function ordenarLinhasRelatorio(linhas: MtrGerenciadorRelatorioLinha[]): MtrGerenciadorRelatorioLinha[] {
  return [...linhas].sort((a, b) => {
    const da = a.baixadaEm === '—' ? '' : a.baixadaEm
    const db = b.baixadaEm === '—' ? '' : b.baixadaEm
    return db.localeCompare(da, 'pt-BR')
  })
}

function montarLinhaRelatorioEnvioPendente(p: LinhaPendenteEnvioGerenciador): MtrGerenciadorRelatorioLinha {
  const numero = p.numero.trim()
  const norm = normalizarNumeroMtrRelatorio(numero)
  const pesoNum = parsePesoLiquidoInput(p.peso)

  return {
    chave: `envio-${norm || numero}`,
    origem: 'cadastro_manual',
    linhaCadastroId: null,
    gerenciadorId: null,
    gerenciadorNome: null,
    mtrId: '',
    mtrNumero: numero || '—',
    baixadaEm: p.data ? formatarDataHora(`${p.data}T12:00:00`) : '—',
    baixaJustificativa: '—',
    cenarioComplexo: false,
    gerador: p.gerador || '—',
    residuo: p.residuo || '—',
    quantidade: p.quantidade || '—',
    quantidadeNum: null,
    unidade: '',
    clienteMtr: '—',
    coletaId: null,
    numeroColeta: '—',
    clienteNome: 'Envio Gerenciador',
    pesoLiquidoKg: formatarPeso(pesoNum),
    pesoLiquidoNum: pesoNum,
    statusConferencia: '—',
    pendencias: 'Cadastro manual — MTR ainda não registrada no sistema',
    passoEsteira: '—',
    naFilaFaturar: false,
    bloqueios: ['Registre a MTR no sistema ou salve no cadastro Gerenciador'],
    registroFaturamento: '—',
    urlFaturamento: null,
    urlMalaDiretaMedicao: null,
    urlMalaDiretaNf: null,
    urlMtr: null,
    urlControleMassa: null,
    podeEnviarParaFilaFaturamento: false,
    bloqueioEnviarFila: 'MTR não existe no sistema',
    tooltipEnviarFilaFaturamento: 'MTR não existe no sistema',
  }
}

async function carregarLinhasEnvioPendenteRelatorio(
  numerosJaIncluidos: Set<string>
): Promise<MtrGerenciadorRelatorioLinha[]> {
  const pendentes = lerLinhasPendentesEnvio()
  const linhas: MtrGerenciadorRelatorioLinha[] = []

  for (const p of pendentes) {
    const norm = normalizarNumeroMtrRelatorio(p.numero)
    if (!norm || numerosJaIncluidos.has(norm)) continue
    const mtr = await buscarMtrPorNumero(p.numero)
    if (mtr) continue
    linhas.push(montarLinhaRelatorioEnvioPendente(p))
    numerosJaIncluidos.add(norm)
  }

  return linhas
}

function montarLinhaRelatorioCadastroManual(
  row: CadastroMtrLinhaDb,
  mtrIdResolvido: string | null
): MtrGerenciadorRelatorioLinha {
  const numero = String(row.mtr_baixada ?? '').trim()
  const gerRaw = row.clientes_gerenciador
  const gerenciadorNome = String(
    Array.isArray(gerRaw) ? gerRaw[0]?.nome_exibicao : gerRaw?.nome_exibicao ?? ''
  ).trim()
  const pesoNum =
    row.peso_kg != null && Number.isFinite(Number(row.peso_kg)) && Number(row.peso_kg) > 0
      ? Number(row.peso_kg)
      : null
  const temMtrSistema = !!mtrIdResolvido

  return {
    chave: `cadastro-${row.id}`,
    origem: 'cadastro_manual',
    linhaCadastroId: row.id,
    gerenciadorId: row.gerenciador_id,
    gerenciadorNome: gerenciadorNome || null,
    mtrId: mtrIdResolvido ?? '',
    mtrNumero: numero || '—',
    baixadaEm: row.data ? formatarDataHora(`${row.data}T12:00:00`) : '—',
    baixaJustificativa: '—',
    cenarioComplexo: false,
    gerador: row.gerador?.trim() || '—',
    residuo: row.residuo?.trim() || '—',
    quantidade: row.quantidade?.trim() || '—',
    quantidadeNum: null,
    unidade: '',
    clienteMtr: '—',
    coletaId: null,
    numeroColeta: '—',
    clienteNome: gerenciadorNome || 'Cadastro Gerenciador',
    pesoLiquidoKg: formatarPeso(pesoNum),
    pesoLiquidoNum: pesoNum,
    statusConferencia: '—',
    pendencias: temMtrSistema
      ? 'Cadastro Gerenciador — MTR no sistema; confira baixa e coleta'
      : 'Cadastro Gerenciador — MTR ainda não registrada no sistema',
    passoEsteira: '—',
    naFilaFaturar: false,
    bloqueios: temMtrSistema
      ? ['Confirme a baixa no painel superior ou vincule coleta']
      : ['Registre a MTR no sistema ou use o painel de baixa manual'],
    registroFaturamento: '—',
    urlFaturamento: null,
    urlMalaDiretaMedicao: null,
    urlMalaDiretaNf: null,
    urlMtr: temMtrSistema ? `/mtr?mtr=${encodeURIComponent(mtrIdResolvido!)}` : null,
    urlControleMassa: null,
    podeEnviarParaFilaFaturamento: false,
    bloqueioEnviarFila: temMtrSistema
      ? 'Vincule coleta e confirme elegibilidade'
      : 'MTR não existe no sistema',
    tooltipEnviarFilaFaturamento: temMtrSistema
      ? 'Vincule coleta e confirme elegibilidade'
      : 'Registre a MTR no sistema antes de enviar à fila',
  }
}

async function carregarLinhasCadastroManualRelatorio(): Promise<{
  linhas: MtrGerenciadorRelatorioLinha[]
  erro: string | null
}> {
  const { data, error } = await supabase
    .from('clientes_gerenciador_mtr_linhas')
    .select(
      'id, gerenciador_id, mtr_baixada, data, gerador, residuo, quantidade, peso_kg, clientes_gerenciador ( nome_exibicao )'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return {
      linhas: [],
      erro: mensagemErroSupabase(error, 'Não foi possível carregar linhas do cadastro Gerenciador.'),
    }
  }

  const rows = ((data ?? []) as unknown as CadastroMtrLinhaDb[]).filter((r) =>
    String(r.mtr_baixada ?? '').trim()
  )

  const numerosUnicos = [
    ...new Set(rows.map((r) => normalizarNumeroMtrRelatorio(r.mtr_baixada)).filter(Boolean)),
  ]
  const mtrIdPorNumero = new Map<string, string>()
  await Promise.all(
    numerosUnicos.map(async (norm) => {
      const row = rows.find((r) => normalizarNumeroMtrRelatorio(r.mtr_baixada) === norm)
      if (!row) return
      const mtr = await buscarMtrPorNumero(String(row.mtr_baixada ?? '').trim())
      if (mtr) mtrIdPorNumero.set(norm, mtr.id)
    })
  )

  const linhas = rows.map((row) => {
    const norm = normalizarNumeroMtrRelatorio(row.mtr_baixada)
    const mtrId = norm ? mtrIdPorNumero.get(norm) ?? null : null
    return montarLinhaRelatorioCadastroManual(row, mtrId)
  })

  return { linhas, erro: null }
}

/** Relatório completo: MTRs baixadas no sistema + linhas salvas no cadastro Gerenciador. */
export async function carregarRelatorioMtrGerenciadorCompleto(): Promise<{
  linhas: MtrGerenciadorRelatorioLinha[]
  erro: string | null
}> {
  const [sistema, cadastro] = await Promise.all([
    carregarRelatorioMtrGerenciador(),
    carregarLinhasCadastroManualRelatorio(),
  ])

  if (sistema.erro && cadastro.erro) {
    return { linhas: [], erro: sistema.erro }
  }

  const numerosSistema = new Set(
    sistema.linhas
      .map((l) => normalizarNumeroMtrRelatorio(l.mtrNumero))
      .filter(Boolean)
  )

  const manualSemDuplicar = cadastro.linhas.filter((l) => {
    const norm = normalizarNumeroMtrRelatorio(l.mtrNumero)
    return norm && !numerosSistema.has(norm)
  })

  const merged = [...sistema.linhas, ...manualSemDuplicar]
  const numerosMerged = new Set(
    merged.map((l) => normalizarNumeroMtrRelatorio(l.mtrNumero)).filter(Boolean)
  )
  const envioPendente = await carregarLinhasEnvioPendenteRelatorio(numerosMerged)

  return {
    linhas: ordenarLinhasRelatorio([...merged, ...envioPendente]),
    erro: sistema.erro ?? cadastro.erro,
  }
}

/** Une linhas do sistema com cadastro manual, sem duplicar por número de MTR já baixada. */
export function mesclarLinhasRelatorioMtrGerenciador(
  sistema: MtrGerenciadorRelatorioLinha[],
  cadastro: MtrGerenciadorRelatorioLinha[]
): MtrGerenciadorRelatorioLinha[] {
  const numerosSistema = new Set(
    sistema.map((l) => normalizarNumeroMtrRelatorio(l.mtrNumero)).filter(Boolean)
  )
  const manual = cadastro.filter((l) => {
    const norm = normalizarNumeroMtrRelatorio(l.mtrNumero)
    return norm && !numerosSistema.has(norm)
  })
  return ordenarLinhasRelatorio([...sistema, ...manual])
}
