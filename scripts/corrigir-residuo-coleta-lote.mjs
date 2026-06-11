/**
 * Varre coletas com MTR e corrige quando `tipo_residuo` diverge de
 * `mtrs.detalhes.residuos_itens[0].texto` (padrão RECICLADO vs contrato).
 *
 * Uso:
 *   node scripts/corrigir-residuo-coleta-lote.mjs --dry-run
 *   node scripts/corrigir-residuo-coleta-lote.mjs
 *   node scripts/corrigir-residuo-coleta-lote.mjs --dias 180
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'fs'
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

function limparSufixoEstadoFisico(texto) {
  return texto
    .replace(/\s+—\s+—\s*$/u, '')
    .replace(/\s+—\s+[^—]+$/u, (m) => {
      const parte = m.replace(/^\s+—\s+/, '').trim()
      if (!parte || parte === '—') return ''
      return m
    })
    .trim()
}

function rotuloExibicao(texto) {
  const t = String(texto ?? '').trim()
  if (!t) return ''
  return limparSufixoEstadoFisico(t) || t
}

function textosResiduoItensMtr(detalhes) {
  if (!detalhes || typeof detalhes !== 'object') return []
  const itens = Array.isArray(detalhes.residuos_itens) ? detalhes.residuos_itens : []
  return itens.map((i) => String(i?.texto ?? '').trim()).filter(Boolean)
}

function textoResiduoItensMtr(detalhes, index = 0) {
  const textos = textosResiduoItensMtr(detalhes)
  return textos[index] ?? textos[0] ?? null
}

function textoCaracterizacaoMtr(detalhes) {
  if (!detalhes || typeof detalhes !== 'object') return null
  const lista = Array.isArray(detalhes.residuos_lista) ? detalhes.residuos_lista : []
  const fromLista = lista.map((l) => String(l?.caracterizacao ?? '').trim()).filter(Boolean)
  if (fromLista.length > 0) return fromLista[0]
  return String(detalhes.residuo?.caracterizacao ?? '').trim() || null
}

function patchDetalhesMtr(detalhes, novoTexto, index = 0) {
  const base = detalhes && typeof detalhes === 'object' ? { ...detalhes } : {}
  const residuo =
    base.residuo && typeof base.residuo === 'object' ? { ...base.residuo } : {}

  residuo.caracterizacao = novoTexto
  if (!residuo.fonte_origem) residuo.fonte_origem = 'Industrial'
  if (!residuo.estado_fisico) residuo.estado_fisico = '—'

  const lista = Array.isArray(base.residuos_lista) ? [...base.residuos_lista] : []
  const li = lista[index] && typeof lista[index] === 'object' ? { ...lista[index] } : null
  if (li) {
    lista[index] = { ...li, caracterizacao: novoTexto }
  } else if (lista.length > 0 && lista[0] && typeof lista[0] === 'object') {
    lista[0] = { ...lista[0], caracterizacao: novoTexto }
  } else {
    lista[index] = {
      fonte_origem: residuo.fonte_origem,
      caracterizacao: novoTexto,
      estado_fisico: residuo.estado_fisico,
      acondicionamento: residuo.acondicionamento ?? '',
      quantidade_aproximada: residuo.quantidade_aproximada ?? '',
      onu: residuo.onu ?? '',
    }
  }

  const itens = Array.isArray(base.residuos_itens) ? [...base.residuos_itens] : []
  const item = itens[index] && typeof itens[index] === 'object' ? { ...itens[index] } : null
  if (item) {
    itens[index] = { ...item, texto: novoTexto }
  } else {
    itens[index] = { texto: novoTexto, catalogo_id: null, peso_tara: '', peso_bruto: '', peso_liquido: '' }
  }

  if (index === 0) {
    residuo.caracterizacao = novoTexto
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
  const rotuloAtual = rotuloExibicao(mtr.residuo_rotulo)
  if (!rotuloAtual || normalizar(rotuloAtual) === normalizar(coleta.tipo_residuo)) {
    mtr.residuo_rotulo = novoTexto
  }
  r.mtr = mtr
  return r
}

function indiceColetaNoGrupoMtr(coleta, grupo) {
  const sorted = [...grupo].sort(
    (a, b) => (a.numero_coleta ?? 0) - (b.numero_coleta ?? 0) || a.id.localeCompare(b.id)
  )
  return sorted.findIndex((c) => c.id === coleta.id)
}

function avaliarCorrecao(coleta, mtr, opts) {
  const idx = opts.indiceNoGrupo ?? 0
  const fonteItens = textoResiduoItensMtr(mtr.detalhes, idx)
  if (!fonteItens) return null

  const novoTexto = rotuloExibicao(fonteItens)
  if (!novoTexto) return null

  const atualColeta = rotuloExibicao(coleta.tipo_residuo)
  const atualMtrCar = rotuloExibicao(textoCaracterizacaoMtr(mtr.detalhes))
  const atualMtrTopo = rotuloExibicao(mtr.tipo_residuo)

  const coletaOk = normalizar(atualColeta) === normalizar(novoTexto)
  const mtrOk =
    normalizar(atualMtrCar) === normalizar(novoTexto) &&
    normalizar(atualMtrTopo) === normalizar(novoTexto)

  if (coletaOk && mtrOk) return null

  const modo = opts.modo ?? 'reciclado'
  if (modo === 'reciclado') {
    const coletaReciclado = normalizar(atualColeta) === 'reciclado'
    const listaReciclado = normalizar(atualMtrCar) === 'reciclado'
    const paraReciclado = normalizar(novoTexto).includes('reciclado')
    if (!((coletaReciclado || listaReciclado) && !paraReciclado)) return null
  } else if (modo === 'divergencia') {
    if (normalizar(atualColeta) === normalizar(novoTexto)) return null
  }

  return {
    novoTexto,
    deColeta: coleta.tipo_residuo,
    deMtr: atualMtrCar || mtr.tipo_residuo,
    fonte: fonteItens,
    indice: idx,
  }
}

async function fetchColetasComMtr(sb, dias) {
  const rows = []
  const pageSize = 1000
  const createdMin =
    dias > 0
      ? new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
      : null

  for (let page = 0; page < 50; page++) {
    let qb = sb
      .from('coletas')
      .select(
        'id, numero_coleta, numero, cliente, tipo_residuo, residuos_itens, mtr_id, peso_tara, peso_bruto, peso_liquido, created_at'
      )
      .not('mtr_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (createdMin) qb = qb.gte('created_at', createdMin)

    const { data, error } = await qb
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}

async function fetchMtrsMap(sb, ids) {
  const map = new Map()
  const uniq = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < uniq.length; i += 200) {
    const chunk = uniq.slice(i, i + 200)
    const { data, error } = await sb
      .from('mtrs')
      .select('id, numero, tipo_residuo, detalhes')
      .in('id', chunk)
    if (error) throw new Error(error.message)
    for (const m of data ?? []) map.set(m.id, m)
  }
  return map
}

async function aplicarCorrecao(sb, coleta, mtr, plano, dryRun) {
  if (dryRun) return { ok: true, regs: 0 }

  const detalhesNovo = patchDetalhesMtr(mtr.detalhes, plano.novoTexto, plano.indice ?? 0)

  const { error: errMtr } = await sb
    .from('mtrs')
    .update({ tipo_residuo: plano.novoTexto, detalhes: detalhesNovo })
    .eq('id', mtr.id)
  if (errMtr) return { ok: false, erro: `MTR: ${errMtr.message}` }

  const itensAtual = Array.isArray(coleta.residuos_itens) ? coleta.residuos_itens : []
  const itensNovo =
    itensAtual.length > 0
      ? itensAtual.map((item, i) =>
          i === 0 && item && typeof item === 'object' ? { ...item, texto: plano.novoTexto } : item
        )
      : [
          {
            texto: plano.novoTexto,
            catalogo_id: null,
            peso_tara: coleta.peso_tara,
            peso_bruto: coleta.peso_bruto,
            peso_liquido: coleta.peso_liquido,
          },
        ]

  const { error: errColeta } = await sb
    .from('coletas')
    .update({ tipo_residuo: plano.novoTexto, residuos_itens: itensNovo })
    .eq('id', coleta.id)
  if (errColeta) return { ok: false, erro: `Coleta: ${errColeta.message}` }

  const { data: registros } = await sb
    .from('faturamento_registros')
    .select('id, resumo_financeiro')
    .eq('coleta_id', coleta.id)

  let regs = 0
  for (const reg of registros ?? []) {
    if (!reg.resumo_financeiro) continue
    const patched = patchResumoFinanceiro(reg.resumo_financeiro, plano.novoTexto, coleta)
    const { error } = await sb
      .from('faturamento_registros')
      .update({ resumo_financeiro: patched })
      .eq('id', reg.id)
    if (!error) regs++
  }

  return { ok: true, regs }
}

loadEnv()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const diasArg = args.find((a) => a.startsWith('--dias='))
const dias = diasArg ? Number(diasArg.split('=')[1]) : 365
const modoArg = args.find((a) => a.startsWith('--modo='))
const modo = modoArg ? modoArg.split('=')[1] : 'reciclado'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

console.log(
  `\nVarredura de coletas com MTR (últimos ${dias} dias, modo=${modo})${dryRun ? ' [dry-run]' : ''}…\n`
)

const coletas = await fetchColetasComMtr(sb, dias)
const mtrMap = await fetchMtrsMap(
  sb,
  coletas.map((c) => c.mtr_id)
)

const porMtr = new Map()
for (const coleta of coletas) {
  const mid = coleta.mtr_id
  if (!porMtr.has(mid)) porMtr.set(mid, [])
  porMtr.get(mid).push(coleta)
}

const candidatos = []
for (const coleta of coletas) {
  const mtr = mtrMap.get(coleta.mtr_id)
  if (!mtr) continue
  const grupo = porMtr.get(coleta.mtr_id) ?? [coleta]
  const idx = indiceColetaNoGrupoMtr(coleta, grupo)
  const plano = avaliarCorrecao(coleta, mtr, { indiceNoGrupo: idx, modo })
  if (!plano) continue
  candidatos.push({ coleta, mtr, plano })
}

console.log(`Coletas analisadas: ${coletas.length}`)
console.log(`Com divergência (residuos_itens MTR ≠ coleta/lista): ${candidatos.length}\n`)

if (candidatos.length === 0) {
  console.log('Nada a corrigir.')
  process.exit(0)
}

const relatorio = []
let ok = 0
let falhas = 0
let totalRegs = 0

for (const { coleta, mtr, plano } of candidatos) {
  const linha = {
    coleta: coleta.numero_coleta,
    cliente: coleta.cliente,
    mtr: mtr.numero,
    de: plano.deColeta,
    para: plano.novoTexto,
    fonte_mtr_itens: plano.fonte,
  }
  relatorio.push(linha)

  console.log(
    `${dryRun ? '[simular]' : '[corrigir]'} ${coleta.numero_coleta} · ${coleta.cliente?.slice(0, 40) ?? '—'}`
  )
  console.log(`  MTR ${mtr.numero}: «${plano.deColeta}» → «${plano.novoTexto}»`)

  const res = await aplicarCorrecao(sb, coleta, mtr, plano, dryRun)
  if (res.ok) {
    ok++
    totalRegs += res.regs ?? 0
  } else {
    falhas++
    console.log(`  ERRO: ${res.erro}`)
    linha.erro = res.erro
  }
}

const outPath = resolve('scripts/corrigir-residuo-lote-relatorio.json')
writeFileSync(outPath, JSON.stringify({ dryRun, dias, ok, falhas, totalRegs, itens: relatorio }, null, 2))

console.log('\n=== Resumo ===')
console.log(`Corrigidas: ${ok}`)
console.log(`Falhas: ${falhas}`)
console.log(`Registros faturamento atualizados: ${totalRegs}`)
console.log(`Relatório: ${outPath}`)
if (dryRun) console.log('\nExecute sem --dry-run para gravar as correções.')
