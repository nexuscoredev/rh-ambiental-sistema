import fs from 'fs'
import path from 'path'

const dir = 'supabase/migrations'
const out = 'supabase/scripts/PENDING_MIGRATIONS_APPLY_MANUAL.sql'
const fixOut = 'supabase/scripts/00_RUN_FIRST_drop_vw_faturamento.sql'
const baseline = '20260425120000_rls_por_cargo_core_fluxo'

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => f.replace('.sql', '') > baseline)

function patchMigrationSql(content) {
  const marker = 'CREATE OR REPLACE VIEW public.vw_faturamento_resumo'
  if (!content.includes(marker)) return content
  const drop = 'DROP VIEW IF EXISTS public.vw_faturamento_resumo CASCADE;'
  if (content.includes(drop)) return content
  return content.split(marker).join(`${drop}\n\nCREATE VIEW public.vw_faturamento_resumo`)
}

const parts = [
  '-- =============================================================================',
  '-- SQL PENDENTE (corrigido): DROP VIEW antes de recriar vw_faturamento_resumo',
  '-- Evita erro 42P16: cannot drop columns from view',
  '-- Preferir: npx supabase db push',
  '-- =============================================================================',
  '',
]

for (const f of files) {
  let body = fs.readFileSync(path.join(dir, f), 'utf8').trimEnd()
  body = patchMigrationSql(body)
  parts.push(`-- >>> BEGIN ${f}`, '', body, '', `-- <<< END ${f}`, '')
}

fs.mkdirSync('supabase/scripts', { recursive: true })
fs.writeFileSync(out, `${parts.join('\n')}\n`, 'utf8')
fs.writeFileSync(
  fixOut,
  `-- Execute primeiro se o script grande falhou com 42P16 (cannot drop columns from view)
DROP VIEW IF EXISTS public.vw_faturamento_resumo CASCADE;
`,
  'utf8'
)

console.log(`Wrote ${files.length} migrations to ${out}`)
