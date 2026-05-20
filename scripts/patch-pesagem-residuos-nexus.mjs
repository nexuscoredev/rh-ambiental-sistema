import fs from "fs";

const p = "src/pages/ControleMassa-NEXUS.tsx";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("PesagemResiduosLista")) {
  s = s.replace(
    `} from "../lib/fluxoEtapas";

/** Busca insensível`,
    `} from "../lib/fluxoEtapas";
import { PesagemResiduosLista } from "../components/controleMassa/PesagemResiduosLista";
import {
  isErroColunaResiduosItens,
  linhaVaziaResiduoPesagem,
  linhasParaFormLegacy,
  parseResiduosFromRow,
  parseResiduosItensJson,
  residuoCatalogoIdParaDb,
  resolverResiduosParaGravacao,
  type ResiduoPesagemItem,
} from "../lib/residuosPesagem";

function mergeFormResiduosLinhas(
  prev: FormRegistro,
  linhas: ResiduoPesagemItem[]
): FormRegistro {
  return { ...prev, residuos_linhas: linhas, ...linhasParaFormLegacy(linhas) };
}

/** Busca insensível`
  );
}

const catalogLabel = "Resíduo (catálogo)</label>";
const idx = s.indexOf(catalogLabel);
if (idx >= 0 && !s.includes("<PesagemResiduosLista")) {
  const start = s.lastIndexOf('<motionlessDiv style={{ gridColumn: "span 4" }}', idx);
  const start2 = s.lastIndexOf('<div style={{ gridColumn: "span 4" }} className="field">', idx);
  const blockStart = start2 >= 0 ? start2 : start;
  const pesoIdx = s.indexOf("Peso tara (kg)</label>", idx);
  const pesoDiv = s.lastIndexOf('<div style={{ gridColumn: "span 4" }} className="field">', pesoIdx);
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
  s = s.slice(0, blockStart) + replacement + s.slice(pesoDiv);
}

fs.writeFileSync(p, s);
console.log("nexus patched");
