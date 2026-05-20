import fs from "fs";

const p = "src/pages/ControleMassa-NEXUS.tsx";
let s = fs.readFileSync(p, "utf8");

if (s.includes("<PesagemResiduosLista")) {
  console.log("already patched");
  process.exit(0);
}

const catalogLabel = "Resíduo (catálogo)</label>";
const idx = s.indexOf(catalogLabel);
if (idx < 0) {
  console.error("catalog label not found");
  process.exit(1);
}

const start = s.lastIndexOf('<div style={{ gridColumn: "span 4" }} className="field">', idx);
const pesoIdx = s.indexOf("Peso tara (kg)</label>", idx);
const pesoDiv = s.lastIndexOf('<motionlessDiv style={{ gridColumn: "span 4" }}', pesoIdx);
const pesoDiv2 = s.lastIndexOf('<motionlessDiv style={{ gridColumn: "span 4" }} className="field">', pesoIdx);
const pesoDiv3 = s.lastIndexOf('<div style={{ gridColumn: "span 4" }} className="field">', pesoIdx);

const pesoStart = [pesoDiv3, pesoDiv2, pesoDiv].find((x) => x >= 0 && x > idx) ?? pesoDiv3;

const replacement = `                  <PesagemResiduosLista
                    linhas={form.residuos_linhas}
                    onLinhasChange={(linhas) =>
                      setForm((prev) => mergeFormResiduosLinhas(prev, linhas))
                    }
                    residuosCatalogo={residuosCatalogo}
                    catalogoPorId={catalogoResiduosPorId}
                    inputStyle={inputStyle}
                  />

`;

const newS = s.slice(0, start) + replacement + s.slice(pesoStart);
fs.writeFileSync(p, newS);
console.log("patched", p);
