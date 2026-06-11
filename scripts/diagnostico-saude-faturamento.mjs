/**
 * Diagnóstico de saúde do fluxo faturamento × operacional × MTR × contrato.
 * Somente leitura — não altera dados nem lógica.
 *
 * Uso: node scripts/diagnostico-saude-faturamento.mjs
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

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

function rotulo(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+—\s+—\s*$/u, '')
    .trim()
}

function textoItensMtr(detalhes, idx = 0) {
  if (!detalhes || typeof detalhes !== 'object') return null
  const itens = Array.isArray(detalhes.residuos_itens) ? detalhes.residuos_itens : []
  const textos = itens.map((i) => rotulo(i?.texto)).filter(Boolean)
  return textos[idx] ?? textos[0] ?? null
}

function caracMtr(detalhes, idx = 0) {
  if (!detalhes || typeof detalhes !== 'object') return null
  const lista = Array.isArray(detalhes.residuos_lista) ? detalhes.residuos_lista : []
  const c = lista[idx]?.caracterizacao ?? detalhes.residuo?.caracterizacao
  return rotulo(c) || null
}

loadEnv()
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const dias = 365
const createdMin = new Date(Date.now() - dias * 86400000).toISOString()

console.log('\n=== DIAGNÓSTICO DE SAÚDE — FATURAMENTO ===')
console.log(`Período: últimos ${dias} dias · ${new Date().toLocaleString('pt-BR')}\n`)

// 1) Fila operacional (vw)
const { data: fila, error: errFila } = await sb
  .from('vw_faturamento_resumo')
  .select(
    'coleta_id, numero_coleta, cliente_nome, mtr_id, mtr_numero, tipo_residuo, ticket_comprovante, peso_liquido, status_conferencia, pendencias_resumo, faturamento_registro_status, faturamento_esteira_status, valor_coleta'
  )
  .gte('created_at', createdMin)
  .or('faturamento_registro_status.is.null,faturamento_registro_status.neq.emitido')

if (errFila) {
  console.error('Erro vw_faturamento_resumo:', errFila.message)
  process.exit(1)
}

console.log(`1) Fila operacional (não emitida): ${fila?.length ?? 0} coletas`)

const pendencias = {
  sem_peso: [],
  sem_ticket: [],
  sem_valor: [],
  mtr_cancelada: [],
  reciclado_bug: [],
  resumo_desalinhado: [],
  contrato_sem_taxa: [],
}

for (const row of fila ?? []) {
  if (!row.peso_liquido || row.peso_liquido <= 0) pendencias.sem_peso.push(row)
  if (!row.ticket_comprovante?.trim()) pendencias.sem_ticket.push(row)
  if (!row.valor_coleta || row.valor_coleta <= 0) pendencias.sem_valor.push(row)
  if (row.status_conferencia === 'MTR_CANCELADA') pendencias.mtr_cancelada.push(row)
}

// 2) Cruzamento coleta × MTR (amostra completa com mtr_id)
const coletaIds = (fila ?? []).map((r) => r.coleta_id)
const coletasDet = []
for (let i = 0; i < coletaIds.length; i += 200) {
  const chunk = coletaIds.slice(i, i + 200)
  const { data } = await sb
    .from('coletas')
    .select('id, numero_coleta, tipo_residuo, mtr_id, cliente_id, residuos_itens')
    .in('id', chunk)
  coletasDet.push(...(data ?? []))
}

const mtrIds = [...new Set(coletasDet.map((c) => c.mtr_id).filter(Boolean))]
const mtrMap = new Map()
for (let i = 0; i < mtrIds.length; i += 200) {
  const chunk = mtrIds.slice(i, i + 200)
  const { data } = await sb.from('mtrs').select('id, numero, detalhes, tipo_residuo').in('id', chunk)
  for (const m of data ?? []) mtrMap.set(m.id, m)
}

const porMtr = new Map()
for (const c of coletasDet) {
  if (!c.mtr_id) continue
  if (!porMtr.has(c.mtr_id)) porMtr.set(c.mtr_id, [])
  porMtr.get(c.mtr_id).push(c)
}

for (const c of coletasDet) {
  const m = mtrMap.get(c.mtr_id)
  if (!m) continue
  const grupo = porMtr.get(c.mtr_id) ?? [c]
  const sorted = [...grupo].sort((a, b) => (a.numero_coleta ?? 0) - (b.numero_coleta ?? 0))
  const idx = sorted.findIndex((x) => x.id === c.id)
  const itens = textoItensMtr(m.detalhes, idx)
  const carac = caracMtr(m.detalhes, idx)
  const coletaTxt = rotulo(c.tipo_residuo)

  if (itens && norm(coletaTxt) !== norm(itens)) {
    const recicladoErrado =
      norm(coletaTxt) === 'reciclado' || norm(carac) === 'reciclado'
    const item = {
      coleta: c.numero_coleta,
      cliente_id: c.cliente_id,
      mtr: m.numero,
      coleta_residuo: coletaTxt,
      mtr_itens: itens,
      mtr_carac: carac,
    }
    if (recicladoErrado && !norm(itens).includes('reciclado')) {
      pendencias.reciclado_bug.push(item)
    }
  }
}

// 3) Registros resumo_financeiro vs coleta
const { data: regs } = await sb
  .from('faturamento_registros')
  .select('id, coleta_id, resumo_financeiro, status, valor')
  .not('resumo_financeiro', 'is', null)
  .gte('updated_at', createdMin)
  .limit(500)

const coletaMap = new Map(coletasDet.map((c) => [c.id, c]))
for (const reg of regs ?? []) {
  const c = coletaMap.get(reg.coleta_id)
  if (!c) continue
  const ticketTxt = rotulo(reg.resumo_financeiro?.ticket?.tipo_residuo)
  const coletaTxt = rotulo(c.tipo_residuo)
  if (ticketTxt && coletaTxt && norm(ticketTxt) !== norm(coletaTxt)) {
    pendencias.resumo_desalinhado.push({
      coleta: c.numero_coleta,
      coleta_residuo: coletaTxt,
      resumo_ticket: ticketTxt,
      registro_status: reg.status,
      valor: reg.valor,
    })
  }
}

// 4) Clientes na fila com contrato sem taxa no resíduo da coleta
const clienteIds = [...new Set(coletasDet.map((c) => c.cliente_id).filter(Boolean))]
const clientesMap = new Map()
for (let i = 0; i < clienteIds.length; i += 100) {
  const chunk = clienteIds.slice(i, i + 100)
  const { data } = await sb
    .from('clientes')
    .select('id, nome, residuos_contrato, tipo_residuo')
    .in('id', chunk)
  for (const cl of data ?? []) clientesMap.set(cl.id, cl)
}

for (const c of coletasDet) {
  if (!c.cliente_id) continue
  const cl = clientesMap.get(c.cliente_id)
  if (!cl) continue
  const arr = Array.isArray(cl.residuos_contrato) ? cl.residuos_contrato : []
  if (arr.length === 0) continue
  const tipo = rotulo(c.tipo_residuo)
  const na = norm(tipo)
  const match = arr.find((r) => {
    const t = norm(r.tipo_residuo)
    return t && (t === na || na.includes(t) || t.includes(na))
  })
  const valor = match ? Number(match.valor) : null
  if (!match || !Number.isFinite(valor) || valor <= 0) {
    const naFila = (fila ?? []).some((f) => f.coleta_id === c.id)
    if (naFila) {
      pendencias.contrato_sem_taxa.push({
        coleta: c.numero_coleta,
        cliente: cl.nome?.slice(0, 45),
        tipo_coleta: tipo,
        contrato_match: match?.tipo_residuo ?? '(sem match)',
        valor_contrato: valor,
      })
    }
  }
}

// Relatório
function printLista(titulo, lista, max = 15) {
  console.log(`\n--- ${titulo}: ${lista.length} ---`)
  if (lista.length === 0) {
    console.log('  (nenhum)')
    return
  }
  for (const item of lista.slice(0, max)) {
    console.log(' ', JSON.stringify(item))
  }
  if (lista.length > max) console.log(`  … +${lista.length - max} não exibidos`)
}

printLista('Sem peso líquido na fila', pendencias.sem_peso)
printLista('Sem ticket na fila', pendencias.sem_ticket)
printLista('Sem valor_coleta na fila', pendencias.sem_valor)
printLista('MTR cancelada na fila', pendencias.mtr_cancelada)
printLista('BUG RECICLADO (coleta≠itens MTR)', pendencias.reciclado_bug)
printLista('Resumo financeiro ≠ coleta (tipo resíduo)', pendencias.resumo_desalinhado)
printLista('Na fila: contrato sem taxa no resíduo', pendencias.contrato_sem_taxa)

const alertas =
  pendencias.reciclado_bug.length +
  pendencias.resumo_desalinhado.length +
  pendencias.sem_peso.length

const avisos =
  pendencias.contrato_sem_taxa.length +
  pendencias.sem_valor.length +
  pendencias.sem_ticket.length

const status =
  alertas === 0
    ? avisos === 0
      ? 'VERDE'
      : 'AMARELO'
    : 'VERMELHO'

const resumo = {
  gerado_em: new Date().toISOString(),
  periodo_dias: dias,
  fila_operacional: fila?.length ?? 0,
  status_geral: status,
  alertas_criticos: alertas,
  avisos_operacionais: avisos,
  pendencias: {
    sem_peso: pendencias.sem_peso.length,
    sem_ticket: pendencias.sem_ticket.length,
    sem_valor: pendencias.sem_valor.length,
    mtr_cancelada: pendencias.mtr_cancelada.length,
    reciclado_bug: pendencias.reciclado_bug.length,
    resumo_desalinhado: pendencias.resumo_desalinhado.length,
    contrato_sem_taxa: pendencias.contrato_sem_taxa.length,
  },
  amostras: {
    reciclado_bug: pendencias.reciclado_bug.slice(0, 20),
    contrato_sem_taxa: pendencias.contrato_sem_taxa.slice(0, 20),
    resumo_desalinhado: pendencias.resumo_desalinhado.slice(0, 20),
  },
  testes_locais: {
    nota: 'Executar npm run test:faturamento-guard para contrato de cálculo',
  },
}

const out = resolve('scripts/diagnostico-saude-faturamento-relatorio.json')
writeFileSync(out, JSON.stringify(resumo, null, 2))

console.log('\n=== VEREDITO ===')
console.log(`Status: ${status}`)
console.log(`Alertas críticos (dados/fluxo): ${alertas}`)
console.log(`Avisos operacionais (dados incompletos): ${avisos}`)
console.log(`Relatório JSON: ${out}`)
console.log('\nLógica de cálculo: use npm run test:faturamento-guard (não alterada neste script).')
