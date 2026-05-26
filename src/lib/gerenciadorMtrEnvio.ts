import type { ResiduoContratoItem } from './clienteContratoCadastro'

export type LinhaGerenciadorEnvio = {
  mtr_baixada: string
  data: string
  gerador: string
  residuo: string
  quantidade: string
  peso: string
  valor_unitario: string
  valor_total: string
}
import { parseNumeroCampo } from './faturamentoDesvinculacao'
import { buscarMtrPorNumero, type MtrResumoGerenciador } from './gerenciadorMtrHistorico'
import { parseQuantidadeGerenciadorRelatorio } from './mtrGerenciadorRelatorio'
import { resolverVinculoMtrGerenciador } from './mtrGerenciadorVinculoColeta'
import { listarColetaIdsPorMtr } from './excluirOperacionalCascata'
import { supabase } from './supabase'
import { mensagemErroSupabase } from './supabaseErrors'

export type ResultadoEnvioLinhaGerenciador = {
  numero: string
  mtr: MtrResumoGerenciador | null
  dadosAplicados: boolean
  coletaIds: string[]
  erroAplicar: string | null
}

export type ResultadoPrepararEnvioGerenciador = {
  linhas: ResultadoEnvioLinhaGerenciador[]
  /** Números informados na tabela que não existem em `mtrs`. */
  naoEncontrados: string[]
}

/** sessionStorage: referência ao abrir o gerenciador sem MTR no sistema. */
export const GERENCIADOR_MTR_NAO_ENCONTRADAS_STORAGE = 'rg-gerenciador-mtr-nao-encontradas'

/** Dados da tabela Gerenciador para MTR ainda não existente em `mtrs`. */
export type LinhaPendenteEnvioGerenciador = {
  numero: string
  data: string
  gerador: string
  residuo: string
  quantidade: string
  peso: string
}

export const GERENCIADOR_MTR_LINHAS_PENDENTES_STORAGE = 'rg-gerenciador-mtr-linhas-pendentes-envio'

export function armazenarMtrsNaoEncontradasEnvio(numeros: string[]): void {
  const nums = numeros.map((n) => n.trim()).filter(Boolean)
  if (!nums.length) return
  try {
    sessionStorage.setItem(GERENCIADOR_MTR_NAO_ENCONTRADAS_STORAGE, JSON.stringify(nums))
  } catch {
    /* quota / modo privado */
  }
}

export function lerMtrsNaoEncontradasEnvio(): string[] {
  try {
    const raw = sessionStorage.getItem(GERENCIADOR_MTR_NAO_ENCONTRADAS_STORAGE)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((n) => String(n).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function normalizarNumeroEnvio(numero: string): string {
  return numero.trim().toLowerCase().replace(/\s+/g, '')
}

export function armazenarLinhasPendentesEnvio(linhas: LinhaGerenciadorEnvio[]): void {
  const novas: LinhaPendenteEnvioGerenciador[] = []
  for (const l of linhas) {
    const numero = l.mtr_baixada.trim()
    if (!numero) continue
    novas.push({
      numero,
      data: l.data.trim(),
      gerador: l.gerador.trim(),
      residuo: l.residuo.trim(),
      quantidade: l.quantidade.trim(),
      peso: l.peso.trim(),
    })
  }
  if (!novas.length) return

  const existentes = lerLinhasPendentesEnvio()
  const map = new Map<string, LinhaPendenteEnvioGerenciador>()
  for (const e of existentes) {
    const k = normalizarNumeroEnvio(e.numero)
    if (k) map.set(k, e)
  }
  for (const n of novas) {
    const k = normalizarNumeroEnvio(n.numero)
    if (k) map.set(k, n)
  }

  try {
    sessionStorage.setItem(
      GERENCIADOR_MTR_LINHAS_PENDENTES_STORAGE,
      JSON.stringify([...map.values()])
    )
  } catch {
    /* quota / modo privado */
  }
}

export function lerLinhasPendentesEnvio(): LinhaPendenteEnvioGerenciador[] {
  try {
    const raw = sessionStorage.getItem(GERENCIADOR_MTR_LINHAS_PENDENTES_STORAGE)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        const o = item as Record<string, unknown>
        return {
          numero: String(o.numero ?? '').trim(),
          data: String(o.data ?? '').trim(),
          gerador: String(o.gerador ?? '').trim(),
          residuo: String(o.residuo ?? '').trim(),
          quantidade: String(o.quantidade ?? '').trim(),
          peso: String(o.peso ?? '').trim(),
        }
      })
      .filter((l) => l.numero)
  } catch {
    return []
  }
}

export function atualizarLinhaPendenteEnvio(
  numero: string,
  patch: Partial<Omit<LinhaPendenteEnvioGerenciador, 'numero'>>
): void {
  const alvo = normalizarNumeroEnvio(numero)
  if (!alvo) return
  const lista = lerLinhasPendentesEnvio()
  const idx = lista.findIndex((l) => normalizarNumeroEnvio(l.numero) === alvo)
  if (idx < 0) return
  lista[idx] = { ...lista[idx]!, ...patch, numero: lista[idx]!.numero }
  try {
    sessionStorage.setItem(GERENCIADOR_MTR_LINHAS_PENDENTES_STORAGE, JSON.stringify(lista))
  } catch {
    /* quota */
  }
}

/** Rota do histórico; opcionalmente leva números não encontrados na query e no sessionStorage. */
export function rotaGerenciadorHistoricoEnvio(opts?: { naoEncontrados?: string[] }): string {
  const p = new URLSearchParams()
  p.set('historico', '1')
  const nums = (opts?.naoEncontrados ?? []).map((n) => n.trim()).filter(Boolean)
  if (nums.length) {
    p.set('mtrPendentes', nums.join(','))
    armazenarMtrsNaoEncontradasEnvio(nums)
  }
  return `/mtr/gerenciador?${p.toString()}`
}

/** Uma única mensagem consolidada (evita toasts repetidos no envio em lote). */
export function mensagemMtrsNaoEncontradasEnvio(numeros: string[]): string {
  const nums = numeros.map((n) => n.trim()).filter(Boolean)
  if (nums.length === 0) return ''
  if (nums.length === 1) {
    return `MTR «${nums[0]}» ainda não está no sistema — conferir no relatório (cadastro manual).`
  }
  return `${nums.length} MTR(s) ainda não estão no sistema — conferir no relatório (cadastro manual).`
}

/** Acrescenta `mtrPendentes` e persiste números/linhas para o relatório. */
export function anexarMtrsPendentesNaRota(
  rota: string,
  opts: { naoEncontrados: string[]; linhas?: LinhaGerenciadorEnvio[] }
): string {
  const nums = opts.naoEncontrados.map((n) => n.trim()).filter(Boolean)
  if (!nums.length) return rota

  if (opts.linhas?.length) {
    const agrupado = agruparLinhasPorMtrBaixada(opts.linhas)
    const linhasPendentes = nums
      .map((n) => agrupado.get(n))
      .filter((l): l is LinhaGerenciadorEnvio => !!l)
    armazenarLinhasPendentesEnvio(linhasPendentes)
  } else {
    armazenarMtrsNaoEncontradasEnvio(nums)
  }

  const [path, qs] = rota.split('?')
  const p = new URLSearchParams(qs ?? '')
  p.set('mtrPendentes', nums.join(','))
  armazenarMtrsNaoEncontradasEnvio(nums)
  return `${path}?${p.toString()}`
}

let toastEnvioGerenciadorAtivo: HTMLDivElement | null = null

/** Aviso discreto (toast), não bloqueia navegação nem exige clique. */
export function avisoToastEnvioGerenciador(
  message: string,
  variant: 'info' | 'warning' = 'info'
): void {
  if (typeof document === 'undefined' || !message.trim()) return

  toastEnvioGerenciadorAtivo?.remove()
  toastEnvioGerenciadorAtivo = null

  const bg = variant === 'warning' ? '#fffbeb' : '#f8fafc'
  const border = variant === 'warning' ? '#fde68a' : '#e2e8f0'
  const color = variant === 'warning' ? '#92400e' : '#475569'

  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')
  el.textContent = message
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '10050',
    maxWidth: 'min(360px, calc(100vw - 32px))',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: '12px',
    lineHeight: '1.4',
    fontWeight: '500',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
    pointerEvents: 'none',
  } as CSSStyleDeclaration)

  document.body.appendChild(el)
  toastEnvioGerenciadorAtivo = el
  window.setTimeout(() => {
    el.style.transition = 'opacity 0.3s ease'
    el.style.opacity = '0'
    window.setTimeout(() => {
      el.remove()
      if (toastEnvioGerenciadorAtivo === el) toastEnvioGerenciadorAtivo = null
    }, 300)
  }, 5500)
}

function pesoLinhaParaKg(texto: string): number | null {
  const n = parseNumeroCampo(texto)
  return n > 0 ? n : null
}

/** Grava na MTR (e peso na coleta vinculada) os dados preenchidos na tabela do gerenciador. */
export async function aplicarDadosLinhaGerenciadorNaMtr(
  linha: LinhaGerenciadorEnvio,
  mtrId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const mid = mtrId.trim()
  if (!mid) return { ok: false, message: 'MTR inválida.' }

  const { quantidade, unidade } = parseQuantidadeGerenciadorRelatorio(linha.quantidade)

  const patchMtr: Record<string, unknown> = {}
  const gerador = linha.gerador.trim()
  const residuo = linha.residuo.trim()
  const qtdTexto = linha.quantidade.trim()

  if (gerador) patchMtr.gerador = gerador
  if (residuo) patchMtr.tipo_residuo = residuo
  if (qtdTexto) {
    patchMtr.quantidade = quantidade
    if (unidade != null) patchMtr.unidade = unidade
  }

  if (Object.keys(patchMtr).length > 0) {
    const { error } = await supabase.from('mtrs').update(patchMtr).eq('id', mid)
    if (error) {
      return {
        ok: false,
        message: mensagemErroSupabase(error, 'Não foi possível atualizar os dados da MTR.'),
      }
    }
  }

  const peso = pesoLinhaParaKg(linha.peso)
  if (peso != null) {
    const coletaIds = await listarColetaIdsPorMtr(supabase, mid)
    if (coletaIds.length === 1) {
      const { error: errColeta } = await supabase
        .from('coletas')
        .update({ peso_liquido: peso })
        .eq('id', coletaIds[0]!)
      if (errColeta) {
        return {
          ok: false,
          message: mensagemErroSupabase(
            errColeta,
            'MTR atualizada, mas o peso da coleta não foi gravado.'
          ),
        }
      }
    }
  }

  return { ok: true }
}

/** Agrupa linhas por número de MTR (primeira linha com dados prevalece por campo). */
export function agruparLinhasPorMtrBaixada(
  linhas: LinhaGerenciadorEnvio[]
): Map<string, LinhaGerenciadorEnvio> {
  const map = new Map<string, LinhaGerenciadorEnvio>()
  for (const l of linhas) {
    const num = l.mtr_baixada.trim()
    if (!num) continue
    const existente = map.get(num)
    if (!existente) {
      map.set(num, l)
      continue
    }
    map.set(num, {
      ...existente,
      data: existente.data || l.data,
      gerador: existente.gerador || l.gerador,
      residuo: existente.residuo || l.residuo,
      quantidade: existente.quantidade || l.quantidade,
      peso: existente.peso || l.peso,
      valor_unitario: existente.valor_unitario || l.valor_unitario,
      valor_total: existente.valor_total || l.valor_total,
    })
  }
  return map
}

/**
 * Prepara envio ao MTR Gerenciador só pelo número em `mtr_baixada`.
 * Não exige registro em `clientes_gerenciador` nem linhas persistidas no Supabase.
 */
export async function prepararEnvioGerenciadorParaMtr(
  linhas: LinhaGerenciadorEnvio[],
  _residuosContrato?: ResiduoContratoItem[]
): Promise<ResultadoPrepararEnvioGerenciador> {
  void _residuosContrato
  const agrupado = agruparLinhasPorMtrBaixada(linhas)
  const numeros = [...agrupado.keys()]
  const resultados: ResultadoEnvioLinhaGerenciador[] = []
  const naoEncontrados: string[] = []

  for (const num of numeros) {
    const linha = agrupado.get(num)!
    const mtr = await buscarMtrPorNumero(num)
    if (!mtr) {
      naoEncontrados.push(num)
      resultados.push({
        numero: num,
        mtr: null,
        dadosAplicados: false,
        coletaIds: [],
        erroAplicar: null,
      })
      continue
    }

    const aplicar = await aplicarDadosLinhaGerenciadorNaMtr(linha, mtr.id)
    const resolv = await resolverVinculoMtrGerenciador(mtr.id)

    resultados.push({
      numero: num,
      mtr,
      dadosAplicados: aplicar.ok,
      coletaIds: resolv.coletaIds,
      erroAplicar: aplicar.ok ? null : aplicar.message,
    })
  }

  return { linhas: resultados, naoEncontrados }
}
