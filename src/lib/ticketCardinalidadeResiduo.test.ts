import { describe, expect, it } from "vitest";
import {
  coletaCorrespondeResiduo,
  deveSegmentarTicketsPorMtr,
  indiceSufixoNumeroTicket,
  numeroTicketParaSegmento,
  ordenarColetasPorLinhasResiduo,
  resolverColetaIdParaLinhaResiduo,
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

  it("ordena coletas na ordem das linhas de resíduo (Ticket 1 = 1ª linha)", () => {
    const coletas = [
      { id: "c3", numero: "903", tipo_residuo: "C" },
      { id: "c1", numero: "901", tipo_residuo: "A" },
      { id: "c2", numero: "902", tipo_residuo: "B" },
    ];
    const ord = ordenarColetasPorLinhasResiduo(coletas, [
      { texto: "A" },
      { texto: "B" },
      { texto: "C" },
    ]);
    expect(ord.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("não reutiliza a mesma coleta em dois tickets", () => {
    const coletas = [{ id: "c1", tipo_residuo: "MIX" }];
    const usadas = new Set<string>();
    expect(resolverColetaIdParaLinhaResiduo(coletas, "MIX", usadas)).toBe("c1");
    usadas.add("c1");
    expect(resolverColetaIdParaLinhaResiduo(coletas, "MIX", usadas)).toBe("");
  });

  it("indiceSufixoNumeroTicket lê sufixo -1, -2", () => {
    expect(indiceSufixoNumeroTicket("153818-1")).toBe(1);
    expect(indiceSufixoNumeroTicket("153818-3")).toBe(3);
  });
});
