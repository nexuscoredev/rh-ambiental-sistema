import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import {
  coletaAguardandoConfirmacaoNfBoleto,
  rotuloEsteiraLinha,
} from '../../lib/faturamentoEsteira'
import { supabase } from '../../lib/supabase'
import { registarNumeroNfBoletoEsteiraFaturamento } from '../../services/financeiroReceber'

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '18px 20px',
  marginBottom: '18px',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 120,
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
}

type CamposNfBoleto = {
  numeroNf: string
  numeroBoleto: string
}

type Props = {
  linhas: FaturamentoResumoViewRow[]
  carregando?: boolean
  podeConfirmar?: boolean
  onAtualizar: () => void
}

function valorExibicao(row: FaturamentoResumoViewRow): string {
  const v = row.faturamento_registro_valor ?? row.valor_coleta
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

  const [campos, setCampos] = useState<Record<string, CamposNfBoleto>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    setCampos((prev) => {
      const next = { ...prev }
      for (const r of pendentes) {
        if (!next[r.coleta_id]) {
          next[r.coleta_id] = {
            numeroNf: (r.numero_nf_coleta ?? r.faturamento_referencia_nf ?? r.referencia_nf ?? '').trim(),
            numeroBoleto: '',
          }
        }
      }
      return next
    })
  }, [pendentes])

  if (carregando || pendentes.length === 0) {
    return null
  }

  function atualizarCampo(coletaId: string, patch: Partial<CamposNfBoleto>) {
    setCampos((prev) => ({
      ...prev,
      [coletaId]: {
        numeroNf: prev[coletaId]?.numeroNf ?? '',
        numeroBoleto: prev[coletaId]?.numeroBoleto ?? '',
        ...patch,
      },
    }))
  }

  async function guardar(row: FaturamentoResumoViewRow) {
    setErro('')
    setMensagem('')
    if (!podeConfirmar) {
      setErro('Sem permissão para registar NF e enviar ao Financeiro.')
      return
    }

    const c = campos[row.coleta_id]
    const numeroNf = (c?.numeroNf ?? '').trim()
    if (!numeroNf) {
      setErro(`Informe o número da NF da coleta ${row.numero_coleta ?? row.numero}.`)
      return
    }

    setSalvandoId(row.coleta_id)
    const res = await registarNumeroNfBoletoEsteiraFaturamento(supabase, {
      referencia_coleta_id: row.coleta_id,
      numero_nf: numeroNf,
      numero_boleto: (c?.numeroBoleto ?? '').trim() || null,
    })
    setSalvandoId(null)

    if (!res.ok) {
      setErro(res.message)
      return
    }

    setMensagem(
      `Coleta ${row.numero_coleta ?? row.numero}: NF registada. A cobrança está em Financeiro → Contas a Receber.`
    )
    onAtualizar()
  }

  const busy = salvandoId !== null

  return (
    <div style={card}>
      <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
        7. Mala Direta — Registo de NF / boleto
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
        Após <strong>confirmar o faturamento</strong>, informe o <strong>número da NF</strong> (e, se quiser, a
        referência do boleto). Ao <strong>guardar</strong>, a coleta passa para <strong>Finalizado</strong> e entra na
        fila <Link to="/financeiro/contas-receber">Financeiro → Contas a Receber</Link>. O envio por e-mail continua
        disponível em <Link to="/envio-nf">Mala Direta</Link> (opcional).
      </p>

      <div style={{ fontWeight: 700, fontSize: '13px', color: '#b45309', marginBottom: '10px' }}>
        Aguardando número NF / boleto ({pendentes.length})
      </div>

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {pendentes.slice(0, 30).map((r) => {
          const c = campos[r.coleta_id] ?? { numeroNf: '', numeroBoleto: '' }
          const salvando = salvandoId === r.coleta_id
          const envioUrl = `/envio-nf?coleta=${encodeURIComponent(r.coleta_id)}${
            r.cliente_id ? `&cliente=${encodeURIComponent(r.cliente_id)}` : ''
          }`

          return (
            <li
              key={r.coleta_id}
              style={{
                padding: '14px 14px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px 14px',
                  alignItems: 'center',
                  marginBottom: '12px',
                  fontSize: '12px',
                  color: '#334155',
                }}
              >
                <span style={{ fontWeight: 700 }}>
                  Coleta {r.numero_coleta ?? r.numero} · {r.cliente_nome}
                </span>
                <span style={{ color: '#64748b' }}>{rotuloEsteiraLinha(r)}</span>
                <span style={{ color: '#047857', fontWeight: 700 }}>{valorExibicao(r)}</span>
                <Link
                  to={envioUrl}
                  className="rg-btn rg-btn--outline"
                  style={{ fontSize: '11px', padding: '4px 10px', marginLeft: 'auto' }}
                >
                  Mala Direta (e-mail)
                </Link>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '10px 14px',
                  alignItems: 'end',
                }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '12px', fontWeight: 600 }}>
                  Número da NF *
                  <input
                    type="text"
                    value={c.numeroNf}
                    onChange={(e) => atualizarCampo(r.coleta_id, { numeroNf: e.target.value })}
                    placeholder="Ex.: 12345"
                    disabled={!podeConfirmar || busy}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '12px', fontWeight: 600 }}>
                  Boleto / referência (opcional)
                  <input
                    type="text"
                    value={c.numeroBoleto}
                    onChange={(e) => atualizarCampo(r.coleta_id, { numeroBoleto: e.target.value })}
                    placeholder="Nº boleto ou linha digitável"
                    disabled={!podeConfirmar || busy}
                    style={inputStyle}
                  />
                </label>
                <button
                  type="button"
                  className="rg-btn rg-btn--primary"
                  style={{ fontSize: '13px', padding: '10px 16px', fontWeight: 800 }}
                  disabled={!podeConfirmar || busy}
                  onClick={() => void guardar(r)}
                >
                  {salvando ? 'A guardar…' : 'Guardar e enviar ao Financeiro'}
                </button>
              </div>
            </li>
          )
        })}
        {pendentes.length > 30 ? (
          <li style={{ fontSize: '12px', color: '#94a3b8' }}>+ {pendentes.length - 30} coleta(s)…</li>
        ) : null}
      </ul>

      {erro ? (
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#b91c1c', fontWeight: 600 }}>{erro}</p>
      ) : null}
      {mensagem ? (
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#047857', fontWeight: 600 }}>{mensagem}</p>
      ) : null}
    </div>
  )
}
