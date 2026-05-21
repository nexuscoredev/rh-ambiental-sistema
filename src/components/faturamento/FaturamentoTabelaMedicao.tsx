import type { CSSProperties } from 'react'
import {
  formatarDataCurta,
  formatarMoedaMedicao,
  formatarPesoMedicao,
  formatarTaxaMedicao,
  totaisRelatorioMedicao,
  type LinhaRelatorioMedicao,
} from '../../lib/faturamentoRelatorioMedicao'
import { COLUNAS_RELATORIO_MEDICAO } from '../../lib/faturamentoRelatorioMedicaoColunas'

const thBase: CSSProperties = {
  padding: '8px 6px',
  fontSize: '11px',
  fontWeight: 700,
  color: '#334155',
  borderBottom: '2px solid #e2e8f0',
  whiteSpace: 'nowrap',
}

const tdBase: CSSProperties = {
  padding: '8px 6px',
  fontSize: '11px',
  color: '#0f172a',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
}

type Props = {
  linhas: LinhaRelatorioMedicao[]
  compacto?: boolean
  mostrarTotais?: boolean
  mostrarColeta?: boolean
}

function celulaValor(
  key: (typeof COLUNAS_RELATORIO_MEDICAO)[number]['key'],
  r: LinhaRelatorioMedicao
): string {
  switch (key) {
    case 'data':
      return formatarDataCurta(r.data)
    case 'mtr':
      return r.mtr
    case 'gerador':
      return r.gerador
    case 'tipoResiduo':
      return r.tipoResiduo
    case 'placa':
      return r.placa
    case 'quantViagens':
      return String(r.quantViagens)
    case 'valorFrete':
      return r.valorFrete > 0 ? formatarMoedaMedicao(r.valorFrete) : '—'
    case 'pesoKg':
      return formatarPesoMedicao(r.pesoKg)
    case 'valorTaxa':
      return formatarTaxaMedicao(r.valorTaxa)
    case 'total':
      return formatarMoedaMedicao(r.total)
    default:
      return '—'
  }
}

/** Tabela da esteira / pré-visualização — mesmas colunas do relatório impresso. */
export function FaturamentoTabelaMedicao({
  linhas,
  compacto,
  mostrarTotais = true,
  mostrarColeta = true,
}: Props) {
  const totais = totaisRelatorioMedicao(linhas)
  const fontSize = compacto ? '10px' : '11px'

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: compacto ? 920 : 980 }}>
      <thead>
        <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
          {mostrarColeta ? (
            <th style={{ ...thBase, fontSize, textAlign: 'left' }}>Coleta</th>
          ) : null}
          {COLUNAS_RELATORIO_MEDICAO.map((c) => (
            <th
              key={c.key}
              style={{
                ...thBase,
                fontSize,
                textAlign: c.align,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((r) => (
          <tr key={r.coleta_id}>
            {mostrarColeta ? (
              <td style={{ ...tdBase, fontSize, fontWeight: 600 }}>{r.numeroColeta ?? '—'}</td>
            ) : null}
            {COLUNAS_RELATORIO_MEDICAO.map((c) => (
              <td
                key={c.key}
                style={{
                  ...tdBase,
                  fontSize,
                  textAlign: c.align,
                  fontWeight: c.key === 'total' ? 600 : undefined,
                }}
              >
                {celulaValor(c.key, r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {mostrarTotais && linhas.length > 0 ? (
        <tfoot>
          <tr style={{ background: '#fffbeb' }}>
            {mostrarColeta ? (
              <td style={{ ...tdBase, fontSize, fontWeight: 700, textAlign: 'right' }} colSpan={1}>
                Totais
              </td>
            ) : null}
            <td
              colSpan={6}
              style={{ ...tdBase, fontSize, fontWeight: 700, textAlign: 'right' }}
            >
              {!mostrarColeta ? 'Totais' : null}
            </td>
            <td style={{ ...tdBase, fontSize, fontWeight: 700, textAlign: 'right' }}>
              {formatarMoedaMedicao(totais.valorFrete)}
            </td>
            <td style={{ ...tdBase, fontSize, fontWeight: 700, textAlign: 'right' }}>
              {formatarPesoMedicao(totais.pesoKg)}
            </td>
            <td style={{ ...tdBase, fontSize }} />
            <td
              style={{
                ...tdBase,
                fontSize,
                fontWeight: 800,
                textAlign: 'right',
                background: '#fef08a',
              }}
            >
              {formatarMoedaMedicao(totais.total)}
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  )
}
