import { useMemo, type CSSProperties } from 'react'
import { asTextoFormulario } from '../../lib/clienteContratoCadastro'
import { TIPO_RESIDUO_REGRA_QUALQUER } from '../../lib/residuosCatalogo'

type Props = {
  value: string | unknown
  onChange: (value: string) => void
  disabled?: boolean
  style?: CSSProperties
  /** Regras de preço: placeholder indica uso de * para qualquer resíduo. */
  permitirQualquer?: boolean
  id?: string
  placeholder?: string
}

/** Campo de texto livre para tipo de resíduo (sem catálogo / lista). */
export function SelectTipoResiduoCatalogo({
  value,
  onChange,
  disabled,
  style,
  permitirQualquer = false,
  id,
  placeholder,
}: Props) {
  const valueStr = useMemo(() => asTextoFormulario(value), [value])

  const placeholderFinal =
    placeholder ??
    (permitirQualquer
      ? 'Ex.: Mix contaminado ou * para qualquer resíduo'
      : 'Descreva o tipo de resíduo')

  return (
    <input
      id={id}
      type="text"
      value={valueStr}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholderFinal}
      title={
        permitirQualquer
          ? `Use ${TIPO_RESIDUO_REGRA_QUALQUER} na regra para aplicar a qualquer resíduo`
          : undefined
      }
      style={{
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: '10px',
        border: "1px solid var(--input-border, #cbd5e1)",
        padding: '0 12px',
        fontSize: '14px',
        height: '42px',
        ...style,
      }}
    />
  )
}
