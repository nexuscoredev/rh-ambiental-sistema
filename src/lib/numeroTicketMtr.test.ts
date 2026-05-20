import { describe, expect, it } from "vitest";
import {
  extrairSufixoFinalNumeroMtr,
  numeroTicketFromMtr,
} from "./numeroTicketMtr";

describe("numeroTicketMtr", () => {
  it("extrai sufixo de MTR estilo N/ano", () => {
    expect(extrairSufixoFinalNumeroMtr("2650/2026")).toBe("2650");
    expect(numeroTicketFromMtr("2650/2026")).toBe("2650");
  });

  it("extrai sufixo após último hífen", () => {
    expect(extrairSufixoFinalNumeroMtr("MTR-20260520-143022")).toBe("143022");
    expect(numeroTicketFromMtr("MTR-20260520-143022")).toBe("143022");
  });

  it("segmenta vários tickets com o mesmo sufixo base", () => {
    expect(numeroTicketFromMtr("2650/2026", 0, 3)).toBe("2650-1");
    expect(numeroTicketFromMtr("2650/2026", 1, 3)).toBe("2650-2");
    expect(numeroTicketFromMtr("2650/2026", 2, 3)).toBe("2650-3");
  });
});
