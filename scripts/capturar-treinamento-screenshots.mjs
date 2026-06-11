/**
 * Captura screenshots reais para a KB de treinamentos (public/assets/treinamento/*.png).
 *
 * Requer: dev server em http://localhost:4173, .env com VITE_SUPABASE_* e SUPABASE_SERVICE_ROLE_KEY.
 * Opcional: CAPTURA_TREINAMENTO_EMAIL + CAPTURA_TREINAMENTO_PASSWORD (senão usa magic link admin).
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const BASE = 'http://localhost:4173'
const OUT = join(process.cwd(), 'public', 'assets', 'treinamento')
const VIEWPORT = { width: 1280, height: 800 }

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = join(process.cwd(), f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[k]) process.env[k] = v
    }
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
  process.exit(1)
}

const admin = serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null
const anon = createClient(url, anonKey, { auth: { persistSession: false } })

async function obterSessao() {
  const emailEnv = process.env.CAPTURA_TREINAMENTO_EMAIL?.trim()
  const passEnv = process.env.CAPTURA_TREINAMENTO_PASSWORD?.trim()
  if (emailEnv && passEnv) {
    const { data, error } = await anon.auth.signInWithPassword({ email: emailEnv, password: passEnv })
    if (error) throw new Error(`Login falhou: ${error.message}`)
    return { session: data.session, email: emailEnv, metodo: 'password' }
  }

  if (!admin) {
    throw new Error(
      'Defina CAPTURA_TREINAMENTO_EMAIL/PASSWORD ou SUPABASE_SERVICE_ROLE_KEY para magic link admin',
    )
  }

  let email = emailEnv
  if (!email) {
    const { data: users, error } = await admin
      .from('usuarios')
      .select('email, cargo')
      .in('cargo', ['Desenvolvedor', 'Administrador'])
      .limit(10)
    if (error) throw new Error(`usuarios: ${error.message}`)
    email =
      users?.find((u) => u.cargo === 'Desenvolvedor')?.email ??
      users?.[0]?.email ??
      'cavalcantersc07@gmail.com'
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`)

  const tokenHash = linkData?.properties?.hashed_token
  if (!tokenHash) throw new Error('generateLink não devolveu hashed_token')

  const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  })
  if (verifyErr) throw new Error(`verifyOtp: ${verifyErr.message}`)
  return { session: verifyData.session, email, metodo: 'magiclink-admin' }
}

function storageKey(projectRef) {
  return `sb-${projectRef}-auth-token`
}

function projectRefFromUrl(supabaseUrl) {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0]
  } catch {
    return 'local'
  }
}

async function injectSession(page, session) {
  const ref = projectRefFromUrl(url)
  const key = storageKey(ref)
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  })
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ([k, v]) => {
      localStorage.setItem(k, v)
    },
    [key, payload],
  )
  await page.goto(`${BASE}/bem-vindo`, { waitUntil: 'networkidle', timeout: 60000 })
}

async function waitStable(page, ms = 400) {
  await page.waitForTimeout(ms)
}

async function shot(page, name, opts = {}) {
  const file = join(OUT, `${name}.png`)
  mkdirSync(OUT, { recursive: true })
  const clip = opts.clip
  await page.screenshot({
    path: file,
    type: 'png',
    fullPage: false,
    ...(clip ? { clip } : {}),
  })
  console.log('OK', `${name}.png`)
  return file
}

async function shotMain(page, name) {
  const main = page.locator('main').first()
  if (await main.count()) {
    const box = await main.boundingBox()
    if (box && box.height > 100) {
      return shot(page, name, {
        clip: {
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
          width: Math.min(box.width, VIEWPORT.width),
          height: Math.min(box.height, 720),
        },
      })
    }
  }
  return shot(page, name)
}

async function clickIfVisible(page, selectors) {
  for (const sel of selectors) {
    const el = page.locator(sel).first()
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click()
      await waitStable(page, 600)
      return true
    }
  }
  return false
}

/** @type {{ name: string, run: (page: import('playwright').Page) => Promise<void>, skipReason?: string }[]} */
const CAPTURAS = [
  {
    name: 'programacao-calendario',
    run: async (page) => {
      await page.goto(`${BASE}/programacao`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 800)
      await shotMain(page, 'programacao-calendario')
    },
  },
  {
    name: 'programacao-formulario',
    run: async (page) => {
      await page.goto(`${BASE}/programacao`, { waitUntil: 'networkidle', timeout: 60000 })
      await clickIfVisible(page, [
        'button:has-text("Nova programação")',
        'button:has-text("Nova programacao")',
        'button:has-text("Criar programação")',
        'button:has-text("Incluir")',
      ])
      await waitStable(page, 500)
      await shotMain(page, 'programacao-formulario')
    },
  },
  {
    name: 'mtr-formulario',
    run: async (page) => {
      await page.goto(`${BASE}/mtr`, { waitUntil: 'networkidle', timeout: 60000 })
      await clickIfVisible(page, [
        'button:has-text("Nova MTR")',
        'button:has-text("Nova mtr")',
        'button:has-text("Incluir")',
      ])
      await waitStable(page, 500)
      await shotMain(page, 'mtr-formulario')
    },
  },
  {
    name: 'mtr-gerenciador',
    run: async (page) => {
      await page.goto(`${BASE}/mtr/gerenciador`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 800)
      await shotMain(page, 'mtr-gerenciador')
    },
  },
  {
    name: 'controle-massa-fila',
    run: async (page) => {
      await page.goto(`${BASE}/controle-massa`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 800)
      await shotMain(page, 'controle-massa-fila')
    },
  },
  {
    name: 'controle-massa-pesagem',
    run: async (page) => {
      await page.goto(`${BASE}/controle-massa`, { waitUntil: 'networkidle', timeout: 60000 })
      const row = page.locator('table tbody tr, [role="row"]').first()
      if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
        await row.click()
        await waitStable(page, 800)
      }
      await shotMain(page, 'controle-massa-pesagem')
    },
  },
  {
    name: 'faturamento-fila',
    run: async (page) => {
      await page.goto(`${BASE}/faturamento`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 1000)
      await shotMain(page, 'faturamento-fila')
    },
  },
  {
    name: 'faturamento-resumo',
    run: async (page) => {
      await page.goto(`${BASE}/faturamento`, { waitUntil: 'networkidle', timeout: 60000 })
      await clickIfVisible(page, [
        'button:has-text("Resumo")',
        'a:has-text("Resumo")',
        'table tbody tr',
        '[role="row"]',
      ])
      await waitStable(page, 1000)
      const modal = page.locator('[role="dialog"], .modal, .rg-dialog').first()
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const box = await modal.boundingBox()
        if (box) {
          await shot(page, 'faturamento-resumo', {
            clip: {
              x: Math.max(0, box.x - 8),
              y: Math.max(0, box.y - 8),
              width: Math.min(box.width + 16, VIEWPORT.width),
              height: Math.min(box.height + 16, 720),
            },
          })
          return
        }
      }
      await shotMain(page, 'faturamento-resumo')
    },
  },
  {
    name: 'financeiro-hub',
    run: async (page) => {
      await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 800)
      await shotMain(page, 'financeiro-hub')
    },
  },
  {
    name: 'financeiro-contas-receber',
    run: async (page) => {
      await page.goto(`${BASE}/financeiro/contas-receber`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 800)
      await shotMain(page, 'financeiro-contas-receber')
    },
  },
  {
    name: 'fluxo-completo-visao-etapas',
    run: async (page) => {
      await page.goto(`${BASE}/rh/treinamentos/fluxo-completo`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      })
      await waitStable(page, 800)
      const fluxo = page.locator('.treinamento-kb__fluxo, .treinamento-kb__timeline').first()
      if (await fluxo.isVisible({ timeout: 2000 }).catch(() => false)) {
        const box = await fluxo.boundingBox()
        if (box) {
          await shot(page, 'fluxo-completo-visao-etapas', {
            clip: {
              x: Math.max(0, box.x - 12),
              y: Math.max(0, box.y - 12),
              width: Math.min(box.width + 24, VIEWPORT.width),
              height: Math.min(box.height + 24, 600),
            },
          })
          return
        }
      }
      await shotMain(page, 'fluxo-completo-visao-etapas')
    },
  },
  {
    name: 'frota-hub-transportes',
    run: async (page) => {
      await page.goto(`${BASE}/operacional-frota`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 800)
      await shotMain(page, 'frota-hub-transportes')
    },
  },
  {
    name: 'frota-movimentacao-formulario',
    run: async (page) => {
      await page.goto(`${BASE}/operacional-frota/transportes`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      })
      await clickIfVisible(page, [
        'button:has-text("Nova movimentação")',
        'button:has-text("Nova movimentacao")',
        'button:has-text("Registrar")',
        'button:has-text("Incluir")',
      ])
      await waitStable(page, 600)
      await shotMain(page, 'frota-movimentacao-formulario')
    },
  },
  {
    name: 'frota-historico-movimentacoes',
    run: async (page) => {
      await page.goto(`${BASE}/operacional-frota/transportes`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      })
      await waitStable(page, 800)
      const table = page.locator('table, [class*="historico"], [class*="tabela"]').first()
      if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
        const box = await table.boundingBox()
        if (box) {
          await shot(page, 'frota-historico-movimentacoes', {
            clip: {
              x: Math.max(0, box.x),
              y: Math.max(0, box.y),
              width: Math.min(box.width, VIEWPORT.width),
              height: Math.min(box.height, 520),
            },
          })
          return
        }
      }
      await shotMain(page, 'frota-historico-movimentacoes')
    },
  },
  {
    name: 'clientes-lista-busca',
    run: async (page) => {
      await page.goto(`${BASE}/clientes`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 800)
      await shotMain(page, 'clientes-lista-busca')
    },
  },
  {
    name: 'clientes-formulario-cadastro',
    run: async (page) => {
      await page.goto(`${BASE}/clientes`, { waitUntil: 'networkidle', timeout: 60000 })
      const row = page.locator('table tbody tr, [role="row"]').first()
      if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
        await row.click()
      } else {
        await clickIfVisible(page, ['button:has-text("Incluir cliente")', 'button:has-text("Novo")'])
      }
      await waitStable(page, 800)
      await shotMain(page, 'clientes-formulario-cadastro')
    },
  },
  {
    name: 'clientes-contrato-residuos-precos',
    run: async (page) => {
      await page.goto(`${BASE}/clientes`, { waitUntil: 'networkidle', timeout: 60000 })
      const row = page.locator('table tbody tr, [role="row"]').first()
      if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
        await row.click()
        await waitStable(page, 600)
      }
      await clickIfVisible(page, [
        'button:has-text("Contrato")',
        '[role="tab"]:has-text("Contrato")',
        'a:has-text("Contrato")',
      ])
      await page.evaluate(() => {
        const el =
          document.querySelector('[class*="contrato"], [class*="residuo"], section h2, h3')
        el?.scrollIntoView({ block: 'start' })
      })
      await waitStable(page, 500)
      await shotMain(page, 'clientes-contrato-residuos-precos')
    },
  },
  {
    name: 'conferencia-transporte-selecao-coleta',
    run: async (page) => {
      await page.goto(`${BASE}/conferencia-transporte`, { waitUntil: 'networkidle', timeout: 60000 })
      await waitStable(page, 800)
      await shotMain(page, 'conferencia-transporte-selecao-coleta')
    },
  },
  {
    name: 'conferencia-transporte-checklist-motorista',
    run: async (page) => {
      await page.goto(`${BASE}/conferencia-transporte`, { waitUntil: 'networkidle', timeout: 60000 })
      const row = page.locator('table tbody tr, [role="row"], button').first()
      if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
        await row.click()
        await waitStable(page, 1000)
      }
      await page.evaluate(() => {
        const chk = document.querySelector('[class*="checklist"], [class*="Checklist"]')
        chk?.scrollIntoView({ block: 'start' })
      })
      await waitStable(page, 400)
      await shotMain(page, 'conferencia-transporte-checklist-motorista')
    },
  },
  {
    name: 'conferencia-transporte-folha-modelo',
    run: async (page) => {
      await page.goto(`${BASE}/conferencia-transporte`, { waitUntil: 'networkidle', timeout: 60000 })
      const row = page.locator('table tbody tr, [role="row"]').first()
      if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
        await row.click()
        await waitStable(page, 1000)
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await waitStable(page, 400)
      await shotMain(page, 'conferencia-transporte-folha-modelo')
    },
  },
]

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const list = only.length ? CAPTURAS.filter((c) => only.includes(c.name)) : CAPTURAS

  console.log('A obter sessão Supabase…')
  const { session, email, metodo } = await obterSessao()
  console.log(`Login: ${email} (${metodo})`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()

  await injectSession(page, session)

  const ok = []
  const fail = []

  for (const cap of list) {
    try {
      await cap.run(page)
      ok.push(cap.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('FAIL', cap.name, msg)
      fail.push({ name: cap.name, reason: msg })
    }
  }

  await browser.close()

  const report = { login: { email, metodo }, ok, fail, timestamp: new Date().toISOString() }
  writeFileSync(join(OUT, 'captura-relatorio.json'), JSON.stringify(report, null, 2), 'utf8')
  console.log('\n--- Resumo ---')
  console.log('OK:', ok.length, '/', list.length)
  if (fail.length) {
    console.log('Falhas:')
    for (const f of fail) console.log(' -', f.name, ':', f.reason)
  }
  process.exit(fail.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
