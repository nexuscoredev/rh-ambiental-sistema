/**
 * Permissões por cargo alinhadas ao fluxo operacional RG Ambiental.
 * Usado nas telas para desabilitar mutações; a fonte da verdade para políticas finas continua sendo o RLS no Supabase.
 *
 * Matriz por setor/nome (organograma): `src/lib/rbac` — funções abaixo aceitam `UsuarioAcessoCtx`
 * ou cargo isolado (fallback por cargo quando o nome não está disponível na página).
 */

import {
  rbacPode,
  type UsuarioAcessoContext,
} from './rbac'

export type UsuarioAcessoCtx = UsuarioAcessoContext

export function acessoDesdeCargo(
  cargo: string | null | undefined,
  nome?: string | null
): UsuarioAcessoCtx {
  return { cargo: cargo ?? null, nome: nome ?? null }
}

function ctxDeArgs(
  cargo: string | null | undefined,
  nome?: string | null | undefined
): UsuarioAcessoCtx {
  return acessoDesdeCargo(cargo, nome)
}

/** Cargos canónicos dos times (valores gravados em `usuarios.cargo`). */
export const CARGO_OPERACIONAL_TIME_T = 'Operacional (Time T)'
export const CARGO_OPERADORES_TIME_R = 'Operadores (Time R)'

export function normalizarTextoCargo(s: string | null | undefined): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function cargoEhAdministrador(cargo: string | null | undefined): boolean {
  return normalizarTextoCargo(cargo).includes('administrador')
}

export function cargoEhDesenvolvedor(cargo: string | null | undefined): boolean {
  return normalizarTextoCargo(cargo).includes('desenvolvedor')
}

/**
 * Autoridade máxima na UI: Desenvolvedor acede a tudo (rotas, mutações, listas de páginas).
 * RLS no Supabase pode ainda aplicar limites técnicos.
 */
export function cargoTemAutoridadeMaximaSistema(cargo: string | null | undefined): boolean {
  return cargoEhDesenvolvedor(cargo)
}

function liberadoSeAutoridadeMaxima(cargo: string | null | undefined): boolean {
  return cargoTemAutoridadeMaximaSistema(cargo)
}

/** Limpar histórico de conversa no chat interno — apenas Desenvolvedor. */
export function cargoPodeApagarHistoricoChat(cargo: string | null | undefined): boolean {
  return cargoEhDesenvolvedor(cargo)
}

/** Operacional genérico (sem sufixo Time T). */
function cargoEhOperacionalGenerico(cargo: string | null | undefined): boolean {
  return normalizarTextoCargo(cargo) === 'operacional'
}

/** Criar / excluir utilizadores — somente Desenvolvedor (master total). */
export function cargoEhAdministradorOuDesenvolvedor(cargo: string | null | undefined): boolean {
  return cargoEhDesenvolvedor(cargo)
}

/**
 * Acesso de rotas e mutações ao nível de «Administrador» no app, incluindo Financeiro
 * e Operacional (Time T) (mesmas áreas de negócio; Time T mantém extras no faturamento).
 */
export function cargoTemAcessoTipoAdministradorApp(cargo: string | null | undefined): boolean {
  if (cargoEhAdministrador(cargo)) return true
  if (cargoEhDesenvolvedor(cargo)) return true
  if (cargoEhOperacionalTimeT(cargo)) return true
  const c = normalizarTextoCargo(cargo)
  if (c.includes('financeiro') && !c.includes('operacional')) return true
  return false
}

export function cargoEhVisualizador(cargo: string | null | undefined): boolean {
  return normalizarTextoCargo(cargo).includes('visualizador')
}

export function cargoEhDiretoria(cargo: string | null | undefined): boolean {
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  return c.includes('diretoria') || c.includes('diretor')
}

/**
 * Operacional (Time T): administrador de negócio + faturamento editável (ex-Gerente do Time).
 */
/** Thais — cargo «Comercial Adm» (legado: Operacional Time T). */
export const CARGO_COMERCIAL_ADM = 'Comercial Adm'

export function cargoEhOperacionalTimeT(cargo: string | null | undefined): boolean {
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (c === normalizarTextoCargo(CARGO_COMERCIAL_ADM)) return true
  if (c.includes('comercial') && c.includes('adm')) return true
  if (c.includes('operacional') && c.includes('time t')) return true
  if (c.includes('operacional') && c.includes('thais')) return true
  if (c.includes('gerente') && c.includes('time')) return true
  return c === 'gerente time' || c.includes('operacional time thais')
}

/** @deprecated Use `cargoEhOperacionalTimeT`. */
export const cargoEhGerenteTimeFaturamento = cargoEhOperacionalTimeT

/**
 * Operadores (Time R): programação, MTR, pesagem/ticket e chat — sem faturamento/financeiro.
 */
export function cargoEhOperadoresTimeR(cargo: string | null | undefined): boolean {
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (c.includes('operadores') && c.includes('time r')) return true
  if (c.includes('operadores') && c.includes('rafael')) return true
  if (c === 'operadores' || c.includes('meninos') || c === 'os meninos') return true
  return c.includes('operadores time rafael')
}

/** @deprecated Use `cargoEhOperadoresTimeR`. */
export const cargoEhOperadores = cargoEhOperadoresTimeR

/** @deprecated Use `cargoEhOperadoresTimeR`. */
export const cargoEhOperadorMeninos = cargoEhOperadoresTimeR

/** Time R não usa mais perfil «só ticket padrão». */
export function cargoPerfilSomenteLancamentoTicketPadrao(
  cargo?: string | null | undefined
): boolean {
  void cargo
  return false
}

/**
 * Painel executivo (home tipo BI) — Diretoria e Administrador.
 * Outros perfis mantêm o dashboard operacional padrão.
 */
export function cargoPodeVerDashboardExecutivo(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return cargoEhDiretoria(cargo)
}

/** Programação — criar/editar: setor Comercial (matriz RBAC). */
export function usuarioPodeCriarProgramacao(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('programacao', 'criar', ctx)
}

export function usuarioPodeEditarProgramacao(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('programacao', 'editar', ctx)
}

export function cargoPodeMutarProgramacao(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return usuarioPodeEditarProgramacao(ctxDeArgs(cargo, nome))
}

/** MTR — edição: todos os utilizadores autenticados (exceto visualizador). */
export function usuarioPodeEditarMtr(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('mtr', 'editar', ctx)
}

export function cargoPodeMutarMtr(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return usuarioPodeEditarMtr(ctxDeArgs(cargo, nome))
}

/** Lançamento de pesagem — balanceiro, Operadores, operacional, logística e admin. */
export function cargoPodeMutarControleMassa(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  if (cargoEhOperadoresTimeR(cargo)) return true
  if (cargoEhOperacionalTimeT(cargo)) return true
  const c = normalizarTextoCargo(cargo)
  if (!c) return true
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return (
    c.includes('balanceiro') ||
    c.includes('pesagem') ||
    cargoEhOperacionalGenerico(cargo) ||
    c.includes('logistica') ||
    c.includes('faturamento')
  )
}

/** Conferência operacional (documentos / dados após pesagem) — Operacional + Admin. */
export function cargoPodeMutarConferenciaOperacional(cargo: string | null | undefined): boolean {
  return cargoPodeMutarMtr(cargo)
}

/** Checklist de transporte — motorista, operacional, logística e admin (não visualizador). */
export function cargoPodeMutarChecklistTransporte(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return (
    c.includes('motorista') ||
    cargoEhOperacionalGenerico(cargo) ||
    c.includes('logistica')
  )
}

/**
 * Ticket operacional — mesmo universo do Controle de Massa
 * (inclui Operadores para gravar/imprimir o ticket padrão).
 */
export function cargoPodeMutarTicketOperacional(cargo: string | null | undefined): boolean {
  return cargoPodeMutarControleMassa(cargo)
}

/** Tipo/número manual do ticket, reabrir após «ticket gerado». */
export function cargoPodeCustomizarTicketOperacional(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  return cargoPodeMutarTicketOperacional(cargo)
}

export function cargoPodeReeditarTicketOperacionalAposGerado(
  cargo: string | null | undefined
): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  return cargoPodeMutarTicketOperacional(cargo)
}

/** Decisão da diretoria na etapa ENVIADO_APROVACAO. */
export function cargoPodeMutarAprovacaoDiretoria(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return cargoEhDiretoria(cargo)
}

/** Comprovante de descarte — Thais e Raquel (+ Desenvolvedor). */
export function cargoPodeMutarComprovanteDescarte(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return rbacPode('comprovante_descarte', 'editar', ctxDeArgs(cargo, nome))
}

/** Conferência de transporte — setor Operação; exclusão só Thais. */
export function cargoPodeMutarConferenciaTransporte(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return rbacPode('conferencia_transporte', 'editar', ctxDeArgs(cargo, nome))
}

export function cargoPodeExcluirConferenciaTransporte(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return rbacPode('conferencia_transporte', 'excluir', ctxDeArgs(cargo, nome))
}

/** Resumos editáveis (ticket + MTR) e acréscimo/desconto — Thais (+ Desenvolvedor). */
export function cargoPodeEditarValoresFaturamento(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  return usuarioPodeMutarFaturamentoFluxo(ctxDeArgs(cargo, nome))
}

/** Alias semântico para UI do modal de faturamento. */
export const cargoPodeEditarResumosFinanceirosFaturamento = cargoPodeEditarValoresFaturamento

/** Encerramento definitivo do ticket no faturamento — Thais (+ Desenvolvedor). */
export function cargoPodeEncerrarTicketDefinitivoFaturamento(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  return usuarioPodeMutarFaturamentoFluxo(ctxDeArgs(cargo, nome))
}

/** Visualizar módulo Faturamento — setor Comercial (+ Desenvolvedor). */
export function usuarioPodeVerFaturamento(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('faturamento', 'ler', ctx)
}

/** Mutações no fluxo de faturamento — Thais (+ Desenvolvedor); não altera cálculos internos. */
export function usuarioPodeMutarFaturamentoFluxo(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('faturamento', 'editar', ctx)
}

export function cargoPodeMutarFaturamentoFluxo(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return usuarioPodeMutarFaturamentoFluxo(ctxDeArgs(cargo, nome))
}

/** Conferência / aprovação do ticket na fila — Thais (+ Desenvolvedor). */
export function cargoPodeAprovarTicketConferenciaFaturamento(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhOperadoresTimeR(cargo)) return false
  if (cargoEhVisualizador(cargo)) return false
  return usuarioPodeMutarFaturamentoFluxo(ctxDeArgs(cargo, nome))
}

/** Corrigir peso líquido na fila de conferência do ticket (alinhado à RPC no Supabase). */
export function cargoPodeEditarPesoConferenciaTicket(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  if (cargoEhOperacionalTimeT(cargo)) return true
  if (usuarioPodeMutarFaturamentoFluxo(ctxDeArgs(cargo, nome))) return true
  if (cargoEhDiretoria(cargo)) return true
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return (
    c.includes('faturamento') ||
    c.includes('financeiro') ||
    c.includes('operacional') ||
    c.includes('logistica') ||
    c.includes('balanceiro') ||
    c.includes('pesagem')
  )
}

/** Alterar valor da conta após faturamento (travado) — só Administrador e Desenvolvedor. */
export function cargoPodeAlterarValorContaTravada(cargo: string | null | undefined): boolean {
  return cargoEhAdministradorOuDesenvolvedor(cargo)
}

/**
 * Gestão de usuários — quem pode editar nome, cargo, status, página e senha.
 * Administrador e Diretoria, conforme regra de negócio acordada.
 * Criar e excluir continua sendo somente Administrador (`cargoPodeCriarOuExcluirUsuario`).
 */
export function cargoPodeGerirUsuarios(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  if (cargoEhDiretoria(cargo)) return true
  return false
}

/** Criar ou excluir usuário — Administrador e Desenvolvedor (não Financeiro). */
export function cargoPodeCriarOuExcluirUsuario(cargo: string | null | undefined): boolean {
  return cargoEhAdministradorOuDesenvolvedor(cargo)
}

/** Alterar o cargo de outro usuário — Administrador e Diretoria. */
export const cargoPodeAlterarCargoDeUsuario = cargoPodeGerirUsuarios

/** Cobrança / pagamento na tela Financeiro. Operadores: sem acesso. */
export function cargoPodeMutarFinanceiro(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhOperadoresTimeR(cargo)) return false
  if (cargoEhVisualizador(cargo)) return false
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  if (cargoEhDiretoria(cargo)) return true
  if (c.includes('faturamento')) return true
  if (cargoEhOperacionalGenerico(cargo)) return false
  return c === 'financeiro' || (c.includes('financeiro') && !cargoEhOperacionalGenerico(cargo))
}

// ---------------------------------------------------------------------------
// Fase 5 — permissões por ação (wrappers sem espalhar regra pela UI)
// ---------------------------------------------------------------------------

export function cargoPodeCriarProgramacao(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return usuarioPodeCriarProgramacao(ctxDeArgs(cargo, nome))
}

export function cargoPodeEditarProgramacao(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return usuarioPodeEditarProgramacao(ctxDeArgs(cargo, nome))
}

export function cargoPodeExcluirProgramacao(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return rbacPode('programacao', 'excluir', ctxDeArgs(cargo, nome))
}

export const cargoPodeCriarMtr = cargoPodeMutarMtr
export const cargoPodeEditarMtr = cargoPodeMutarMtr

export function cargoPodeExcluirMtr(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return rbacPode('mtr', 'excluir', ctxDeArgs(cargo, nome))
}

export function cargoPodeExcluirTicketPesagem(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return rbacPode('pesagem_ticket', 'excluir', ctxDeArgs(cargo, nome))
}

// Cadastro ------------------------------------------------------------------

export function usuarioPodeVerCliente(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('cliente', 'ler', ctx)
}

export function usuarioPodeIncluirCliente(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('cliente', 'criar', ctx)
}

export function usuarioPodeEditarCliente(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('cliente', 'editar', ctx)
}

export function usuarioPodeExcluirCliente(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('cliente', 'excluir', ctx)
}

export function usuarioPodeMutarMotorista(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('motorista', 'editar', ctx)
}

export function usuarioPodeMutarVeiculo(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('veiculo', 'editar', ctx)
}

export function usuarioPodeVerRepresentante(ctx: UsuarioAcessoCtx): boolean {
  return rbacPode('representante', 'ler', ctx)
}

/** Cancelar / baixar MTR, frete em cancelamento e rateio (Time T, Faturamento, Financeiro, admin). */
export function cargoPodeMutarMtrCicloVida(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  if (cargoEhOperacionalTimeT(cargo) || cargoEhGerenteTimeFaturamento(cargo)) return true
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  return c.includes('faturamento') || c.includes('financeiro')
}

export const cargoPodeLancarPesagem = cargoPodeMutarControleMassa

export function cargoPodeEmitirFaturamento(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  return cargoPodeMutarFaturamentoFluxo(cargo, nome)
}

export const cargoPodeConfirmarEmissaoFaturamento = cargoPodeEmitirFaturamento
export const cargoPodeCancelarFaturamento = cargoPodeEmitirFaturamento

/** Mala direta / envio real de NF por e-mail (UI + Edge Function send-nf-email). */
export function cargoPodeEnviarNfEmail(
  cargo: string | null | undefined,
  nome?: string | null
): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhOperadoresTimeR(cargo)) return false
  if (cargoEhVisualizador(cargo)) return false
  if (cargoEhOperacionalTimeT(cargo)) return true
  if (usuarioPodeMutarFaturamentoFluxo(ctxDeArgs(cargo, nome))) return true
  if (cargoEhAdministrador(cargo)) return true
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (c.includes('financeiro') && !c.includes('operacional')) return true
  return c.includes('faturamento') || c.includes('financeiro') || cargoEhDiretoria(cargo)
}

export const PERFIS_ENVIO_NF_EMAIL =
  'Desenvolvedor, Comercial Adm, Comercial, Administrador, Faturamento, Financeiro ou Diretoria'

export const cargoPodeEditarCobranca = cargoPodeMutarFinanceiro
export const cargoPodeMarcarPagamento = cargoPodeMutarFinanceiro

export const cargoPodeEditarChecklistTransporte = cargoPodeMutarChecklistTransporte
/** Gravar / imprimir ticket no fluxo padrão (inclui Operadores). */
export const cargoPodeEditarTicketOperacional = cargoPodeMutarTicketOperacional

/** Alias explícito para pesagem + ticket padrão. */
export const cargoPodeLancarTicketPadraoOperador = cargoPodeLancarPesagem
export const cargoPodeDecidirAprovacaoDiretoria = cargoPodeMutarAprovacaoDiretoria
