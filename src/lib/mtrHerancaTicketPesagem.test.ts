import { describe, expect, it } from "vitest";
import {
  aplicarHerancaMtrEmCamposPesagem,
  extrairHerancaMtrParaPesagem,
  linhasResiduoHerancaOuColeta,
  mesclarLinhasResiduoHerancaMtr,
} from "./mtrHerancaTicketPesagem";
import { linhaVaziaResiduoPesagem } from "./residuosPesagem";

describe("mtrHerancaTicketPesagem", () => {
  it("extrai placa e motorista dos detalhes da MTR", () => {
    const h = extrairHerancaMtrParaPesagem({
      tipo_residuo: "Lodo",
      detalhes: {
        transportador: { placa: "ABC-1D23", motorista: "João Silva" },
        residuo: { caracterizacao: "Lodo industrial" },
      },
      programacao_id: "prog-1",
    }, "Truck");

    expect(h.placa).toBe("ABC-1D23");
    expect(h.motorista).toBe("João Silva");
    expect(h.tipo_residuo).toBe("Lodo");
    expect(h.tipo_caminhao).toBe("Truck");
    expect(h.linhas_residuo[0]?.texto).toContain("Lodo");
  });

  it("prioriza placa/motorista da MTR sobre coleta vazia", () => {
    const campos = aplicarHerancaMtrEmCamposPesagem(
      { placa: "", motorista: "" },
      extrairHerancaMtrParaPesagem({
        tipo_residuo: "X",
        detalhes: { transportador: { placa: "XYZ-9999", motorista: "Maria" } },
      })
    );
    expect(campos.placa).toBe("XYZ-9999");
    expect(campos.motorista).toBe("Maria");
  });

  it("extrai várias linhas de residuos_lista nos detalhes da MTR", () => {
    const h = extrairHerancaMtrParaPesagem({
      tipo_residuo: "Teste Residuo 1 · Teste Residuo 2",
      detalhes: {
        residuos_lista: [
          {
            fonte_origem: "Industrial",
            caracterizacao: "Teste Residuo 1",
            estado_fisico: "Classe I",
            acondicionamento: "Polli",
            quantidade_aproximada: "1",
            onu: "",
          },
          {
            fonte_origem: "Industrial",
            caracterizacao: "Teste Residuo 2",
            estado_fisico: "Classe II",
            acondicionamento: "Classe II",
            quantidade_aproximada: "1",
            onu: "",
          },
        ],
        residuo: {
          fonte_origem: "Industrial",
          caracterizacao: "Teste Residuo 1",
          estado_fisico: "Classe I",
          acondicionamento: "Polli",
          quantidade_aproximada: "",
          onu: "",
        },
      },
    });

    expect(h.linhas_residuo).toHaveLength(2);
    expect(h.linhas_residuo[0]?.texto).toContain("Teste Residuo 1");
    expect(h.linhas_residuo[1]?.texto).toContain("Teste Residuo 2");
  });

  it("preserva texto e pesos da coleta ao mesclar linhas da MTR", () => {
    const mescladas = mesclarLinhasResiduoHerancaMtr(
      [{ ...linhaVaziaResiduoPesagem(), texto: "EFLUENTE CONTAMINADO", peso_bruto: "1000", peso_tara: "200", peso_liquido: "800" }],
      [{ ...linhaVaziaResiduoPesagem(), texto: "RESIDUO CLASSE I" }]
    );
    expect(mescladas).toHaveLength(1);
    expect(mescladas[0]?.texto).toBe("EFLUENTE CONTAMINADO");
    expect(mescladas[0]?.peso_bruto).toBe("1000");
    expect(mescladas[0]?.peso_tara).toBe("200");
    expect(mescladas[0]?.peso_liquido).toBe("800");
  });

  it("linhasResiduoHerancaOuColeta não expande várias linhas MTR sobre coleta já definida", () => {
    const coleta = [{ ...linhaVaziaResiduoPesagem(), texto: "EFLUENTE CONTAMINADO", peso_liquido: "1040" }];
    const heranca = extrairHerancaMtrParaPesagem({
      tipo_residuo: "MIX",
      detalhes: {
        residuos_lista: [
          {
            fonte_origem: "Industrial",
            caracterizacao: "CLASSE II",
            estado_fisico: "Sólido",
            acondicionamento: "",
            quantidade_aproximada: "",
            onu: "",
          },
          {
            fonte_origem: "Industrial",
            caracterizacao: "RESIDUO CLASSE I",
            estado_fisico: "Líquido",
            acondicionamento: "",
            quantidade_aproximada: "",
            onu: "",
          },
        ],
        residuo: {
          fonte_origem: "Industrial",
          caracterizacao: "CLASSE II",
          estado_fisico: "Sólido",
          acondicionamento: "",
          quantidade_aproximada: "",
          onu: "",
        },
      },
    });
    const linhas = linhasResiduoHerancaOuColeta(coleta, heranca);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.texto).toBe("EFLUENTE CONTAMINADO");
    expect(linhas[0]?.peso_liquido).toBe("1040");
  });
});
