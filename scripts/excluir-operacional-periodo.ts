/**
 * Exclui programações, MTRs, coletas e tickets (e dependências) num intervalo de datas.
 *
 * Uso:
 *   npx tsx scripts/excluir-operacional-periodo.ts --from 2026-05-01 --to 2026-05-24 --dry-run
 *   npx tsx scripts/excluir-operacional-periodo.ts --from 2026-05-01 --to 2026-05-24 --yes
 *
 * Requer: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function carregarEnvArquivo() {
  const p = resolve(process.cwd(), '.env')
  if (!existsSync(p)) return
  const raw = readFileSync(p, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (process.env[k] === undefined) process.env[k] = v
  }
}

carregarEnvArquivo()

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return undefined
  return process.argv[i + 1]?.trim()
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchAllIds(
  supabase: SupabaseClient,
  table: string,
  build: (q: ReturnType<SupabaseClient['from']>) => ReturnType<SupabaseClient['from']>
): Promise<string[]> {
  const ids: string[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    let q = supabase.from(table).select('id').range(offset, offset + pageSize - 1)
    q = build(q) as typeof q
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    const rows = (data ?? []) as { id: string }[]
    if (rows.length === 0) break
    ids.push(...rows.map((r) => r.id).filter(Boolean))
    if (rows.length < pageSize) break
  }
  return ids
}

async function fetchIdsByIn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[]
): Promise<string[]> {
  const uniq = [...new Set(values.filter(Boolean))]
  const out: string[] = []
  for (const part of chunk(uniq, 80)) {
    if (part.length === 0) continue
    const ids = await fetchAllIds(supabase, table, (q) => q.in(column, part))
    out.push(...ids)
  }
  return [...new Set(out)]
}

async function excluirDependenciasColetas(
  supabase: SupabaseClient,
  coletaIds: string[]
): Promise<void> {
  for (const part of chunk(coletaIds, 80)) {
    if (part.length === 0) continue

    await supabase.from('programacoes').update({ coleta_id: null }).in('coleta_id', part)

    const tables: { table: string; column: string }[] = [
      { table: 'contas_receber', column: 'referencia_coleta_id' },
      { table: 'faturamento_registros', column: 'coleta_id' },
      { table: 'financeiro_documentos', column: 'coleta_id' },
      { table: 'checklist_transporte', column: 'coleta_id' },
      { table: 'conferencia_transporte', column: 'coleta_id' },
      { table: 'tickets_operacionais', column: 'coleta_id' },
      { table: 'tickets_operacionais_historico', column: 'coleta_id' },
      { table: 'conferencia_operacional', column: 'coleta_id' },
      { table: 'aprovacoes_diretoria', column: 'coleta_id' },
      { table: 'controle_massa', column: 'coleta_id' },
    ]

    for (const { table, column } of tables) {
      const { error } = await supabase.from(table).delete().in(column, part)
      if (error && !error.message.includes('does not exist')) {
        throw new Error(`${table}: ${error.message}`)
      }
    }

    await supabase
      .from('comprovantes_descarte')
      .update({ coleta_id: null, controle_massa_id: null })
      .in('coleta_id', part)

    const { error: delColeta } = await supabase.from('coletas').delete().in('id', part)
    if (delColeta) throw new Error(`coletas: ${delColeta.message}`)
  }
}

async function main() {
  const from = argValue('--from') ?? '2026-05-01'
  const to = argValue('--to') ?? '2026-05-24'
  const dryRun = process.argv.includes('--dry-run')
  const yes = process.argv.includes('--yes') || process.argv.includes('-y')

  if (!yes && !dryRun) {
    console.error(
      'Confirme com --yes ou use --dry-run para apenas contar.\n' +
        'Ex.: npx tsx scripts/excluir-operacional-periodo.ts --from 2026-05-01 --to 2026-05-24 --yes'
    )
    process.exit(1)
  }

  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) {
    console.error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  console.log(`Período: ${from} a ${to}${dryRun ? ' (simulação)' : ''}\n`)

  const progIds = await fetchAllIds(supabase, 'programacoes', (q) =>
    q.gte('data_programada', from).lte('data_programada', to)
  )

  const mtrIdsPorData = await fetchAllIds(supabase, 'mtrs', (q) =>
    q.gte('data_emissao', from).lte('data_emissao', to)
  )
  const mtrIdsPorProg =
    progIds.length > 0 ? await fetchIdsByIn(supabase, 'mtrs', 'programacao_id', progIds) : []
  const mtrIds = [...new Set([...mtrIdsPorData, ...mtrIdsPorProg])]

  const coletaIds = new Set<string>()

  if (mtrIds.length > 0) {
    for (const id of await fetchIdsByIn(supabase, 'coletas', 'mtr_id', mtrIds)) {
      coletaIds.add(id)
    }
  }
  if (progIds.length > 0) {
    for (const id of await fetchIdsByIn(supabase, 'coletas', 'programacao_id', progIds)) {
      coletaIds.add(id)
    }
  }
  for (const id of await fetchAllIds(supabase, 'coletas', (q) =>
    q.gte('data_agendada', from).lte('data_agendada', to)
  )) {
    coletaIds.add(id)
  }
  for (const id of await fetchAllIds(supabase, 'coletas', (q) =>
    q.gte('data_coleta', from).lte('data_coleta', to)
  )) {
    coletaIds.add(id)
  }
  if (progIds.length > 0) {
    const { data: progsColeta } = await supabase
      .from('programacoes')
      .select('coleta_id')
      .in('id', progIds)
      .not('coleta_id', 'is', null)
    for (const row of progsColeta ?? []) {
      const cid = (row as { coleta_id?: string | null }).coleta_id
      if (cid) coletaIds.add(cid)
    }
  }

  const coletaIdList = [...coletaIds]

  const ticketCount =
    coletaIdList.length > 0
      ? (
          await Promise.all(
            chunk(coletaIdList, 80).map(async (part) => {
              const { count, error } = await supabase
                .from('tickets_operacionais')
                .select('id', { count: 'exact', head: true })
                .in('coleta_id', part)
              if (error) throw error
              return count ?? 0
            })
          )
        ).reduce((a, b) => a + b, 0)
      : 0

  console.log(`Programações (data_programada): ${progIds.length}`)
  console.log(`MTRs (data_emissao ou vínculo): ${mtrIds.length}`)
  console.log(`Coletas (vínculo ou data): ${coletaIdList.length}`)
  console.log(`Tickets operacionais: ${ticketCount}`)

  if (dryRun) {
    console.log('\nDry-run — nada foi apagado.')
    return
  }

  if (coletaIdList.length > 0) {
    console.log('\nA apagar dependências e coletas…')
    await excluirDependenciasColetas(supabase, coletaIdList)
  }

  if (mtrIds.length > 0) {
    console.log('A apagar MTRs…')
    await supabase.from('comprovantes_descarte').update({ mtr_id: null }).in('mtr_id', mtrIds)
    for (const part of chunk(mtrIds, 80)) {
      const { error } = await supabase.from('mtrs').delete().in('id', part)
      if (error) throw new Error(`mtrs: ${error.message}`)
    }
  }

  if (progIds.length > 0) {
    console.log('A apagar programações…')
    for (const part of chunk(progIds, 80)) {
      const { error } = await supabase.from('programacoes').delete().in('id', part)
      if (error) throw new Error(`programacoes: ${error.message}`)
    }
  }

  console.log('\nConcluído.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
