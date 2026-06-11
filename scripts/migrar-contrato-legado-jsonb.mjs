/**
 * Opção A — popula veiculos_contrato / equipamentos_contrato / residuos_contrato
 * a partir dos campos legado quando os JSONB estão vazios ([]).
 *
 * Não inventa valores (R$): só estrutura tipos/descrições para o faturamento
 * e para a Thaís reabrir o cadastro e confirmar valores.
 *
 * Uso:
 *   node scripts/migrar-contrato-legado-jsonb.mjs          # dry-run
 *   node scripts/migrar-contrato-legado-jsonb.mjs --apply  # grava no Supabase
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const APPLY = process.argv.includes('--apply')

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

function splitPipe(text) {
  const t = (text ?? '').trim()
  if (!t) return []
  return t
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
}

function splitMultiline(text) {
  const t = (text ?? '').trim()
  if (!t) return []
  return t
    .split(/\n|[|;]/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function veiculosFromLegado(descricao) {
  const partes = splitPipe(descricao)
  if (partes.length === 0) return []
  return partes.map((tipo_veiculo) => ({
    tipo_veiculo,
    sem_custo: true,
    valor: null,
  }))
}

function equipamentosFromLegado(texto) {
  const partes = splitMultiline(texto)
  if (partes.length === 0) return []
  return partes.map((descricao) => ({
    descricao,
    com_custo: false,
    valor: null,
  }))
}

function residuosFromLegado(row) {
  const tipos = splitPipe(row.tipo_residuo)
  const classes = splitPipe(row.classificacao)
  const unidades = splitPipe(row.unidade_medida)
  const frequencias = splitPipe(row.frequencia_coleta)
  const n = Math.max(tipos.length, classes.length, unidades.length, frequencias.length)
  if (n === 0) return []
  return Array.from({ length: n }, (_, i) => ({
    tipo_residuo: tipos[i] || tipos[0] || '',
    classificacao: classes[i] || null,
    unidade_medida: unidades[i] || 'kg',
    valor: null,
    frequencia_coleta: frequencias[i] || null,
    faturamento_minimo: null,
  }))
}

function jsonbVazio(v) {
  return !Array.isArray(v) || v.length === 0
}

function precisaMigrar(c) {
  return (
    jsonbVazio(c.veiculos_contrato) &&
    jsonbVazio(c.equipamentos_contrato) &&
    jsonbVazio(c.residuos_contrato) &&
    ((c.descricao_veiculo ?? '').trim() ||
      (c.equipamentos ?? '').trim() ||
      (c.tipo_residuo ?? '').trim())
  )
}

loadEnv()
const url = process.env.VITE_SUPABASE_URL?.trim()
const key = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)?.trim()
if (!url || !key) {
  console.error('Falta VITE_SUPABASE_URL ou chave no .env')
  process.exit(1)
}

const sb = createClient(url, key)

const PAGE = 200
let offset = 0
const candidatos = []

while (true) {
  const { data, error } = await sb
    .from('clientes')
    .select(
      'id, nome, descricao_veiculo, equipamentos, tipo_residuo, classificacao, unidade_medida, frequencia_coleta, veiculos_contrato, equipamentos_contrato, residuos_contrato'
    )
    .range(offset, offset + PAGE - 1)

  if (error) {
    if (
      error.message.includes('veiculos_contrato') ||
      error.message.includes('schema cache')
    ) {
      console.error(
        'Colunas de contrato ausentes. Execute no Supabase:\n' +
          'supabase/migrations/20260519140000_clientes_contrato_veiculos_equipamentos_residuos.sql'
      )
      process.exit(2)
    }
    console.error(error.message)
    process.exit(1)
  }

  const chunk = data ?? []
  for (const c of chunk) {
    if (precisaMigrar(c)) candidatos.push(c)
  }
  if (chunk.length < PAGE) break
  offset += PAGE
}

console.log(`Clientes candidatos (JSONB vazio + legado): ${candidatos.length}`)
console.log(APPLY ? 'Modo: APLICAR' : 'Modo: dry-run (use --apply para gravar)')

let ok = 0
let fail = 0

for (const c of candidatos) {
  const payload = {
    veiculos_contrato: veiculosFromLegado(c.descricao_veiculo),
    equipamentos_contrato: equipamentosFromLegado(c.equipamentos),
    residuos_contrato: residuosFromLegado(c),
  }

  if (
    payload.veiculos_contrato.length === 0 &&
    payload.equipamentos_contrato.length === 0 &&
    payload.residuos_contrato.length === 0
  ) {
    continue
  }

  console.log(
    `${APPLY ? '→' : '·'} ${c.nome} | V:${payload.veiculos_contrato.length} E:${payload.equipamentos_contrato.length} R:${payload.residuos_contrato.length}`
  )

  if (!APPLY) continue

  const { error } = await sb.from('clientes').update(payload).eq('id', c.id)
  if (error) {
    console.error(`  ERRO ${c.nome}: ${error.message}`)
    fail++
  } else {
    ok++
  }
}

if (APPLY) {
  console.log(`\nMigrados: ${ok} | Falhas: ${fail}`)
} else {
  console.log('\nDry-run concluído. Rode com --apply para gravar.')
}
