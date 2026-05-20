import { describe, expect, it } from "vitest";
import {
  CARGO_OPERACIONAL_TIME_T,
  CARGO_OPERADORES_TIME_R,
  cargoEhGerenteTimeFaturamento,
  cargoEhOperacionalTimeT,
  cargoEhOperadores,
  cargoEhOperadoresTimeR,
  cargoTemAutoridadeMaximaSistema,
  cargoPodeAlterarValorContaTravada,
  cargoPodeApagarHistoricoChat,
  cargoPodeAprovarTicketConferenciaFaturamento,
  cargoPodeCriarOuExcluirUsuario,
  cargoPodeCustomizarTicketOperacional,
  cargoPodeEditarResumosFinanceirosFaturamento,
  cargoPodeEncerrarTicketDefinitivoFaturamento,
  cargoPodeExcluirMtr,
  cargoPodeLancarPesagem,
  cargoPodeMutarFaturamentoFluxo,
  cargoPodeMutarFinanceiro,
  cargoPodeMutarProgramacao,
  cargoPodeVerDashboardExecutivo,
  cargoTemAcessoTipoAdministradorApp,
} from "./workflowPermissions";

describe("workflowPermissions — Desenvolvedor (autoridade máxima)", () => {
  it("reconhece autoridade máxima", () => {
    expect(cargoTemAutoridadeMaximaSistema("Desenvolvedor")).toBe(true);
    expect(cargoTemAutoridadeMaximaSistema("Administrador")).toBe(false);
  });

  it("pode mutar e excluir em qualquer módulo de negócio", () => {
    expect(cargoPodeMutarProgramacao("Desenvolvedor")).toBe(true);
    expect(cargoPodeExcluirMtr("Desenvolvedor")).toBe(true);
    expect(cargoPodeCustomizarTicketOperacional("Desenvolvedor")).toBe(true);
    expect(cargoPodeEditarResumosFinanceirosFaturamento("Desenvolvedor")).toBe(true);
    expect(cargoPodeCriarOuExcluirUsuario("Desenvolvedor")).toBe(true);
    expect(cargoPodeApagarHistoricoChat("Desenvolvedor")).toBe(true);
  });
});

describe("workflowPermissions — Operadores (Time R)", () => {
  it("reconhece o cargo canónico", () => {
    expect(cargoEhOperadoresTimeR(CARGO_OPERADORES_TIME_R)).toBe(true);
    expect(cargoEhOperadores(CARGO_OPERADORES_TIME_R)).toBe(true);
    expect(cargoEhOperadoresTimeR("Operadores")).toBe(true);
  });

  it("acede a programação, MTR e pesagem; sem faturamento", () => {
    expect(cargoPodeMutarProgramacao(CARGO_OPERADORES_TIME_R)).toBe(true);
    expect(cargoPodeExcluirMtr(CARGO_OPERADORES_TIME_R)).toBe(true);
    expect(cargoPodeLancarPesagem(CARGO_OPERADORES_TIME_R)).toBe(true);
    expect(cargoPodeCustomizarTicketOperacional(CARGO_OPERADORES_TIME_R)).toBe(true);
    expect(cargoPodeMutarFaturamentoFluxo(CARGO_OPERADORES_TIME_R)).toBe(false);
    expect(cargoPodeMutarFinanceiro(CARGO_OPERADORES_TIME_R)).toBe(false);
  });
});

describe("workflowPermissions — Operacional (Time T)", () => {
  it("reconhece o cargo canónico e legado Gerente do Time", () => {
    expect(cargoEhOperacionalTimeT(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoEhGerenteTimeFaturamento("Gerente do Time")).toBe(true);
  });

  it("tem acesso tipo Administrador e faturamento editável", () => {
    expect(cargoTemAcessoTipoAdministradorApp(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoPodeVerDashboardExecutivo(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoPodeMutarFinanceiro(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoPodeAlterarValorContaTravada(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoPodeEditarResumosFinanceirosFaturamento(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoPodeEncerrarTicketDefinitivoFaturamento(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoPodeMutarFaturamentoFluxo(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoPodeAprovarTicketConferenciaFaturamento(CARGO_OPERACIONAL_TIME_T)).toBe(true);
  });
});
