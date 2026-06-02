#!/usr/bin/env node
/**
 * Verifica integridade do projeto antes de dev/build.
 * Bloqueia execução se:
 * - pasta estiver dentro de OneDrive/Google Drive (risco de corrupção de node_modules e ficheiros);
 * - ficheiros críticos estiverem em falta;
 * - links em node_modules/.bin estiverem quebrados;
 * - muitos ficheiros versionados tiverem desaparecido do disco.
 *
 * Modo suave (só aviso): GUARD_PROJETO_SOFT=1
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const soft = process.env.GUARD_PROJETO_SOFT === '1'
const isRemoteBuild =
  process.env.VERCEL === '1' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true'

const CRITICAL_FILES = [
  'index.html',
  'package.json',
  'vite.config.ts',
  'src/main.tsx',
  'src/App-NEXUS.tsx',
  'public/assets/logo/favicon.svg',
]

const CLOUD_SYNC_MARKERS = ['onedrive', 'one drive', 'google drive', 'googledrive', 'my drive']

function fail(message) {
  console.error(`\n[guard:projeto] ${message}\n`)
  process.exit(1)
}

function warn(message) {
  console.warn(`[guard:projeto] aviso: ${message}`)
}

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (r.status !== 0) return ''
  return (r.stdout || '').trim()
}

const errors = []
const warnings = []

const rootLower = resolve(root).toLowerCase()
if (CLOUD_SYNC_MARKERS.some((m) => rootLower.includes(m))) {
  errors.push(
    'Projeto em pasta sincronizada (OneDrive/Google Drive) — alto risco de corrupção.\n' +
      '  Use C:\\dev\\rh-ambiental-sistema e abra essa pasta no Cursor.\n' +
      '  Para recuperar: git clone https://github.com/nexuscoredev/rh-ambiental-sistema.git C:\\dev\\rh-ambiental-sistema',
  )
}

for (const rel of CRITICAL_FILES) {
  if (!existsSync(join(root, rel))) {
    errors.push(`Ficheiro crítico em falta: ${rel}`)
  }
}

const viteBin =
  process.platform === 'win32'
    ? join(root, 'node_modules', '.bin', 'vite.cmd')
    : join(root, 'node_modules', '.bin', 'vite')

if (!existsSync(viteBin)) {
  errors.push(
    'Executável vite em falta (node_modules/.bin). Corra: npm install',
  )
}

if (isRemoteBuild) {
  for (const w of warnings) warn(w)
  if (errors.length > 0) {
    console.error('\n[guard:projeto] Integridade comprometida:\n')
    errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}\n`))
    process.exit(1)
  }
  console.log('[guard:projeto] OK — ambiente CI/Vercel.')
  process.exit(0)
}

const tracked = git(['ls-files']).split('\n').filter(Boolean)
const missingTracked = tracked.filter((rel) => !existsSync(join(root, rel)))
const missingThreshold = 3

if (missingTracked.length >= missingThreshold) {
  errors.push(
    `${missingTracked.length} ficheiros versionados em falta no disco` +
      ` (ex.: ${missingTracked.slice(0, 5).join(', ')}).\n` +
      '  Recuperação: git restore .   (ou clone limpo em C:\\dev\\)',
  )
} else if (missingTracked.length > 0) {
  warnings.push(
    `${missingTracked.length} ficheiro(s) versionado(s) em falta: ${missingTracked.join(', ')}`,
  )
}

if (!existsSync(join(root, '.git'))) {
  errors.push('Pasta .git em falta — não é um repositório Git.')
} else {
  const remote = git(['remote', 'get-url', 'origin'])
  if (!remote) {
    warnings.push('Remote origin não configurado — código não tem backup remoto.')
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const upstream = git(['rev-parse', '--abbrev-ref', '@{u}'])
  if (branch && upstream) {
    const counts = git(['rev-list', '--left-right', '--count', `${upstream}...HEAD`])
    const match = counts.match(/(\d+)\s+(\d+)/)
    if (match) {
      const behind = Number(match[1])
      const ahead = Number(match[2])
      if (behind > 0) {
        warnings.push(`Branch ${behind} commit(s) atrás de ${upstream} — considere git pull.`)
      }
      if (ahead > 0) {
        warnings.push(
          `${ahead} commit(s) local(is) ainda não enviado(s) ao GitHub — faça git push para não perder trabalho.`,
        )
      }
    }
  }
}

try {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  if (!pkg?.engines?.node) {
    warnings.push('package.json sem engines.node — verifique versão do Node.')
  }
} catch {
  errors.push('package.json ilegível.')
}

const backupLatest =
  process.platform === 'win32'
    ? join('C:', 'dev', 'backups', 'rh-ambiental-sistema', 'LATEST.txt')
    : join(process.env.HOME || '/tmp', 'dev-backups', 'rh-ambiental-sistema', 'LATEST.txt')

if (existsSync(backupLatest)) {
  try {
    const meta = readFileSync(backupLatest, 'utf8')
    const m = meta.match(/ultimo_backup:\s*(.+)/)
    if (m) {
      const ageDays = (Date.now() - Date.parse(m[1].trim())) / (1000 * 60 * 60 * 24)
      if (ageDays > 7) {
        warnings.push(
          `Backup local (.env) há ${Math.floor(ageDays)} dias — corra: npm run backup:local`,
        )
      }
    }
  } catch {
    /* ignora */
  }
} else if (process.platform === 'win32' && !rootLower.includes('onedrive')) {
  warnings.push('Ainda não há backup local — corra: npm run backup:local')
}

for (const w of warnings) warn(w)

if (errors.length > 0) {
  if (soft) {
    for (const e of errors) warn(e.replace(/\n/g, ' '))
    console.log('[guard:projeto] modo suave — continua apesar dos problemas.')
    process.exit(0)
  }
  console.error('\n[guard:projeto] Integridade comprometida:\n')
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}\n`))
  process.exit(1)
}

console.log('[guard:projeto] OK — projeto íntegro.')
