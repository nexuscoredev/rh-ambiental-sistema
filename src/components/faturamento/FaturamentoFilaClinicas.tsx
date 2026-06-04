import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { LinkGerarOsClinicas } from '../clinicas/LinkGerarOsClinicas'
import { rotuloMeioCobranca } from '../../lib/clinicasApi'
import { CLINICAS_GERAR_OS_PATH } from '../../lib/clinicasRotas'
import {
  emitirFaturamentoClinicaOs,
  exigeReferenciaNfNaEmissao,
  formatarMoedaClinica,
  listarFilaFaturamentoClinicas,
  parseValorClinicaInput,
  salvarValorFaturamentoClinica,
} from '../../lib/clinicasFaturamento'
import type { ClinicaFilaFaturamentoRow } from '../../lib/clinicasTypes'
import { useRgDialog } from '../../lib/RgDialogProvider'
import { sugerirDataVencimentoIso } from '../../services/financeiroReceber'

type Props = {
  podeEmitir: boolean
  podeEditarValor: boolean
  /** Dispara recarga do histórico de O.S. emitidas (secção abaixo). */
  onOsEmitida?: () => void
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px 22px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
  marginBottom: '18px',
}

export function FaturamentoFilaClinicas({ podeEmitir, podeEditarValor, onOsEmitida }: Props) {
  const { confirm, alert } = useRgDialog()
  const [linhas, setLinhas] = useState<ClinicaFilaFaturamentoRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [valoresDraft, setValoresDraft] = useState<Record<string, string>>({})
  const [nfDraft, setNfDraft] = useState<Record<string, string>>({})
  const [processandoId, setProcessandoId] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    const res = await listarFilaFaturamentoClinicas()
    setCarregando(false)
    if (!res.ok) {
      setErro(res.message)
      setLinhas([])
      return
    }
    setLinhas(res.linhas)
    const v: Record<string, string> = {}
    for (const r of res.linhas) {
      if (r.faturamento_valor != null && r.faturamento_valor > 0) {
        v[r.ordem_servico_id] = String(r.faturamento_valor).replace('.', ',')
      }
    }
    setValoresDraft(v)
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const qtd = linhas.length

  const valorPendenteEstimado = useMemo(() => {
    let s = 0
    for (const r of linhas) {
      const id = r.ordem_servico_id
      const parsed = parseValorClinicaInput(valoresDraft[id] ?? '')
      const v = parsed ?? (r.faturamento_valor != null ? Number(r.faturamento_valor) : 0)
      if (v > 0) s += v
    }
    return s > 0 ? formatarMoedaClinica(s) : '—'
  }, [linhas, valoresDraft])

  async function gravarValor(row: ClinicaFilaFaturamentoRow) {
    if (!podeEditarValor) return
    const valor = parseValorClinicaInput(valoresDraft[row.ordem_servico_id] ?? '')
    if (valor == null) {
      await alert({ title: 'Valor', message: 'Informe um valor válido.', variant: 'warning' })
      return
    }
    setProcessandoId(row.ordem_servico_id)
    const res = await salvarValorFaturamentoClinica(row.ordem_servico_id, valor)
    setProcessandoId(null)
    if (!res.ok) {
      await alert({ title: 'Clínicas', message: res.message, variant: 'danger' })
      return
    }
    await recarregar()
  }

  async function emitir(row: ClinicaFilaFaturamentoRow) {
    if (!podeEmitir) return
    const valor = parseValorClinicaInput(valoresDraft[row.ordem_servico_id] ?? '')
    if (valor == null) {
      await alert({
        title: 'Faturamento clínicas',
        message: 'Defina e grave o valor antes de emitir.',
        variant: 'warning',
      })
      return
    }

    const nf = (nfDraft[row.ordem_servico_id] ?? '').trim()
    if (exigeReferenciaNfNaEmissao(row) && !nf) {
      await alert({
        title: 'Nota fiscal',
        message: 'Esta unidade emite NF — informe o número da nota.',
        variant: 'warning',
      })
      return
    }

    const meio = rotuloMeioCobranca(row.emite_nota_snapshot, row.pagamento_pix_snapshot)
    const ok = await confirm({
      title: 'Emitir faturamento — clínica',
      message: `${row.razao_social}\n${row.numero_os}\nValor: ${formatarMoedaClinica(valor)}\n${meio}`,
      confirmLabel: 'Emitir',
      variant: 'warning',
    })
    if (!ok) return

    setProcessandoId(row.ordem_servico_id)
    const saveRes = await salvarValorFaturamentoClinica(row.ordem_servico_id, valor)
    if (!saveRes.ok) {
      setProcessandoId(null)
      await alert({ title: 'Clínicas', message: saveRes.message, variant: 'danger' })
      return
    }

    const emitRes = await emitirFaturamentoClinicaOs({
      ordemId: row.ordem_servico_id,
      valor,
      dataVencimento: sugerirDataVencimentoIso(7),
      referenciaNf: nf || null,
    })
    setProcessandoId(null)

    if (!emitRes.ok) {
      await alert({ title: 'Emissão', message: emitRes.message, variant: 'danger' })
      return
    }

    await alert({
      title: 'Emitido',
      message: `O.S. emitida. Envie ao financeiro no histórico de Faturar clínicas ou em Financeiro → Contas a receber → Fila clínicas.`,
      variant: 'success',
    })
    await recarregar()
    onOsEmitida?.()
  }

  return (
    <section id="fila-clinicas" style={cardStyle} aria-labelledby="fila-clinicas-titulo">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 id="fila-clinicas-titulo" style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
            Fila de espera
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b', maxWidth: 720, lineHeight: 1.55 }}>
            O.S. aguardando valor e emissão. Unidades com <strong>Emite Nota</strong> exigem NF; só <strong>PIX</strong>{' '}
            → sem NF.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <LinkGerarOsClinicas variant="outline" />
          <button
            type="button"
            onClick={() => void recarregar()}
            disabled={carregando}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: carregando ? 'wait' : 'pointer',
            }}
          >
            Atualizar
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '13px',
          color: '#475569',
        }}
      >
        <span>
          Na fila: <strong style={{ color: '#0f172a' }}>{qtd}</strong>
        </span>
        <span>
          Soma valores informados: <strong style={{ color: '#0f172a' }}>{valorPendenteEstimado}</strong>
        </span>
      </div>

      {erro ? (
        <p style={{ marginTop: '14px', color: '#b91c1c', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{erro}</p>
      ) : null}

      {carregando ? (
        <p style={{ marginTop: '16px', color: '#64748b' }}>A carregar fila de clínicas…</p>
      ) : linhas.length === 0 && !erro ? (
        <p style={{ marginTop: '16px', color: '#64748b' }}>
          Nenhuma O.S. de clínica aguardando faturamento.{' '}
          <Link to={CLINICAS_GERAR_OS_PATH} style={{ color: '#0d9488', fontWeight: 700 }}>
            Gerar O.S. em Clínicas
          </Link>
          .
        </p>
      ) : (
        <div className="rg-mobile-table-scroll" style={{ marginTop: '16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>O.S.</th>
                <th style={{ padding: '8px' }}>Unidade</th>
                <th style={{ padding: '8px' }}>Data serv.</th>
                <th style={{ padding: '8px' }}>Cobrança</th>
                <th style={{ padding: '8px' }}>Valor (R$)</th>
                <th style={{ padding: '8px' }}>NF</th>
                <th style={{ padding: '8px' }} />
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => {
                const id = r.ordem_servico_id
                const busy = processandoId === id
                const exigeNf = exigeReferenciaNfNaEmissao(r)
                return (
                  <tr key={id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a' }}>{r.numero_os}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 600 }}>{r.razao_social}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {[r.cnpj && `CNPJ ${r.cnpj}`, r.cpf && `CPF ${r.cpf}`].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{r.data_servico}</td>
                    <td style={{ padding: '10px 8px' }}>
                      {rotuloMeioCobranca(r.emite_nota_snapshot, r.pagamento_pix_snapshot)}
                    </td>
                    <td style={{ padding: '10px 8px', minWidth: 120 }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="chat-interno-input"
                        style={{ width: '100%', maxWidth: 140 }}
                        disabled={!podeEditarValor || busy}
                        value={valoresDraft[id] ?? ''}
                        onChange={(e) =>
                          setValoresDraft((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        placeholder="0,00"
                        aria-label={`Valor ${r.numero_os}`}
                      />
                    </td>
                    <td style={{ padding: '10px 8px', minWidth: 120 }}>
                      {exigeNf ? (
                        <input
                          type="text"
                          className="chat-interno-input"
                          style={{ width: '100%', maxWidth: 140 }}
                          disabled={!podeEmitir || busy}
                          value={nfDraft[id] ?? ''}
                          onChange={(e) => setNfDraft((prev) => ({ ...prev, [id]: e.target.value }))}
                          placeholder="N.º NF"
                          aria-label={`NF ${r.numero_os}`}
                        />
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>PIX / sem NF</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                      {podeEditarValor ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void gravarValor(r)}
                          style={{
                            marginRight: '6px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: busy ? 'wait' : 'pointer',
                          }}
                        >
                          Gravar valor
                        </button>
                      ) : null}
                      {podeEmitir ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void emitir(r)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#0d9488',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '12px',
                            cursor: busy ? 'wait' : 'pointer',
                          }}
                        >
                          {busy ? '…' : 'Emitir'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
