import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { ResiduoContratoItem } from '../../lib/clienteContratoCadastro'
import {
  fetchClienteRowContratoMtr,
  parseContratoClienteMtr,
  residuoContratoTemConteudo,
  rotuloResiduoContrato,
  type MtrContratoClienteSnapshot,
} from '../../lib/mtrClienteContratoAutofill'
import { valorTipoResiduoCorrespondeContrato } from '../../lib/mtrResiduoContratoOpcoes'
import { SelectTipoResiduoClienteContrato } from '../mtr/SelectTipoResiduoClienteContrato'

type Props = {
  clienteId: string
  tipoResiduo: string
  onTipoResiduoChange: (value: string, item: ResiduoContratoItem | null) => void
  labelStyle: CSSProperties
  inputStyle: CSSProperties
}

const blocoEspelhoStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const itemLinhaStyle: CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.45,
  color: '#334155',
  padding: '8px 10px',
  borderRadius: '8px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
}

const tituloSecaoStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  fontWeight: 800,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export function ProgramacaoClienteContratoCampos({
  clienteId,
  tipoResiduo,
  onTipoResiduoChange,
  labelStyle,
  inputStyle,
}: Props) {
  const [contrato, setContrato] = useState<MtrContratoClienteSnapshot | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    const id = clienteId.trim()
    if (!id) {
      setContrato(null)
      return
    }
    let cancel = false
    setCarregando(true)
    void fetchClienteRowContratoMtr(supabase, id).then(({ row, error }) => {
      if (cancel) return
      setCarregando(false)
      if (error || !row) {
        setContrato(null)
        return
      }
      setContrato(parseContratoClienteMtr(row))
    })
    return () => {
      cancel = true
    }
  }, [clienteId])

  const residuos = (contrato?.residuos ?? []).filter(residuoContratoTemConteudo)
  const equipamentos = (contrato?.equipamentos ?? []).filter((e) => e.descricao.trim())

  return (
    <>
      <div>
        <label style={labelStyle}>Tipo de resíduo</label>
        <SelectTipoResiduoClienteContrato
          value={tipoResiduo}
          onChange={onTipoResiduoChange}
          residuosContrato={residuos}
          disabled={!clienteId.trim() || carregando}
          style={inputStyle}
        />
        {!clienteId.trim() ? (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
            Selecione um cliente para carregar os resíduos do contrato.
          </p>
        ) : carregando ? (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
            Carregando contrato do cliente…
          </p>
        ) : null}
      </div>

      {clienteId.trim() ? (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={blocoEspelhoStyle}>
            <p style={tituloSecaoStyle}>Resíduos no cadastro do cliente</p>
            {residuos.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Nenhum resíduo cadastrado no contrato deste cliente.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '6px' }}>
                {residuos.map((r, i) => {
                  const rotulo = rotuloResiduoContrato(r)
                  const ativo =
                    Boolean(tipoResiduo.trim()) &&
                    valorTipoResiduoCorrespondeContrato(tipoResiduo, [r])
                  return (
                    <li
                      key={`${rotulo}-${i}`}
                      style={{
                        ...itemLinhaStyle,
                        borderColor: ativo ? '#99f6e4' : '#e2e8f0',
                        background: ativo ? '#f0fdfa' : '#ffffff',
                      }}
                    >
                      <strong style={{ color: '#0f172a' }}>{rotulo || '—'}</strong>
                      {r.unidade_medida.trim() ? (
                        <span style={{ color: '#64748b' }}> · {r.unidade_medida.trim()}</span>
                      ) : null}
                      {r.frequencia_coleta.trim() ? (
                        <span style={{ color: '#64748b' }}>
                          {' '}
                          · Frequência: {r.frequencia_coleta.trim()}
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div style={blocoEspelhoStyle}>
            <p style={tituloSecaoStyle}>Equipamentos no cadastro do cliente</p>
            {equipamentos.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Nenhum equipamento cadastrado no contrato deste cliente.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '6px' }}>
                {equipamentos.map((e, i) => (
                  <li key={`${e.descricao}-${i}`} style={itemLinhaStyle}>
                    <strong style={{ color: '#0f172a' }}>{e.descricao.trim()}</strong>
                    {e.com_custo ? (
                      <span style={{ color: '#64748b' }}> · com custo no contrato</span>
                    ) : (
                      <span style={{ color: '#64748b' }}> · sem custo</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
