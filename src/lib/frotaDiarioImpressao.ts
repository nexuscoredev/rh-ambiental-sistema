import { RG_AMBIENTAL_DADOS_CORPORATIVOS } from './rgAmbientalDadosCorporativos'
import type { FrotaDiarioChecklist, FrotaDiarioRow } from './frotaTypes'

export const FROTA_DIARIO_CHECKLIST_IMPRESSAO: { key: keyof FrotaDiarioChecklist; label: string }[] = [
  { key: 'oleo_nivel_ok', label: 'Nível de óleo OK' },
  { key: 'pneus_ok', label: 'Pneus / calibragem OK' },
  { key: 'freios_ok', label: 'Freios OK' },
  { key: 'luzes_ok', label: 'Luzes e sinalização OK' },
  { key: 'documentacao_ok', label: 'Documentação do veículo OK' },
  { key: 'limpeza_ok', label: 'Limpeza / higiene OK' },
]

export type FrotaDiarioPrintData = {
  empresa: string
  cnpj: string
  email: string
  dataDiario: string
  dataDiarioBr: string
  veiculoLabel: string
  placa: string
  kmOdometro: string
  oleoKm: string
  oleoData: string
  checklist: FrotaDiarioChecklist
  anomalias: string
  observacoes: string
  responsavelNome: string
  responsavelCargo: string
}

function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

export function montarDadosImpressaoDiario(
  row: FrotaDiarioRow,
  placa: string,
  modelo?: string | null
): FrotaDiarioPrintData {
  const cl = row.checklist ?? {}
  return {
    empresa: 'RG Ambiental Transporte',
    cnpj: RG_AMBIENTAL_DADOS_CORPORATIVOS.cnpj,
    email: 'logistica@rgambiental.com.br',
    dataDiario: row.data_diario,
    dataDiarioBr: formatarDataBr(row.data_diario),
    veiculoLabel: `${placa}${modelo ? ` · ${modelo}` : ''}`,
    placa,
    kmOdometro:
      row.km_odometro != null ? `${row.km_odometro.toLocaleString('pt-BR')} km` : '—',
    oleoKm:
      row.ultima_troca_oleo_km != null
        ? `${row.ultima_troca_oleo_km.toLocaleString('pt-BR')} km`
        : '—',
    oleoData: formatarDataBr(row.ultima_troca_oleo_data),
    checklist: cl,
    anomalias: cl.anomalias?.trim() ?? '',
    observacoes: row.observacoes?.trim() ?? '',
    responsavelNome: row.assinatura_responsavel_nome?.trim() ?? '',
    responsavelCargo: row.assinatura_responsavel_cargo?.trim() ?? '',
  }
}
