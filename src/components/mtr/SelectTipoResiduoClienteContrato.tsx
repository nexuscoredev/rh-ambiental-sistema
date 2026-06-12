import { useMemo, type CSSProperties } from 'react'
import type { ResiduoContratoItem } from '../../lib/clienteContratoCadastro'
import {
  opcoesResiduoContratoMtr,
  valorTipoResiduoCorrespondeContrato,
} from '../../lib/mtrResiduoContratoOpcoes'

type Props = {
  value: string
  onChange: (value: string, item: ResiduoContratoItem | null) => void
  residuosContrato: ResiduoContratoItem[]
  disabled?: boolean
  style?: CSSProperties
  id?: string
}

const selectStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '10px',
  border: "1px solid var(--input-border, #cbd5e1)",
  padding: '0 12px',
  fontSize: '14px',
  height: '42px',
  background: "var(--bg-card, #ffffff)",
}

export function SelectTipoResiduoClienteContrato({
  value,
  onChange,
  residuosContrato,
  disabled,
  style,
  id,
}: Props) {
  const opcoes = useMemo(() => opcoesResiduoContratoMtr(residuosContrato), [residuosContrato])

  const valorAtual = (value ?? '').trim()
  const valorNoContrato = valorAtual && valorTipoResiduoCorrespondeContrato(valorAtual, residuosContrato)

  if (!opcoes.length) {
    return (
      <input
        id={id}
        type="text"
        value={valorAtual}
        onChange={(e) => onChange(e.target.value, null)}
        disabled={disabled}
        placeholder="Cadastre resíduos no contrato do cliente"
        style={{ ...selectStyle, ...style }}
      />
    )
  }

  const selectValue = valorNoContrato
    ? opcoes.find((o) => o.value === valorAtual)?.value ??
      opcoes.find((o) => valorAtual.includes(o.value))?.value ??
      ''
    : valorAtual
      ? '__legado__'
      : ''

  return (
    <select
      id={id}
      value={selectValue}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value
        if (v === '__legado__') return
        if (v === '') {
          onChange('', null)
          return
        }
        const op = opcoes.find((o) => o.value === v)
        onChange(v, op?.item ?? null)
      }}
      style={{ ...selectStyle, ...style }}
    >
      <option value="">Selecione o resíduo do contrato…</option>
      {valorAtual && !valorNoContrato ? (
        <option value="__legado__">{valorAtual} (valor atual)</option>
      ) : null}
      {opcoes.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
