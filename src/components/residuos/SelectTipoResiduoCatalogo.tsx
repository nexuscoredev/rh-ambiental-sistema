import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { asTextoFormulario } from '../../lib/clienteContratoCadastro'
import {
  fetchResiduosCatalogo,
  rotuloResiduoCatalogo,
  TIPO_RESIDUO_REGRA_QUALQUER,
  type ResiduoCatalogo,
} from '../../lib/residuosCatalogo'

const selectBaseStyle: CSSProperties = {
  cursor: 'pointer',
  appearance: 'auto',
  WebkitAppearance: 'menulist',
}

type Props = {
  value: string | unknown
  onChange: (value: string) => void
  disabled?: boolean
  style?: CSSProperties
  /** Regras de preço: inclui opção «qualquer resíduo» (*). */
  permitirQualquer?: boolean
  id?: string
  /** Catálogo já carregado pelo pai (evita N pedidos em listas repetidas). */
  catalogo?: ResiduoCatalogo[]
  carregando?: boolean
}

export function SelectTipoResiduoCatalogo({
  value,
  onChange,
  disabled,
  style,
  permitirQualquer = false,
  id,
  catalogo,
  carregando: carregandoProp,
}: Props) {
  const [rows, setRows] = useState<ResiduoCatalogo[]>(catalogo ?? [])
  const [carregandoInterno, setCarregandoInterno] = useState(catalogo == null)

  const carregando = carregandoProp ?? carregandoInterno

  useEffect(() => {
    if (catalogo != null) {
      setRows(catalogo)
      return
    }
    let cancel = false
    queueMicrotask(() => setCarregandoInterno(true))
    void fetchResiduosCatalogo().then((data) => {
      if (cancel) return
      setRows(data)
      setCarregandoInterno(false)
    })
    return () => {
      cancel = true
    }
  }, [catalogo])

  const ativos = useMemo(() => rows.filter((r) => r.ativo), [rows])

  const valueStr = useMemo(() => asTextoFormulario(value), [value])

  const valorLegado = useMemo(() => {
    const v = valueStr.trim()
    if (!v || v === TIPO_RESIDUO_REGRA_QUALQUER) return null
    const labels = new Set(ativos.map(rotuloResiduoCatalogo))
    return labels.has(v) ? null : v
  }, [valueStr, ativos])

  const valorSelect = useMemo(() => {
    const v = valueStr.trim()
    if (permitirQualquer && (!v || v === TIPO_RESIDUO_REGRA_QUALQUER)) return TIPO_RESIDUO_REGRA_QUALQUER
    if (!v) return ''
    return v
  }, [valueStr, permitirQualquer])

  return (
    <select
      id={id}
      value={valorSelect}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || carregando}
      style={{ ...selectBaseStyle, ...style }}
    >
      {permitirQualquer ? (
        <option value={TIPO_RESIDUO_REGRA_QUALQUER}>Qualquer resíduo (*)</option>
      ) : (
        <option value="">Selecione o resíduo</option>
      )}
      {carregando ? (
        <option value="" disabled>
          A carregar catálogo…
        </option>
      ) : null}
      {ativos.map((r) => (
        <option key={r.id} value={rotuloResiduoCatalogo(r)}>
          {rotuloResiduoCatalogo(r)}
        </option>
      ))}
      {valorLegado ? (
        <option value={valorLegado}>{valorLegado} (cadastro anterior)</option>
      ) : null}
    </select>
  )
}
