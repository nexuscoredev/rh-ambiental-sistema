import { Link, type LinkProps } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { CLINICAS_GERAR_OS_PATH } from '../../lib/clinicasRotas'

type Variant = 'primary' | 'outline' | 'text'

const styles: Record<Variant, CSSProperties> = {
  primary: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: 'none',
    background: '#0d9488',
    color: '#fff',
    fontWeight: 800,
    fontSize: '13px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  outline: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #0d9488',
    background: "var(--accent-teal-soft, #ecfdf5)",
    color: '#0f766e',
    fontWeight: 700,
    fontSize: '13px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  text: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#0d9488',
    textDecoration: 'none',
  },
}

type Props = Omit<LinkProps, 'to'> & {
  variant?: Variant
  children?: ReactNode
}

/** Volta à página Clínicas na secção de geração de O.S. em lote. */
export function LinkGerarOsClinicas({
  variant = 'outline',
  children = 'Gerar O.S. em Clínicas →',
  style,
  ...rest
}: Props) {
  return (
    <Link to={CLINICAS_GERAR_OS_PATH} style={{ ...styles[variant], ...style }} {...rest}>
      {children}
    </Link>
  )
}
