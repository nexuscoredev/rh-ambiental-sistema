import { useEffect, useState, type CSSProperties } from 'react'
import { clienteInputStyle } from '../../lib/clienteCadastroUi'
import {
  listarHistoricoMtrsBaixadas,
  type MtrBaixadaHistoricoRow,
} from '../../lib/gerenciadorMtrHistorico'

export type LinhaMtrGerenciador = {
  id: string
  mtr_baixada: string
  data: string
  gerador: string
  residuo: string
  quantidade: string
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
  }
}

type Props = {
  linhas: LinhaMtrGerenciador[]
  onChange: (linhas: LinhaMtrGerenciador[]) => void
  readOnly?: boolean
  /** Incrementar após concluir baixa no histórico para recarregar o dropdown. */
  listaRefreshKey?: number
}

export function linhaMtrGerenciadorVazia(): LinhaMtrGerenciador {
  return novaLinha()
}

function rotuloOpcaoMtr(o: MtrBaixadaHistoricoRow): string {
  const partes = [o.numero || '—']
  if (o.cliente?.trim()) partes.push(o.cliente.trim())
  if (o.data) {
    partes.push(new Date(`${o.data}T12:00:00`).toLocaleDateString('pt-BR'))
  }
  return partes.join(' · ')
}

export function ClienteGerenciadorMtrTabela({
  linhas,
  onChange,
  readOnly = false,
  listaRefreshKey = 0,
}: Props) {
  const [mtrsBaixadas, setMtrsBaixadas] = useState<MtrBaixadaHistoricoRow[]>([])
  const [carregandoMtrs, setCarregandoMtrs] = useState(true)
  const [erroMtrs, setErroMtrs] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setCarregandoMtrs(true)
    void listarHistoricoMtrsBaixadas().then((res) => {
      if (!ativo) return
      setMtrsBaixadas(res.rows)
      setErroMtrs(res.erro)
      setCarregandoMtrs(false)
    })
    return () => {
      ativo = false
    }
  }, [listaRefreshKey])

  function atualizar(index: number, campo: keyof Omit<LinhaMtrGerenciador, 'id'>, valor: string) {
    const next = [...linhas]
    next[index] = { ...next[index], [campo]: valor }
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

  function selecionarMtrBaixada(index: number, numero: string) {
    const mtr = mtrsBaixadas.find((o) => o.numero === numero)
    const next = [...linhas]
    next[index] = {
      ...next[index],
      mtr_baixada: numero,
      data: mtr?.data ?? (numero ? next[index].data : ''),
      gerador: mtr?.gerador ?? (numero ? next[index].gerador : ''),
      residuo: mtr?.residuo ?? (numero ? next[index].residuo : ''),
      quantidade: mtr?.quantidade ?? (numero ? next[index].quantidade : ''),
    }
    onChange(next)
  }

  const inputCell: CSSProperties = {
    ...clienteInputStyle,
    height: '36px',
    fontSize: '13px',
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
      {erroMtrs ? (
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#b45309' }}>{erroMtrs}</p>
      ) : null}
      {!carregandoMtrs && !erroMtrs && mtrsBaixadas.length === 0 ? (
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
          Nenhuma MTR baixada no sistema ainda. O botão <strong>Baixar MTR</strong> na página MTR só
          abre este Gerenciador — é preciso preencher a justificativa no painel{' '}
          <strong>Histórico de MTRs baixadas</strong> (acima) e clicar em{' '}
          <strong>Confirmar baixa</strong>. Só depois o status fica <strong>Baixada</strong> e a MTR
          aparece aqui. Se a confirmação falhar, aplique a migração{' '}
          <code style={{ fontSize: '11px' }}>20260527120000_mtr_ciclo_vida_faturamento.sql</code> no
          Supabase.
        </p>
      ) : null}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>MTR baixada</th>
              <th style={thStyle}>Data</th>
              <th style={thStyle}>Gerador</th>
              <th style={thStyle}>Resíduo</th>
              <th style={thStyle}>Quantidade</th>
              {!readOnly ? <th style={{ ...thStyle, width: 72 }} /> : null}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, index) => {
              const numeroSalvo = linha.mtr_baixada.trim()
              const numeroNaLista = mtrsBaixadas.some((o) => o.numero === numeroSalvo)

              return (
              <tr key={linha.id}>
                <td style={tdStyle}>
                  <select
                    value={linha.mtr_baixada}
                    onChange={(e) => selecionarMtrBaixada(index, e.target.value)}
                    style={{
                      ...inputCell,
                      cursor: readOnly || carregandoMtrs ? 'default' : 'pointer',
                    }}
                    disabled={readOnly || carregandoMtrs}
                    title="MTRs baixadas na página MTR (status Baixada)"
                  >
                    <option value="">
                      {carregandoMtrs ? 'Carregando MTRs baixadas…' : 'Selecione a MTR baixada…'}
                    </option>
                    {numeroSalvo && !numeroNaLista ? (
                      <option value={numeroSalvo}>{numeroSalvo} (registro anterior)</option>
                    ) : null}
                    {mtrsBaixadas.map((o) => (
                      <option key={o.id} value={o.numero}>
                        {rotuloOpcaoMtr(o)}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={tdStyle}>
                  <input
                    type="date"
                    value={linha.data}
                    onChange={(e) => atualizar(index, 'data', e.target.value)}
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.gerador}
                    onChange={(e) => atualizar(index, 'gerador', e.target.value)}
                    placeholder="Gerador"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.residuo}
                    onChange={(e) => atualizar(index, 'residuo', e.target.value)}
                    placeholder="Resíduo"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    value={linha.quantidade}
                    onChange={(e) => atualizar(index, 'quantidade', e.target.value)}
                    placeholder="Quantidade"
                    style={inputCell}
                    readOnly={readOnly}
                  />
                </td>
                {!readOnly ? (
                  <td style={tdStyle}>
                    <button
                      type="button"
                      className="mini-btn mini-btn-danger"
                      onClick={() => remover(index)}
                      title="Remover linha"
                    >
                      ×
                    </button>
                  </td>
                ) : null}
              </tr>
            )})}
          </tbody>
        </table>
      </div>
      {!readOnly ? (
        <button
          type="button"
          className="rg-btn rg-btn--outline"
          style={{ marginTop: '10px' }}
          onClick={adicionar}
        >
          + Adicionar linha
        </button>
      ) : null}
    </div>
  )
}
