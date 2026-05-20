import { describe, expect, it } from "vitest";
import {
  coletaCorrespondeResiduo,
  deveSegmentarTicketsPorMtr,
  numeroTicketParaSegmento,
} from "./ticketCardinalidadeResiduo";
import { linhaVaziaResiduoPesagem } from "./residuosPesagem";

describe("ticketCardinalidadeResiduo", () => {
  it("segmenta quando há MTR e mais de um resíduo", () => {
    const linhas = [
      { ...linhaVaziaResiduoPesagem(), texto: "A" },
      { ...linhaVaziaResiduoPesagem(), texto: "B" },
    ];
    expect(deveSegmentarTicketsPorMtr("mtr-1", linhas)).toBe(true);
    expect(deveSegmentarTicketsPorMtr(null, linhas)).toBe(false);
    expect(deveSegmentarTicketsPorMtr("mtr-1", [{ ...linhaVaziaResiduoPesagem(), texto: "A" }])).toBe(
      false
    );
  });

  it("numera segmentos com sufixo da MTR", () => {
    expect(numeroTicketParaSegmento("2650/2026", 0, 3)).toBe("2650-1");
    expect(numeroTicketParaSegmento("2650/2026", 2, 3)).toBe("2650-3");
    expect(numeroTicketParaSegmento("2650/2026", 0, 1)).toBe("2650");
  });

  it("fallback legado sem MTR", () => {
    expect(numeroTicketParaSegmento("", 0, 3, "90001")).toBe("90001-1");
  });

  it("associa coleta pelo tipo de resíduo", () => {
    expect(coletaCorrespondeResiduo({ tipo_residuo: "Lodo" }, "lodo")).toBe(true);
    expect(coletaCorrespondeResiduo({ tipo_residuo: "Outro" }, "Lodo")).toBe(false);
  });
});
