/** Data operacional do ticket (pesagem), não a data de gravação/impressão. */

export function formatDataIsoCurtaParaBr(iso: string | null | undefined): string {
  const t = (iso ?? '').trim()
  if (!t) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-')
    return `${d}/${m}/${y}`
  }
  const dt = new Date(t.includes('T') ? t : `${t.slice(0, 10)}T12:00:00`)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR')
}

/** Prioridade: data da pesagem (form/controle_massa) → execução → agendada → criação do ticket. */
export function resolverDataExibicaoTicket(opts: {
  dataPesagem?: string | null
  dataExecucao?: string | null
  dataAgendada?: string | null
  ticketCriadoEm?: string | null
}): string {
  for (const raw of [
    opts.dataPesagem,
    opts.dataExecucao,
    opts.dataAgendada,
    opts.ticketCriadoEm,
  ]) {
    const br = formatDataIsoCurtaParaBr(raw)
    if (br !== '—') return br
  }
  return '—'
}

export function isoDataHojeLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
