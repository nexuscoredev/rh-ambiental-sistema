import { existsSync, readFileSync } from 'fs'

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i <= 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (process.env[k] === undefined) process.env[k] = v
    }
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
const key = process.env.VITE_SUPABASE_ANON_KEY

async function checkTable(name) {
  const r = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const text = await r.text()
  if (r.status === 404 || /does not exist|42P01|PGRST205/i.test(text)) {
    return { name, ok: false, detail: 'tabela ou view não existe' }
  }
  if (r.ok) {
    return { name, ok: true, detail: `HTTP ${r.status}` }
  }
  return { name, ok: false, detail: `HTTP ${r.status}: ${text.slice(0, 100)}` }
}

async function checkRpc(name) {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  const text = await r.text()
  if (/does not exist|42883|PGRST202/i.test(text)) {
    return { name, ok: false, detail: 'função RPC não existe' }
  }
  if (r.ok) return { name, ok: true, detail: `HTTP ${r.status}` }
  return { name, ok: false, detail: `HTTP ${r.status}: ${text.slice(0, 100)}` }
}

async function main() {
  console.log('=== Verificação R1.2.144 ===\n')

  try {
    const ver = await fetch('https://rh-ambiental-sistema.vercel.app/version.json')
    const verJson = await ver.json()
    console.log('Vercel produção:', verJson.version, '| build', verJson.builtAt)
  } catch (e) {
    console.log('Vercel produção: ERRO', e.message)
  }

  if (!url || !key) {
    console.log('\nSupabase: SKIP (sem VITE_SUPABASE_URL/ANON_KEY no .env)')
    return
  }

  console.log('\nSupabase REST (' + new URL(url).hostname + '):')
  for (const t of [
    'chat_pedido_ajuste_aprovacao_thais',
    'chat_pedido_ajuste_config',
    'chat_pedido_ajuste_historico',
  ]) {
    const r = await checkTable(t)
    console.log(`  ${r.ok ? '✓' : '✗'} ${t} — ${r.detail}`)
  }

  for (const fn of [
    'chat_obter_config_pedido_ajuste',
    'chat_aprovar_pedido_fila_thais',
    'chat_enviar_pedido_fila_thais',
  ]) {
    const r = await checkRpc(fn)
    console.log(`  ${r.ok ? '✓' : '✗'} rpc/${fn} — ${r.detail}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
