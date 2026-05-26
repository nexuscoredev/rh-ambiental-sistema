import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
  aplicarRascunhosLinhasMedicao,
  atualizarCampoRascunhoMedicao,
  fingerprintLinhasMedicao,
  linhasParaRascunhosEdicao,
  mesclarLinhasComRascunhosMedicao,
  type RascunhoEdicaoLinhaMedicao,
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

const inputCelula: CSSProperties = {
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

const COLUNAS_EDITAVEIS = new Set([
  'quantViagens',
  'valorFrete',
  'pesoKg',
  'valorTaxa',
  'total',
])

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
  const [modoEdicao, setModoEdicao] = useState(false)
  const [rascunhos, setRascunhos] = useState<Record<string, RascunhoEdicaoLinhaMedicao>>({})
  const modoEdicaoRef = useRef(false)
  const linhasPropFingerprint = useMemo(() => fingerprintLinhasMedicao(linhasProp), [linhasProp])

  useEffect(() => {
    modoEdicaoRef.current = modoEdicao
  }, [modoEdicao])

  useEffect(() => {
    setLinhas(linhasProp)
    if (!modoEdicaoRef.current) {
      setModoEdicao(false)
      setRascunhos({})
    }
  }, [linhasPropFingerprint, linhasProp])

  const linhasPreview = useMemo(
    () => (modoEdicao ? mesclarLinhasComRascunhosMedicao(linhas, rascunhos) : linhas),
    [modoEdicao, linhas, rascunhos]
  )

  const totais = useMemo(() => totaisRelatorioMedicao(linhasPreview), [linhasPreview])
  const fontSize = compacto ? '10px' : '11px'

  function publicarLinhas(next: LinhaRelatorioMedicao[]) {
    setLinhas(next)
    onLinhasChange?.(next)
  }

  function entrarEdicao() {
    setRascunhos(linhasParaRascunhosEdicao(linhas))
    setModoEdicao(true)
  }

  function concluirEdicao() {
    const next = aplicarRascunhosLinhasMedicao(linhas, rascunhos)
    publicarLinhas(next)
    setModoEdicao(false)
    setRascunhos({})
  }

  function atualizarRascunho(
    coletaId: string,
    key: keyof RascunhoEdicaoLinhaMedicao,
    valor: string
  ) {
    const linha = linhas.find((l) => l.coleta_id === coletaId)
    if (!linha) return
    setRascunhos((prev) => {
      const draft = prev[coletaId] ?? linhasParaRascunhosEdicao(linhas)[coletaId]!
      return {
        ...prev,
        [coletaId]: atualizarCampoRascunhoMedicao(linha, draft, key, valor),
      }
    })
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
        {linhas.map((r) => {
          const draft = rascunhos[r.coleta_id]
          return (
            <tr
              key={r.coleta_id}
              style={modoEdicao ? { background: '#f8fafc' } : undefined}
            >
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
                  {modoEdicao && COLUNAS_EDITAVEIS.has(c.key) && draft ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      style={inputCelula}
                      value={draft[c.key as keyof RascunhoEdicaoLinhaMedicao]}
                      onChange={(e) =>
                        atualizarRascunho(
                          r.coleta_id,
                          c.key as keyof RascunhoEdicaoLinhaMedicao,
                          e.target.value
                        )
                      }
                      aria-label={`${c.label} — coleta ${r.numeroColeta ?? r.coleta_id}`}
                    />
                  ) : (
                    celulaValor(c.key, r)
                  )}
                </td>
              ))}
            </tr>
          )
        })}
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
            <td style={{ ...tdBase, fontSize, textAlign: 'right' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '6px',
                }}
              >
                <span style={{ fontWeight: 800 }}>{formatarMoedaMedicao(totais.total)}</span>
                <button
                  type="button"
                  className="rg-btn rg-btn--outline"
                  style={{
                    fontSize: '11px',
                    padding: '6px 10px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={modoEdicao ? concluirEdicao : entrarEdicao}
                >
                  {modoEdicao ? 'Concluir edição' : 'Editar total'}
                </button>
              </div>
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  )
}
