import { useMemo, type CSSProperties } from 'react'
import {
  TIPOS_CAMINHAO_GRUPOS,
  TIPOS_CAMINHAO_LISTA,
} from '../../lib/programacaoTiposCaminhao'

export type ProgramacaoTipoContagem = { tipo: string; count: number }

type Props = {
  filtroTipo: string
  onFiltroTipoChange: (tipo: string) => void
  contagensTipoNoMes: ProgramacaoTipoContagem[]
  inputStyle: CSSProperties
  /** Onde o filtro aparece: página inteira ou painel do dia. */
  variant?: 'page' | 'painel'
}

export default function ProgramacaoFiltroCaminhao({
  filtroTipo,
  onFiltroTipoChange,
  contagensTipoNoMes,
  inputStyle,
  variant = 'page',
}: Props) {
  const contagemPorTipo = useMemo(
    () => new Map(contagensTipoNoMes.map((c) => [c.tipo.toLowerCase(), c.count])),
    [contagensTipoNoMes]
  )

  const tiposLegadoNoMes = useMemo(() => {
    return contagensTipoNoMes
      .map((c) => c.tipo)
      .filter((t) => !TIPOS_CAMINHAO_LISTA.some((cat) => cat.toLowerCase() === t.toLowerCase()))
  }, [contagensTipoNoMes])

  return (
    <section
      className={
        variant === 'painel'
          ? 'programacao-filtro-caminhao programacao-filtro-caminhao--painel'
          : 'programacao-filtro-caminhao'
      }
      aria-label="Filtrar caminhões por tipo"
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: "var(--text-secondary, #64748b)" }}>Tipo (lista)</span>
        <select
          value={filtroTipo}
          onChange={(e) => onFiltroTipoChange(e.target.value)}
          style={{ ...inputStyle, width: '100%' }}
          aria-label="Filtrar por tipo de caminhão"
        >
          <option value="">Todos os tipos</option>
          {TIPOS_CAMINHAO_GRUPOS.map((grupo) => (
            <optgroup key={grupo.titulo} label={grupo.titulo}>
              {grupo.opcoes.map((op) => (
                <option key={op} value={op}>
                  {op}
                  {contagemPorTipo.get(op.toLowerCase())
                    ? ` (${contagemPorTipo.get(op.toLowerCase())})`
                    : ''}
                </option>
              ))}
            </optgroup>
          ))}
          {tiposLegadoNoMes.map((t) => (
            <option key={`leg-${t}`} value={t}>
              {t} (outro)
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
