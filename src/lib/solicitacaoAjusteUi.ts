/** Evento global para abrir o painel «Solicitar ajuste no sistema» (sidebar / MainLayout). */
export const EVENTO_ABRIR_SOLICITACAO_AJUSTE = 'rg:abrir-solicitacao-ajuste'

export type AbrirSolicitacaoAjusteDetail = {
  /** Texto pré-preenchido no formulário do chamado. */
  textoInicial?: string
}

export function abrirSolicitacaoAjusteSistema(detail?: AbrirSolicitacaoAjusteDetail): void {
  window.dispatchEvent(
    new CustomEvent<AbrirSolicitacaoAjusteDetail>(EVENTO_ABRIR_SOLICITACAO_AJUSTE, { detail })
  )
}
