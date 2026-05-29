#!/usr/bin/env node
/**
 * Cópia de segurança local fora do OneDrive e fora do repositório Git.
 * Guarda .env, .env.example e snapshot do estado Git (sem segredos extra).
 *
 * Destino padrão: C:\dev\backups\rh-ambiental-sistema\
 * Retém os últimos 14 snapshots por ficheiro.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const projectName = 'rh-ambiental-sistema'
const defaultBackupRoot =
  process.platform === 'win32'
    ? join('C:', 'dev', 'backups', projectName)
    : join(process.env.HOME || '/tmp', 'dev-backups', projectName)

const backupRoot = process.env.RG_BACKUP_DIR?.trim() || defaultBackupRoot
const keep = Number(process.env.RG_BACKUP_KEEP || 14)

const FILES_TO_BACKUP = ['.env', '.env.example']

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function gitSnapshot() {
  const r = spawnSync('git', ['status', '-sb'], { cwd: root, encoding: 'utf8' })
  const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  })
  const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  })
  return [
    `# backup ${new Date().toISOString()}`,
    `# cwd: ${root}`,
    `# branch: ${(branch.stdout || '').trim()}`,
    `# commit: ${(commit.stdout || '').trim()}`,
    '',
    (r.stdout || r.stderr || '').trim(),
  ].join('\n')
}

function prune(dir, prefix, ext) {
  if (!existsSync(dir)) return
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)

  for (const old of files.slice(keep)) {
    rmSync(join(dir, old.f), { force: true })
  }
}

mkdirSync(backupRoot, { recursive: true })

const ts = stamp()
let copied = 0

for (const name of FILES_TO_BACKUP) {
  const src = join(root, name)
  if (!existsSync(src)) continue
  const dest = join(backupRoot, `${name.replace(/^\./, '')}-${ts}${name.endsWith('.example') ? '' : ''}`)
  const destPath = join(backupRoot, `${name === '.env' ? 'env' : 'env.example'}-${ts}.txt`)
  copyFileSync(src, destPath)
  copied++
  prune(backupRoot, name === '.env' ? 'env-' : 'env.example-', '.txt')
}

const statusPath = join(backupRoot, `git-status-${ts}.txt`)
writeFileSync(statusPath, gitSnapshot(), 'utf8')
prune(backupRoot, 'git-status-', '.txt')

const latestPath = join(backupRoot, 'LATEST.txt')
writeFileSync(
  latestPath,
  [
    `ultimo_backup: ${new Date().toISOString()}`,
    `origem: ${root}`,
    `ficheiros_copiados: ${copied}`,
    `git_status: ${statusPath}`,
  ].join('\n'),
  'utf8',
)

console.log(`[backup:local] OK — ${copied} ficheiro(s) + git status em:\n  ${backupRoot}`)
