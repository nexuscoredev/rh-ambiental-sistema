import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import {
  aprovarTicketFaturamentoColeta,
  atualizarPesoLiquidoConferenciaTicket,
} from '../../lib/faturamentoTicketFluxo'
import { rotuloConferenciaNaFilaTicket } from '../../lib/faturamentoOperacionalFila'
import {
  formatarPesoKg,
  parsePesoLiquidoKgInput,
  pesoLiquidoParaInput,
} from '../../lib/pesoKgInput'
import { abrirPdfTicketOperacional } from '../../lib/ticketOperacionalPdf'
import { useRgConfirm } from '../../lib/useRgConfirm'

const wrap: CSSProperties = {
  background: '#fff',
  border: '1px solid #fde68a',
  borderRadius: '16px',
  padding: '20px 22px',
  marginBottom: '20px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
}

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#64748b',
  padding: '10px 12px',
  borderBottom: '1px solid #e2e8f0',
  background: '#fffbeb',
}

const td: CSSProperties = {
  padding: '12px',
  fontSize: '13px',
  color: '#0f172a',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
}

type Props = {
  linhas: FaturamentoResumoViewRow[]
  carregando: boolean
  podeAprovar: boolean
  podeEditarPeso: boolean
  onAprovado: () => void | Promise<void>
}

function fmtData(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export function FaturamentoFilaAprovacaoTicket({
  linhas,
  carregando,
  podeAprovar,
  podeEditarPeso,
  onAprovado,
}: Props) {
  const [aprovandoId, setAprovandoId] = useState<string | null>(null)
  const [abrindoPdfId, setAbrindoPdfId] = useState<string | null>(null)
  const [editandoPesoId, setEditandoPesoId] = useState<string | null>(null)
  const [pesoEditValor, setPesoEditValor] = useState('')
  const [salvandoPesoId, setSalvandoPesoId] = useState<string | null>(null)
  const [erroPeso, setErroPeso] = useState('')
  const [sucessoPeso, setSucessoPeso] = useState('')
  /** Reflete o peso gravado antes do refresh da vista. */
  const [pesoLocal, setPesoLocal] = useState<Record<string, number>>({})
  const { confirm, dialogElement } = useRgConfirm()

  const linhaOcupada = (coletaId: string) =>
    aprovandoId === coletaId || abrindoPdfId === coletaId || salvandoPesoId === coletaId

  function iniciarEdicaoPeso(row: FaturamentoResumoViewRow) {
    if (!podeEditarPeso) {
      setErroPeso('O seu perfil não pode alterar o peso nesta fila.')
      return
    }
    setSucessoPeso('')
    setErroPeso('')
    setEditandoPesoId(row.coleta_id)
    setPesoEditValor(pesoLiquidoParaInput(pesoLocal[row.coleta_id] ?? row.peso_liquido))
  }

  function cancelarEdicaoPeso() {
    setEditandoPesoId(null)
    setPesoEditValor('')
    setErroPeso('')
  }

  async function executarSalvarPeso(row: FaturamentoResumoViewRow, peso: number) {
    setSalvandoPesoId(row.coleta_id)
    setErroPeso('')
    setSucessoPeso('')
    const res = await atualizarPesoLiquidoConferenciaTicket(row.coleta_id, peso)
    setSalvandoPesoId(null)

    if (!res.ok) {
      setErroPeso(res.message)
      return
    }

    setPesoLocal((prev) => ({ ...prev, [row.coleta_id]: peso }))
    cancelarEdicaoPeso()
    setSucessoPeso(
      `Peso da coleta ${row.numero_coleta ?? row.numero} atualizado para ${formatarPesoKg(peso)}. MTR e ticket sincronizados.`
    )
    void onAprovado()
  }

  async function confirmarESalvarPeso(row: FaturamentoResumoViewRow) {
    const peso = parsePesoLiquidoKgInput(pesoEditValor)
    if (peso == null || peso <= 0) {
      setErroPeso('Informe um peso líquido válido (ex.: 1250 ou 1250,5).')
      return
    }

    const atual =
      pesoLocal[row.coleta_id] ??
      (row.peso_liquido != null ? Number(row.peso_liquido) : null)
    if (atual != null && Math.abs(atual - peso) < 0.001) {
      setErroPeso('O peso informado é igual ao atual. Altere o valor antes de guardar.')
      return
    }

    const rotulo = peso.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    })
    const ok = await confirm({
      title: 'Guardar peso líquido',
      message: (
        <>
          Coleta <strong>{row.numero_coleta ?? row.numero}</strong> · {row.cliente_nome ?? '—'}
        </>
      ),
      details: [
        `Novo peso: ${rotulo} kg`,
        'Atualiza a coleta, o Controle de Massa e o ticket desta pesagem.',
      ],
      confirmLabel: 'Guardar peso',
      variant: 'default',
    })
    if (!ok) return

    setErroPeso('')
    void executarSalvarPeso(row, peso)
  }

  async function handleVisualizar(row: FaturamentoResumoViewRow) {
    setAbrindoPdfId(row.coleta_id)
    const res = await abrirPdfTicketOperacional(row)
    setAbrindoPdfId(null)
    if (!res.ok) window.alert(res.message ?? 'Não foi possível abrir o PDF do ticket.')
  }

  async function handleAprovar(row: FaturamentoResumoViewRow) {
    if (!podeAprovar) return
    const ok = await confirm({
      title: 'Aprovar ticket na conferência',
      message: (
        <>
          Coleta <strong>{row.numero_coleta ?? row.numero}</strong> · {row.cliente_nome ?? '—'}
          {row.ticket_comprovante ? (
            <>
              {' '}
              · Ticket <strong>{row.ticket_comprovante}</strong>
            </>
          ) : null}
        </>
      ),
      details: [
        'Valida o ticket impresso e libera a coleta na esteira de faturamento.',
        'Próximos passos: ajuste de valores → relatório de medição → faturar → Financeiro.',
      ],
      confirmLabel: 'Aprovar ticket',
      variant: 'warning',
    })
    if (!ok) return

    setAprovandoId(row.coleta_id)
    const res = await aprovarTicketFaturamentoColeta(row.coleta_id)
    setAprovandoId(null)

    if (!res.ok) {
      window.alert(res.message)
      return
    }
    onAprovado()
  }

  return (
    <>
      {dialogElement}
      <section style={wrap} aria-labelledby="fila-aprovacao-ticket-titulo">
      <h2
        id="fila-aprovacao-ticket-titulo"
        style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: '#92400e' }}
      >
        Fila de conferência do ticket
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#78716c', lineHeight: 1.55, maxWidth: 720 }}>
        Coletas com pesagem e ticket <strong>salvos</strong> no Controle de Massa, aguardando validação do Faturamento.
        Depois de aprovar, a coleta segue na esteira (ajuste de valores → medição → faturar).
        {podeEditarPeso ? (
          <>
            {' '}
            Para corrigir o peso: <strong>Editar peso</strong> → altere o valor (kg) → <strong>Guardar</strong>.
          </>
        ) : podeAprovar ? (
          <>
            {' '}
            O seu perfil pode aprovar tickets, mas não alterar o peso manualmente.
          </>
        ) : (
          <>
            {' '}
            O seu perfil não pode alterar peso nem aprovar tickets nesta fila.
          </>
        )}
      </p>

      {sucessoPeso ? (
        <p
          role="status"
          style={{
            margin: '0 0 12px',
            padding: '10px 12px',
            borderRadius: 8,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {sucessoPeso}
        </p>
      ) : null}

      {erroPeso ? (
        <p
          role="alert"
          style={{
            margin: '0 0 12px',
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {erroPeso}
        </p>
      ) : null}

      {carregando ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>A carregar…</p>
      ) : linhas.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Nenhum ticket aguardando conferência neste momento.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Coleta</th>
                <th style={th}>Cliente</th>
                <th style={th}>MTR</th>
                <th style={th}>Ticket</th>
                <th style={th}>Peso líq.</th>
                <th style={th}>Salvo em</th>
                <th style={th}>Situação</th>
                <th style={th}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => {
                const editando = editandoPesoId === r.coleta_id
                const ocupada = linhaOcupada(r.coleta_id)

                return (
                  <tr key={r.coleta_id}>
                    <td style={td}>{r.numero_coleta ?? r.numero}</td>
                    <td style={td}>{r.cliente_nome ?? '—'}</td>
                    <td style={td}>{r.mtr_numero ?? '—'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{r.ticket_comprovante ?? '—'}</td>
                    <td style={td}>
                      {editando ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={pesoEditValor}
                            onChange={(e) => setPesoEditValor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                confirmarESalvarPeso(r)
                              }
                              if (e.key === 'Escape') cancelarEdicaoPeso()
                            }}
                            placeholder="Peso em kg"
                            autoFocus
                            disabled={salvandoPesoId === r.coleta_id}
                            aria-label="Peso líquido em kg"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: '1px solid #d97706',
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          />
                          {(r.peso_tara != null || r.peso_bruto != null) && (
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              Bruto {formatarPesoKg(r.peso_bruto)} · Tara {formatarPesoKg(r.peso_tara)}
                            </span>
                          )}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="rg-btn rg-btn--primary"
                              style={{ fontSize: 11, padding: '6px 10px' }}
                              disabled={salvandoPesoId === r.coleta_id}
                              onClick={() => confirmarESalvarPeso(r)}
                            >
                              {salvandoPesoId === r.coleta_id ? 'A guardar…' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              className="rg-btn rg-btn--outline"
                              style={{ fontSize: 11, padding: '6px 10px' }}
                              disabled={salvandoPesoId === r.coleta_id}
                              onClick={cancelarEdicaoPeso}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <span>{formatarPesoKg(pesoLocal[r.coleta_id] ?? r.peso_liquido)}</span>
                          {podeEditarPeso ? (
                            <button
                              type="button"
                              disabled={ocupada}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                iniciarEdicaoPeso(r)
                              }}
                              title="Corrigir peso líquido manualmente"
                              style={{
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                color: '#b45309',
                                fontWeight: 800,
                                fontSize: 11,
                                cursor: ocupada ? 'not-allowed' : 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              Editar peso
                            </button>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td style={td}>{fmtData(r.ticket_impresso_em)}</td>
                    <td style={{ ...td, color: '#b45309', fontWeight: 700 }}>
                      {rotuloConferenciaNaFilaTicket(r)}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="rg-btn rg-btn--outline"
                          style={{ fontSize: 12, padding: '8px 14px' }}
                          disabled={ocupada || editando}
                          onClick={() => void handleVisualizar(r)}
                          title="Abrir PDF do ticket para conferência"
                        >
                          {abrindoPdfId === r.coleta_id ? 'A abrir…' : 'Visualizar ticket'}
                        </button>
                        <button
                          type="button"
                          className="rg-btn rg-btn--primary"
                          style={{
                            fontSize: 12,
                            padding: '8px 14px',
                            background: podeAprovar && !ocupada && !editando ? '#f59e0b' : undefined,
                            borderColor: podeAprovar && !ocupada && !editando ? '#d97706' : undefined,
                          }}
                          disabled={!podeAprovar || ocupada || editando}
                          onClick={() => void handleAprovar(r)}
                        >
                          {aprovandoId === r.coleta_id ? 'Aprovando…' : 'Aprovar ticket'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </>
  )
}
