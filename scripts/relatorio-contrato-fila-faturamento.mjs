/**
 * Relatório para Thaís/comercial: coletas na fila de faturamento com contrato
 * sem taxa (valor 0) ou sem match de resíduo.
 *
 * Uso: node scripts/relatorio-contrato-fila-faturamento.mjs
 * Saída: docs/relatorios/contrato-fila-faturamento-YYYY-MM-DD.{csv,xlsx}
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

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

function rotulo(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+—\s+—\s*$/u, '')
    .trim()
}

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function encontrarResiduoContrato(itens, tipoColeta) {
  const na = norm(tipoColeta)
  if (!na) return null
  const validos = itens.filter((r) => norm(r.tipo_residuo))
  const exact = validos.find((r) => norm(r.tipo_residuo) === na)
  if (exact) return exact
  const parcial = validos.find((r) => {
    const t = norm(r.tipo_residuo)
    return t.includes(na) || na.includes(t)
  })
  return parcial ?? null
}

function listarResiduosContrato(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return ''
  return arr
    .map((r) => {
      const t = (r.tipo_residuo ?? '').trim()
      const v = Number(r.valor)
      const val = Number.isFinite(v) ? v : 0
      return t ? `${t} (R$ ${val}/un)` : ''
    })
    .filter(Boolean)
    .join(' | ')
}

loadEnv()

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dias = 365
const createdMin = new Date(Date.now() - dias * 86400000).toISOString()
const hoje = new Date().toISOString().slice(0, 10)

console.log('\n=== Relatório contrato × fila faturamento ===\n')

const { data: fila, error: errFila } = await sb
  .from('vw_faturamento_resumo')
  .select(
    'coleta_id, numero_coleta, cliente_id, cliente_nome, mtr_numero, ticket_comprovante, tipo_residuo, peso_liquido, status_conferencia, pendencias_resumo, faturamento_esteira_status'
  )
  .gte('created_at', createdMin)
  .or('faturamento_registro_status.is.null,faturamento_registro_status.neq.emitido')

if (errFila) {
  console.error('Erro:', errFila.message)
  process.exit(1)
}

const filaMap = new Map((fila ?? []).map((r) => [r.coleta_id, r]))
const coletaIds = [...filaMap.keys()]

const coletasDet = []
for (let i = 0; i < coletaIds.length; i += 200) {
  const chunk = coletaIds.slice(i, i + 200)
  const { data } = await sb
    .from('coletas')
    .select('id, numero_coleta, tipo_residuo, cliente_id, cliente')
    .in('id', chunk)
  coletasDet.push(...(data ?? []))
}

const clienteIds = [...new Set(coletasDet.map((c) => c.cliente_id).filter(Boolean))]
const clientesMap = new Map()
for (let i = 0; i < clienteIds.length; i += 100) {
  const chunk = clienteIds.slice(i, i + 100)
  const { data } = await sb
    .from('clientes')
    .select('id, nome, razao_social, residuos_contrato, tipo_residuo, veiculos_contrato')
    .in('id', chunk)
  for (const cl of data ?? []) clientesMap.set(cl.id, cl)
}

const linhas = []

for (const c of coletasDet) {
  const vw = filaMap.get(c.id)
  if (!vw) continue
  const cl = c.cliente_id ? clientesMap.get(c.cliente_id) : null
  const arr = Array.isArray(cl?.residuos_contrato) ? cl.residuos_contrato : []
  const tipoColeta = rotulo(c.tipo_residuo || vw.tipo_residuo)
  const match = encontrarResiduoContrato(arr, tipoColeta)
  const valor = match != null ? Number(match.valor) : null
  const temJsonb = arr.length > 0

  let motivo = ''
  if (!temJsonb) {
    motivo = 'SEM_RESIDUOS_CONTRATO_JSONB'
  } else if (!match) {
    motivo = 'SEM_MATCH_RESIDUO'
  } else if (!Number.isFinite(valor) || valor <= 0) {
    motivo = 'VALOR_ZERO_NO_CONTRATO'
  } else {
    continue
  }

  const veiculos = Array.isArray(cl?.veiculos_contrato) ? cl.veiculos_contrato : []
  const caminhaoComValor = veiculos.filter((v) => Number(v.valor) > 0 && !v.sem_custo)

  linhas.push({
    numero_coleta: vw.numero_coleta ?? c.numero_coleta,
    cliente: cl?.nome ?? vw.cliente_nome ?? c.cliente ?? '',
    razao_social: cl?.razao_social ?? '',
    mtr: vw.mtr_numero ?? '',
    ticket: vw.ticket_comprovante ?? '',
    residuo_coleta: tipoColeta,
    peso_liquido_kg: vw.peso_liquido ?? '',
    status_conferencia: vw.status_conferencia ?? '',
    esteira: vw.faturamento_esteira_status ?? '',
    motivo,
    contrato_residuo_match: match?.tipo_residuo ?? '',
    valor_unitario_contrato: match != null && Number.isFinite(valor) ? valor : '',
    faturamento_minimo_kg: match?.faturamento_minimo ?? '',
    unidade_medida: match?.unidade_medida ?? '',
    residuos_no_contrato: listarResiduosContrato(arr),
    caminhoes_com_valor: caminhaoComValor.map((v) => v.tipo_veiculo).join(' | '),
    pendencias_view: vw.pendencias_resumo ?? '',
    acao_sugerida:
      motivo === 'SEM_MATCH_RESIDUO'
        ? 'Conferir nome do resíduo na coleta vs cadastro do cliente'
        : motivo === 'VALOR_ZERO_NO_CONTRATO'
          ? 'Preencher valor (R$/kg ou unidade) no cadastro do cliente e salvar'
          : 'Migrar/preencher residuos_contrato no cadastro do cliente',
  })
}

linhas.sort((a, b) => {
  const ca = String(a.cliente).localeCompare(String(b.cliente), 'pt-BR')
  if (ca !== 0) return ca
  return (a.numero_coleta ?? 0) - (b.numero_coleta ?? 0)
})

// Resumo por cliente
const porCliente = new Map()
for (const l of linhas) {
  const k = l.cliente
  if (!porCliente.has(k)) {
    porCliente.set(k, {
      cliente: l.cliente,
      razao_social: l.razao_social,
      coletas_afetadas: 0,
      sem_match: 0,
      valor_zero: 0,
      sem_jsonb: 0,
      residuos_no_contrato: l.residuos_no_contrato,
    })
  }
  const agg = porCliente.get(k)
  agg.coletas_afetadas++
  if (l.motivo === 'SEM_MATCH_RESIDUO') agg.sem_match++
  else if (l.motivo === 'VALOR_ZERO_NO_CONTRATO') agg.valor_zero++
  else if (l.motivo === 'SEM_RESIDUOS_CONTRATO_JSONB') agg.sem_jsonb++
}

const resumoClientes = [...porCliente.values()].sort((a, b) =>
  String(a.cliente).localeCompare(String(b.cliente), 'pt-BR')
)

const outDirs = [resolve(root, 'docs/relatorios'), resolve(root, 'public/assets/relatorios')]
for (const d of outDirs) mkdirSync(d, { recursive: true })

const baseName = `contrato-fila-faturamento-${hoje}`
const csvPath = resolve(outDirs[0], `${baseName}.csv`)
const xlsxPath = resolve(outDirs[0], `${baseName}.xlsx`)
const csvPublic = resolve(outDirs[1], `${baseName}.csv`)
const xlsxPublic = resolve(outDirs[1], `${baseName}.xlsx`)

const headers = [
  'numero_coleta',
  'cliente',
  'razao_social',
  'mtr',
  'ticket',
  'residuo_coleta',
  'peso_liquido_kg',
  'status_conferencia',
  'esteira',
  'motivo',
  'contrato_residuo_match',
  'valor_unitario_contrato',
  'faturamento_minimo_kg',
  'unidade_medida',
  'residuos_no_contrato',
  'caminhoes_com_valor',
  'pendencias_view',
  'acao_sugerida',
]

const csvLines = [
  headers.join(';'),
  ...linhas.map((row) => headers.map((h) => csvEscape(row[h])).join(';')),
]
const csvContent = '\uFEFF' + csvLines.join('\n')
writeFileSync(csvPath, csvContent, 'utf8')
writeFileSync(csvPublic, csvContent, 'utf8')

const wb = XLSX.utils.book_new()
const wsColetas = XLSX.utils.json_to_sheet(linhas, { header: headers })
const wsResumo = XLSX.utils.json_to_sheet(resumoClientes)
XLSX.utils.book_append_sheet(wb, wsColetas, 'Coletas')
XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por cliente')
XLSX.writeFile(wb, xlsxPath)
XLSX.writeFile(wb, xlsxPublic)

const appOrigin = (process.env.VITE_APP_ORIGIN ?? 'https://rh-ambiental-sistema.vercel.app').replace(
  /\/$/,
  ''
)
const urlXlsx = `${appOrigin}/assets/relatorios/${baseName}.xlsx`
const urlCsv = `${appOrigin}/assets/relatorios/${baseName}.csv`

const porMotivo = {
  SEM_MATCH_RESIDUO: linhas.filter((l) => l.motivo === 'SEM_MATCH_RESIDUO').length,
  VALOR_ZERO_NO_CONTRATO: linhas.filter((l) => l.motivo === 'VALOR_ZERO_NO_CONTRATO').length,
  SEM_RESIDUOS_CONTRATO_JSONB: linhas.filter((l) => l.motivo === 'SEM_RESIDUOS_CONTRATO_JSONB').length,
}

console.log(`Fila analisada: ${fila?.length ?? 0} coletas`)
console.log(`Linhas no relatório: ${linhas.length}`)
console.log(`Clientes distintos: ${resumoClientes.length}`)
console.log('Por motivo:', porMotivo)
console.log(`\nCSV (repo):   ${csvPath}`)
console.log(`Excel (repo): ${xlsxPath}`)
console.log(`\nLink download Excel (após deploy): ${urlXlsx}`)
console.log(`Link download CSV (após deploy):  ${urlCsv}`)
