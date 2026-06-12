/**
 * Substitui cores neutras hardcoded por CSS variables (tema claro/escuro).
 * Uso único: node scripts/migrate-ui-theme-vars.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const TARGET_DIRS = [
  path.join(ROOT, 'src', 'pages'),
  path.join(ROOT, 'src', 'components'),
  path.join(ROOT, 'src'),
]
const CSS_FILES = [path.join(ROOT, 'src', 'index-NEXUS.css')]

const SKIP_PATH_RE =
  /Print\.css$|print\.css$|mtrManifesto|mtrResiduo|frotaDeclaracao|index\.css$|tema-escuro\.css$/

const REPLACEMENTS_TS = [
  [/background:\s*["']#fff["']/g, 'background: "var(--bg-card, #ffffff)"'],
  [/background:\s*["']#ffffff["']/g, 'background: "var(--bg-card, #ffffff)"'],
  [/background:\s*["']#f8fafc["']/g, 'background: "var(--bg-subtle, #f8fafc)"'],
  [/background:\s*["']#f1f5f9["']/g, 'background: "var(--bg-inset, #f1f5f9)"'],
  [/background:\s*["']#fafafa["']/g, 'background: "var(--bg-inset, #fafafa)"'],
  [/background:\s*["']#fafbfc["']/g, 'background: "var(--bg-inset, #fafbfc)"'],
  [/backgroundColor:\s*["']#ffffff["']/g, 'backgroundColor: "var(--bg-card, #ffffff)"'],
  [/backgroundColor:\s*["']#f8fafc["']/g, 'backgroundColor: "var(--bg-subtle, #f8fafc)"'],
  [/backgroundColor:\s*["']#f1f5f9["']/g, 'backgroundColor: "var(--bg-inset, #f1f5f9)"'],
  [/backgroundColor:\s*["']#e0f2fe["']/g, 'backgroundColor: "var(--accent-teal-soft, #e0f2fe)"'],
  [/background:\s*["']#f0fdf4["']/g, 'background: "var(--status-success-bg, #f0fdf4)"'],
  [/background:\s*["']#fffbeb["']/g, 'background: "var(--status-warning-bg, #fffbeb)"'],
  [/background:\s*["']#fef2f2["']/g, 'background: "var(--status-error-bg, #fef2f2)"'],
  [/background:\s*["']#eff6ff["']/g, 'background: "var(--status-info-bg, #eff6ff)"'],
  [/background:\s*["']#ecfdf5["']/g, 'background: "var(--accent-teal-soft, #ecfdf5)"'],
  [/background:\s*["']#f0fdfa["']/g, 'background: "var(--accent-teal-soft, #f0fdfa)"'],
  [/background:\s*["']#f0f9ff["']/g, 'background: "var(--status-info-bg, #f0f9ff)"'],
  [/color:\s*["']#0f172a["']/g, 'color: "var(--text-primary, #0f172a)"'],
  [/color:\s*["']#111827["']/g, 'color: "var(--text-primary, #111827)"'],
  [/color:\s*["']#1f2937["']/g, 'color: "var(--text-primary, #1f2937)"'],
  [/color:\s*["']#334155["']/g, 'color: "var(--text-primary, #334155)"'],
  [/color:\s*["']#475569["']/g, 'color: "var(--text-secondary, #475569)"'],
  [/color:\s*["']#64748b["']/g, 'color: "var(--text-secondary, #64748b)"'],
  [/color:\s*["']#94a3b8["']/g, 'color: "var(--text-secondary, #94a3b8)"'],
  [/border:\s*["']1px solid #e5e7eb["']/g, 'border: "1px solid var(--border-color, #e5e7eb)"'],
  [/border:\s*["']1px solid #e2e8f0["']/g, 'border: "1px solid var(--border-color, #e2e8f0)"'],
  [/border:\s*["']1px solid #e8ecf1["']/g, 'border: "1px solid var(--border-color, #e8ecf1)"'],
  [/border:\s*["']1px solid #cbd5e1["']/g, 'border: "1px solid var(--input-border, #cbd5e1)"'],
  [/border:\s*["']1px solid #d1d5db["']/g, 'border: "1px solid var(--input-border, #d1d5db)"'],
  [/borderBottom:\s*["']1px solid #e5e7eb["']/g, 'borderBottom: "1px solid var(--border-color, #e5e7eb)"'],
  [/borderBottom:\s*["']1px solid #e2e8f0["']/g, 'borderBottom: "1px solid var(--border-color, #e2e8f0)"'],
  [/borderTop:\s*["']1px solid #e5e7eb["']/g, 'borderTop: "1px solid var(--border-color, #e5e7eb)"'],
  [/borderTop:\s*["']1px solid #e2e8f0["']/g, 'borderTop: "1px solid var(--border-color, #e2e8f0)"'],
]

const REPLACEMENTS_CSS = [
  [/background:\s*#fff\b/g, 'background: var(--bg-card, #ffffff)'],
  [/background:\s*#ffffff\b/g, 'background: var(--bg-card, #ffffff)'],
  [/background:\s*#f8fafc\b/g, 'background: var(--bg-subtle, #f8fafc)'],
  [/background:\s*#f1f5f9\b/g, 'background: var(--bg-inset, #f1f5f9)'],
  [/background:\s*#fafafa\b/g, 'background: var(--bg-inset, #fafafa)'],
  [/background:\s*#fafbfc\b/g, 'background: var(--bg-inset, #fafbfc)'],
  [/color:\s*#0f172a\b/g, 'color: var(--text-primary, #0f172a)'],
  [/color:\s*#334155\b/g, 'color: var(--text-primary, #334155)'],
  [/color:\s*#64748b\b/g, 'color: var(--text-secondary, #64748b)'],
  [/border:\s*1px solid #e2e8f0\b/g, 'border: 1px solid var(--border-color, #e2e8f0)'],
  [/border:\s*1px solid #e5e7eb\b/g, 'border: 1px solid var(--border-color, #e5e7eb)'],
  [/border-bottom:\s*1px solid #e2e8f0\b/g, 'border-bottom: 1px solid var(--border-color, #e2e8f0)'],
  [/border-bottom:\s*1px solid #e5e7eb\b/g, 'border-bottom: 1px solid var(--border-color, #e5e7eb)'],
]

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (
      /\.(tsx|ts)$/.test(name) &&
      !SKIP_PATH_RE.test(full) &&
      !full.includes(`${path.sep}lib${path.sep}`) &&
      name !== 'main.tsx' &&
      name !== 'vite-env.d.ts'
    )
      acc.push(full)
  }
  return acc
}

function applyReplacements(content, replacements) {
  let out = content
  let changed = false
  for (const [re, rep] of replacements) {
    const next = out.replace(re, rep)
    if (next !== out) {
      changed = true
      out = next
    }
  }
  return { out, changed }
}

let filesChanged = 0

for (const dir of TARGET_DIRS) {
  for (const file of walk(dir)) {
    const raw = fs.readFileSync(file, 'utf8')
    const { out, changed } = applyReplacements(raw, REPLACEMENTS_TS)
    if (changed) {
      fs.writeFileSync(file, out, 'utf8')
      filesChanged++
      console.log('tsx:', path.relative(ROOT, file))
    }
  }
}

for (const file of CSS_FILES) {
  const raw = fs.readFileSync(file, 'utf8')
  const { out, changed } = applyReplacements(raw, REPLACEMENTS_CSS)
  if (changed) {
    fs.writeFileSync(file, out, 'utf8')
    filesChanged++
    console.log('css:', path.relative(ROOT, file))
  }
}

console.log(`\nMigrados ${filesChanged} arquivo(s).`)
