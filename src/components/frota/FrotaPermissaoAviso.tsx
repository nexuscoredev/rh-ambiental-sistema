type Props = {
  somenteLeitura?: boolean
}

/** Aviso quando o perfil não pode incluir/editar ou gerar relatório na frota. */
export function FrotaPermissaoAviso({ somenteLeitura }: Props) {
  if (!somenteLeitura) return null
  return (
    <p className="frota-permissao-aviso" role="status">
      O seu perfil tem acesso apenas de consulta neste módulo. Inclusão, edição e relatório para assinatura
      estão disponíveis para Operacional, Comercial, Comercial Adm e Diretoria.
    </p>
  )
}
