import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { FaturamentoResumoViewRow } from '../../lib/faturamentoResumo'
import { carregarLinhasRelatorioMedicao } from '../../lib/carregarLinhasRelatorioMedicao'
import type { LinhaRelatorioMedicao } from '../../lib/faturamentoRelatorioMedicao'
import {
  agruparPorClienteMedicao,
  aprovarMedicaoCliente,
  confirmarEmailMedicaoEnviado,
  coletaNaFilaMedicaoAprovacaoCliente,
  coletaNaFilaMedicaoEmail,
  coletaNaFilaRelatorioMedicao,
  marcarRelatorioMedicaoGerado,
  type GrupoMedicaoCliente,
} from '../../lib/faturamentoEsteira'
import { imprimirRelatorioMedicaoJanela } from '../../lib/imprimirRelatorioMedicaoJanela'
import { FaturamentoTabelaMedicao } from './FaturamentoTabelaMedicao'

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
}

function GrupoMedicaoCard({
  grupo,
  filtro,
  titulo,
  acao,
  esteiraAtiva,
  onImprimir,
  preparandoPrint,
}: {
  grupo: GrupoMedicaoCliente
  filtro: (r: FaturamentoResumoViewRow) => boolean
  titulo: string
  acao: ReactNode
  esteiraAtiva: boolean
  onImprimir: (linhas: FaturamentoResumoViewRow[], clienteNome: string) => void
  preparandoPrint?: boolean
}) {
  const linhasColeta = grupo.linhas.filter(filtro)
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
  }, [idsKey, grupo.cliente_id])

  if (linhasColeta.length === 0) return null

  return (
    <div style={{ ...card, borderLeft: '4px solid #6366f1' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>{grupo.cliente_nome}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {titulo} · {linhasColeta.length} ticket(s)
            {grupo.cliente_email_nf ? ` · ${grupo.cliente_email_nf}` : ''}
          </div>
        </div>
        <div className="fat-esteira-toolbar">
          <button
            type="button"
            className="rg-btn rg-btn--report"
            disabled={preparandoPrint || carregandoMedicao}
            onClick={() => onImprimir(linhasColeta, grupo.cliente_nome)}
          >
            {preparandoPrint ? 'A preparar…' : 'Imprimir / PDF'}
          </button>
          {acao ? <div className="fat-esteira-toolbar__extra">{acao}</div> : null}
        </div>
      </div>

      <div style={{ marginTop: '12px', overflowX: 'auto' }}>
        {carregandoMedicao ? (
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>A calcular valores do contrato…</p>
        ) : erroMedicao ? (
          <p style={{ margin: 0, fontSize: '12px', color: '#b45309' }}>{erroMedicao}</p>
        ) : (
          <FaturamentoTabelaMedicao linhas={linhasMedicao} mostrarColeta />
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

export function FaturamentoFilaMedicao({ linhas, carregando, esteiraAtiva, onAtualizar }: Props) {
  const [processando, setProcessando] = useState(false)
  const [obsCliente, setObsCliente] = useState('')
  const [preparandoPrint, setPreparandoPrint] = useState(false)

  const gruposMedicao = useMemo(
    () => agruparPorClienteMedicao(linhas, coletaNaFilaRelatorioMedicao),
    [linhas]
  )
  const gruposEmail = useMemo(
    () => agruparPorClienteMedicao(linhas, coletaNaFilaMedicaoEmail),
    [linhas]
  )
  const gruposAprovacao = useMemo(
    () => agruparPorClienteMedicao(linhas, coletaNaFilaMedicaoAprovacaoCliente),
    [linhas]
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
      window.alert(res.message ?? 'Erro')
      return
    }
    onAtualizar()
  }

  async function imprimirRelatorioMedicao(
    linhasColeta: FaturamentoResumoViewRow[],
    clienteNome: string
  ) {
    setPreparandoPrint(true)
    try {
      const res = await carregarLinhasRelatorioMedicao(linhasColeta)
      if (res.erro) {
        window.alert(res.erro)
        return
      }
      if (res.linhas.every((l) => l.total <= 0)) {
        const ok = window.confirm(
          'Não foi possível calcular valores pelo contrato (resíduo/caminhão). Deseja imprimir mesmo assim?'
        )
        if (!ok) return
      }
      imprimirRelatorioMedicaoJanela({
        clienteNome,
        linhas: res.linhas,
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
          Esteira 2–4 · Medição e aprovação do cliente
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#4c1d95', lineHeight: 1.55 }}>
          Tabela no modelo do relatório impresso. Use <strong>Imprimir / PDF</strong> para gerar o documento
          em página inteira (paisagem).
        </p>
      </div>

      {gruposMedicao.map((g) => (
        <GrupoMedicaoCard
          key={`med-${g.cliente_id}`}
          grupo={g}
          filtro={coletaNaFilaRelatorioMedicao}
          titulo="Relatório de medição pendente"
          esteiraAtiva={esteiraAtiva}
          onImprimir={(l, nome) => void imprimirRelatorioMedicao(l, nome)}
          preparandoPrint={preparandoPrint}
          acao={
            <button
              type="button"
              className="rg-btn rg-btn--outline"
              disabled={processando || !esteiraAtiva}
              onClick={() =>
                void run(() =>
                  marcarRelatorioMedicaoGerado(
                    g.linhas.filter(coletaNaFilaRelatorioMedicao).map((r) => r.coleta_id)
                  )
                )
              }
            >
              Relatório gerado
            </button>
          }
        />
      ))}

      {gruposEmail.map((g) => (
        <GrupoMedicaoCard
          key={`email-${g.cliente_id}`}
          grupo={g}
          filtro={coletaNaFilaMedicaoEmail}
          titulo="Confirmar envio do relatório por e-mail"
          esteiraAtiva={esteiraAtiva}
          onImprimir={(l, nome) => void imprimirRelatorioMedicao(l, nome)}
          preparandoPrint={preparandoPrint}
          acao={
            <button
              type="button"
              className="rg-btn rg-btn--primary"
              disabled={processando || !esteiraAtiva}
              onClick={() => {
                const ok = window.confirm(
                  `Confirmar que o relatório de medição foi enviado por e-mail ao cliente ${g.cliente_nome}?`
                )
                if (!ok) return
                void run(() =>
                  confirmarEmailMedicaoEnviado(
                    g.linhas.filter(coletaNaFilaMedicaoEmail).map((r) => r.coleta_id)
                  )
                )
              }}
            >
              E-mail enviado
            </button>
          }
        />
      ))}

      {gruposAprovacao.map((g) => (
        <GrupoMedicaoCard
          key={`aprov-${g.cliente_id}`}
          grupo={g}
          filtro={coletaNaFilaMedicaoAprovacaoCliente}
          titulo="Aguardando aprovação do cliente (e-mail)"
          esteiraAtiva={esteiraAtiva}
          onImprimir={(l, nome) => void imprimirRelatorioMedicao(l, nome)}
          preparandoPrint={preparandoPrint}
          acao={
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
                  const ok = window.confirm(
                    `Registrar aprovação do cliente ${g.cliente_nome} e liberar para faturamento?`
                  )
                  if (!ok) return
                  void run(() =>
                    aprovarMedicaoCliente(
                      g.linhas.filter(coletaNaFilaMedicaoAprovacaoCliente).map((r) => r.coleta_id),
                      obsCliente
                    )
                  )
                }}
              >
                Cliente aprovou → Liberado faturamento
              </button>
            </>
          }
        />
      ))}
    </>
  )
}
