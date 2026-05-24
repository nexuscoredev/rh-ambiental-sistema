import type { ClinicaRelatorio30dRow } from './clinicasTypes'

/** A view SQL já consolida por unidade nos últimos 30 dias; esta função normaliza números para UI. */
export function consolidarRelatorioClinicas30d(linhas: ClinicaRelatorio30dRow[]): ClinicaRelatorio30dRow[] {
  return linhas.map((r) => ({
    ...r,
    qtd_os: Number(r.qtd_os) || 0,
    valor_emitido_total: Number(r.valor_emitido_total) || 0,
    valor_pendente_total: Number(r.valor_pendente_total) || 0,
  }))
}
