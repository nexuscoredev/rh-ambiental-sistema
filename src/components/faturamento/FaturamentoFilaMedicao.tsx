import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import { carregarLinhasRelatorioMedicao } from '../../lib/carregarLinhasRelatorioMedicao'
import type { LinhaRelatorioMedicao } from '../../lib/faturamentoRelatorioMedicao'
import {
  agruparGruposMedicaoPorMtr,
  aprovarMedicaoCliente,
  coletaNaFilaMedicaoAprovacaoCliente,
  coletaNaFilaMedicaoEmail,
  coletaNaFilaRelatorioMedicao,
  etapaUnificadaGrupoMedicao,
  marcarRelatorioMedicaoGerado,
  voltarGrupoMedicaoParaAjusteValores,
  type GrupoMedicaoCliente,
} from '../../lib/faturamentoEsteira'
import { imprimirRelatorioMedicaoJanela } from '../../lib/imprimirRelatorioMedicaoJanela'
import { buildUrlEnvioNfMedicao } from '../../lib/coletaContextoUrl'
import { useRgDialog } from '../../lib/RgDialogProvider'
import { FaturamentoTabelaMedicao } from './FaturamentoTabelaMedicao'
import { MedicaoGeradorDonoFaturamentoBloco } from './MedicaoGeradorDonoFaturamentoBloco'

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '18px 20px',
  marginBottom: '18px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}

type Props = {
  linhas: FaturamentoResumoViewRow[]
  carregando?: boolean
  esteiraAtiva: boolean
  onAtualizar: () => void
  /** Coleta em foco na esteira (sugestão opcional na Mala Direta por MTR). */
  coletaIdContexto?: string | null
}

function GrupoMedicaoCard({
  grupo,
  titulo,
  acao,
  esteiraAtiva,
  onImprimir,
  preparandoPrint,
}: {
  grupo: GrupoMedicaoCliente
  titulo: string
  acao: ReactNode
  esteiraAtiva: boolean
  onImprimir: (
    linhasColeta: FaturamentoResumoViewRow[],
    clienteNome: string,
    linhasMedicaoOverride?: LinhaRelatorioMedicao[]
  ) => void
  preparandoPrint?: boolean
}) {
  const linhasColeta = grupo.linhas
  const [linhasMedicao, setLinhasMedicao] = useState<LinhaRelatorioMedicao[]>([])
  const [carregandoMedicao, setCarregandoMedicao] = useState(false)
  const [erroMedicao, setErroMedicao] = useState('')

  const idsKey = useMemo(
    () => linhasColeta.map((r) => r.coleta_id).sort().join(','),
    [linhasColeta]
  )

  useEffect(() => {
    if (linhasColeta.length === 0) {
      setLinhasMedicao([])
      setErroMedicao('')
      return
    }
    let cancel = false
    setCarregandoMedicao(true)
    setErroMedicao('')
    void carregarLinhasRelatorioMedicao(linhasColeta).then((res) => {
      if (cancel) return
      setCarregandoMedicao(false)
      if (res.erro) {
        setErroMedicao(res.erro)
        setLinhasMedicao([])
        return
      }
      setLinhasMedicao(res.linhas)
    })
    return () => {
      cancel = true
    }
    // linhasColeta já refletido em idsKey (ids das coletas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, grupo.cliente_id, grupo.mtr_numero])

  if (linhasColeta.length === 0) return null

  const tituloRelatorio = `${grupo.cliente_nome} · ${grupo.rotulo_periodo}`

  return (
    <div style={{ ...card, borderLeft: '4px solid #6366f1' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>{tituloRelatorio}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {titulo} · {linhasColeta.length} ticket(s) · até 30 dias de lançamento
            {grupo.mtr_numero && grupo.mtr_numero !== '—' ? ` · ${grupo.mtr_numero}` : ''}
            {grupo.cliente_email_nf ? ` · ${grupo.cliente_email_nf}` : ''}
          </div>
        </div>
        <div className="fat-esteira-toolbar">
          <button
            type="button"
            className="rg-btn rg-btn--report"
            disabled={preparandoPrint || carregandoMedicao}
            onClick={() => onImprimir(linhasColeta, tituloRelatorio, linhasMedicao)}
          >
            {preparandoPrint ? 'A preparar…' : 'Imprimir / PDF'}
          </button>
          {acao ? <div className="fat-esteira-toolbar__extra">{acao}</div> : null}
        </div>
      </div>

      <MedicaoGeradorDonoFaturamentoBloco clienteId={grupo.cliente_id} />

      <div style={{ marginTop: '12px', overflowX: 'auto' }}>
        {carregandoMedicao ? (
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>A calcular valores do contrato…</p>
        ) : erroMedicao ? (
          <p style={{ margin: 0, fontSize: '12px', color: '#b45309' }}>{erroMedicao}</p>
        ) : (
          <FaturamentoTabelaMedicao
            linhas={linhasMedicao}
            mostrarColeta
            onLinhasChange={setLinhasMedicao}
          />
        )}
      </div>

      {!esteiraAtiva ? (
        <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#b45309' }}>
          Migração da esteira não aplicada — ações bloqueadas até atualizar o Supabase.
        </p>
      ) : null}
    </div>
  )
}

export function FaturamentoFilaMedicao({
  linhas,
  carregando,
  esteiraAtiva,
  onAtualizar,
  coletaIdContexto = null,
}: Props) {
  function urlMalaDiretaMedicaoGrupo(clienteId: string, coletaId?: string | null) {
    return buildUrlEnvioNfMedicao({
      clienteId: clienteId.trim() || null,
      coletaId: (coletaId ?? coletaIdContexto ?? '').trim() || null,
    })
  }
  const [processando, setProcessando] = useState(false)
  const [obsCliente, setObsCliente] = useState('')
  const [preparandoPrint, setPreparandoPrint] = useState(false)
  const { confirm, alert } = useRgDialog()

  const gruposPorMtr = useMemo(() => agruparGruposMedicaoPorMtr(linhas), [linhas])
  const gruposMedicao = useMemo(
    () => gruposPorMtr.filter((g) => etapaUnificadaGrupoMedicao(g.linhas) === 'relatorio'),
    [gruposPorMtr]
  )
  const gruposEmail = useMemo(
    () => gruposPorMtr.filter((g) => etapaUnificadaGrupoMedicao(g.linhas) === 'email'),
    [gruposPorMtr]
  )
  const gruposAprovacao = useMemo(
    () => gruposPorMtr.filter((g) => etapaUnificadaGrupoMedicao(g.linhas) === 'aprovacao'),
    [gruposPorMtr]
  )

  const totalMedicao = linhas.filter(coletaNaFilaRelatorioMedicao).length
  const totalEmail = linhas.filter(coletaNaFilaMedicaoEmail).length
  const totalAprov = linhas.filter(coletaNaFilaMedicaoAprovacaoCliente).length

  if (carregando) {
    return (
      <div style={card}>
        <p style={{ margin: 0, color: '#64748b' }}>A carregar esteira de medição…</p>
      </div>
    )
  }

  if (totalMedicao + totalEmail + totalAprov === 0) {
    return null
  }

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setProcessando(true)
    const res = await fn()
    setProcessando(false)
    if (!res.ok) {
      await alert({ title: 'Não foi possível concluir', message: res.message ?? 'Erro', variant: 'danger' })
      return
    }
    onAtualizar()
  }

  const btnVoltarAjusteStyle: CSSProperties = {
    background: '#fef2f2',
    borderColor: '#fecaca',
    color: '#b91c1c',
  }

  const btnRelatorioGeradoStyle: CSSProperties = {
    background: '#f0fdf4',
    borderColor: '#bbf7d0',
    color: '#15803d',
  }

  function botaoVoltarAjuste(g: GrupoMedicaoCliente) {
    return (
      <button
        type="button"
        className="rg-btn rg-btn--outline"
        style={btnVoltarAjusteStyle}
        disabled={processando || !esteiraAtiva}
        onClick={() => {
          void (async () => {
            const ok = await confirm({
              title: 'Voltar para ajuste de valores',
              message: (
                <>
                  {g.cliente_nome} · {g.rotulo_periodo} · {g.linhas.length} ticket(s)
                </>
              ),
              details: [
                'Desfaz relatório de medição, envio por e-mail e aprovação do cliente neste lote (mesmo cliente, 30 dias).',
                'A coleta volta para a esteira 2 (Ajuste de valores) para rever os cálculos.',
              ],
              confirmLabel: 'Voltar para ajuste',
              variant: 'danger',
            })
            if (!ok) return
            void run(() => voltarGrupoMedicaoParaAjusteValores(g.linhas.map((r) => r.coleta_id)))
          })()
        }}
      >
        Volte para o ajuste
      </button>
    )
  }

  function acoesToolbar(g: GrupoMedicaoCliente, extra: ReactNode) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {botaoVoltarAjuste(g)}
        {extra}
      </div>
    )
  }

  async function imprimirRelatorioMedicao(
    linhasColeta: FaturamentoResumoViewRow[],
    clienteNome: string,
    linhasMedicaoOverride?: LinhaRelatorioMedicao[]
  ) {
    setPreparandoPrint(true)
    try {
      let linhasPrint = linhasMedicaoOverride
      if (!linhasPrint?.length) {
        const res = await carregarLinhasRelatorioMedicao(linhasColeta)
        if (res.erro) {
          await alert({ title: 'Relatório de medição', message: res.erro, variant: 'danger' })
          return
        }
        linhasPrint = res.linhas
      }
      if (linhasPrint.every((l) => l.total <= 0)) {
        const ok = await confirm({
          title: 'Imprimir sem valores do contrato',
          message: (
            <>
              Cliente <strong>{clienteNome}</strong>
            </>
          ),
          details: [
            'Não foi possível calcular valores pelo contrato (resíduo, caminhão ou equipamento).',
            'O PDF pode sair com totais zerados ou incompletos.',
          ],
          confirmLabel: 'Imprimir mesmo assim',
          variant: 'warning',
        })
        if (!ok) return
      }
      imprimirRelatorioMedicaoJanela({
        clienteNome,
        linhas: linhasPrint,
        geradoEm: new Date().toLocaleString('pt-BR'),
      })
    } finally {
      setPreparandoPrint(false)
    }
  }

  return (
    <>
      <div style={{ ...card, background: '#f5f3ff', borderColor: '#c4b5fd' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: '#312e81' }}>
          Esteira 3–5 · Medição e aprovação do cliente
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#4c1d95', lineHeight: 1.55 }}>
          Tickets do <strong>mesmo cliente</strong> com lançamento em até <strong>30 dias</strong> entram num{' '}
          <strong>único relatório</strong> (várias MTRs na mesma tabela e PDF).
          Use <strong>Imprimir / PDF</strong> para gerar o documento.
          O envio ao cliente é feito em{' '}
          <Link to="/envio-nf?tipo=medicao">Mala Direta — Medição</Link> (qualquer cliente).
        </p>
      </div>

      {gruposMedicao.map((g) => (
        <GrupoMedicaoCard
          key={`med-${g.cliente_id}-${g.periodo_inicio}-${g.periodo_fim}`}
          grupo={g}
          titulo="Relatório de medição pendente"
          esteiraAtiva={esteiraAtiva}
          onImprimir={(l, nome) => void imprimirRelatorioMedicao(l, nome)}
          preparandoPrint={preparandoPrint}
          acao={acoesToolbar(
            g,
            <button
              type="button"
              className="rg-btn rg-btn--outline"
              style={btnRelatorioGeradoStyle}
              disabled={processando || !esteiraAtiva}
              onClick={() =>
                void run(() =>
                  marcarRelatorioMedicaoGerado(g.linhas.map((r) => r.coleta_id))
                )
              }
            >
              Relatório gerado
            </button>
          )}
        />
      ))}

      {gruposEmail.map((g) => (
        <GrupoMedicaoCard
          key={`email-${g.cliente_id}-${g.mtr_numero}`}
          grupo={g}
          titulo="Enviar relatório por e-mail (mala direta)"
          esteiraAtiva={esteiraAtiva}
          onImprimir={(l, nome) => void imprimirRelatorioMedicao(l, nome)}
          preparandoPrint={preparandoPrint}
          acao={acoesToolbar(
            g,
            <Link
              to={urlMalaDiretaMedicaoGrupo(
                g.cliente_id,
                g.linhas[0]?.coleta_id ?? null
              )}
              className="rg-btn rg-btn--primary"
              style={{ fontSize: '12px', padding: '8px 14px', textDecoration: 'none' }}
            >
              Mala Direta — Medição
            </Link>
          )}
        />
      ))}

      {gruposAprovacao.map((g) => (
        <GrupoMedicaoCard
          key={`aprov-${g.cliente_id}-${g.periodo_inicio}-${g.periodo_fim}`}
          grupo={g}
          titulo="Aguardando aprovação do cliente (e-mail)"
          esteiraAtiva={esteiraAtiva}
          onImprimir={(l, nome) => void imprimirRelatorioMedicao(l, nome)}
          preparandoPrint={preparandoPrint}
          acao={acoesToolbar(
            g,
            <>
              <input
                type="text"
                className="fat-esteira-input"
                placeholder="Obs. aprovação (opcional)"
                value={obsCliente}
                onChange={(e) => setObsCliente(e.target.value)}
                aria-label="Observação da aprovação do cliente"
              />
              <button
                type="button"
                className="rg-btn rg-btn--primary rg-btn--aprovar"
                disabled={processando || !esteiraAtiva}
                onClick={() => {
                  void (async () => {
                    const ok = await confirm({
                      title: 'Cliente aprovou a medição',
                      message: (
                        <>
                          {g.cliente_nome} · {g.rotulo_periodo} · {g.linhas.length} ticket(s)
                        </>
                      ),
                      details: [
                        'Regista a aprovação do cliente após o envio do relatório por e-mail.',
                        'Libera os tickets para a fila «Faturar» e emissão ao Financeiro.',
                      ],
                      confirmLabel: 'Liberar faturamento',
                      variant: 'success',
                    })
                    if (!ok) return
                    void run(() =>
                      aprovarMedicaoCliente(g.linhas.map((r) => r.coleta_id), obsCliente)
                    )
                  })()
                }}
              >
                Cliente aprovou → Liberado faturamento
              </button>
            </>
          )}
        />
      ))}
    </>
  )
}
