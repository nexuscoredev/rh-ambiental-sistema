/**
 * Cargos permitidos por rota — fonte única para `App-NEXUS.tsx` e `paginasSistema.ts` (menu).
 * Regras de negócio (resumo):
 * - Desenvolvedor: autoridade máxima (todas as rotas, incluindo `/usuarios`; bypass na UI).
 * - Administrador / Financeiro: acesso total às rotas de negócio (exceto Usuários).
 * - Comercial Adm / Operacional (Time T): Thais — acesso amplo de negócio (como Administrador nas rotas).
 * - Comercial: Rafaela, Rose, Raquel — cadastro, programação, MTR, faturamento, comprovante.
 * - Diretoria: visão e operação em todo o fluxo de negócio (cadastros, programação, MTR,
 *   pesagem, faturamento, financeiro, clínicas, mala direta); sem `/usuarios` (criar acessos).
 * - Operacional: fluxo operacional geral (sem Faturamento, Financeiro, Pós-venda).
 * - Operadores (Time R): Programação, MTR, Pesagem/Ticket e Chat (ex-Rafael).
 * - Logística / Comercial: conforme perfis restritos abaixo.
 */

import {
  CARGO_COMERCIAL_ADM,
  CARGO_OPERACIONAL_TIME_T,
  CARGO_OPERADORES_TIME_R,
} from './workflowPermissions'
import { FROTA_ROTAS_SISTEMA } from './frotaModulos'
import { FINANCEIRO_ROTAS_SISTEMA } from './financeiroModulos'
import { PRESIDENTE_ROTAS_SISTEMA } from './presidenteModulos'
import { RH_ROTAS_SISTEMA } from './rhModulos'

export const CARGO_NEXUS = {
  desenvolvedor: 'Desenvolvedor',
  administrador: 'Administrador',
  financeiro: 'Financeiro',
  operacional: 'Operacional',
  logistica: 'Logística',
  balanceiro: 'Balanceiro',
  diretoria: 'Diretoria',
  faturamento: 'Faturamento',
  comercial: 'Comercial',
  comercialAdm: CARGO_COMERCIAL_ADM,
  visualizador: 'Visualizador',
  operadoresTimeR: CARGO_OPERADORES_TIME_R,
  operacionalTimeT: CARGO_OPERACIONAL_TIME_T,
} as const

const C = CARGO_NEXUS

/** Thais (Comercial Adm) e legado Time T — mesmo âmbito de rotas de negócio. */
const ACESSO_COMERCIAL_ADM = [C.comercialAdm, C.operacionalTimeT] as const

const ACESSO_TOTAL = [
  C.desenvolvedor,
  C.administrador,
  C.financeiro,
  ...ACESSO_COMERCIAL_ADM,
] as const

/** Visão geral: sem Comercial nem Logística (fluxo/cadastro fora do perfil). */
const DASHBOARD_E_CHAT = [
  ...ACESSO_TOTAL,
  C.operacional,
  C.balanceiro,
  C.diretoria,
  C.faturamento,
  C.visualizador,
  C.comercial,
] as const

/** Cadastros (sem Logística; Comercial incluído). */
const CADASTRO = [
  ...ACESSO_TOTAL,
  C.operacional,
  C.balanceiro,
  C.diretoria,
  C.faturamento,
  C.visualizador,
  C.comercial,
] as const

/** Pós-venda: Operacional genérico não acede. */
const POS_VENDA = [
  ...ACESSO_TOTAL,
  C.balanceiro,
  C.diretoria,
  C.faturamento,
  C.visualizador,
  C.comercial,
] as const

const PROGRAMACAO_MTR = [
  ...ACESSO_TOTAL,
  C.diretoria,
  C.operacional,
  C.operadoresTimeR,
  C.logistica,
  C.visualizador,
  C.comercial,
] as const

const CONTROLE_MASSA = [
  ...ACESSO_TOTAL,
  C.operacional,
  C.operadoresTimeR,
  C.logistica,
  C.balanceiro,
  C.diretoria,
  C.faturamento,
  C.visualizador,
] as const

/** Comprovante e conferência: incluem Logística (itens do menu «Fluxo operacional»). */
const FLUXO_COM_LOGISTICA = [
  ...ACESSO_TOTAL,
  C.operacional,
  C.logistica,
  C.balanceiro,
  C.diretoria,
  C.faturamento,
  C.visualizador,
  C.comercial,
] as const

/** Checklist, ticket, aprovação: Logística não acede (fora do conjunto restrito). */
const FLUXO_SEM_LOGISTICA = [
  ...ACESSO_TOTAL,
  C.operacional,
  C.balanceiro,
  C.diretoria,
  C.faturamento,
  C.visualizador,
] as const

const FATURAMENTO = [
  ...ACESSO_TOTAL,
  C.balanceiro,
  C.diretoria,
  C.faturamento,
  C.visualizador,
  C.comercial,
] as const

const FINANCEIRO = [...ACESSO_TOTAL, C.diretoria, C.faturamento, C.visualizador] as const

/** RH: em desenvolvimento — apenas Desenvolvedor acede às rotas por enquanto. */
const RH = [C.desenvolvedor] as const

/** Presidência — visão executiva (câmaras e rastreamento). */
const PRESIDENTE = [C.desenvolvedor, C.diretoria] as const

const ENVIO_NF = [...ACESSO_TOTAL, C.diretoria, C.faturamento, C.visualizador, C.comercial] as const

const USUARIOS = [C.desenvolvedor] as const

/** Gestão de filas de solicitações (chat) — apenas Desenvolvedor. */
const SOLICITACOES_AJUSTE_ADMIN = [C.desenvolvedor] as const

/** Fila de exclusões de programação/MTR — Thais (Comercial Adm) e Desenvolvedor. */
const FILA_EXCLUSAO_OPERACIONAL = [C.desenvolvedor, ...ACESSO_COMERCIAL_ADM] as const

const RH_CARGOS_POR_ROTA = Object.fromEntries(
  RH_ROTAS_SISTEMA.map(({ path }) => [path, RH])
) as Record<string, readonly string[]>

/** Frota: Operacional, Comercial (incl. Adm), Diretoria — sem Logística/Balanceiro/Faturamento. */
const FROTA = [
  ...ACESSO_TOTAL,
  C.operacional,
  C.diretoria,
  C.comercial,
] as const

const FROTA_CARGOS_POR_ROTA = Object.fromEntries(
  FROTA_ROTAS_SISTEMA.map(({ path }) => [path, [...FROTA]])
) as Record<string, readonly string[]>

const PRESIDENTE_CARGOS_POR_ROTA = Object.fromEntries(
  PRESIDENTE_ROTAS_SISTEMA.map(({ path }) => [path, [...PRESIDENTE]])
) as Record<string, readonly string[]>

const FINANCEIRO_CARGOS_POR_ROTA = Object.fromEntries(
  FINANCEIRO_ROTAS_SISTEMA.map(({ path }) => [path, FINANCEIRO])
) as Record<string, readonly string[]>

export const NEXUS_CARGOS_POR_ROTA: Record<string, readonly string[]> = {
  '/dashboard': [...DASHBOARD_E_CHAT],
  '/clientes': [...CADASTRO],
  '/clientes/gerenciador': [...CADASTRO],
  '/motoristas': [...CADASTRO],
  '/caminhoes': [...CADASTRO],
  '/representantes-rg': [...CADASTRO],
  '/pos-venda': [...POS_VENDA],
  '/programacao': [...PROGRAMACAO_MTR],
  '/mtr': [...PROGRAMACAO_MTR],
  '/mtr/gerenciador': [...PROGRAMACAO_MTR],
  '/controle-massa': [...CONTROLE_MASSA],
  '/comprovantes-descarte': [...FLUXO_COM_LOGISTICA],
  '/checklist-transporte': [...FLUXO_SEM_LOGISTICA],
  '/conferencia-transporte': [...FLUXO_COM_LOGISTICA],
  '/ticket-operacional': [...FLUXO_SEM_LOGISTICA],
  '/aprovacao': [...FLUXO_SEM_LOGISTICA],
  '/clinicas': [...FATURAMENTO],
  '/faturamento': [...FATURAMENTO],
  '/faturamento-clinicas': [...FATURAMENTO],
  ...FINANCEIRO_CARGOS_POR_ROTA,
  '/envio-nf': [...ENVIO_NF],
  '/usuarios': [...USUARIOS],
  '/sistema/solicitacoes-ajuste': [...SOLICITACOES_AJUSTE_ADMIN],
  '/sistema/fila-exclusoes': [...FILA_EXCLUSAO_OPERACIONAL],
  '/sistema/senha-pessoal': [...SOLICITACOES_AJUSTE_ADMIN],
  '/chat': [...DASHBOARD_E_CHAT, C.operadoresTimeR],
  ...RH_CARGOS_POR_ROTA,
  ...FROTA_CARGOS_POR_ROTA,
  ...PRESIDENTE_CARGOS_POR_ROTA,
}
