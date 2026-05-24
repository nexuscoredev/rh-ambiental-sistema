import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { LinkGerarOsClinicas } from './LinkGerarOsClinicas'
import { RgReportPdfIcon } from '../ui/RgReportPdfIcon'
import {
  clinicaOsNoFinanceiro,
  clinicaOsPodeExcluirEmitida,
  enviarClinicaOsAoFinanceiro,
  excluirClinicaOrdemServicoEmitida,
  listarHistoricoOsClinicasEmitidas,
  rotuloMeioCobranca,
} from '../../lib/clinicasApi'
import { formatarMoedaClinica } from '../../lib/clinicasFaturamento'
import type { ClinicaOrdemServicoDetalhe } from '../../lib/clinicasTypes'
import { useRgDialog } from '../../lib/RgDialogProvider'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { sugerirDataVencimentoIso } from '../../services/financeiroReceber'

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px 22px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
  marginBottom: '18px',
}

function inicioMesIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type Props = {
  /** Incrementar após emissão na fila para atualizar a lista sem clicar em Atualizar. */
  refreshVersao?: number
}

export function ClinicasHistoricoFaturado({ refreshVersao = 0 }: Props) {
  const { alert, confirm } = useRgDialog()
  const [dataDe, setDataDe] = useState(inicioMesIso)
  const [dataAte, setDataAte] = useState(hojeIso)
  const [busca, setBusca] = useState('')
  const buscaDeb = useDebouncedValue(busca, 300)
  const [ordens, setOrdens] = useState<ClinicaOrdemServicoDetalhe[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [processandoId, setProcessandoId] = useState<string | null>(null)

  const recarregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) {
        setCarregando(true)
        setErro('')
      }
      const res = await listarHistoricoOsClinicasEmitidas({
        dataServicoDe: dataDe,
        dataServicoAte: dataAte,
      })
      if (!silencioso) setCarregando(false)
      if (!res.ok) {
        if (!silencioso) {
          setErro(res.message)
          setOrdens([])
        }
        return
      }
      setErro('')
      setOrdens(res.ordens)
    },
    [dataDe, dataAte]
  )

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    if (refreshVersao < 1) return
    void recarregar(true)
  }, [refreshVersao, recarregar])

  const filtradas = useMemo(() => {
    const t = buscaDeb.trim().toLowerCase()
    if (!t) return ordens
    return ordens.filter((o) => {
      const blob = [o.numero_os, o.razao_social, o.cnpj, o.cpf, o.referencia_nf]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(t)
    })
  }, [ordens, buscaDeb])

  const somaValores = useMemo(
    () => filtradas.reduce((s, o) => s + (o.faturamento_valor ?? 0), 0),
    [filtradas]
  )

  async function exportarPdf() {
    if (gerandoPdf) return
    setGerandoPdf(true)
    try {
      const { gerarRelatorioClinicasHistoricoPdf: gerar } = await import(
        '../../lib/gerarRelatorioClinicasPdf'
      )
      gerar({
        ordens: filtradas,
        filtros: { dataDe, dataAte, busca: buscaDeb },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Nao foi possivel gerar o PDF.'
      await alert({ title: 'Relatorio PDF', message: msg, variant: 'danger' })
    } finally {
      setGerandoPdf(false)
    }
  }

  async function enviarFinanceiro(o: ClinicaOrdemServicoDetalhe) {
    if (clinicaOsNoFinanceiro(o)) {
      await alert({
        title: 'Financeiro',
        message: 'Esta O.S. já foi enviada ao financeiro.',
        variant: 'warning',
      })
      return
    }
    const ok = await confirm({
      title: 'Enviar ao financeiro',
      message: `Enviar ${o.numero_os} (${o.razao_social}) para a fila de Contas a receber — Clínicas?`,
      confirmLabel: 'Enviar',
      variant: 'warning',
    })
    if (!ok) return

    setProcessandoId(o.id)
    const res = await enviarClinicaOsAoFinanceiro(o.id, sugerirDataVencimentoIso(7))
    setProcessandoId(null)

    if (!res.ok) {
      await alert({ title: 'Financeiro', message: res.message, variant: 'danger' })
      return
    }
    await alert({
      title: 'Enviado',
      message: 'Título criado na fila de clínicas em Financeiro → Contas a receber.',
      variant: 'success',
    })
    await recarregar()
  }

  async function excluirEmitida(o: ClinicaOrdemServicoDetalhe) {
    if (!clinicaOsPodeExcluirEmitida(o)) {
      await alert({
        title: 'Exclusão',
        message:
          'Não é possível excluir O.S. já quitada no financeiro. Estorne o pagamento na fila de clínicas antes.',
        variant: 'warning',
      })
      return
    }
    const ok = await confirm({
      title: 'Excluir O.S. faturada',
      message: `Excluir permanentemente ${o.numero_os} (${o.razao_social})? Remove também o título no financeiro se ainda não foi pago.`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    setProcessandoId(o.id)
    const res = await excluirClinicaOrdemServicoEmitida(o.id)
    setProcessandoId(null)

    if (!res.ok) {
      await alert({ title: 'Exclusão', message: res.message, variant: 'danger' })
      return
    }
    await recarregar()
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Histórico — O.S. faturadas</h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b', maxWidth: 640 }}>
            Ordens emitidas no faturamento. Envie ao financeiro ou exclua antes do pagamento.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <LinkGerarOsClinicas variant="outline">Gerar novas O.S. →</LinkGerarOsClinicas>
          <button
            type="button"
            onClick={() => void recarregar()}
            disabled={carregando}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontWeight: 700,
              fontSize: '13px',
              cursor: carregando ? 'wait' : 'pointer',
            }}
          >
            Atualizar
          </button>
          <button
            type="button"
            className="rg-btn rg-btn--report"
            onClick={() => void exportarPdf()}
            disabled={carregando || gerandoPdf}
            title="Gerar PDF do histórico filtrado"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #0d9488',
              background: '#fff',
              color: '#0f766e',
              fontWeight: 700,
              fontSize: '13px',
              cursor: carregando || gerandoPdf ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RgReportPdfIcon className="rg-btn__icon" />
            {gerandoPdf ? 'Gerando PDF…' : 'Relatório PDF'}
          </button>
        </div>
      </div>

      {erro ? (
        <p style={{ marginTop: '12px', color: '#b91c1c', fontSize: '13px' }}>{erro}</p>
      ) : null}

      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'flex-end',
        }}
      >
        <label style={{ fontSize: '13px' }}>
          Data serv. de
          <input
            type="date"
            value={dataDe}
            onChange={(e) => setDataDe(e.target.value)}
            style={{
              display: 'block',
              marginTop: '4px',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
        </label>
        <label style={{ fontSize: '13px' }}>
          até
          <input
            type="date"
            value={dataAte}
            onChange={(e) => setDataAte(e.target.value)}
            style={{
              display: 'block',
              marginTop: '4px',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
        </label>
        <label style={{ fontSize: '13px', flex: '1 1 200px', minWidth: 180 }}>
          Buscar
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="O.S., unidade, CNPJ, NF…"
            style={{
              display: 'block',
              width: '100%',
              marginTop: '4px',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
        </label>
      </div>

      <p style={{ margin: '14px 0 0', fontSize: '13px', color: '#475569' }}>
        <strong>{filtradas.length}</strong> O.S. emitida(s)
        {filtradas.length > 0 ? (
          <>
            {' '}
            · Soma valores: <strong>{formatarMoedaClinica(somaValores)}</strong>
          </>
        ) : null}
      </p>

      {carregando ? (
        <p style={{ marginTop: '12px', color: '#64748b' }}>A carregar histórico…</p>
      ) : filtradas.length === 0 ? (
        <p style={{ marginTop: '12px', color: '#64748b' }}>Nenhuma O.S. emitida no período.</p>
      ) : (
        <div style={{ marginTop: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>O.S.</th>
                <th style={{ padding: '8px' }}>Unidade</th>
                <th style={{ padding: '8px' }}>Data serv.</th>
                <th style={{ padding: '8px' }}>Cobrança</th>
                <th style={{ padding: '8px' }}>NF ref.</th>
                <th style={{ padding: '8px' }}>Valor</th>
                <th style={{ padding: '8px' }}>Financeiro</th>
                <th style={{ padding: '8px' }} />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o) => {
                const noFin = clinicaOsNoFinanceiro(o)
                const busy = processandoId === o.id
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{o.numero_os}</td>
                    <td style={{ padding: '10px 8px' }}>{o.razao_social}</td>
                    <td style={{ padding: '10px 8px' }}>{o.data_servico}</td>
                    <td style={{ padding: '10px 8px' }}>
                      {rotuloMeioCobranca(o.emite_nota_snapshot, o.pagamento_pix_snapshot)}
                    </td>
                    <td style={{ padding: '10px 8px' }}>{o.referencia_nf?.trim() || '—'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      {o.faturamento_valor != null && o.faturamento_valor > 0
                        ? formatarMoedaClinica(o.faturamento_valor)
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: '12px', color: '#64748b' }}>
                      {noFin ? (
                        <>
                          Na fila
                          {o.conta_status_pagamento === 'Pago' ? ' · Pago' : ''}
                        </>
                      ) : (
                        'Aguardando envio'
                      )}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {!noFin ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void enviarFinanceiro(o)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#0d9488',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: busy ? 'wait' : 'pointer',
                            }}
                          >
                            {busy ? '…' : 'Enviar ao financeiro'}
                          </button>
                        ) : (
                          <Link
                            to="/financeiro/contas-receber?aba=clinicas"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              fontWeight: 700,
                              fontSize: '12px',
                              color: '#0d9488',
                              textDecoration: 'none',
                            }}
                          >
                            Ver no financeiro
                          </Link>
                        )}
                        <button
                          type="button"
                          disabled={busy || !clinicaOsPodeExcluirEmitida(o)}
                          onClick={() => void excluirEmitida(o)}
                          title={
                            clinicaOsPodeExcluirEmitida(o)
                              ? 'Excluir O.S. e título não pago'
                              : 'Não disponível após pagamento'
                          }
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#b91c1c',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor:
                              busy || !clinicaOsPodeExcluirEmitida(o) ? 'not-allowed' : 'pointer',
                            opacity: clinicaOsPodeExcluirEmitida(o) ? 1 : 0.5,
                          }}
                        >
                          Excluir
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
    </div>
  )
}
