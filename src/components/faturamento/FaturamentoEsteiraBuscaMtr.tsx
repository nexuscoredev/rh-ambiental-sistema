import { useState, type CSSProperties, type FormEvent } from 'react'
import {
  consultarEtapaEsteiraPorMtrId,
  consultarEtapaEsteiraPorMtrNumero,
  type ResultadoConsultaEsteiraMtr,
} from '../../lib/faturamentoEsteiraLookup'

const wrap: CSSProperties = {
  marginTop: '12px',
  padding: '12px 14px',
  borderRadius: '10px',
  background: "var(--bg-card, #ffffff)",
  border: "1px solid var(--border-color, #e2e8f0)",
}

const rowFlex: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
}

const inputStyle: CSSProperties = {
  flex: '1 1 200px',
  minWidth: '160px',
  padding: '8px 12px',
  borderRadius: '8px',
  border: "1px solid var(--input-border, #cbd5e1)",
  fontSize: '13px',
  fontWeight: 600,
  color: "var(--text-primary, #0f172a)",
}

const btnStyle: CSSProperties = {
  padding: '8px 16px',
  borderRadius: '8px',
  border: 'none',
  background: 'linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)',
  color: '#fff',
  fontWeight: 800,
  fontSize: '13px',
  cursor: 'pointer',
}

function PainelResultado({ resultado }: { resultado: ResultadoConsultaEsteiraMtr }) {
  if (resultado.status === 'vazio') return null

  if (resultado.status === 'erro') {
    return (
      <div
        style={{
          marginTop: '10px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: "var(--status-error-bg, #fef2f2)",
          border: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '13px',
        }}
      >
        {resultado.mensagem}
      </div>
    )
  }

  if (resultado.status === 'nao_encontrado') {
    return (
      <div
        style={{
          marginTop: '10px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: "var(--bg-subtle, #f8fafc)",
          border: "1px solid var(--border-color, #e2e8f0)",
          color: "var(--text-secondary, #475569)",
          fontSize: '13px',
        }}
      >
        Nenhuma MTR encontrada para <strong>{resultado.termo}</strong>. Verifique o número e tente de novo.
      </div>
    )
  }

  if (resultado.status === 'multiplos_mtrs') {
    return (
      <div
        style={{
          marginTop: '10px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: "var(--status-warning-bg, #fffbeb)",
          border: '1px solid #fde68a',
          color: '#92400e',
          fontSize: '13px',
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: '8px' }}>
          Várias MTRs correspondem a «{resultado.termo}». Escolha uma:
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
          {resultado.mtrs.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                data-mtr-id={m.id}
                className="faturamento-esteira-busca-mtr-opcao"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#0d9488',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                MTR {m.numero}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const { mtr, coletas, passo_principal, rotulo_passo_principal, passos_distintos } = resultado

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '12px 14px',
        borderRadius: '8px',
        background: passo_principal != null ? '#f0fdfa' : '#f8fafc',
        border: `1px solid ${passo_principal != null ? '#99f6e4' : '#e2e8f0'}`,
        fontSize: '13px',
        color: "var(--text-primary, #0f172a)",
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 800, color: '#0f766e', marginBottom: '6px' }}>
        MTR {mtr.numero}
      </div>
      {passo_principal != null ? (
        <p style={{ margin: 0 }}>
          Etapa atual: <strong>{rotulo_passo_principal}</strong>
        </p>
      ) : (
        <p style={{ margin: 0, color: "var(--text-secondary, #475569)" }}>
          <strong>{rotulo_passo_principal}</strong>
        </p>
      )}
      {coletas.length > 0 ? (
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: "var(--text-secondary, #64748b)" }}>
          {coletas.length === 1
            ? `1 coleta vinculada (n.º ${coletas[0]!.numero_exibicao}).`
            : `${coletas.length} coletas vinculadas.`}
          {passos_distintos ? ' As coletas estão em etapas diferentes — detalhe abaixo.' : null}
        </p>
      ) : null}
      {passos_distintos && coletas.length > 1 ? (
        <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px', color: "var(--text-primary, #334155)" }}>
          {coletas.map((c) => (
            <li key={c.coleta_id}>
              Coleta {c.numero_exibicao}: {c.rotulo_passo}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Consulta read-only: em que passo (1–8) da esteira está uma MTR. */
export function FaturamentoEsteiraBuscaMtr() {
  const [termo, setTermo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoConsultaEsteiraMtr | null>(null)

  async function executarBusca(valor: string) {
    const n = valor.trim()
    if (!n) {
      setResultado({ status: 'vazio' })
      return
    }
    setBuscando(true)
    setResultado(null)
    try {
      const res = await consultarEtapaEsteiraPorMtrNumero(n)
      setResultado(res)
    } finally {
      setBuscando(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void executarBusca(termo)
  }

  async function onEscolherMtr(mtrId: string) {
    setBuscando(true)
    setResultado(null)
    try {
      const res = await consultarEtapaEsteiraPorMtrId(mtrId)
      setResultado(res)
      if (res.status === 'ok') setTermo(res.mtr.numero)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div style={wrap}>
      <form onSubmit={onSubmit}>
        <div style={rowFlex}>
          <label htmlFor="faturamento-busca-mtr" style={{ fontSize: '12px', fontWeight: 700, color: "var(--text-secondary, #475569)" }}>
            Consultar etapa por MTR
          </label>
        </div>
        <div style={{ ...rowFlex, marginTop: '8px' }}>
          <input
            id="faturamento-busca-mtr"
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Número da MTR (ex.: 2377/2026)"
            style={inputStyle}
            disabled={buscando}
            autoComplete="off"
          />
          <button type="submit" style={btnStyle} disabled={buscando || !termo.trim()}>
            {buscando ? 'A consultar…' : 'Consultar'}
          </button>
        </div>
      </form>
      {resultado ? (
        <div
          onClick={(e) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
              'button.faturamento-esteira-busca-mtr-opcao'
            )
            const id = btn?.getAttribute('data-mtr-id')
            if (id) void onEscolherMtr(id)
          }}
        >
          <PainelResultado resultado={resultado} />
        </div>
      ) : (
        <p style={{ margin: '8px 0 0', fontSize: '11px', color: "var(--text-secondary, #94a3b8)" }}>
          Pesquisa parcial pelo número. Mostra o passo 1–8 da esteira de faturamento (somente leitura).
        </p>
      )}
    </div>
  )
}
