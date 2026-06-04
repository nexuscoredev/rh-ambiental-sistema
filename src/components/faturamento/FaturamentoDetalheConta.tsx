import { useMemo, type CSSProperties } from 'react'
import {
  fmtBrlDetalheConta,
  montarDetalheContaFaturamento,
  montarDetalheReferenciaContrato,
  type LinhaDetalheConta,
} from '../../lib/faturamentoDetalheConta'
import type { PrecoBreakdownLinha } from '../../lib/faturamentoPrecoContrato'
import type { ResumoFinanceiroDesvinculado } from '../../lib/faturamentoDesvinculacao'

const wrap: CSSProperties = {
  marginBottom: '14px',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
}

const tituloGrupo: Record<string, string> = {
  ticket: 'Ticket (pesagem / comprovante)',
  mtr: 'MTR (caminhão + equipamento + resíduo)',
  ajuste: 'Ajustes',
  subtotal: 'Subtotais',
  referencia: 'Referência — contrato / regra',
}

type Props = {
  resumo: ResumoFinanceiroDesvinculado
  referencia?: {
    total: number
    origemLabel: string
    linhas: PrecoBreakdownLinha[]
  } | null
  diferenca?: number | null
}

function LinhaValor({ linha }: { linha: LinhaDetalheConta }) {
  const ehTotal = linha.grupo === 'total'
  const ehSub = linha.grupo === 'subtotal'
  const negativo = linha.valor < 0
  const valorAbs = Math.abs(linha.valor)
  const mostraValor =
    linha.grupo !== 'ticket' || linha.valor > 0 || linha.rotulo.toLowerCase().includes('valor')

  return (
    <div
      className="rg-mobile-stack-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '8px 16px',
        alignItems: 'start',
        padding: ehTotal ? '10px 0 0' : '5px 0',
        marginTop: ehTotal ? '8px' : 0,
        borderTop: ehTotal ? '2px solid #0f172a' : ehSub ? '1px dashed #cbd5e1' : 'none',
        fontWeight: ehTotal ? 800 : ehSub ? 700 : 500,
        fontSize: ehTotal ? '15px' : '13px',
        color: '#0f172a',
      }}
    >
      <div style={{ paddingLeft: linha.indent ? '12px' : 0 }}>
        <div>{linha.rotulo}</div>
        {linha.detalhe ? (
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>
            {linha.detalhe}
          </div>
        ) : null}
      </div>
      <div
        style={{
          fontWeight: ehTotal ? 800 : 700,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          color: negativo ? '#b91c1c' : ehTotal ? '#065f46' : '#0f172a',
        }}
      >
        {mostraValor
          ? negativo
            ? `− ${fmtBrlDetalheConta(valorAbs)}`
            : fmtBrlDetalheConta(valorAbs)
          : '—'}
      </div>
    </div>
  )
}

export function FaturamentoDetalheConta({ resumo, referencia, diferenca }: Props) {
  const grupos = useMemo(() => {
    const conta = montarDetalheContaFaturamento(resumo)
    const ref = referencia
      ? montarDetalheReferenciaContrato(referencia.linhas, referencia.total)
      : []
    const ordem: LinhaDetalheConta['grupo'][] = [
      'ticket',
      'mtr',
      'subtotal',
      'ajuste',
      'total',
      'referencia',
    ]
    const porGrupo = new Map<LinhaDetalheConta['grupo'], LinhaDetalheConta[]>()
    for (const g of ordem) porGrupo.set(g, [])
    for (const l of conta) {
      const arr = porGrupo.get(l.grupo) ?? []
      arr.push(l)
      porGrupo.set(l.grupo, arr)
    }
    for (const l of ref) {
      const arr = porGrupo.get('referencia') ?? []
      arr.push(l)
      porGrupo.set('referencia', arr)
    }
    return ordem
      .map((g) => ({ grupo: g, linhas: porGrupo.get(g) ?? [] }))
      .filter((x) => x.linhas.length > 0)
  }, [resumo, referencia])

  const confere =
    diferenca != null && referencia && referencia.total > 0 && Math.abs(diferenca) < 0.02

  return (
    <section style={wrap} aria-labelledby="detalhe-conta-titulo">
      <h3
        id="detalhe-conta-titulo"
        style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}
      >
        Detalhamento da conta
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
        Valores deste faturamento (editáveis nos blocos acima). A soma é{' '}
        <strong>ticket + MTR + acréscimo − desconto</strong>.
      </p>

      {grupos.map(({ grupo, linhas }) => (
        <div
          key={grupo}
          style={{
            marginBottom: grupo === 'total' ? '4px' : '14px',
            marginTop: grupo === 'referencia' ? '16px' : 0,
            paddingTop: grupo === 'referencia' ? '14px' : 0,
            borderTop: grupo === 'referencia' ? '2px solid #e2e8f0' : undefined,
          }}
        >
          {grupo !== 'total' && grupo !== 'subtotal' ? (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#64748b',
                marginBottom: '6px',
              }}
            >
              {tituloGrupo[grupo] ?? grupo}
              {grupo === 'referencia' && referencia ? ` · ${referencia.origemLabel}` : ''}
              {grupo === 'referencia' ? (
                <span
                  style={{
                    display: 'block',
                    marginTop: '4px',
                    fontWeight: 500,
                    textTransform: 'none',
                    letterSpacing: 0,
                    color: '#94a3b8',
                  }}
                >
                  Conferência automática (resíduos/mínimos pelo contrato). O caminhão segue o
                  selecionado acima.
                </span>
              ) : null}
            </div>
          ) : null}
          {linhas.map((l, i) => (
            <LinhaValor key={`${grupo}-${i}-${l.rotulo}`} linha={l} />
          ))}
        </div>
      ))}

      {referencia && referencia.total > 0 && diferenca != null ? (
        <div
          style={{
            marginTop: '4px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: confere ? '#ecfdf5' : '#fffbeb',
            border: `1px solid ${confere ? '#6ee7b7' : '#fcd34d'}`,
            fontSize: '13px',
            fontWeight: 700,
            color: confere ? '#047857' : '#b45309',
          }}
        >
          {confere
            ? 'A conta confere com a referência do contrato/regra.'
            : `Diferença em relação à referência: ${diferenca.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}`}
        </div>
      ) : null}
    </section>
  )
}
