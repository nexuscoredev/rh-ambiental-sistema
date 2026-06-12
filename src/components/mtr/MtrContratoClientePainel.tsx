import type { CSSProperties } from 'react'
import type { MtrContratoClienteSnapshot } from '../../lib/mtrClienteContratoAutofill'

type Props = {
  contrato: MtrContratoClienteSnapshot | null
}

const box: CSSProperties = {
  marginTop: '8px',
  padding: '10px 12px',
  borderRadius: '10px',
  background: "var(--status-success-bg, #f0fdf4)",
  border: '1px solid #bbf7d0',
  fontSize: '12px',
  color: '#166534',
  lineHeight: 1.45,
}

export function MtrContratoClientePainel({ contrato }: Props) {
  if (!contrato) return null
  const temAlgo =
    contrato.veiculos.length > 0 ||
    contrato.equipamentos.length > 0 ||
    contrato.residuos.length > 0
  if (!temAlgo) return null

  return (
    <div style={box}>
      <strong style={{ display: 'block', marginBottom: '6px' }}>
        Cadastro do cliente (contrato) — reflete na MTR e na pesagem
      </strong>
      <div>
        <strong>Veículos:</strong> {contrato.rotuloVeiculos}
      </div>
      <div style={{ marginTop: '4px' }}>
        <strong>Equipamentos:</strong> {contrato.rotuloEquipamentos}
      </div>
      <div style={{ marginTop: '4px' }}>
        <strong>Resíduos ({contrato.residuos.length}):</strong> {contrato.rotuloResiduos}
        {contrato.residuos.length > 1 ? (
          <span style={{ display: 'block', marginTop: '4px', fontWeight: 600 }}>
            Cada resíduo gera um ticket na pesagem; valores no faturamento somam ticket + MTR.
          </span>
        ) : null}
      </div>
    </div>
  )
}
