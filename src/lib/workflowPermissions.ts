/**
 * Permissões por cargo alinhadas ao fluxo operacional RG Ambiental.
 * Usado nas telas para desabilitar mutações; a fonte da verdade para políticas finas continua sendo o RLS no Supabase.
 */

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

/** Criar / excluir utilizadores — Administrador, Desenvolvedor e Operacional (Time T). */
export function cargoEhAdministradorOuDesenvolvedor(cargo: string | null | undefined): boolean {
  return (
    cargoEhAdministrador(cargo) ||
    cargoEhDesenvolvedor(cargo) ||
    cargoEhOperacionalTimeT(cargo)
  )
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

/** Logística não pode eliminar registos em lado nenhum (Desenvolvedor pode). */
function cargoProibidoExcluirRegistos(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return false
  return normalizarTextoCargo(cargo).includes('logistica')
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
export function cargoEhOperacionalTimeT(cargo: string | null | undefined): boolean {
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
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
  _cargo: string | null | undefined
): boolean {
  return false
}

function cargoBypassFaturamentoValoresEditaveis(cargo: string | null | undefined): boolean {
  return cargoTemAcessoTipoAdministradorApp(cargo) || cargoEhOperacionalTimeT(cargo)
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

/** Programação: criação de agenda e vínculo ao fluxo — Operacional + Admin. */
export function cargoPodeMutarProgramacao(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  const c = normalizarTextoCargo(cargo)
  // Sem cargo na tabela usuários: não bloquear a UI (RLS no Supabase continua sendo a barreira real).
  if (!c) return true
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  if (cargoEhOperadoresTimeR(cargo)) return true
  return cargoEhOperacionalGenerico(cargo) || c.includes('logistica')
}

/** MTR / documentação — Operacional + Admin. */
export function cargoPodeMutarMtr(cargo: string | null | undefined): boolean {
  return cargoPodeMutarProgramacao(cargo)
}

/** Lançamento de pesagem — balanceiro, Operadores, operacional, logística e admin. */
export function cargoPodeMutarControleMassa(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  if (cargoEhOperadoresTimeR(cargo)) return true
  const c = normalizarTextoCargo(cargo)
  if (!c) return true
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return (
    c.includes('balanceiro') ||
    c.includes('pesagem') ||
    cargoEhOperacionalGenerico(cargo) ||
    c.includes('logistica')
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

/**
 * Comprovante de descarte — documentação pós-pesagem (operacional / pesagem / faturamento).
 */
export function cargoPodeMutarComprovanteDescarte(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  const c = normalizarTextoCargo(cargo)
  if (!c) return true
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return (
    cargoEhOperacionalGenerico(cargo) ||
    c.includes('logistica') ||
    c.includes('balanceiro') ||
    c.includes('pesagem') ||
    c.includes('faturamento') ||
    c.includes('financeiro') ||
    cargoEhDiretoria(cargo)
  )
}

/** Resumos editáveis (ticket + MTR) e acréscimo/desconto — Operacional (Time T) (+ admin/dev). */
export function cargoPodeEditarValoresFaturamento(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  return cargoBypassFaturamentoValoresEditaveis(cargo)
}

/** Alias semântico para UI do modal de faturamento. */
export const cargoPodeEditarResumosFinanceirosFaturamento = cargoPodeEditarValoresFaturamento

/** Encerramento definitivo do ticket no faturamento — Operacional (Time T). */
export function cargoPodeEncerrarTicketDefinitivoFaturamento(
  cargo: string | null | undefined
): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhVisualizador(cargo)) return false
  return cargoBypassFaturamentoValoresEditaveis(cargo)
}

/** Registo de faturamento (camada antes do financeiro). Operadores (Time R): sem acesso. */
export function cargoPodeMutarFaturamentoFluxo(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhOperadoresTimeR(cargo)) return false
  if (cargoEhVisualizador(cargo)) return false
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return (
    c.includes('faturamento') ||
    c.includes('financeiro') ||
    cargoEhDiretoria(cargo)
  )
}

/** Conferência / aprovação do ticket na fila (antes do faturamento com valores editáveis). */
export function cargoPodeAprovarTicketConferenciaFaturamento(
  cargo: string | null | undefined
): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  if (cargoEhOperadoresTimeR(cargo)) return false
  if (cargoEhVisualizador(cargo)) return false
  const c = normalizarTextoCargo(cargo)
  if (!c) return false
  if (cargoTemAcessoTipoAdministradorApp(cargo)) return true
  return c.includes('faturamento') || cargoEhDiretoria(cargo)
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

export const cargoPodeCriarProgramacao = cargoPodeMutarProgramacao
export const cargoPodeEditarProgramacao = cargoPodeMutarProgramacao
export function cargoPodeExcluirProgramacao(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  return cargoPodeMutarProgramacao(cargo) && !cargoProibidoExcluirRegistos(cargo)
}

export const cargoPodeCriarMtr = cargoPodeMutarMtr
export const cargoPodeEditarMtr = cargoPodeMutarMtr
export function cargoPodeExcluirMtr(cargo: string | null | undefined): boolean {
  if (liberadoSeAutoridadeMaxima(cargo)) return true
  return cargoPodeMutarMtr(cargo) && !cargoProibidoExcluirRegistos(cargo)
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

export const cargoPodeEmitirFaturamento = cargoPodeMutarFaturamentoFluxo
export const cargoPodeConfirmarEmissaoFaturamento = cargoPodeMutarFaturamentoFluxo
export const cargoPodeCancelarFaturamento = cargoPodeMutarFaturamentoFluxo

export const cargoPodeEditarCobranca = cargoPodeMutarFinanceiro
export const cargoPodeMarcarPagamento = cargoPodeMutarFinanceiro

export const cargoPodeEditarChecklistTransporte = cargoPodeMutarChecklistTransporte
/** Gravar / imprimir ticket no fluxo padrão (inclui Operadores). */
export const cargoPodeEditarTicketOperacional = cargoPodeMutarTicketOperacional

/** Alias explícito para pesagem + ticket padrão. */
export const cargoPodeLancarTicketPadraoOperador = cargoPodeLancarPesagem
export const cargoPodeDecidirAprovacaoDiretoria = cargoPodeMutarAprovacaoDiretoria
