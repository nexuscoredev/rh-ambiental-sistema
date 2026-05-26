import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  formatarDataCurta,
  formatarMoedaMedicao,
  formatarPesoMedicao,
  formatarTaxaMedicao,
  totaisRelatorioMedicao,
  type LinhaRelatorioMedicao,
} from '../../lib/faturamentoRelatorioMedicao'
import { COLUNAS_RELATORIO_MEDICAO } from '../../lib/faturamentoRelatorioMedicaoColunas'
import {
  aplicarRascunhoBulkLinhasMedicao,
  rascunhoEdicaoBulkMedicaoVazio,
  type RascunhoEdicaoBulkMedicao,
} from '../../lib/faturamentoRelatorioMedicaoEdicao'

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

const inputBulk: CSSProperties = {
  width: '100%',
  minWidth: '56px',
  padding: '5px 6px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '11px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
}

type Props = {
  linhas: LinhaRelatorioMedicao[]
  compacto?: boolean
  mostrarTotais?: boolean
  mostrarColeta?: boolean
  onLinhasChange?: (linhas: LinhaRelatorioMedicao[]) => void
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
  linhas: linhasProp,
  compacto,
  mostrarTotais = true,
  mostrarColeta = true,
  onLinhasChange,
}: Props) {
  const [linhas, setLinhas] = useState(linhasProp)
  const [modoEdicaoTotal, setModoEdicaoTotal] = useState(false)
  const [rascunhoBulk, setRascunhoBulk] = useState<RascunhoEdicaoBulkMedicao>(
    rascunhoEdicaoBulkMedicaoVazio
  )

  useEffect(() => {
    setLinhas(linhasProp)
    setModoEdicaoTotal(false)
    setRascunhoBulk(rascunhoEdicaoBulkMedicaoVazio())
  }, [linhasProp])

  const totais = useMemo(() => totaisRelatorioMedicao(linhas), [linhas])
  const fontSize = compacto ? '10px' : '11px'
  const colunasEditaveisBulk = new Set(['quantViagens', 'valorFrete', 'pesoKg', 'valorTaxa', 'total'])

  function publicarLinhas(next: LinhaRelatorioMedicao[]) {
    setLinhas(next)
    onLinhasChange?.(next)
  }

  function aplicarEdicaoTotal() {
    const next = aplicarRascunhoBulkLinhasMedicao(linhas, rascunhoBulk)
    publicarLinhas(next)
    setRascunhoBulk(rascunhoEdicaoBulkMedicaoVazio())
    setModoEdicaoTotal(false)
  }

  function toggleEdicaoTotal() {
    if (modoEdicaoTotal) {
      aplicarEdicaoTotal()
      return
    }
    setModoEdicaoTotal(true)
  }

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
          {modoEdicaoTotal ? (
            <tr style={{ background: '#f8fafc' }}>
              {mostrarColeta ? (
                <td style={{ ...tdBase, fontSize, color: '#64748b', fontStyle: 'italic' }}>
                  Edição em massa
                </td>
              ) : null}
              {COLUNAS_RELATORIO_MEDICAO.map((c) => (
                <td key={`bulk-${c.key}`} style={{ ...tdBase, fontSize, textAlign: c.align }}>
                  {colunasEditaveisBulk.has(c.key) ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      style={inputBulk}
                      value={rascunhoBulk[c.key as keyof RascunhoEdicaoBulkMedicao]}
                      onChange={(e) => {
                        const key = c.key as keyof RascunhoEdicaoBulkMedicao
                        setRascunhoBulk((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }}
                      placeholder="—"
                      aria-label={`Editar ${c.label} em todas as linhas`}
                    />
                  ) : null}
                </td>
              ))}
            </tr>
          ) : null}
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
            <td style={{ ...tdBase, fontSize, textAlign: 'right' }}>
              <button
                type="button"
                className="rg-btn rg-btn--outline"
                style={{
                  fontSize: '11px',
                  padding: '6px 10px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
                onClick={toggleEdicaoTotal}
              >
                {modoEdicaoTotal ? 'Aplicar a todas' : 'Editar total'}
              </button>
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  )
}
