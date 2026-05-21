import type { LinhaRelatorioMedicao } from '../../lib/faturamentoRelatorioMedicao'
import {
  formatarDataCurta,
  formatarMoedaMedicao,
  formatarPesoMedicao,
  formatarTaxaMedicao,
  rotuloPeriodoRelatorioMedicao,
  totaisRelatorioMedicao,
  vencimentoRelatorioMedicao,
} from '../../lib/faturamentoRelatorioMedicao'
import { COLUNAS_RELATORIO_MEDICAO } from '../../lib/faturamentoRelatorioMedicaoColunas'

export type FaturamentoRelatorioMedicaoPrintProps = {
  clienteNome: string
  linhas: LinhaRelatorioMedicao[]
  geradoEm?: string
}

/** Layout «RELATÓRIO DE MEDIÇÃO» — modelo RG Ambiental (impressão paisagem). */
export function FaturamentoRelatorioMedicaoPrintView({
  clienteNome,
  linhas,
  geradoEm,
}: FaturamentoRelatorioMedicaoPrintProps) {
  const totais = totaisRelatorioMedicao(linhas)
  const periodo = rotuloPeriodoRelatorioMedicao(linhas)
  const vencimentoIso = vencimentoRelatorioMedicao(linhas)

  return (
    <div className="medicao-print-doc">
      <header className="medicao-print-doc__header">
        <div>
          <div className="medicao-print-doc__marca">RG Ambiental</div>
          <h1 className="medicao-print-doc__titulo">Relatório de medição</h1>
          <p className="medicao-print-doc__cliente">{clienteNome}</p>
          {geradoEm ? <p className="medicao-print-doc__gerado">Gerado em {geradoEm}</p> : null}
        </div>
        {periodo ? <div className="medicao-print-doc__periodo">{periodo}</div> : null}
      </header>

      <table className="medicao-print__table">
        <thead>
          <tr>
            {COLUNAS_RELATORIO_MEDICAO.map((c) => (
              <th key={c.key} className={`medicao-print__th medicao-print__th--${c.key}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((r) => (
            <tr key={r.coleta_id}>
              <td className="medicao-print__td medicao-print__td--center">
                {formatarDataCurta(r.data)}
              </td>
              <td className="medicao-print__td medicao-print__td--center medicao-print__td--mtr">
                {r.mtr}
              </td>
              <td className="medicao-print__td medicao-print__td--gerador">{r.gerador}</td>
              <td className="medicao-print__td medicao-print__td--residuo">{r.tipoResiduo}</td>
              <td className="medicao-print__td medicao-print__td--center">{r.placa}</td>
              <td className="medicao-print__td medicao-print__td--center">{r.quantViagens}</td>
              <td className="medicao-print__td medicao-print__td--num">
                {r.valorFrete > 0 ? formatarMoedaMedicao(r.valorFrete) : '—'}
              </td>
              <td className="medicao-print__td medicao-print__td--num">
                {formatarPesoMedicao(r.pesoKg)}
              </td>
              <td className="medicao-print__td medicao-print__td--num">
                {formatarTaxaMedicao(r.valorTaxa)}
              </td>
              <td className="medicao-print__td medicao-print__td--num medicao-print__td--total">
                {formatarMoedaMedicao(r.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="medicao-print__totais">
            <td colSpan={6} className="medicao-print__td medicao-print__td--rotulo-totais">
              Totais
            </td>
            <td className="medicao-print__td medicao-print__td--num medicao-print__td--bold">
              {formatarMoedaMedicao(totais.valorFrete)}
            </td>
            <td className="medicao-print__td medicao-print__td--num medicao-print__td--bold">
              {formatarPesoMedicao(totais.pesoKg)}
            </td>
            <td className="medicao-print__td" />
            <td className="medicao-print__td medicao-print__td--num medicao-print__td--grand-total">
              {formatarMoedaMedicao(totais.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      <footer className="medicao-print-doc__footer">
        {vencimentoIso ? (
          <p className="medicao-print-doc__vencimento">
            <strong>Vencimento:</strong> {formatarDataCurta(vencimentoIso)}
          </p>
        ) : (
          <span />
        )}
        <p className="medicao-print-doc__nota">
          Valores conforme contrato (frete na 1.ª linha da MTR + peso × valor da taxa). Documento para
          aprovação do cliente.
        </p>
      </footer>
    </div>
  )
}
