import type { CSSProperties } from 'react'
import {
  listaResiduosFromDetalhesMtr,
  residuoDetalhesVazio,
  syncResiduoPrincipalComLista,
  type MtrResiduoDetalhesCampos,
} from '../../lib/mtrClienteContratoAutofill'

type DetalhesComLista = {
  residuo: MtrResiduoDetalhesCampos
  residuos_lista?: MtrResiduoDetalhesCampos[]
  blocos?: { descricoes_adicionais_residuos?: string }
  [key: string]: unknown
}

type Props = {
  detalhes: DetalhesComLista
  onChange: (next: DetalhesComLista) => void
}

const card: CSSProperties = {
  marginBottom: '12px',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  background: '#fafafa',
}

const label: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
  marginBottom: '4px',
}

const input: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  boxSizing: 'border-box',
}

const grid3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
}

const grid2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
}

function patchLista(
  lista: MtrResiduoDetalhesCampos[],
  index: number,
  partial: Partial<MtrResiduoDetalhesCampos>
): MtrResiduoDetalhesCampos[] {
  return lista.map((row, i) => (i === index ? { ...row, ...partial } : row))
}

export function MtrResiduosDescricaoForm({ detalhes, onChange }: Props) {
  const lista = listaResiduosFromDetalhesMtr(detalhes)

  function aplicarLista(novaLista: MtrResiduoDetalhesCampos[]) {
    const sync = syncResiduoPrincipalComLista({ ...detalhes, residuos_lista: novaLista })
    onChange({ ...detalhes, ...sync })
  }

  function patchRow(index: number, partial: Partial<MtrResiduoDetalhesCampos>) {
    aplicarLista(patchLista(lista, index, partial))
  }

  return (
    <>
      <div className="field field-full">
        <div style={{ fontWeight: 800 }}>2. Descrição dos resíduos</div>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
          {lista.length > 1
            ? `${lista.length} resíduos do cadastro do cliente — cada linha gera um ticket na pesagem.`
            : 'Um resíduo do cadastro do cliente.'}
        </p>
      </div>

      {lista.map((row, index) => (
        <div key={`mtr-residuo-desc-${index}`} style={card}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
            Resíduo {index + 1}
            {index === 0 ? (
              <span style={{ fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>(principal no manifesto)</span>
            ) : null}
          </div>
          <div style={grid2}>
            <div>
              <label style={label}>Fonte de origem</label>
              <input
                style={input}
                value={row.fonte_origem}
                onChange={(e) => patchRow(index, { fonte_origem: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Caracterização / tipo</label>
              <input
                style={input}
                value={row.caracterizacao}
                onChange={(e) => patchRow(index, { caracterizacao: e.target.value })}
              />
            </div>
          </div>
          <div style={{ ...grid3, marginTop: '10px' }}>
            <div>
              <label style={label}>Estado físico / classe</label>
              <input
                style={input}
                value={row.estado_fisico}
                onChange={(e) => patchRow(index, { estado_fisico: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Tipo de acondicionamento</label>
              <input
                style={input}
                value={row.acondicionamento}
                onChange={(e) => patchRow(index, { acondicionamento: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Qtde aproximada</label>
              <input
                style={input}
                value={row.quantidade_aproximada}
                onChange={(e) => patchRow(index, { quantidade_aproximada: e.target.value })}
              />
            </div>
          </div>
          <div style={{ marginTop: '10px', maxWidth: '200px' }}>
            <label style={label}>Nº ONU</label>
            <input
              style={input}
              value={row.onu}
              onChange={(e) => patchRow(index, { onu: e.target.value })}
            />
          </div>
        </div>
      ))}

      {lista.length === 0 ? (
        <button
          type="button"
          className="mini-btn"
          onClick={() => aplicarLista([residuoDetalhesVazio()])}
        >
          Adicionar linha de resíduo
        </button>
      ) : null}
    </>
  )
}
