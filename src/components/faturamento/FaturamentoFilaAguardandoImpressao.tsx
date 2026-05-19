import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'

const wrap: CSSProperties = {
  background: '#fff',
  border: '1px solid #bfdbfe',
  borderRadius: '16px',
  padding: '18px 20px',
  marginBottom: '20px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
}

type Props = {
  linhas: FaturamentoResumoViewRow[]
  carregando: boolean
}

export function FaturamentoFilaAguardandoImpressao({ linhas, carregando }: Props) {
  if (carregando || linhas.length === 0) return null

  return (
    <div style={wrap}>
      <div style={{ fontWeight: 800, color: '#1e40af', marginBottom: '8px', fontSize: '15px' }}>
        Aguardando lançamento no Controle de Massa ({linhas.length})
      </div>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
        Estas coletas têm MTR, peso e ticket na vista, mas a pesagem ainda não foi <strong>salva</strong> no passo 4
        do Controle de Massa. Use <strong>Salvar pesagem e ticket</strong> — depois entram na fila de conferência
        acima. A impressão em papel é opcional.
      </p>
      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#0f172a', lineHeight: 1.55 }}>
        {linhas.slice(0, 8).map((r) => (
          <li key={r.coleta_id} style={{ marginBottom: '6px' }}>
            Coleta <strong>{r.numero_coleta ?? r.numero}</strong> · {r.cliente_nome ?? '—'}
            {r.mtr_numero ? ` · MTR ${r.mtr_numero}` : ''}
            {' · '}
            <Link
              to={`/controle-massa?coleta=${encodeURIComponent(r.coleta_id)}`}
              style={{ color: '#2563eb', fontWeight: 700 }}
            >
              Abrir pesagem →
            </Link>
          </li>
        ))}
      </ul>
      {linhas.length > 8 ? (
        <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#64748b' }}>
          + {linhas.length - 8} coleta(s) na mesma situação.
        </p>
      ) : null}
    </div>
  )
}
