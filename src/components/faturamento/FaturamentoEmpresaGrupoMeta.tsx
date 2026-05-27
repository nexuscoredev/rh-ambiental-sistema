import type { CSSProperties } from 'react'

const metaStyle: CSSProperties = {
  marginTop: '4px',
  fontSize: '11px',
  lineHeight: 1.45,
  color: '#64748b',
  fontWeight: 600,
}

type Props = {
  rotulo: string | null | undefined
  indisponivel?: boolean
}

export function FaturamentoEmpresaGrupoMeta({ rotulo, indisponivel }: Props) {
  if (indisponivel) {
    return (
      <div style={{ ...metaStyle, color: '#b45309' }} title="Migração 20260529120000 pendente">
        Empresa do grupo (faturamento): cadastro indisponível
      </div>
    )
  }
  if (!rotulo) return null
  return (
    <div style={metaStyle} title="Empresa do grupo responsável pelo faturamento">
      <span style={{ fontWeight: 800, color: '#475569' }}>Grupo faturamento: </span>
      {rotulo}
    </div>
  )
}
