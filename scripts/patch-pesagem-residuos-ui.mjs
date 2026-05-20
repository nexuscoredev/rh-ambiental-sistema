import fs from "fs";

const p = "src/pages/ControleMassa.tsx";
let s = fs.readFileSync(p, "utf8");

const idx = s.indexOf("Resíduo (catálogo)</label>");
if (idx < 0) {
  console.error("catalog label not found");
  process.exit(1);
}

const blockStart = s.lastIndexOf('<div style={{ gridColumn: "span 4" }} className="field">', idx);

const pesoLiqInput = s.indexOf('name="peso_liquido"', idx);
if (pesoLiqInput < 0) {
  console.error("peso_liquido input not found");
  process.exit(1);
}
const end = s.indexOf("</div>", pesoLiqInput);
if (blockStart < 0 || end < 0) {
  console.error("bounds not found", { blockStart, end });
  process.exit(1);
}
const endPos = end + 6;

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

const newS = s.slice(0, blockStart) + replacement + s.slice(endPos);
fs.writeFileSync(p, newS, "utf8");
console.log("patched", p, "removed", endPos - blockStart, "chars");
