/**
 * Diagnóstico: origem do resíduo exibido no faturamento (coleta / MTR / contrato / registro).
 * Uso: node scripts/diagnostico-residuo-coleta.mjs 90011
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

const alvo = process.argv[2] ?? '90011'
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const num = Number(alvo)
const filtro = Number.isFinite(num)
  ? `numero_coleta.eq.${num},ticket_numero.eq.${alvo}`
  : `ticket_numero.eq.${alvo}`

const { data: coletas, error } = await sb
  .from('coletas')
  .select(
    'id, numero_coleta, numero, ticket_numero, tipo_residuo, residuos_itens, mtr_id, cliente, peso_liquido, programacao_id'
  )
  .or(filtro)
  .limit(5)

if (error) {
  console.error(error)
  process.exit(1)
}

console.log('\n=== COLETAS ===')
for (const c of coletas ?? []) {
  console.log(JSON.stringify(c, null, 2))
}

const c0 = coletas?.[0]
if (!c0) {
  console.log('Nenhuma coleta encontrada.')
  process.exit(0)
}

if (c0.mtr_id) {
  const { data: mtr } = await sb
    .from('mtrs')
    .select('id, numero, tipo_residuo, detalhes')
    .eq('id', c0.mtr_id)
    .maybeSingle()
  const det = mtr?.detalhes
  console.log('\n=== MTR ===')
  console.log(
    JSON.stringify(
      {
        numero: mtr?.numero,
        tipo_residuo: mtr?.tipo_residuo,
        residuo: det?.residuo,
        residuos_lista: det?.residuos_lista,
        residuos_itens: det?.residuos_itens,
      },
      null,
      2
    )
  )
}

const { data: vw } = await sb
  .from('vw_faturamento_resumo')
  .select('coleta_id, numero_coleta, ticket_comprovante, tipo_residuo, mtr_numero, cliente_nome')
  .eq('coleta_id', c0.id)
  .maybeSingle()

console.log('\n=== VW_FATURAMENTO_RESUMO ===')
console.log(JSON.stringify(vw, null, 2))

const { data: reg } = await sb
  .from('faturamento_registros')
  .select('resumo_financeiro, updated_at')
  .eq('coleta_id', c0.id)
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (reg?.resumo_financeiro) {
  const r = reg.resumo_financeiro
  console.log('\n=== FATURAMENTO_REGISTROS.resumo_financeiro ===')
  console.log('ticket.tipo_residuo:', r.ticket?.tipo_residuo)
  console.log('mtr.residuo_rotulo:', r.mtr?.residuo_rotulo)
  console.log('linhas_tickets:', JSON.stringify(r.ticket?.linhas_tickets, null, 2))
}

if (c0.programacao_id) {
  const { data: prog } = await sb
    .from('programacoes')
    .select('numero, tipo_residuo, residuos_programacao')
    .eq('id', c0.programacao_id)
    .maybeSingle()
  console.log('\n=== PROGRAMACAO ===')
  console.log(JSON.stringify(prog, null, 2))
}

const { data: cli } = await sb
  .from('clientes')
  .select('nome, tipo_residuo, classificacao, residuos_contrato')
  .ilike('nome', `%${String(c0.cliente ?? '').split(' ')[0]}%`)
  .limit(3)

console.log('\n=== CLIENTE (match parcial) ===')
console.log(JSON.stringify(cli, null, 2))
