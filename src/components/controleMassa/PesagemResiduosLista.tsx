import { type CSSProperties } from "react";
import {
  agregarPesosDasLinhas,
  calcularPesoLiquidoLinha,
  linhaVaziaResiduoPesagem,
  type ResiduoPesagemItem,
} from "../../lib/residuosPesagem";

type Props = {
  linhas: ResiduoPesagemItem[];
  onLinhasChange: (linhas: ResiduoPesagemItem[]) => void;
  inputStyle: CSSProperties;
};

export function PesagemResiduosLista({
  linhas,
  onLinhasChange,
  inputStyle,
}: Props) {
  function atualizarLinha(index: number, patch: Partial<ResiduoPesagemItem>) {
    onLinhasChange(linhas.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function onTextoChange(index: number, value: string) {
    atualizarLinha(index, { texto: value, catalogo_id: "" });
  }

  function onPesoChange(
    index: number,
    campo: "peso_tara" | "peso_bruto",
    value: string
  ) {
    const linha = linhas[index];
    if (!linha) return;
    const proximo = { ...linha, [campo]: value };
    proximo.peso_liquido = calcularPesoLiquidoLinha(proximo.peso_bruto, proximo.peso_tara);
    atualizarLinha(index, proximo);
  }

  const totais = agregarPesosDasLinhas(linhas);

  function removerLinha(index: number) {
    if (linhas.length <= 1) {
      onLinhasChange([linhaVaziaResiduoPesagem()]);
      return;
    }
    onLinhasChange(linhas.filter((_, i) => i !== index));
  }

  function adicionarLinha() {
    onLinhasChange([...linhas, linhaVaziaResiduoPesagem()]);
  }

  return (
    <div style={{ gridColumn: "span 12", display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Resíduos</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 600 }}>
            Um ticket = um resíduo. Informe o tipo e os pesos (texto livre).
          </div>
        </div>
        <button
          type="button"
          onClick={adicionarLinha}
          style={{
            height: 38,
            padding: "0 16px",
            borderRadius: 10,
            border: "1px solid #0f766e",
            background: "linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(13, 148, 136, 0.35)",
          }}
        >
          + Adicionar resíduo
        </button>
      </div>

      {linhas.map((linha, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 12,
            background: index % 2 === 0 ? "#ffffff" : "#f8fafc",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>
              Resíduo {index + 1}
            </span>
            {linhas.length > 1 ? (
              <button
                type="button"
                onClick={() => removerLinha(index)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#b91c1c",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Remover
              </button>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ gridColumn: "span 12" }} className="field">
              <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                Tipo de resíduo
              </label>
              <input
                value={linha.texto}
                onChange={(e) => onTextoChange(index, e.target.value)}
                placeholder="Ex.: Mix de resíduos contaminados"
                style={{ ...inputStyle, height: "44px", fontSize: "14px" }}
                aria-label={`Tipo de resíduo ${index + 1}`}
              />
            </div>

            <div style={{ gridColumn: "span 4" }} className="field">
              <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                Peso bruto (kg)
              </label>
              <input
                inputMode="decimal"
                value={linha.peso_bruto}
                onChange={(e) => onPesoChange(index, "peso_bruto", e.target.value)}
                placeholder="Ex.: 2540"
                style={{ ...inputStyle, height: "46px", fontSize: "15px", fontWeight: 800 }}
              />
            </div>

            <div style={{ gridColumn: "span 4" }} className="field">
              <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                Peso tara (kg)
              </label>
              <input
                inputMode="decimal"
                value={linha.peso_tara}
                onChange={(e) => onPesoChange(index, "peso_tara", e.target.value)}
                placeholder="Ex.: 320"
                style={{ ...inputStyle, height: "46px", fontSize: "15px", fontWeight: 800 }}
              />
            </div>

            <div style={{ gridColumn: "span 4" }} className="field">
              <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                Peso líquido (auto)
              </label>
              <input
                value={linha.peso_liquido}
                readOnly
                placeholder="—"
                style={{
                  ...inputStyle,
                  height: "46px",
                  fontSize: "15px",
                  fontWeight: 900,
                  background: "#f8fafc",
                  borderColor: "#cbd5e1",
                }}
              />
            </div>
          </div>
        </div>
      ))}

      {totais.peso_liquido ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "#f0fdfa",
            border: "1px solid #99f6e4",
            fontSize: 13,
            fontWeight: 700,
            color: "#0f766e",
          }}
        >
          Total da pesagem (soma dos resíduos):{" "}
          <strong>
            {Number(totais.peso_liquido).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 3,
            })}{" "}
            kg líquido
          </strong>
        </div>
      ) : null}
    </div>
  );
}
