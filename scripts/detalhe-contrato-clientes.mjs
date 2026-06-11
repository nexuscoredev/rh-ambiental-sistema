/**
 * Detalhe do contrato JSONB — clientes alvo Opção A.
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

loadEnv()
const sb = createClient(
  process.env.VITE_SUPABASE_URL.trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY).trim()
)

const ids = [
  'e4ae52fa-0f02-4285-869e-e74b4769473e', // Arkema
  '2149a5f8-04a9-45b1-96ec-6a4ebed2a7fa', // Autokit
  '33ce3d3e-2ff6-46d3-9adb-9858b3fec1b2', // Alta
]

const { data, error } = await sb
  .from('clientes')
  .select(
    'id, nome, veiculos_contrato, equipamentos_contrato, residuos_contrato'
  )
  .in('id', ids)

if (error) {
  console.error(error.message)
  process.exit(1)
}

for (const c of data ?? []) {
  console.log('\n#' + c.nome)
  console.log('VEICULOS:', JSON.stringify(c.veiculos_contrato, null, 2))
  console.log('EQUIP:', JSON.stringify(c.equipamentos_contrato, null, 2))
  console.log('RESIDUOS:', JSON.stringify(c.residuos_contrato, null, 2))
}

// Clientes com JSONB vazio mas legado preenchido (candidatos re-salvar)
const { data: todos, error: err2 } = await sb
  .from('clientes')
  .select(
    'id, nome, descricao_veiculo, equipamentos, veiculos_contrato, equipamentos_contrato, residuos_contrato'
  )
  .limit(500)

if (err2) {
  console.error(err2.message)
  process.exit(1)
}

const vazios = (todos ?? []).filter((c) => {
  const v = Array.isArray(c.veiculos_contrato) ? c.veiculos_contrato.length : 0
  const e = Array.isArray(c.equipamentos_contrato) ? c.equipamentos_contrato.length : 0
  const r = Array.isArray(c.residuos_contrato) ? c.residuos_contrato.length : 0
  const leg =
    (c.descricao_veiculo ?? '').trim() || (c.equipamentos ?? '').trim()
  return v === 0 && e === 0 && r === 0 && leg
})

console.log(`\n=== Clientes JSONB vazio + legado (${vazios.length}) ===`)
for (const c of vazios.slice(0, 30)) {
  console.log(`- ${c.nome} (${c.id})`)
}
