/**
 * Importa cadastro de resíduos de contrato a partir da planilha preenchida pela Thaís.
 *
 * Uso:
 *   node scripts/importar-contrato-planilha.mjs docs/relatorios/contrato-fila-faturamento-2026-06-11.xlsx
 *   node scripts/importar-contrato-planilha.mjs caminho/arquivo.xlsx --apply
 *
 * Regras:
 *   - Processa apenas linhas com confirmado = SIM
 *   - Atualiza clientes.residuos_contrato (não altera lógica de faturamento)
 *   - Dry-run por padrão; --apply grava no Supabase
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { read, utils } from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')
const fileArg = process.argv.find((a) => !a.startsWith('-') && a.endsWith('.xlsx'))

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = resolve(root, f)
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

function confirmadoSim(v) {
  return /^sim$/i.test(String(v ?? '').trim())
}

function parseMoeda(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null
  const t = String(v).trim().replace(/\s/g, '').replace(/R\$/gi, '')
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function parsePesoKg(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null
  const t = String(v).trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function encontrarIndiceResiduo(itens, nome) {
  const na = norm(nome)
  if (!na) return -1
  const validos = itens
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => norm(r.tipo_residuo))
  const exact = validos.find(({ r }) => norm(r.tipo_residuo) === na)
  if (exact) return exact.i
  const parcial = validos.find(({ r }) => {
    const t = norm(r.tipo_residuo)
    return t.includes(na) || na.includes(t)
  })
  return parcial?.i ?? -1
}

function clonarResiduos(arr) {
  return (Array.isArray(arr) ? arr : []).map((r) => ({
    tipo_residuo: String(r.tipo_residuo ?? '').trim(),
    classificacao: r.classificacao ?? null,
    unidade_medida: r.unidade_medida ?? 'kg',
    valor: r.valor ?? null,
    frequencia_coleta: r.frequencia_coleta ?? null,
    faturamento_minimo: r.faturamento_minimo ?? null,
  }))
}

function formatarResiduosParaJsonb(itens) {
  return itens
    .filter((r) => r.tipo_residuo.trim())
    .map((r) => ({
      tipo_residuo: r.tipo_residuo.trim(),
      classificacao: r.classificacao?.trim?.() ? String(r.classificacao).trim() : r.classificacao ?? null,
      unidade_medida: String(r.unidade_medida ?? 'kg').trim() || 'kg',
      valor: typeof r.valor === 'number' ? r.valor : parseMoeda(r.valor),
      frequencia_coleta: r.frequencia_coleta ?? null,
      faturamento_minimo:
        typeof r.faturamento_minimo === 'number'
          ? r.faturamento_minimo
          : parsePesoKg(r.faturamento_minimo),
    }))
}

function lerPlanilha(path) {
  const wb = read(readFileSync(path))
  const sheet = wb.Sheets['Coletas'] ?? wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('Aba "Coletas" não encontrada no Excel')
  return utils.sheet_to_json(sheet, { defval: '' })
}

function validarLinha(row, idx) {
  const erros = []
  const avisos = []
  const linha = idx + 2

  if (!confirmadoSim(row.confirmado)) {
    return { ok: false, skip: true, erros, avisos, linha }
  }

  const clienteId = String(row.cliente_id ?? '').trim()
  if (!clienteId) erros.push('cliente_id vazio')

  const nomeResiduo = String(
    row.residuo_contrato_correto || row.contrato_residuo_match || row.residuo_coleta || ''
  ).trim()
  if (!nomeResiduo) erros.push('residuo_contrato_correto vazio')

  const valor = parseMoeda(row.valor_corrigido)
  if (valor == null) erros.push('valor_corrigido inválido ou zero')

  const unidade = String(row.unidade_medida_nova || row.unidade_medida || 'kg').trim() || 'kg'
  const minimo = parsePesoKg(row.faturamento_minimo_kg_novo ?? row.faturamento_minimo_kg)

  if (row.motivo === 'SEM_MATCH_RESIDUO' && !String(row.residuo_contrato_correto ?? '').trim()) {
    avisos.push('SEM_MATCH: usando residuo_coleta como nome no contrato')
  }

  return {
    ok: erros.length === 0,
    skip: false,
    erros,
    avisos,
    linha,
    clienteId,
    nomeResiduo,
    valor,
    unidade,
    minimo,
    motivo: row.motivo,
    cliente: row.cliente,
    numeroColeta: row.numero_coleta,
  }
}

function aplicarLinhaNoCliente(residuos, entrada) {
  const { nomeResiduo, valor, unidade, minimo } = entrada
  const idx = encontrarIndiceResiduo(residuos, nomeResiduo)
  const acao =
    idx >= 0
      ? `atualizar "${residuos[idx].tipo_residuo}" valor ${residuos[idx].valor} → ${valor}`
      : `adicionar "${nomeResiduo}" valor ${valor}`

  if (idx >= 0) {
    residuos[idx] = {
      ...residuos[idx],
      valor,
      unidade_medida: unidade,
      ...(minimo != null ? { faturamento_minimo: minimo } : {}),
    }
  } else {
    residuos.push({
      tipo_residuo: nomeResiduo,
      classificacao: null,
      unidade_medida: unidade,
      valor,
      frequencia_coleta: null,
      faturamento_minimo: minimo,
    })
  }

  return acao
}

loadEnv()

if (!fileArg || !existsSync(fileArg)) {
  console.error('\nUso: node scripts/importar-contrato-planilha.mjs <arquivo.xlsx> [--apply]\n')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL?.trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim()
if (!url || !key) {
  console.error('Falta VITE_SUPABASE_URL ou chave no .env')
  process.exit(1)
}

console.log(`\n=== Importar contrato da planilha ===`)
console.log(`Arquivo: ${fileArg}`)
console.log(`Modo: ${APPLY ? 'APLICAR (--apply)' : 'dry-run (prévia)'}\n`)

const rows = lerPlanilha(resolve(fileArg))
const validadas = rows.map((r, i) => validarLinha(r, i))
const paraImportar = validadas.filter((v) => !v.skip && v.ok)
const ignoradas = validadas.filter((v) => v.skip).length
const comErro = validadas.filter((v) => !v.skip && !v.ok)

for (const e of comErro) {
  console.log(`✗ Linha ${e.linha} (${e.cliente ?? '?'}) coleta ${e.numeroColeta ?? '?'}: ${e.erros.join('; ')}`)
}

if (comErro.length > 0) {
  console.log(`\n${comErro.length} linha(s) com erro — corrija antes de aplicar.`)
  if (!APPLY) process.exit(1)
}

const porCliente = new Map()
for (const v of paraImportar) {
  if (!porCliente.has(v.clienteId)) {
    porCliente.set(v.clienteId, { clienteId: v.clienteId, cliente: v.cliente, entradas: [] })
  }
  porCliente.get(v.clienteId).entradas.push(v)
}

const sb = createClient(url, key)
const clienteIds = [...porCliente.keys()]
const clientesDb = new Map()

for (let i = 0; i < clienteIds.length; i += 100) {
  const chunk = clienteIds.slice(i, i + 100)
  const { data, error } = await sb
    .from('clientes')
    .select('id, nome, residuos_contrato')
    .in('id', chunk)
  if (error) {
    console.error('Erro ao buscar clientes:', error.message)
    process.exit(1)
  }
  for (const c of data ?? []) clientesDb.set(c.id, c)
}

const alteracoes = []
const backup = []

for (const [clienteId, grupo] of porCliente) {
  const db = clientesDb.get(clienteId)
  if (!db) {
    console.log(`✗ Cliente não encontrado: ${clienteId} (${grupo.cliente})`)
    continue
  }

  const antes = clonarResiduos(db.residuos_contrato)
  const depois = clonarResiduos(db.residuos_contrato)
  const acoes = []
  const chavesVistas = new Map()

  for (const entrada of grupo.entradas) {
    const chave = norm(entrada.nomeResiduo)
    if (chavesVistas.has(chave)) {
      const prev = chavesVistas.get(chave)
      if (prev.valor !== entrada.valor) {
        console.log(
          `⚠ ${db.nome}: conflito de valor para "${entrada.nomeResiduo}" (linhas ${prev.linha} e ${entrada.linha}) — usa última`
        )
      }
    }
    chavesVistas.set(chave, entrada)
    acoes.push({
      linha: entrada.linha,
      coleta: entrada.numeroColeta,
      motivo: entrada.motivo,
      detalhe: aplicarLinhaNoCliente(depois, entrada),
    })
  }

  const payload = formatarResiduosParaJsonb(depois)
  alteracoes.push({
    clienteId,
    nome: db.nome,
    antes: formatarResiduosParaJsonb(antes),
    depois: payload,
    acoes,
  })
  backup.push({ cliente_id: clienteId, nome: db.nome, residuos_contrato_antes: antes })
}

console.log(`Linhas na planilha: ${rows.length}`)
console.log(`Ignoradas (sem SIM): ${ignoradas}`)
console.log(`Confirmadas válidas: ${paraImportar.length}`)
console.log(`Clientes a alterar: ${alteracoes.length}\n`)

for (const alt of alteracoes) {
  console.log(`— ${alt.nome} (${alt.clienteId})`)
  for (const a of alt.acoes) {
    console.log(`    coleta ${a.coleta} | ${a.motivo} | ${a.detalhe}`)
  }
  const resAntes = alt.antes.length
  const resDepois = alt.depois.length
  console.log(`    resíduos no contrato: ${resAntes} → ${resDepois}`)
}

const backupDir = resolve(root, 'docs/relatorios/backups')
mkdirSync(backupDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupPath = resolve(backupDir, `contrato-antes-import-${stamp}.json`)
writeFileSync(backupPath, JSON.stringify({ arquivo: basename(fileArg), backup }, null, 2), 'utf8')
console.log(`\nBackup (antes): ${backupPath}`)

if (!APPLY) {
  console.log('\nDry-run concluído. Rode com --apply para gravar no cadastro de clientes.')
  process.exit(0)
}

let ok = 0
let fail = 0

for (const alt of alteracoes) {
  const { error } = await sb
    .from('clientes')
    .update({ residuos_contrato: alt.depois })
    .eq('id', alt.clienteId)
  if (error) {
    console.error(`✗ ERRO ${alt.nome}: ${error.message}`)
    fail++
  } else {
    console.log(`✓ Gravado: ${alt.nome}`)
    ok++
  }
}

console.log(`\nConcluído: ${ok} cliente(s) atualizado(s) | ${fail} falha(s)`)
console.log('Sugestão: rode npm run relatorio:contrato-fila para ver quantas coletas saíram da lista.')
