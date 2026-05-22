import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import {
  agruparGruposNfBoletoPorMtr,
  chaveGrupoMedicaoMtr,
  coletaAguardandoConfirmacaoNfBoleto,
  rotuloEsteiraLinha,
  type GrupoNfBoletoEsteira,
} from '../../lib/faturamentoEsteira'
import { supabase } from '../../lib/supabase'
import { registarNumeroNfBoletoEsteiraFaturamentoLote } from '../../services/financeiroReceber'
import { useRgDialog } from '../../lib/RgDialogProvider'

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
  /** False enquanto o escopo «histórico» (emitidas) ainda não foi buscado. */
  historicoCarregado?: boolean
  podeConfirmar?: boolean
  /** Após gravar NF/boleto e enviar a Contas a Receber (recarrega vista + histórico). */
  onFinalizado?: (coletaIds: string[]) => void | Promise<void>
  /** @deprecated Preferir `onFinalizado`. */
  onAtualizar?: () => void
}

function montarAvisoFinalizarProcesso(
  numeroNf: string,
  numeroBoleto: string,
  grupo: GrupoNfBoletoEsteira
): string {
  const tickets = rotuloTicketsGrupo(grupo)
  const plural = grupo.linhas.length > 1
  const boletoLinha = numeroBoleto ? `\nBoleto/ref.: ${numeroBoleto}` : ''
  const detalheTickets = plural
    ? `Tickets ${tickets} (${grupo.linhas.length} coletas, mesma MTR).`
    : `Coleta ${tickets}.`
  return (
    `Processo encerrado no Faturamento.\n\n` +
    `NF ${numeroNf} registada para ${detalheTickets}${boletoLinha}\n\n` +
    `A cobrança foi enviada para a fila de Contas a Receber do Financeiro.\n` +
    `Consulte o histórico «Coletas faturadas» nesta página ou em Financeiro → Contas a Receber.`
  )
}

function valorExibicao(row: FaturamentoResumoViewRow): string {
  const v = row.faturamento_registro_valor ?? row.valor_coleta
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function nfInicialGrupo(linhas: FaturamentoResumoViewRow[]): string {
  for (const r of linhas) {
    const n = (r.numero_nf_coleta ?? r.faturamento_referencia_nf ?? r.referencia_nf ?? '').trim()
    if (n) return n
  }
  return ''
}

function rotuloTicketsGrupo(grupo: GrupoNfBoletoEsteira): string {
  const nums = grupo.linhas.map((r) => String(r.numero_coleta ?? r.numero))
  if (nums.length <= 3) return nums.join(', ')
  return `${nums.slice(0, 2).join(', ')} +${nums.length - 2}`
}

function valorTotalGrupo(grupo: GrupoNfBoletoEsteira): string {
  let soma = 0
  let temValor = false
  for (const r of grupo.linhas) {
    const v = r.faturamento_registro_valor ?? r.valor_coleta
    if (v != null && Number.isFinite(Number(v))) {
      soma += Number(v)
      temValor = true
    }
  }
  if (!temValor) return '—'
  return soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function FaturamentoFilaPosFaturamento({
  linhas,
  carregando,
  historicoCarregado = true,
  podeConfirmar = false,
  onFinalizado,
  onAtualizar,
}: Props) {
  const { alert } = useRgDialog()
  const pendentes = useMemo(
    () => linhas.filter(coletaAguardandoConfirmacaoNfBoleto),
    [linhas]
  )

  const grupos = useMemo(() => agruparGruposNfBoletoPorMtr(linhas), [linhas])

  const [campos, setCampos] = useState<Record<string, CamposNfBoleto>>({})
  const [salvandoChave, setSalvandoChave] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    setCampos((prev) => {
      const next = { ...prev }
      for (const g of grupos) {
        const k = chaveGrupoMedicaoMtr(g.linhas[0]!)
        if (!next[k]) {
          next[k] = { numeroNf: nfInicialGrupo(g.linhas), numeroBoleto: '' }
        }
      }
      return next
    })
  }, [grupos])

  if (pendentes.length === 0) {
    if (!historicoCarregado || carregando) {
      return (
        <section id="fila-nf-boleto" style={card} aria-busy="true">
          <h2 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
            7. Mala Direta — Registo de NF / boleto
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>A carregar coletas faturadas…</p>
        </section>
      )
    }
    return null
  }

  function atualizarCampo(chaveGrupo: string, patch: Partial<CamposNfBoleto>) {
    setCampos((prev) => ({
      ...prev,
      [chaveGrupo]: {
        numeroNf: prev[chaveGrupo]?.numeroNf ?? '',
        numeroBoleto: prev[chaveGrupo]?.numeroBoleto ?? '',
        ...patch,
      },
    }))
  }

  async function guardarGrupo(grupo: GrupoNfBoletoEsteira) {
    setErro('')
    setMensagem('')
    if (!podeConfirmar) {
      setErro('Sem permissão para registar NF e enviar ao Financeiro.')
      return
    }

    const chave = chaveGrupoMedicaoMtr(grupo.linhas[0]!)
    const c = campos[chave]
    const numeroNf = (c?.numeroNf ?? '').trim()
    if (!numeroNf) {
      const tickets = rotuloTicketsGrupo(grupo)
      setErro(`Informe o número da NF (tickets ${tickets}).`)
      return
    }

    setSalvandoChave(chave)
    const res = await registarNumeroNfBoletoEsteiraFaturamentoLote(supabase, {
      referencia_coleta_ids: grupo.linhas.map((r) => r.coleta_id),
      numero_nf: numeroNf,
      numero_boleto: (c?.numeroBoleto ?? '').trim() || null,
    })
    setSalvandoChave(null)

    if (!res.ok) {
      setErro(res.message)
      return
    }

    const numeroBoleto = (c?.numeroBoleto ?? '').trim()
    const plural = grupo.linhas.length > 1
    const textoSucesso = montarAvisoFinalizarProcesso(numeroNf, numeroBoleto, grupo)
    setMensagem(
      plural
        ? `Enviado a Contas a Receber — NF ${numeroNf} (${grupo.linhas.length} coletas). Processo encerrado aqui; veja o histórico abaixo.`
        : `Enviado a Contas a Receber — NF ${numeroNf}. Processo encerrado aqui; veja o histórico abaixo.`
    )
    await alert({
      title: 'Processo encerrado no Faturamento',
      message: textoSucesso,
      variant: 'success',
    })

    const ids = grupo.linhas.map((r) => r.coleta_id)
    if (onFinalizado) {
      await onFinalizado(ids)
    } else {
      onAtualizar?.()
    }

    setCampos((prev) => {
      const next = { ...prev }
      delete next[chave]
      return next
    })

    requestAnimationFrame(() => {
      document.getElementById('faturamento-historico-coletas')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const busy = salvandoChave !== null

  return (
    <div id="fila-nf-boleto" style={card}>
      <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
        7. Mala Direta — Registo de NF / boleto
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
        Após <strong>confirmar o faturamento</strong>, informe o <strong>número da NF</strong> (e, se quiser, a
        referência do boleto). Vários tickets da <strong>mesma MTR</strong> partilham <strong>uma única NF/boleto</strong>.
        Ao <strong>finalizar o processo</strong>, o caso sai desta esteira e passa para a fila{' '}
        <Link to="/financeiro/contas-receber">Financeiro → Contas a Receber</Link>; aqui fica apenas no{' '}
        <a href="#faturamento-historico-coletas">histórico de coletas faturadas</a>. O envio por e-mail continua
        disponível em <Link to="/envio-nf">Mala Direta</Link> (opcional).
      </p>

      <div style={{ fontWeight: 700, fontSize: '13px', color: '#b45309', marginBottom: '10px' }}>
        Aguardando número NF / boleto ({grupos.length}{' '}
        {grupos.length === 1 ? 'faturamento' : 'faturamentos'}
        {pendentes.length !== grupos.length
          ? ` · ${pendentes.length} ticket${pendentes.length !== 1 ? 's' : ''}`
          : ''}
        )
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
        {grupos.slice(0, 30).map((grupo) => {
          const chave = chaveGrupoMedicaoMtr(grupo.linhas[0]!)
          const c = campos[chave] ?? { numeroNf: '', numeroBoleto: '' }
          const salvando = salvandoChave === chave
          const primeira = grupo.linhas[0]!
          const envioUrl = `/envio-nf?coleta=${encodeURIComponent(primeira.coleta_id)}${
            grupo.cliente_id ? `&cliente=${encodeURIComponent(grupo.cliente_id)}` : ''
          }`
          const multiplos = grupo.linhas.length > 1

          return (
            <li
              key={chave}
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
                  {multiplos ? (
                    <>
                      MTR {grupo.mtr_numero} · {grupo.cliente_nome} · Tickets {rotuloTicketsGrupo(grupo)}
                    </>
                  ) : (
                    <>
                      Coleta {grupo.linhas[0]!.numero_coleta ?? grupo.linhas[0]!.numero} · {grupo.cliente_nome}
                    </>
                  )}
                </span>
                <span style={{ color: '#64748b' }}>{rotuloEsteiraLinha(primeira)}</span>
                <span style={{ color: '#047857', fontWeight: 700 }}>
                  {multiplos ? `Total ${valorTotalGrupo(grupo)}` : valorExibicao(primeira)}
                </span>
                <Link
                  to={envioUrl}
                  className="rg-btn rg-btn--outline"
                  style={{ fontSize: '11px', padding: '4px 10px', marginLeft: 'auto' }}
                >
                  Mala Direta (e-mail)
                </Link>
              </div>

              {multiplos ? (
                <ul
                  style={{
                    margin: '0 0 12px',
                    padding: '0 0 0 18px',
                    fontSize: '12px',
                    color: '#64748b',
                    lineHeight: 1.6,
                  }}
                >
                  {grupo.linhas.map((r) => (
                    <li key={r.coleta_id}>
                      Ticket {r.numero_coleta ?? r.numero}
                      {r.tipo_residuo ? ` · ${r.tipo_residuo}` : ''} — {valorExibicao(r)}
                    </li>
                  ))}
                </ul>
              ) : null}

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
                    onChange={(e) => atualizarCampo(chave, { numeroNf: e.target.value })}
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
                    onChange={(e) => atualizarCampo(chave, { numeroBoleto: e.target.value })}
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
                  onClick={() => void guardarGrupo(grupo)}
                >
                  {salvando
                    ? 'A finalizar…'
                    : multiplos
                      ? `Finalizar processo (${grupo.linhas.length} coletas)`
                      : 'Finalizar processo'}
                </button>
              </div>
            </li>
          )
        })}
        {grupos.length > 30 ? (
          <li style={{ fontSize: '12px', color: '#94a3b8' }}>+ {grupos.length - 30} faturamento(s)…</li>
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
