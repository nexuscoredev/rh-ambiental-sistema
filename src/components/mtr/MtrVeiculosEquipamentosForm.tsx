import type { CSSProperties } from 'react'
import {
  asTextoFormulario,
  equipamentoContratoInicial,
  veiculoContratoInicial,
  type EquipamentoContratoItem,
  type VeiculoContratoItem,
} from '../../lib/clienteContratoCadastro'

const btnAdicionar: CSSProperties = {
  background: '#0f172a',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  height: '36px',
  padding: '0 14px',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
}

const btnRemover: CSSProperties = {
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '6px 10px',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
}

const cardItem: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '14px',
  background: '#f8fafc',
}

const labelCampo: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '6px',
}

const input: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  boxSizing: 'border-box',
}

type Props = {
  veiculos: VeiculoContratoItem[]
  equipamentos: EquipamentoContratoItem[]
  disabled?: boolean
  onChange: (veiculos: VeiculoContratoItem[], equipamentos: EquipamentoContratoItem[]) => void
}

export function MtrVeiculosEquipamentosForm({
  veiculos,
  equipamentos,
  disabled = false,
  onChange,
}: Props) {
  const listaVeiculos = veiculos.length > 0 ? veiculos : [veiculoContratoInicial()]
  const listaEquip = equipamentos.length > 0 ? equipamentos : [equipamentoContratoInicial()]

  function emitir(v: VeiculoContratoItem[], e: EquipamentoContratoItem[]) {
    onChange(v, e)
  }

  function patchVeiculo(index: number, campo: keyof VeiculoContratoItem, valor: string | boolean) {
    const next = listaVeiculos.map((row, i) => {
      if (i !== index) return row
      const atual = { ...row, [campo]: valor }
      if (campo === 'sem_custo' && valor === true) atual.valor = ''
      return atual
    })
    emitir(next, listaEquip)
  }

  function patchEquipamento(index: number, campo: keyof EquipamentoContratoItem, valor: string | boolean) {
    const next = listaEquip.map((row, i) => {
      if (i !== index) return row
      const atual = { ...row, [campo]: valor }
      if (campo === 'com_custo' && valor === false) atual.valor = ''
      return atual
    })
    emitir(listaVeiculos, next)
  }

  return (
    <div className="field field-full">
      <div
        style={{
          fontSize: '15px',
          fontWeight: 800,
          color: '#0f172a',
          paddingBottom: '4px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        Veículos e Equipamentos
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
        {listaVeiculos.some((v) => v.tipo_veiculo.trim()) || listaEquip.some((e) => e.descricao.trim())
          ? 'Dados do cadastro do cliente — edite aqui só para esta MTR (não altera o cadastro).'
          : 'Selecione a programação para carregar veículos e equipamentos do cadastro do cliente.'}
      </p>

      <div style={{ marginTop: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>Veículos</div>
          <button
            type="button"
            style={{
              ...btnAdicionar,
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            disabled={disabled}
            onClick={() => emitir([...listaVeiculos, veiculoContratoInicial()], listaEquip)}
          >
            + Adicionar veículo
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {listaVeiculos.map((veiculo, index) => (
            <div key={`mtr-veiculo-${index}`} style={cardItem}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  Veículo {index + 1}
                </span>
                <button
                  type="button"
                  style={{
                    ...btnRemover,
                    opacity: listaVeiculos.length <= 1 || disabled ? 0.45 : 1,
                    cursor: disabled || listaVeiculos.length <= 1 ? 'not-allowed' : 'pointer',
                  }}
                  disabled={disabled || listaVeiculos.length <= 1}
                  onClick={() => emitir(listaVeiculos.filter((_, i) => i !== index), listaEquip)}
                >
                  Remover
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr minmax(120px, 160px) auto',
                  gap: '12px',
                  alignItems: 'end',
                }}
              >
                <div>
                  <label style={labelCampo}>Tipo de veículo</label>
                  <input
                    style={input}
                    value={asTextoFormulario(veiculo.tipo_veiculo)}
                    disabled={disabled}
                    placeholder="Ex.: truck, carreta, van…"
                    onChange={(e) => patchVeiculo(index, 'tipo_veiculo', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelCampo}>Valor (R$)</label>
                  <input
                    style={{ ...input, opacity: veiculo.sem_custo ? 0.55 : 1 }}
                    value={veiculo.valor}
                    disabled={disabled || veiculo.sem_custo}
                    placeholder="0,00"
                    onChange={(e) => patchVeiculo(index, 'valor', e.target.value)}
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    paddingBottom: '10px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={veiculo.sem_custo}
                    disabled={disabled}
                    onChange={(e) => patchVeiculo(index, 'sem_custo', e.target.checked)}
                  />
                  Sem custo
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '22px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>Equipamentos</div>
          <button
            type="button"
            style={{
              ...btnAdicionar,
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            disabled={disabled}
            onClick={() => emitir(listaVeiculos, [...listaEquip, equipamentoContratoInicial()])}
          >
            + Adicionar equipamento
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {listaEquip.map((equip, index) => (
            <div key={`mtr-equip-${index}`} style={cardItem}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  Equipamento {index + 1}
                </span>
                <button
                  type="button"
                  style={{
                    ...btnRemover,
                    opacity: listaEquip.length <= 1 || disabled ? 0.45 : 1,
                    cursor: disabled || listaEquip.length <= 1 ? 'not-allowed' : 'pointer',
                  }}
                  disabled={disabled || listaEquip.length <= 1}
                  onClick={() => emitir(listaVeiculos, listaEquip.filter((_, i) => i !== index))}
                >
                  Remover
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr minmax(120px, 160px) auto',
                  gap: '12px',
                  alignItems: 'end',
                }}
              >
                <div>
                  <label style={labelCampo}>Equipamento</label>
                  <input
                    style={input}
                    value={asTextoFormulario(equip.descricao)}
                    disabled={disabled}
                    placeholder="Ex.: caçamba 3 m³, lona…"
                    onChange={(e) => patchEquipamento(index, 'descricao', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelCampo}>Valor (R$)</label>
                  <input
                    style={{ ...input, opacity: equip.com_custo ? 1 : 0.55 }}
                    value={asTextoFormulario(equip.valor)}
                    disabled={disabled || !equip.com_custo}
                    placeholder="0,00"
                    onChange={(e) => patchEquipamento(index, 'valor', e.target.value)}
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    paddingBottom: '10px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={equip.com_custo}
                    disabled={disabled}
                    onChange={(e) => patchEquipamento(index, 'com_custo', e.target.checked)}
                  />
                  Com custo
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
