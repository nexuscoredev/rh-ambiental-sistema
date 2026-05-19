import type { CSSProperties } from 'react'
import {
  asTextoFormulario,
  UNIDADES_MEDIDA_RESIDUO,
  type EquipamentoContratoItem,
  type ResiduoContratoItem,
  type VeiculoContratoItem,
} from '../../lib/clienteContratoCadastro'
import { SelectTipoResiduoCatalogo } from '../residuos/SelectTipoResiduoCatalogo'
import type { ResiduoCatalogo } from '../../lib/residuosCatalogo'

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

type Props = {
  inputStyle: CSSProperties
  residuosCatalogo: ResiduoCatalogo[]
  residuosCatalogoCarregando: boolean
  veiculos: VeiculoContratoItem[]
  equipamentos: EquipamentoContratoItem[]
  residuos: ResiduoContratoItem[]
  onVeiculoChange: (index: number, campo: keyof VeiculoContratoItem, valor: string | boolean) => void
  onAdicionarVeiculo: () => void
  onRemoverVeiculo: (index: number) => void
  onEquipamentoChange: (index: number, campo: keyof EquipamentoContratoItem, valor: string | boolean) => void
  onAdicionarEquipamento: () => void
  onRemoverEquipamento: (index: number) => void
  onResiduoChange: (index: number, campo: keyof ResiduoContratoItem, valor: string) => void
  onAdicionarResiduo: () => void
  onRemoverResiduo: (index: number) => void
}

export function ClienteContratoCadastroSecoes({
  inputStyle,
  residuosCatalogo,
  residuosCatalogoCarregando,
  veiculos,
  equipamentos,
  residuos,
  onVeiculoChange,
  onAdicionarVeiculo,
  onRemoverVeiculo,
  onEquipamentoChange,
  onAdicionarEquipamento,
  onRemoverEquipamento,
  onResiduoChange,
  onAdicionarResiduo,
  onRemoverResiduo,
}: Props) {
  return (
    <>
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
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#334155' }}>Veículos Contrato:</div>
          <button type="button" onClick={onAdicionarVeiculo} style={btnAdicionar}>
            + Adicionar veículo
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {veiculos.map((veiculo, index) => (
            <div key={`veiculo-contrato-${index}`} style={cardItem}>
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
                <button type="button" onClick={() => onRemoverVeiculo(index)} style={btnRemover}>
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
                    value={asTextoFormulario(veiculo.tipo_veiculo)}
                    onChange={(e) => onVeiculoChange(index, 'tipo_veiculo', e.target.value)}
                    placeholder="Ex.: truck, carreta, van…"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelCampo}>Valor (R$)</label>
                  <input
                    value={veiculo.valor}
                    onChange={(e) => onVeiculoChange(index, 'valor', e.target.value)}
                    placeholder="0,00"
                    disabled={veiculo.sem_custo}
                    style={{ ...inputStyle, opacity: veiculo.sem_custo ? 0.55 : 1 }}
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
                    onChange={(e) => onVeiculoChange(index, 'sem_custo', e.target.checked)}
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
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#334155' }}>Equipamentos</div>
          <button type="button" onClick={onAdicionarEquipamento} style={btnAdicionar}>
            + Adicionar equipamento
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {equipamentos.map((equip, index) => (
            <div key={`equip-contrato-${index}`} style={cardItem}>
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
                <button type="button" onClick={() => onRemoverEquipamento(index)} style={btnRemover}>
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
                    value={asTextoFormulario(equip.descricao)}
                    onChange={(e) => onEquipamentoChange(index, 'descricao', e.target.value)}
                    placeholder="Ex.: caçamba 3 m³, lona…"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelCampo}>Valor (R$)</label>
                  <input
                    value={asTextoFormulario(equip.valor)}
                    onChange={(e) => onEquipamentoChange(index, 'valor', e.target.value)}
                    placeholder="0,00"
                    disabled={!equip.com_custo}
                    style={{ ...inputStyle, opacity: equip.com_custo ? 1 : 0.55 }}
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
                    onChange={(e) => onEquipamentoChange(index, 'com_custo', e.target.checked)}
                  />
                  Com custo
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
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#334155' }}>
              Resíduos <span style={{ color: '#64748b', fontWeight: 500 }}>(opcional)</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
              Tipo (catálogo de resíduos), classe, unidade, valor, frequência e faturamento mínimo por linha.
            </p>
            {!residuosCatalogoCarregando && residuosCatalogo.filter((r) => r.ativo).length === 0 ? (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#b45309', lineHeight: 1.45 }}>
                Catálogo vazio ou indisponível — confirme a migração <strong>residuos</strong> no Supabase.
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onAdicionarResiduo} style={{ ...btnAdicionar, height: '40px' }}>
            + Adicionar resíduo
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {residuos.map((residuo, index) => (
            <div key={`residuo-contrato-${index}`} style={cardItem}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Resíduo {index + 1}</div>
                <button type="button" onClick={() => onRemoverResiduo(index)} style={btnRemover}>
                  Remover
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '12px',
                }}
              >
                <div>
                  <label style={labelCampo}>Tipo de resíduo</label>
                  <SelectTipoResiduoCatalogo
                    value={residuo.tipo_residuo}
                    onChange={(v) => onResiduoChange(index, 'tipo_residuo', v)}
                    catalogo={residuosCatalogo}
                    carregando={residuosCatalogoCarregando}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelCampo}>Classe</label>
                  <select
                    value={asTextoFormulario(residuo.classificacao)}
                    onChange={(e) => onResiduoChange(index, 'classificacao', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Classe</option>
                    <option value="Classe I">Classe I</option>
                    <option value="Classe II">Classe II</option>
                  </select>
                </div>
                <div>
                  <label style={labelCampo}>Unidade</label>
                  <select
                    value={asTextoFormulario(residuo.unidade_medida)}
                    onChange={(e) => onResiduoChange(index, 'unidade_medida', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Unidade</option>
                    {UNIDADES_MEDIDA_RESIDUO.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelCampo}>Valor (R$)</label>
                  <input
                    value={asTextoFormulario(residuo.valor)}
                    onChange={(e) => onResiduoChange(index, 'valor', e.target.value)}
                    placeholder="0,00"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelCampo}>Frequência</label>
                  <input
                    value={asTextoFormulario(residuo.frequencia_coleta)}
                    onChange={(e) => onResiduoChange(index, 'frequencia_coleta', e.target.value)}
                    placeholder="Ex.: semanal, mensal…"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelCampo}>Faturamento mínimo (R$)</label>
                  <input
                    value={asTextoFormulario(residuo.faturamento_minimo)}
                    onChange={(e) => onResiduoChange(index, 'faturamento_minimo', e.target.value)}
                    placeholder="0,00"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

