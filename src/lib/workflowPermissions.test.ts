import { describe, expect, it } from "vitest";
import {
  CARGO_OPERACIONAL_TIME_T,
  CARGO_OPERADORES_TIME_R,
  cargoEhGerenteTimeFaturamento,
  cargoEhOperacionalTimeT,
  cargoEhOperadores,
  cargoEhOperadoresTimeR,
  cargoTemAutoridadeMaximaSistema,
  cargoPodeApagarHistoricoChat,
  cargoPodeCriarOuExcluirUsuario,
  cargoPodeCustomizarTicketOperacional,
  cargoPodeEditarResumosFinanceirosFaturamento,
  cargoPodeEditarMtr,
  cargoPodeExcluirMtr,
  cargoPodeLancarPesagem,
  cargoPodeMutarFaturamentoFluxo,
  cargoPodeMutarFinanceiro,
  cargoPodeMutarProgramacao,
  usuarioPodeVerFaturamento,
} from "./workflowPermissions";
import { cargoPodeAcessarRotaMenu } from "./paginasSistema";

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

  it("operação edita MTR/pesagem; exclusões só Thais; sem faturamento", () => {
    expect(cargoPodeMutarProgramacao(CARGO_OPERADORES_TIME_R)).toBe(false);
    expect(cargoPodeEditarMtr(CARGO_OPERADORES_TIME_R, "Matheus")).toBe(true);
    expect(cargoPodeExcluirMtr(CARGO_OPERADORES_TIME_R, "Matheus")).toBe(false);
    expect(cargoPodeLancarPesagem(CARGO_OPERADORES_TIME_R)).toBe(true);
    expect(cargoPodeCustomizarTicketOperacional(CARGO_OPERADORES_TIME_R)).toBe(true);
    expect(cargoPodeMutarFaturamentoFluxo(CARGO_OPERADORES_TIME_R)).toBe(false);
    expect(cargoPodeMutarFinanceiro(CARGO_OPERADORES_TIME_R)).toBe(false);
  });
});

describe("workflowPermissions — Diretoria", () => {
  it("opera em todo o fluxo de negócio, sem criar acessos", () => {
    expect(cargoPodeMutarProgramacao("Diretoria", "Ana Novaes")).toBe(true);
    expect(cargoPodeLancarPesagem("Diretoria")).toBe(true);
    expect(cargoPodeMutarFaturamentoFluxo("Diretoria", "Ana Novaes")).toBe(true);
    expect(cargoPodeMutarFinanceiro("Diretoria")).toBe(true);
    expect(usuarioPodeVerFaturamento({ cargo: "Diretoria", nome: "Ana Novaes" })).toBe(true);
    expect(cargoPodeCriarOuExcluirUsuario("Diretoria")).toBe(false);
    expect(cargoPodeAcessarRotaMenu("Diretoria", "/usuarios")).toBe(false);
    expect(cargoPodeAcessarRotaMenu("Diretoria", "/programacao")).toBe(true);
  });
});

describe("workflowPermissions — Comercial Adm (Thais)", () => {
  it("reconhece Comercial Adm e legado Operacional (Time T)", () => {
    expect(cargoEhOperacionalTimeT("Comercial Adm")).toBe(true);
    expect(cargoEhOperacionalTimeT(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoEhGerenteTimeFaturamento("Gerente do Time")).toBe(true);
  });

  it("equipe comercial: faturamento e exclusões", () => {
    expect(cargoPodeEditarResumosFinanceirosFaturamento("Comercial", "Thais")).toBe(true);
    expect(cargoPodeEditarResumosFinanceirosFaturamento("Comercial", "Rafaela")).toBe(true);
    expect(cargoPodeMutarFaturamentoFluxo("Comercial", "Rose")).toBe(true);
    expect(cargoPodeExcluirMtr("Comercial", "Raquel")).toBe(true);
    expect(usuarioPodeVerFaturamento({ cargo: "Comercial", nome: "Rafaela" })).toBe(true);
  });
});
