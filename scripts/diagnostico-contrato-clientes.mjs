/**
 * Diagnóstico Opção A — contrato JSONB vs legado (Arkema, Autokit, Alta + vazios).
 * Uso: node scripts/diagnostico-contrato-clientes.mjs
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

function arrLen(v) {
  if (Array.isArray(v)) return v.length
  if (v == null) return 0
  return -1
}

function temValorFaturavelVeiculos(arr) {
  if (!Array.isArray(arr)) return false
  return arr.some(
    (x) =>
      String(x?.tipo_veiculo ?? '').trim() &&
      !x?.sem_custo &&
      x?.valor != null &&
      String(x.valor).trim() !== '' &&
      Number(String(x.valor).replace(',', '.')) > 0
  )
}

function temValorFaturavelEquip(arr) {
  if (!Array.isArray(arr)) return false
  return arr.some(
    (x) =>
      String(x?.descricao ?? '').trim() &&
      x?.com_custo &&
      x?.valor != null &&
      String(x.valor).trim() !== '' &&
      Number(String(x.valor).replace(',', '.')) > 0
  )
}

function temTaxaResiduo(arr) {
  if (!Array.isArray(arr)) return false
  return arr.some(
    (x) =>
      String(x?.tipo_residuo ?? '').trim() &&
      x?.valor != null &&
      String(x.valor).trim() !== '' &&
      Number(String(x.valor).replace(',', '.')) > 0
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
const buscas = ['Arkema', 'Autokit', 'Alta']

const sel =
  'id, nome, razao_social, descricao_veiculo, equipamentos, tipo_residuo, veiculos_contrato, equipamentos_contrato, residuos_contrato'

for (const termo of buscas) {
  console.log(`\n=== ${termo} ===`)
  const { data, error } = await sb
    .from('clientes')
    .select(sel)
    .or(`nome.ilike.%${termo}%,razao_social.ilike.%${termo}%`)
    .limit(8)

  if (error) {
    if (
      error.message.includes('veiculos_contrato') ||
      error.message.includes('schema cache')
    ) {
      console.log('COLUNAS_CONTRATO_AUSENTES — aplicar migração 20260519140000')
      process.exit(2)
    }
    console.log('ERRO:', error.message)
    continue
  }

  if (!data?.length) {
    console.log('Nenhum cliente encontrado.')
    continue
  }

  for (const c of data) {
    const vLen = arrLen(c.veiculos_contrato)
    const eLen = arrLen(c.equipamentos_contrato)
    const rLen = arrLen(c.residuos_contrato)
    const legadoVeic = (c.descricao_veiculo ?? '').trim()
    const legadoEquip = (c.equipamentos ?? '').trim()
    const legadoRes = (c.tipo_residuo ?? '').trim()

    const jsonbOk =
      temValorFaturavelVeiculos(c.veiculos_contrato) ||
      temValorFaturavelEquip(c.equipamentos_contrato) ||
      temTaxaResiduo(c.residuos_contrato)

    const soLegado =
      (vLen === 0 || !temValorFaturavelVeiculos(c.veiculos_contrato)) &&
      (legadoVeic || legadoEquip || legadoRes)

    let status = 'OK_JSONB'
    if (vLen === 0 && eLen === 0 && rLen === 0 && (legadoVeic || legadoEquip)) {
      status = 'VAZIO_JSONB_SO_LEGADO'
    } else if (!jsonbOk && (legadoVeic || legadoEquip || legadoRes)) {
      status = 'JSONB_SEM_VALOR_FATURAVEL'
    } else if (!jsonbOk) {
      status = 'SEM_PRECO_NO_CONTRATO'
    }

    console.log(
      JSON.stringify(
        {
          status,
          id: c.id,
          nome: c.nome,
          razao_social: c.razao_social,
          veiculos_jsonb: vLen,
          equip_jsonb: eLen,
          residuos_jsonb: rLen,
          legado_veiculo: legadoVeic.slice(0, 100) || null,
          legado_equip: legadoEquip.slice(0, 100) || null,
          legado_residuo: legadoRes.slice(0, 80) || null,
        },
        null,
        2
      )
    )
  }
}

console.log('\nDiagnóstico concluído.')
