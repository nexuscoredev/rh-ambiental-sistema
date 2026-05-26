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
  cargoPodeCancelarBaixarMtr,
  usuarioPodeCancelarBaixarMtr,
  usuarioPodeExcluirMtr,
  usuarioPodeVerFaturamento,
} from "./workflowPermissions";
import { cargoPodeAcessarRotaMenu } from "./paginasSistema";

describe("workflowPermissions — Desenvolvedor (autoridade máxima)", () => {
  it("reconhece autoridade máxima", () => {
    expect(cargoTemAutoridadeMaximaSistema("Desenvolvedor")).toBe(true);
    expect(cargoTemAutoridadeMaximaSistema("Administrador")).toBe(false);
    expect(cargoTemAutoridadeMaximaSistema("Administrador", "Rafael Cavalcante")).toBe(
      true
    );
    expect(
      cargoTemAutoridadeMaximaSistema(
        "Comercial",
        "Rafael Cavalcante",
        "cavalcantersc07@gmail.com"
      )
    ).toBe(true);
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
    expect(cargoPodeAcessarRotaMenu("Administrador", "/usuarios", "Rafael Cavalcante")).toBe(
      true
    );
  });
});

describe("workflowPermissions — Excluir MTR (lista)", () => {
  it("autoriza Thais, Ezequiel, Ana, Rafael (operação) e Vinicius", () => {
    expect(usuarioPodeExcluirMtr("Thais Pichirilli")).toBe(true);
    expect(usuarioPodeExcluirMtr("Ezequiel")).toBe(true);
    expect(usuarioPodeExcluirMtr("Ana Novaes")).toBe(true);
    expect(usuarioPodeExcluirMtr("Rafael")).toBe(true);
    expect(usuarioPodeExcluirMtr("Vinicius")).toBe(true);
  });

  it("autoriza Rafael Cavalcante (desenvolvedor master) e nega Rafaela/Raquel", () => {
    expect(usuarioPodeExcluirMtr("Rafael Cavalcante")).toBe(true);
    expect(cargoPodeExcluirMtr("Administrador", "Rafael Cavalcante")).toBe(true);
    expect(usuarioPodeExcluirMtr("Rafaela Thomaz")).toBe(false);
    expect(usuarioPodeExcluirMtr("Raquel")).toBe(false);
    expect(cargoPodeExcluirMtr("Comercial", "Raquel")).toBe(false);
  });
});

describe("workflowPermissions — Cancelar / Baixar MTR (lista)", () => {
  it("autoriza Thais, Ezequiel, Ana, Raquel, Rafael Cavalcante e Vinicius", () => {
    expect(usuarioPodeCancelarBaixarMtr("Thais Pichirilli")).toBe(true);
    expect(usuarioPodeCancelarBaixarMtr("Ezequiel")).toBe(true);
    expect(usuarioPodeCancelarBaixarMtr("Ana Novaes")).toBe(true);
    expect(usuarioPodeCancelarBaixarMtr("Raquel")).toBe(true);
    expect(usuarioPodeCancelarBaixarMtr("Rafael Cavalcante")).toBe(true);
    expect(usuarioPodeCancelarBaixarMtr("Vinicius")).toBe(true);
  });

  it("nega operação, comercial restante e diretoria fora da lista", () => {
    expect(usuarioPodeCancelarBaixarMtr("Matheus")).toBe(false);
    expect(usuarioPodeCancelarBaixarMtr("Rafael")).toBe(false);
    expect(usuarioPodeCancelarBaixarMtr("Rafaela")).toBe(false);
    expect(usuarioPodeCancelarBaixarMtr("Rose")).toBe(false);
    expect(usuarioPodeCancelarBaixarMtr(null)).toBe(false);
    expect(cargoPodeCancelarBaixarMtr("Operacional (Time T)", null)).toBe(false);
    expect(cargoPodeCancelarBaixarMtr("Operacional (Time T)", "Rafael Cavalcante")).toBe(
      true
    );
  });

  it("autoriza cargo Comercial Adm (Thais) mesmo sem nome no perfil", () => {
    expect(cargoPodeCancelarBaixarMtr("Comercial Adm", null)).toBe(true);
    expect(cargoPodeCancelarBaixarMtr("Comercial", null)).toBe(false);
  });
});

describe("workflowPermissions — Comercial Adm (Thais)", () => {
  it("reconhece Comercial Adm e legado Operacional (Time T)", () => {
    expect(cargoEhOperacionalTimeT("Comercial Adm")).toBe(true);
    expect(cargoEhOperacionalTimeT(CARGO_OPERACIONAL_TIME_T)).toBe(true);
    expect(cargoEhGerenteTimeFaturamento("Gerente do Time")).toBe(true);
  });

  it("equipe comercial: faturamento; exclusão MTR só por nome autorizado", () => {
    expect(cargoPodeEditarResumosFinanceirosFaturamento("Comercial", "Thais")).toBe(true);
    expect(cargoPodeEditarResumosFinanceirosFaturamento("Comercial", "Rafaela")).toBe(true);
    expect(cargoPodeMutarFaturamentoFluxo("Comercial", "Rose")).toBe(true);
    expect(cargoPodeExcluirMtr("Comercial", "Thais")).toBe(true);
    expect(cargoPodeExcluirMtr("Comercial", "Raquel")).toBe(false);
    expect(usuarioPodeVerFaturamento({ cargo: "Comercial", nome: "Rafaela" })).toBe(true);
  });
});
