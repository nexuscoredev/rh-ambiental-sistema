import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import { supabase } from '../../lib/supabase'
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
import { useRgDialog } from '../../lib/RgDialogProvider'

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

const FILA_TICKET_VISIVEL_INICIAL = 5
const FILA_TICKET_CARREGAR_MAIS = 20

const filtrosWrap: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: '10px 12px',
  marginBottom: '14px',
  padding: '12px 14px',
  borderRadius: '12px',
  background: '#fffbeb',
  border: '1px solid #fde68a',
}

const filtroLabel: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#78716c',
  marginBottom: '4px',
}

const filtroInput: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  background: '#fff',
}

function normalizarBuscaFila(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

function textoColetaFila(r: FaturamentoResumoViewRow): string {
  const n = r.numero_coleta ?? r.numero
  return n != null ? String(n) : ''
}

function rotuloLancadorCm(row: {
  balanceiro?: string | null
  balanceiro_nome?: string | null
  usuario_balanceiro?: string | null
}): string {
  const bal = row.balanceiro ?? row.balanceiro_nome ?? row.usuario_balanceiro
  return typeof bal === 'string' ? bal.trim() : ''
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
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroMtr, setFiltroMtr] = useState('')
  const [filtroColeta, setFiltroColeta] = useState('')
  const [filtroLancador, setFiltroLancador] = useState('')
  const [visiveis, setVisiveis] = useState(FILA_TICKET_VISIVEL_INICIAL)
  const [lancadorPorColeta, setLancadorPorColeta] = useState<Record<string, string>>({})
  const { confirm, alert } = useRgDialog()

  const filtroAtivo =
    filtroCliente.trim() !== '' ||
    filtroMtr.trim() !== '' ||
    filtroColeta.trim() !== '' ||
    filtroLancador.trim() !== ''

  useEffect(() => {
    setVisiveis(FILA_TICKET_VISIVEL_INICIAL)
  }, [filtroCliente, filtroMtr, filtroColeta, filtroLancador, linhas])

  useEffect(() => {
    const ids = linhas.map((r) => r.coleta_id).filter(Boolean)
    if (!ids.length) {
      setLancadorPorColeta({})
      return
    }
    let cancel = false
    void (async () => {
      const map: Record<string, string> = {}
      const chunk = 80
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk)
        const { data, error } = await supabase
          .from('controle_massa')
          .select('coleta_id, balanceiro, balanceiro_nome, usuario_balanceiro, created_at')
          .in('coleta_id', slice)
          .order('created_at', { ascending: false })
        if (cancel) return
        if (error) {
          console.error('[fila ticket] balanceiro:', error)
          break
        }
        for (const row of data ?? []) {
          const cid = String(row.coleta_id ?? '')
          if (!cid || map[cid]) continue
          const nome = rotuloLancadorCm(row as Record<string, unknown>)
          if (nome) map[cid] = nome
        }
      }
      if (!cancel) setLancadorPorColeta(map)
    })()
    return () => {
      cancel = true
    }
  }, [linhas])

  const linhasFiltradas = useMemo(() => {
    const qCliente = normalizarBuscaFila(filtroCliente)
    const qMtr = normalizarBuscaFila(filtroMtr)
    const qColeta = normalizarBuscaFila(filtroColeta)
    const qLancador = normalizarBuscaFila(filtroLancador)

    return linhas.filter((r) => {
      if (qCliente) {
        const cliente = normalizarBuscaFila(r.cliente_nome ?? r.cliente_razao_social ?? '')
        if (!cliente.includes(qCliente)) return false
      }
      if (qMtr) {
        const mtr = normalizarBuscaFila(r.mtr_numero ?? '')
        if (!mtr.includes(qMtr)) return false
      }
      if (qColeta) {
        const coleta = normalizarBuscaFila(textoColetaFila(r))
        if (!coleta.includes(qColeta)) return false
      }
      if (qLancador) {
        const quem = normalizarBuscaFila(lancadorPorColeta[r.coleta_id] ?? '')
        if (!quem.includes(qLancador)) return false
      }
      return true
    })
  }, [linhas, filtroCliente, filtroMtr, filtroColeta, filtroLancador, lancadorPorColeta])

  const linhasVisiveis = useMemo(
    () => linhasFiltradas.slice(0, visiveis),
    [linhasFiltradas, visiveis]
  )

  const restantes = Math.max(0, linhasFiltradas.length - visiveis)
  const proximoLote = Math.min(FILA_TICKET_CARREGAR_MAIS, restantes)
  const listaExpandida = visiveis > FILA_TICKET_VISIVEL_INICIAL
  const mostrarControlesLista = linhasFiltradas.length > FILA_TICKET_VISIVEL_INICIAL

  const recolherLista = () => setVisiveis(FILA_TICKET_VISIVEL_INICIAL)

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
    if (!res.ok) {
      await alert({
        title: 'Ticket em PDF',
        message: res.message ?? 'Não foi possível abrir o PDF do ticket.',
        variant: 'danger',
      })
    }
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
      await alert({ title: 'Aprovação do ticket', message: res.message, variant: 'danger' })
      return
    }
    onAprovado()
  }

  return (
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
        <>
          <div style={filtrosWrap} role="search" aria-label="Filtros da fila de conferência do ticket">
            <div>
              <label htmlFor="fila-ticket-filtro-cliente" style={filtroLabel}>
                Cliente
              </label>
              <input
                id="fila-ticket-filtro-cliente"
                type="search"
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                placeholder="Nome do cliente"
                style={filtroInput}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="fila-ticket-filtro-mtr" style={filtroLabel}>
                MTR
              </label>
              <input
                id="fila-ticket-filtro-mtr"
                type="search"
                value={filtroMtr}
                onChange={(e) => setFiltroMtr(e.target.value)}
                placeholder="Número da MTR"
                style={filtroInput}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="fila-ticket-filtro-coleta" style={filtroLabel}>
                Coleta
              </label>
              <input
                id="fila-ticket-filtro-coleta"
                type="search"
                value={filtroColeta}
                onChange={(e) => setFiltroColeta(e.target.value)}
                placeholder="N.º da coleta"
                style={filtroInput}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="fila-ticket-filtro-lancador" style={filtroLabel}>
                Quem lançou
              </label>
              <input
                id="fila-ticket-filtro-lancador"
                type="search"
                value={filtroLancador}
                onChange={(e) => setFiltroLancador(e.target.value)}
                placeholder="Balanceiro / operador"
                style={filtroInput}
                autoComplete="off"
              />
            </div>
            {filtroAtivo ? (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  className="rg-btn rg-btn--outline"
                  style={{ fontSize: 12, padding: '8px 12px', width: '100%' }}
                  onClick={() => {
                    setFiltroCliente('')
                    setFiltroMtr('')
                    setFiltroColeta('')
                    setFiltroLancador('')
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            ) : null}
          </div>

          <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
            {filtroAtivo
              ? `${linhasFiltradas.length} de ${linhas.length} na fila (filtrado)`
              : `${linhas.length} na fila`}
            {linhasFiltradas.length > 0
              ? ` · a mostrar ${Math.min(visiveis, linhasFiltradas.length)}`
              : ''}
          </p>

          {linhasFiltradas.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Nenhum resultado com os filtros actuais.
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
                <th style={th}>Quem lançou</th>
                <th style={th}>Situação</th>
                <th style={th}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {linhasVisiveis.map((r) => {
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
                    <td style={td}>{lancadorPorColeta[r.coleta_id] || '—'}</td>
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

          {mostrarControlesLista ? (
            <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              {restantes > 0 ? (
                <>
                  <button
                    type="button"
                    className="rg-btn rg-btn--outline"
                    style={{ fontSize: 13, padding: '10px 16px', fontWeight: 700 }}
                    onClick={() => setVisiveis((v) => v + proximoLote)}
                  >
                    Carregar mais {proximoLote} ({restantes} restante{restantes === 1 ? '' : 's'})
                  </button>
                  <button
                    type="button"
                    className="rg-btn rg-btn--outline"
                    style={{ fontSize: 12, padding: '8px 12px' }}
                    onClick={() => setVisiveis(linhasFiltradas.length)}
                  >
                    Mostrar todos ({linhasFiltradas.length})
                  </button>
                </>
              ) : null}
              {listaExpandida ? (
                <button
                  type="button"
                  className="rg-btn rg-btn--outline"
                  style={{ fontSize: 12, padding: '8px 12px', fontWeight: 700 }}
                  onClick={recolherLista}
                >
                  Recolher lista (mostrar {FILA_TICKET_VISIVEL_INICIAL})
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
