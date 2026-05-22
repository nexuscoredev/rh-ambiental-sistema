/**
 * Tetos de volume por pedido ao Supabase (performance / plano Free).
 * Não alteram regras de fluxo, RLS, permissões nem filtros de negócio.
 */

export const REST_PAGE_SIZE = 1000

/** Lista Contas a Receber (página dedicada). */
export const CONTAS_RECEBER_LISTA_MAX_LINHAS = 5000

/** Complemento da lista Financeiro — IDs com título em contas_receber (janela de datas igual à view). */
export const CONTAS_RECEBER_FINANCEIRO_IDS_MAX_LINHAS = 3000

/** Páginas da view vw_faturamento_resumo na lista Financeiro (cobrança). */
export const FINANCEIRO_VW_RESUMO_MAX_PAGES = 6

/** Diretório de utilizadores no chat (status ativo). */
export const CHAT_USUARIOS_MAX_PAGES = 20
