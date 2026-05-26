import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ResiduoContratoItem } from '../../lib/clienteContratoCadastro'
import { clienteInputStyle } from '../../lib/clienteCadastroUi'
import {
  aplicarValorTotalLinha,
  calcularValorTotalMtrLinha,
  formatarValorTotalGerenciador,
  valorUnitarioResiduoContrato,
} from '../../lib/gerenciadorMtrLinhaCalculo'
import {
  buscarDadosLinhaMtrPorNumero,
  buscarMtrPorNumero,
  rotaMtrGerenciadorEnvio,
} from '../../lib/gerenciadorMtrHistorico'
import {
  anexarMtrsPendentesNaRota,
  avisoToastEnvioGerenciador,
  mensagemMtrsNaoEncontradasEnvio,
  prepararEnvioGerenciadorParaMtr,
  rotaGerenciadorHistoricoEnvio,
} from '../../lib/gerenciadorMtrEnvio'
import { parseNumeroCampo } from '../../lib/faturamentoDesvinculacao'
import { rgAlert } from '../../lib/RgDialogProvider'
import { enviarMtrColetasParaFilaFaturamentoAjuste } from '../../lib/mtrGerenciadorFilaFaturamento'
import { resolverVinculoMtrGerenciador } from '../../lib/mtrGerenciadorVinculoColeta'

export type LinhaMtrGerenciador = {
  id: string
  mtr_baixada: string
  data: string
  gerador: string
  residuo: string
  quantidade: string
  peso: string
  valor_unitario: string
  valor_total: string
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 10px',
  color: '#0f172a',
  fontWeight: 800,
  fontSize: '12px',
  borderBottom: '2px solid #e2e8f0',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '8px 10px',
  verticalAlign: 'middle',
  borderBottom: '1px solid #e2e8f0',
}

function novaLinha(): LinhaMtrGerenciador {
  return {
    id: `tmp-${crypto.randomUUID()}`,
    mtr_baixada: '',
    data: '',
    gerador: '',
    residuo: '',
    quantidade: '',
    peso: '',
    valor_unitario: '',
    valor_total: '',
  }
}

type Props = {
  linhas: LinhaMtrGerenciador[]
  onChange: (linhas: LinhaMtrGerenciador[]) => void
  readOnly?: boolean
  residuosContrato?: ResiduoContratoItem[]
  /** Grava cadastro + linhas antes do envio (melhor esforço; não bloqueia se falhar). */
  onSalvarGerenciador?: () => Promise<boolean>
}

export function linhaMtrGerenciadorVazia(): LinhaMtrGerenciador {
  return novaLinha()
}

export function ClienteGerenciadorMtrTabela({
  linhas,
  onChange,
  readOnly = false,
  residuosContrato = [],
  onSalvarGerenciador,
}: Props) {
  const navigate = useNavigate()
  const [enviandoGerenciador, setEnviandoGerenciador] = useState(false)
  const [enviandoFilaLinhaId, setEnviandoFilaLinhaId] = useState<string | null>(null)

  const totalGeral = useMemo(() => {
    let soma = 0
    for (const l of linhas) {
      const manual = parseNumeroCampo(l.valor_unitario)
      const unit =
        manual > 0 ? manual : valorUnitarioResiduoContrato(l.residuo, residuosContrato)
      soma += calcularValorTotalMtrLinha(l.peso, unit)
    }
    return formatarValorTotalGerenciador(soma)
  }, [linhas, residuosContrato])

  async function preencherLinhaDesdeMtr(index: number, numero: string) {
    const dados = await buscarDadosLinhaMtrPorNumero(numero)
    if (!dados) return
    atualizarLinha(index, {
      gerador: dados.gerador,
      residuo: dados.residuo || undefined,
      quantidade: dados.quantidade || undefined,
      data: dados.data || undefined,
    })
  }

  function atualizarLinha(
    index: number,
    patch: Partial<Omit<LinhaMtrGerenciador, 'id'>>
  ) {
    const next = [...linhas]
    const merged = { ...next[index], ...patch }
    const autoUnit = valorUnitarioResiduoContrato(merged.residuo, residuosContrato)
    if (patch.residuo != null && parseNumeroCampo(merged.valor_unitario) <= 0 && autoUnit > 0) {
      merged.valor_unitario = String(autoUnit).replace('.', ',')
    }
    next[index] = {
      ...merged,
      ...aplicarValorTotalLinha(merged, residuosContrato),
    }
    onChange(next)
  }

  function remover(index: number) {
    if (linhas.length <= 1) {
      onChange([novaLinha()])
      return
    }
    onChange(linhas.filter((_, i) => i !== index))
  }

  function adicionar() {
    onChange([...linhas, novaLinha()])
  }

  async function enviarLinhaParaFilaFaturamento(linha: LinhaMtrGerenciador) {
    const num = linha.mtr_baixada.trim()
    if (!num) {
      void rgAlert({
        title: 'Fila do faturamento',
        message: 'Informe o número da MTR baixada na linha.',
        variant: 'warning',
      })
      return
    }

    setEnviandoFilaLinhaId(linha.id)
    try {
      const mtr = await buscarMtrPorNumero(num)
      if (!mtr) {
        avisoToastEnvioGerenciador(
          `MTR «${num}» ainda não está no sistema — use o relatório no MTR Gerenciador.`,
          'info'
        )
        return
      }

      const resolv = await resolverVinculoMtrGerenciador(mtr.id)
      if (!resolv.coletaIds.length) {
        void rgAlert({
          title: 'Fila do faturamento',
          message:
            (resolv.message ??
              'Nenhuma coleta vinculada.') +
            ' Abra o relatório em MTR Gerenciador para vincular manualmente.',
          variant: 'warning',
        })
        return
      }

      const res = await enviarMtrColetasParaFilaFaturamentoAjuste(mtr.id)
      if (!res.ok) {
        void rgAlert({ title: 'Fila do faturamento', message: res.message, variant: 'warning' })
        return
      }

      void rgAlert({
        title: 'Fila do faturamento',
        message: `MTR ${mtr.numero}: ${res.coletaIds.length} coleta(s) enviada(s) para Ajuste de valores.`,
        variant: 'success',
      })
    } finally {
      setEnviandoFilaLinhaId(null)
    }
  }

  async function enviarParaMtrGerenciador() {
    const linhasComMtr = linhas.filter((l) => l.mtr_baixada.trim())
    if (linhasComMtr.length === 0) {
      void rgAlert({
        title: 'MTR Gerenciador',
        message: 'Informe o número da MTR baixada em pelo menos uma linha.',
        variant: 'warning',
      })
      return
    }

    if (onSalvarGerenciador) {
      const salvou = await onSalvarGerenciador()
      if (!salvou) {
        void rgAlert({
          title: 'MTR Gerenciador',
          message:
            'Não foi possível gravar o cadastro. Corrija os dados obrigatórios e tente novamente.',
          variant: 'warning',
        })
        return
      }
    }

    setEnviandoGerenciador(true)
    try {
      const prep = await prepararEnvioGerenciadorParaMtr(linhas, residuosContrato)
      const encontrados = prep.linhas.filter((r) => r.mtr != null).map((r) => r.mtr!)
      const errosAplicar = prep.linhas.filter((r) => r.erroAplicar).map((r) => `${r.numero}: ${r.erroAplicar}`)

      const msgNaoEncontradas = mensagemMtrsNaoEncontradasEnvio(prep.naoEncontrados)
      if (msgNaoEncontradas) {
        avisoToastEnvioGerenciador(msgNaoEncontradas, 'info')
      }

      let destino =
        encontrados.length > 0
          ? rotaMtrGerenciadorEnvio(encontrados[0]!)
          : rotaGerenciadorHistoricoEnvio({ naoEncontrados: prep.naoEncontrados })

      if (prep.naoEncontrados.length) {
        destino = anexarMtrsPendentesNaRota(destino, {
          naoEncontrados: prep.naoEncontrados,
          linhas,
        })
      }

      navigate(destino)

      if (errosAplicar.length) {
        avisoToastEnvioGerenciador(`Avisos ao gravar: ${errosAplicar.join('; ')}`, 'warning')
      }
    } finally {
      setEnviandoGerenciador(false)
    }
  }

  const inputCell: CSSProperties = {
    ...clienteInputStyle,
    height: '36px',
    fontSize: '13px',
  }

  const valorTotalCell: CSSProperties = {
    ...inputCell,
    background: '#f8fafc',
    fontWeight: 700,
    color: '#0f172a',
  }

  return (
    <div>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 800,
          color: '#334155',
          marginBottom: '12px',
        }}
      >
        MTRs baixadas
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
        <strong>Valor total</strong> = Peso (kg) × Valor unit. (R$/kg). O valor unitário é preenchido
        pelo contrato de resíduos do cadastro quando o nome do resíduo coincide; pode ser ajustado
        manualmente na linha.
      </p>
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '960px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>MTR baixada</th>
              <th style={thStyle}>Data</th>
              <th style={thStyle}>Gerador</th>
              <th style={thStyle}>Resíduo</th>
              <th style={thStyle}>Quantidade</th>
              <th style={thStyle}>Peso (kg)</th>
              <th style={thStyle}>Valor unit. (R$/kg)</th>
              <th style={thStyle}>Valor total</th>
              {!readOnly ? <th style={{ ...thStyle, width: 120 }}>Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, index) => (
              <tr key={linha.id}>
                <td style={tdStyle}>
                  <input
                    value={linha.mtr_baixada}
                    onChange={(e) => atualizarLinha(index, { mtr_baixada: e.target.value })}
                    onBlur={(e) => {
                      const num = e.target.value.trim()
                      if (num && !readOnly) void preencherLinhaDesdeMtr(index, num)
                    }}
                    placeholder="Nº ou identificação da MTR"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="date"
                    value={linha.data}
                    onChange={(e) => atualizarLinha(index, { data: e.target.value })}
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.gerador}
                    onChange={(e) => atualizarLinha(index, { gerador: e.target.value })}
                    placeholder="Gerador"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.residuo}
                    onChange={(e) => atualizarLinha(index, { residuo: e.target.value })}
                    placeholder="Resíduo"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.quantidade}
                    onChange={(e) => atualizarLinha(index, { quantidade: e.target.value })}
                    placeholder="Quantidade"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.peso}
                    onChange={(e) => atualizarLinha(index, { peso: e.target.value })}
                    placeholder="0"
                    inputMode="decimal"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.valor_unitario}
                    onChange={(e) => atualizarLinha(index, { valor_unitario: e.target.value })}
                    placeholder="Contrato"
                    inputMode="decimal"
                    title="Valor por kg; vazio usa o contrato de resíduos"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.valor_total}
                    readOnly
                    tabIndex={-1}
                    placeholder="—"
                    title="Calculado: peso × valor unitário"
                    style={valorTotalCell}
                  />
                </td>
                {!readOnly ? (
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      {linha.mtr_baixada.trim() ? (
                        <button
                          type="button"
                          className="mini-btn"
                          style={{ fontSize: '10px', padding: '4px 6px' }}
                          disabled={enviandoFilaLinhaId === linha.id}
                          title="Atalho: vincular coleta (se possível) e enviar direto à fila do faturamento, sem passar pelo relatório"
                          onClick={() => void enviarLinhaParaFilaFaturamento(linha)}
                        >
                          {enviandoFilaLinhaId === linha.id ? '…' : '→ Fila'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="mini-btn mini-btn-danger"
                        onClick={() => remover(index)}
                        title="Remover linha"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          {totalGeral ? (
            <tfoot>
              <tr style={{ background: '#f1f5f9' }}>
                <td
                  colSpan={readOnly ? 7 : 7}
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontWeight: 800,
                    fontSize: '12px',
                    color: '#475569',
                  }}
                >
                  Total geral
                </td>
                <td style={{ ...tdStyle, fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                  {totalGeral}
                </td>
                {!readOnly ? <td style={tdStyle} /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {!readOnly ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: '10px',
            alignItems: 'center',
          }}
        >
          <button type="button" className="rg-btn rg-btn--outline" onClick={adicionar}>
            + Adicionar linha
          </button>
          <button
            type="button"
            className="rg-btn rg-btn--primary"
            disabled={enviandoGerenciador}
            title="Grava dados nas MTRs, abre MTR Gerenciador para baixa e relatório editável com envio à fila"
            onClick={() => void enviarParaMtrGerenciador()}
          >
            {enviandoGerenciador ? 'Abrindo…' : 'Enviar para MTR Gerenciador'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
