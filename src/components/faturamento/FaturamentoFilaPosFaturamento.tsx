import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import {
  coletaAguardandoConfirmacaoNfBoleto,
  rotuloEsteiraLinha,
} from '../../lib/faturamentoEsteira'
import { supabase } from '../../lib/supabase'
import { confirmarNfBoletoEnviadosAoCliente } from '../../services/financeiroReceber'

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
  podeConfirmar?: boolean
  onAtualizar: () => void
}

export function FaturamentoFilaPosFaturamento({
  linhas,
  carregando,
  podeConfirmar = false,
  onAtualizar,
}: Props) {
  const pendentes = useMemo(
    () => linhas.filter(coletaAguardandoConfirmacaoNfBoleto),
    [linhas]
  )
  const [observacao, setObservacao] = useState('')
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [confirmandoTodos, setConfirmandoTodos] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  if (carregando || pendentes.length === 0) {
    return null
  }

  async function confirmar(ids: string[], labelLoading: string | null) {
    setErro('')
    setMensagem('')
    if (!podeConfirmar) {
      setErro('Sem permissão para confirmar envio de NF e boleto.')
      return
    }
    if (labelLoading === null) setConfirmandoTodos(true)
    else setConfirmandoId(labelLoading)

    const res = await confirmarNfBoletoEnviadosAoCliente(supabase, ids, observacao)
    if (labelLoading === null) setConfirmandoTodos(false)
    else setConfirmandoId(null)

    if (!res.ok) {
      setErro(res.message)
      return
    }
    setMensagem(
      ids.length === 1
        ? 'Coleta marcada como Finalizado. A cobrança pode ser acompanhada em Financeiro → Contas a Receber.'
        : `${ids.length} coletas marcadas como Finalizado.`
    )
    setObservacao('')
    onAtualizar()
  }

  const busy = confirmandoTodos || confirmandoId !== null

  return (
    <div style={card}>
      <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
        Esteira 5–7 · Pós-faturamento e NF
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
        Após emitir o faturamento, o status fica <strong>Liberado para o Financeiro</strong>. Registre o
        envio em <Link to="/envio-nf">Envio de NF</Link> ou confirme abaixo que <strong>NF e boleto</strong>{' '}
        foram enviados ao cliente. Só então a esteira passa para <strong>Finalizado</strong> e a cobrança
        entra em Financeiro → Contas a Receber.
      </p>

      <div style={{ fontWeight: 700, fontSize: '13px', color: '#b45309', marginBottom: '10px' }}>
        Aguardando confirmação NF + boleto ({pendentes.length})
      </div>

      <ul
        style={{
          margin: '0 0 14px',
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {pendentes.slice(0, 20).map((r) => {
          const envioUrl = `/envio-nf?coleta=${encodeURIComponent(r.coleta_id)}${
            r.cliente_id ? `&cliente=${encodeURIComponent(r.cliente_id)}` : ''
          }`
          const confirmando = confirmandoId === r.coleta_id
          return (
            <li
              key={r.coleta_id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px 14px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                fontSize: '12px',
                color: '#334155',
              }}
            >
              <span style={{ flex: '1 1 200px', fontWeight: 600 }}>
                Coleta {r.numero_coleta ?? r.numero} · {r.cliente_nome} · {rotuloEsteiraLinha(r)}
              </span>
              <Link
                to={envioUrl}
                className="rg-btn rg-btn--outline"
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                Envio de NF
              </Link>
              <button
                type="button"
                className="rg-btn rg-btn--primary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                disabled={!podeConfirmar || busy}
                onClick={() => void confirmar([r.coleta_id], r.coleta_id)}
              >
                {confirmando ? 'A confirmar…' : 'Confirmar NF e boleto enviados'}
              </button>
            </li>
          )
        })}
        {pendentes.length > 20 ? (
          <li style={{ fontSize: '12px', color: '#94a3b8' }}>+ {pendentes.length - 20} coleta(s)…</li>
        ) : null}
      </ul>

      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
        Observação (opcional)
      </label>
      <textarea
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        rows={2}
        placeholder="Ex.: NF e boleto enviados por e-mail em 21/05/2026."
        style={{
          width: '100%',
          maxWidth: '520px',
          marginBottom: '12px',
          padding: '8px 10px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          fontSize: '13px',
          resize: 'vertical',
        }}
      />

      <div className="fat-esteira-toolbar" style={{ marginBottom: '10px' }}>
        <button
          type="button"
          className="rg-btn rg-btn--primary"
          disabled={!podeConfirmar || busy}
          onClick={() =>
            void confirmar(
              pendentes.map((r) => r.coleta_id),
              null
            )
          }
        >
          {confirmandoTodos
            ? 'A confirmar todas…'
            : `Confirmar todas (${pendentes.length})`}
        </button>
      </div>

      {erro ? (
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#b91c1c', fontWeight: 600 }}>{erro}</p>
      ) : null}
      {mensagem ? (
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#047857', fontWeight: 600 }}>{mensagem}</p>
      ) : null}
    </div>
  )
}
