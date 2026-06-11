/**
 * Corrige tipo_residuo da coleta e caracterização da MTR usando `detalhes.residuos_itens`
 * quando este diverge de `residuos_lista` / `tipo_residuo` (ex.: RECICLADO vs BORRACHA - IBC).
 *
 * Uso:
 *   node scripts/corrigir-residuo-coleta-desde-mtr.mjs 90011
 *   node scripts/corrigir-residuo-coleta-desde-mtr.mjs --dry-run 90011
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = resolve(f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (!process.env[k]) process.env[k] = v
    }
  }
}

function normalizar(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function textoResiduoFromMtrDetalhes(detalhes) {
  if (!detalhes || typeof detalhes !== 'object') return null
  const itens = Array.isArray(detalhes.residuos_itens) ? detalhes.residuos_itens : []
  const fromItens = itens.map((i) => String(i?.texto ?? '').trim()).filter(Boolean)
  if (fromItens.length > 0) return fromItens[0]

  const lista = Array.isArray(detalhes.residuos_lista) ? detalhes.residuos_lista : []
  const fromLista = lista.map((l) => String(l?.caracterizacao ?? '').trim()).filter(Boolean)
  if (fromLista.length > 0) return fromLista[0]

  const car = String(detalhes.residuo?.caracterizacao ?? '').trim()
  return car || null
}

function limparSufixoEstadoFisico(texto) {
  return texto.replace(/\s+—\s+—\s*$/u, '').replace(/\s+—\s+[^—]+$/u, (m) => {
    const parte = m.replace(/^\s+—\s+/, '').trim()
    if (!parte || parte === '—') return ''
    return m
  }).trim()
}

function rotuloExibicao(texto) {
  const t = String(texto ?? '').trim()
  if (!t) return ''
  return limparSufixoEstadoFisico(t) || t
}

function patchDetalhesMtr(detalhes, novoTexto) {
  const base = detalhes && typeof detalhes === 'object' ? { ...detalhes } : {}
  const residuo =
    base.residuo && typeof base.residuo === 'object' ? { ...base.residuo } : {}

  residuo.caracterizacao = novoTexto
  if (!residuo.fonte_origem) residuo.fonte_origem = 'Industrial'
  if (!residuo.estado_fisico) residuo.estado_fisico = '—'

  const lista = Array.isArray(base.residuos_lista) ? [...base.residuos_lista] : []
  if (lista.length > 0 && lista[0] && typeof lista[0] === 'object') {
    lista[0] = { ...lista[0], caracterizacao: novoTexto }
  } else {
    lista[0] = {
      fonte_origem: residuo.fonte_origem,
      caracterizacao: novoTexto,
      estado_fisico: residuo.estado_fisico,
      acondicionamento: residuo.acondicionamento ?? '',
      quantidade_aproximada: residuo.quantidade_aproximada ?? '',
      onu: residuo.onu ?? '',
    }
  }

  const itens = Array.isArray(base.residuos_itens) ? [...base.residuos_itens] : []
  if (itens.length > 0 && itens[0] && typeof itens[0] === 'object') {
    itens[0] = { ...itens[0], texto: novoTexto }
  } else {
    itens[0] = { texto: novoTexto, catalogo_id: null, peso_tara: '', peso_bruto: '', peso_liquido: '' }
  }

  return { ...base, residuo, residuos_lista: lista, residuos_itens: itens }
}

function patchResumoFinanceiro(resumo, novoTexto, coleta) {
  if (!resumo || typeof resumo !== 'object') return resumo
  const r = { ...resumo }
  const ticket = r.ticket && typeof r.ticket === 'object' ? { ...r.ticket } : {}
  ticket.tipo_residuo = novoTexto
  const linhas = Array.isArray(ticket.linhas_tickets) ? ticket.linhas_tickets.map((l) => ({ ...l })) : []
  if (linhas.length > 0) {
    linhas[0] = { ...linhas[0], residuo: novoTexto }
  } else {
    linhas.push({
      coleta_numero: String(coleta.numero_coleta ?? coleta.numero ?? '—'),
      ticket_numero: '—',
      residuo: novoTexto,
      peso_tara_kg: coleta.peso_tara != null ? String(coleta.peso_tara) : '',
      peso_bruto_kg: coleta.peso_bruto != null ? String(coleta.peso_bruto) : '',
      peso_liquido_kg: coleta.peso_liquido != null ? String(coleta.peso_liquido) : '',
    })
  }
  ticket.linhas_tickets = linhas
  r.ticket = ticket

  const mtr = r.mtr && typeof r.mtr === 'object' ? { ...r.mtr } : {}
  if (!mtr.residuo_rotulo || normalizar(mtr.residuo_rotulo) === normalizar('RECICLADO')) {
    mtr.residuo_rotulo = novoTexto
  }
  r.mtr = mtr
  return r
}

loadEnv()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const alvo = args.find((a) => a !== '--dry-run') ?? '90011'
const num = Number(alvo)

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const filtro = Number.isFinite(num) ? `numero_coleta.eq.${num}` : `ticket_numero.eq.${alvo}`

const { data: coleta, error: errColeta } = await sb
  .from('coletas')
  .select('id, numero_coleta, numero, tipo_residuo, residuos_itens, mtr_id, peso_tara, peso_bruto, peso_liquido')
  .or(filtro)
  .maybeSingle()

if (errColeta || !coleta) {
  console.error('Coleta não encontrada:', errColeta?.message ?? alvo)
  process.exit(1)
}

if (!coleta.mtr_id) {
  console.error('Coleta sem MTR vinculada.')
  process.exit(1)
}

const { data: mtr, error: errMtr } = await sb
  .from('mtrs')
  .select('id, numero, tipo_residuo, detalhes')
  .eq('id', coleta.mtr_id)
  .maybeSingle()

if (errMtr || !mtr) {
  console.error('MTR não encontrada:', errMtr?.message)
  process.exit(1)
}

const fonte = textoResiduoFromMtrDetalhes(mtr.detalhes)
const novoTexto = rotuloExibicao(fonte)
const atualColeta = rotuloExibicao(coleta.tipo_residuo)

if (!novoTexto) {
  console.error('Não foi possível determinar o resíduo correto em detalhes.residuos_itens.')
  process.exit(1)
}

if (normalizar(atualColeta) === normalizar(novoTexto)) {
  console.log(`Coleta ${coleta.numero_coleta}: resíduo já correto («${atualColeta}»).`)
  process.exit(0)
}

console.log('\n=== Plano de correção ===')
console.log(`Coleta: ${coleta.numero_coleta} (${coleta.id})`)
console.log(`MTR: ${mtr.numero}`)
console.log(`De: «${coleta.tipo_residuo}»`)
console.log(`Para: «${novoTexto}» (fonte: mtrs.detalhes.residuos_itens)`)

if (dryRun) {
  console.log('\n[dry-run] Nenhuma alteração gravada.')
  process.exit(0)
}

const detalhesNovo = patchDetalhesMtr(mtr.detalhes, novoTexto)
const tipoMtrTopo = novoTexto

const { error: errUpMtr } = await sb
  .from('mtrs')
  .update({ tipo_residuo: tipoMtrTopo, detalhes: detalhesNovo })
  .eq('id', mtr.id)

if (errUpMtr) {
  console.error('Erro ao atualizar MTR:', errUpMtr.message)
  process.exit(1)
}

const itensAtual = Array.isArray(coleta.residuos_itens) ? coleta.residuos_itens : []
const itensNovo =
  itensAtual.length > 0
    ? itensAtual.map((item, i) =>
        i === 0 && item && typeof item === 'object' ? { ...item, texto: novoTexto } : item
      )
    : [
        {
          texto: novoTexto,
          catalogo_id: null,
          peso_tara: coleta.peso_tara,
          peso_bruto: coleta.peso_bruto,
          peso_liquido: coleta.peso_liquido,
        },
      ]

const { error: errUpColeta } = await sb
  .from('coletas')
  .update({ tipo_residuo: novoTexto, residuos_itens: itensNovo })
  .eq('id', coleta.id)

if (errUpColeta) {
  console.error('Erro ao atualizar coleta:', errUpColeta.message)
  process.exit(1)
}

const { data: registros } = await sb
  .from('faturamento_registros')
  .select('id, resumo_financeiro')
  .eq('coleta_id', coleta.id)

let regsAtualizados = 0
for (const reg of registros ?? []) {
  if (!reg.resumo_financeiro) continue
  const patched = patchResumoFinanceiro(reg.resumo_financeiro, novoTexto, coleta)
  const { error } = await sb
    .from('faturamento_registros')
    .update({ resumo_financeiro: patched })
    .eq('id', reg.id)
  if (!error) regsAtualizados++
}

console.log('\n✓ MTR atualizada')
console.log('✓ Coleta atualizada')
console.log(`✓ Registros de faturamento atualizados: ${regsAtualizados}`)
