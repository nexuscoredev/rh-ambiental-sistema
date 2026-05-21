import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import {
  coletaAguardandoEnvioNfCliente,
  coletaLiberadaFinanceiroEsteira,
  rotuloEsteiraLinha,
} from '../../lib/faturamentoEsteira'

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '18px 20px',
  marginBottom: '18px',
}

type Props = {
  linhas: FaturamentoResumoViewRow[]
  carregando?: boolean
}

export function FaturamentoFilaPosFaturamento({ linhas, carregando }: Props) {
  const aguardandoNf = linhas.filter(coletaAguardandoEnvioNfCliente)
  const liberadoFin = linhas.filter(coletaLiberadaFinanceiroEsteira)

  if (carregando || (aguardandoNf.length === 0 && liberadoFin.length === 0)) {
    return null
  }

  return (
    <div style={card}>
      <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
        Esteira 5–7 · Pós-faturamento e NF
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
        Após emitir o faturamento, gere o relatório para o cliente e registre o envio de NF em{' '}
        <Link to="/envio-nf">Envio de NF</Link>. Só com status <strong>Finalizado</strong> a cobrança entra
        em Financeiro → Contas a Receber.
      </p>

      {aguardandoNf.length > 0 ? (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#b45309', marginBottom: '8px' }}>
            Aguardando envio NF ao cliente ({aguardandoNf.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#334155' }}>
            {aguardandoNf.slice(0, 12).map((r) => (
              <li key={r.coleta_id}>
                Coleta {r.numero_coleta ?? r.numero} · {r.cliente_nome} · {rotuloEsteiraLinha(r)}
              </li>
            ))}
            {aguardandoNf.length > 12 ? (
              <li style={{ color: '#94a3b8' }}>+ {aguardandoNf.length - 12} …</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {liberadoFin.length > 0 ? (
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          <strong>{liberadoFin.length}</strong> coleta(s) com status Liberado financeiro (emitidas).
        </div>
      ) : null}
    </div>
  )
}
