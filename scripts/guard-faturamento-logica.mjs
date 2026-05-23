#!/usr/bin/env node
/**
 * Guarda da lógica de faturamento congelada.
 * - Executa testes de contrato.
 * - Se ficheiros protegidos mudaram vs base (main/master/HEAD~1), exige decisão explícita.
 *
 * Aprovação intencional de mudança na regra:
 *   FATURAMENTO_LOGICA_APROVADA=1 npm run guard:faturamento
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const PROTECTED = [
  'src/lib/faturamentoPrecoContrato.ts',
  'src/lib/faturamentoConsolidacaoMtr.ts',
  'src/lib/faturamentoRelatorioMedicao.ts',
  'src/lib/faturamentoDetalheConta.ts',
  'src/lib/faturamentoDesvinculacao.ts',
  'src/lib/faturamentoEsteira.ts',
  'src/lib/faturamentoOperacionalSync.ts',
  'src/lib/faturamentoTicketFluxo.ts',
  'src/lib/faturamentoLogicaCongelada.manifest.ts',
  'src/lib/faturamentoLogicaCongelada.test.ts',
  'docs/faturamento-logica-aprovada.md',
]

/** Alterações só na “cerca” (doc, manifest, testes de contrato, script) — aviso, sem bloqueio. */
const META_GUARD_ONLY = new Set([
  'src/lib/faturamentoLogicaCongelada.manifest.ts',
  'src/lib/faturamentoLogicaCongelada.test.ts',
  'docs/faturamento-logica-aprovada.md',
  '.cursor/rules/faturamento-logica-congelada.mdc',
  'scripts/guard-faturamento-logica.mjs',
  'package.json',
  '.github/workflows/ci.yml',
])

const TEST_FILES = [
  'src/lib/faturamentoLogicaCongelada.test.ts',
  'src/lib/faturamentoPrecoContrato.test.ts',
  'src/lib/faturamentoConsolidacaoMtr.test.ts',
  'src/lib/faturamentoRelatorioMedicao.test.ts',
  'src/lib/faturamentoDetalheConta.test.ts',
  'src/lib/faturamentoDesvinculacao.test.ts',
  'src/lib/faturamentoEsteira.test.ts',
]

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts })
  return r.status ?? 1
}

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (r.status !== 0) return ''
  return (r.stdout || '').trim()
}

function resolveBaseRef() {
  for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
    if (git(['rev-parse', '--verify', ref])) return ref
  }
  const parent = git(['rev-parse', '--verify', 'HEAD~1'])
  return parent || 'HEAD'
}

function changedProtectedFiles() {
  const base = resolveBaseRef()
  const diff = git(['diff', '--name-only', `${base}...HEAD`])
  if (!diff) {
    const unstaged = git(['diff', '--name-only', 'HEAD'])
    const names = (unstaged || '')
      .split(/\r?\n/)
      .map((s) => s.replace(/\\/g, '/').trim())
      .filter(Boolean)
    return names.filter((p) => PROTECTED.some((prot) => p === prot || p.startsWith('src/components/faturamento/')))
  }
  const names = diff
    .split(/\r?\n/)
    .map((s) => s.replace(/\\/g, '/').trim())
    .filter(Boolean)
  return names.filter((p) => PROTECTED.some((prot) => p === prot || p.startsWith('src/components/faturamento/')))
}

function readVersion() {
  const manifest = join(root, 'src/lib/faturamentoLogicaCongelada.manifest.ts')
  if (!existsSync(manifest)) return '?'
  const m = readFileSync(manifest, 'utf8').match(/FATURAMENTO_LOGICA_VERSION\s*=\s*'([^']+)'/)
  return m?.[1] ?? '?'
}

console.log(`\n=== Guarda faturamento (lógica congelada ${readVersion()}) ===\n`)

const testStatus = run('npx', ['vitest', 'run', ...TEST_FILES])
if (testStatus !== 0) {
  console.error('\n[FATURAMENTO] Testes de contrato falharam. Reverta ou corrija a lógica.')
  console.error('Documentação: docs/faturamento-logica-aprovada.md\n')
  process.exit(testStatus)
}

const touched = changedProtectedFiles()
const logicaAlterada = touched.filter((f) => !META_GUARD_ONLY.has(f))
const aprovado = process.env.FATURAMENTO_LOGICA_APROVADA === '1'

if (touched.length === 0) {
  console.log(`[FATURAMENTO] Nenhum ficheiro protegido alterado vs base (${resolveBaseRef()}). Testes OK.\n`)
  process.exit(0)
}

if (logicaAlterada.length === 0) {
  console.log('[FATURAMENTO] Apenas meta-guard/doc alterados (sem mudança na lógica de cálculo). Testes OK.\n')
  process.exit(0)
}

console.log('\n⚠️  [FATURAMENTO] Lógica de cálculo / esteira alterada:\n')
for (const f of logicaAlterada) console.log(`   - ${f}`)
console.log('\n   Invariantes: docs/faturamento-logica-aprovada.md')
console.log('   Regra Cursor: .cursor/rules/faturamento-logica-congelada.mdc\n')

if (aprovado) {
  console.log('[FATURAMENTO] FATURAMENTO_LOGICA_APROVADA=1 — alteração registrada como intencional. Testes OK.\n')
  process.exit(0)
}

console.error('╔══════════════════════════════════════════════════════════════════╗')
console.error('║  DECISÃO NECESSÁRIA: mudança na lógica de faturamento congelada  ║')
console.error('╠══════════════════════════════════════════════════════════════════╣')
console.error('║  1. Revise docs/faturamento-logica-aprovada.md                   ║')
console.error('║  2. Atualize manifest + testes se a regra mudou de propósito     ║')
console.error('║  3. Reexecute com: FATURAMENTO_LOGICA_APROVADA=1 npm run guard:…  ║')
console.error('╚══════════════════════════════════════════════════════════════════╝\n')
process.exit(2)
