import type { ResiduoCatalogo } from "./residuosCatalogo";

/** Valor sentinela no `<select>` — não existe em `residuos` (não gravar como FK). */
export const RESIDUO_CATALOGO_ID_OUTROS_URBANOS = "__outros_residuos_urbanos__";

export const TEXTO_RESIDUO_OUTROS_URBANOS_PADRAO =
  "Outros resíduos urbanos não recicláveis (Classe II A), conforme legislação municipal/estadual aplicável.";

/** Separador em `tipo_residuo` / `residuo` quando há vários itens sem JSON estruturado. */
export const SEPARADOR_RESIDUOS_TEXTO = " · ";

export type ResiduoPesagemItem = {
  /** UUID do catálogo, sentinela «outros urbanos» ou vazio. */
  catalogo_id: string;
  texto: string;
  peso_tara: string;
  peso_bruto: string;
  peso_liquido: string;
};

export type ResiduoPesagemItemDb = {
  catalogo_id: string | null;
  texto: string;
  peso_tara: number | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
};

function converterNumeroPeso(valor: string): number | null {
  const texto = (valor ?? "").trim().replace(",", ".");
  if (texto === "") return null;
  const numero = Number(texto);
  return Number.isNaN(numero) ? null : numero;
}

export function calcularPesoLiquidoLinha(pesoBruto: string, pesoTara: string): string {
  const bruto = converterNumeroPeso(pesoBruto);
  const tara = converterNumeroPeso(pesoTara);
  if (bruto === null || tara === null) return "";
  return String(bruto - tara);
}

function pesoNumeroParaInput(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "";
  return String(n);
}

export function residuoCatalogoIdParaDb(raw: string): string | null {
  const t = (raw ?? "").trim();
  if (!t || t === RESIDUO_CATALOGO_ID_OUTROS_URBANOS) return null;
  return t;
}

export function linhaVaziaResiduoPesagem(): ResiduoPesagemItem {
  return { catalogo_id: "", texto: "", peso_tara: "", peso_bruto: "", peso_liquido: "" };
}

function normalizarItemJson(raw: unknown): ResiduoPesagemItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const texto = String(o.texto ?? "").trim();
  const catRaw = o.catalogo_id;
  const catalogo_id =
    catRaw != null && String(catRaw).trim() !== "" ? String(catRaw) : "";
  const peso_tara = pesoNumeroParaInput(
    o.peso_tara != null ? Number(o.peso_tara) : null
  );
  const peso_bruto = pesoNumeroParaInput(
    o.peso_bruto != null ? Number(o.peso_bruto) : null
  );
  const peso_liquido =
    o.peso_liquido != null && String(o.peso_liquido).trim() !== ""
      ? pesoNumeroParaInput(Number(o.peso_liquido))
      : calcularPesoLiquidoLinha(peso_bruto, peso_tara);
  if (!texto && !catalogo_id) return null;
  return { catalogo_id, texto, peso_tara, peso_bruto, peso_liquido };
}

export function parseResiduosItensJson(raw: unknown): ResiduoPesagemItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const itens = raw.map(normalizarItemJson).filter((x): x is ResiduoPesagemItem => x != null);
  return itens.length > 0 ? itens : null;
}

export function parseResiduosFromRow(row: {
  residuos_itens?: unknown;
  tipo_residuo?: string | null;
  residuo?: string | null;
  residuo_catalogo_id?: string | null;
}): ResiduoPesagemItem[] {
  const fromJson = parseResiduosItensJson(row.residuos_itens);
  if (fromJson) return fromJson;

  const texto = String(row.tipo_residuo ?? row.residuo ?? "").trim();
  const catId =
    row.residuo_catalogo_id != null && String(row.residuo_catalogo_id).trim() !== ""
      ? String(row.residuo_catalogo_id)
      : "";

  if (!texto && !catId) return [linhaVaziaResiduoPesagem()];

  if (texto.includes(SEPARADOR_RESIDUOS_TEXTO)) {
    const partes = texto.split(SEPARADOR_RESIDUOS_TEXTO).map((p) => p.trim()).filter(Boolean);
    if (partes.length > 1) {
      return partes.map((p) => ({ ...linhaVaziaResiduoPesagem(), texto: p }));
    }
  }

  return [{ ...linhaVaziaResiduoPesagem(), catalogo_id: catId, texto }];
}

/** Soma os pesos das linhas para gravar totais na coleta / ticket. */
export function agregarPesosDasLinhas(linhas: ResiduoPesagemItem[]): {
  peso_tara: string;
  peso_bruto: string;
  peso_liquido: string;
  pesoTaraNum: number | null;
  pesoBrutoNum: number | null;
  pesoLiquidoNum: number | null;
} {
  const com = linhasComConteudo(linhas);
  if (com.length === 0) {
    return {
      peso_tara: "",
      peso_bruto: "",
      peso_liquido: "",
      pesoTaraNum: null,
      pesoBrutoNum: null,
      pesoLiquidoNum: null,
    };
  }

  let sumTara = 0;
  let sumBruto = 0;
  let sumLiquido = 0;

  for (const l of com) {
    const t = converterNumeroPeso(l.peso_tara);
    const b = converterNumeroPeso(l.peso_bruto);
    const liqStr = l.peso_liquido.trim() || calcularPesoLiquidoLinha(l.peso_bruto, l.peso_tara);
    const liq = converterNumeroPeso(liqStr);
    if (t != null) sumTara += t;
    if (b != null) sumBruto += b;
    if (liq != null) sumLiquido += liq;
  }

  return {
    peso_tara: String(sumTara),
    peso_bruto: String(sumBruto),
    peso_liquido: String(sumLiquido),
    pesoTaraNum: sumTara,
    pesoBrutoNum: sumBruto,
    pesoLiquidoNum: sumLiquido,
  };
}

export function validarPesosResiduosLinhas(linhas: ResiduoPesagemItem[]): string | null {
  const com = linhasComConteudo(linhas);
  if (com.length === 0) return null;

  for (let i = 0; i < com.length; i++) {
    const l = com[i]!;
    const n = i + 1;
    if (converterNumeroPeso(l.peso_tara) === null) {
      return `Preencha o peso tara do resíduo ${n}.`;
    }
    if (converterNumeroPeso(l.peso_bruto) === null) {
      return `Preencha o peso bruto do resíduo ${n}.`;
    }
    const liq =
      l.peso_liquido.trim() || calcularPesoLiquidoLinha(l.peso_bruto, l.peso_tara);
    if (!liq || converterNumeroPeso(liq) === null) {
      return `Não foi possível calcular o peso líquido do resíduo ${n}.`;
    }
  }
  return null;
}

/** Preenche pesos da coleta na primeira linha quando o JSON antigo não tinha peso por item. */
export function aplicarPesosColetaNasLinhas(
  linhas: ResiduoPesagemItem[],
  pesos: { peso_tara?: number | null; peso_bruto?: number | null; peso_liquido?: number | null }
): ResiduoPesagemItem[] {
  const temPesoNasLinhas = linhas.some(
    (l) => l.peso_tara.trim() || l.peso_bruto.trim() || l.peso_liquido.trim()
  );
  if (temPesoNasLinhas || linhas.length === 0) return linhas;

  const tara = pesoNumeroParaInput(pesos.peso_tara ?? null);
  const bruto = pesoNumeroParaInput(pesos.peso_bruto ?? null);
  const liquido =
    pesoNumeroParaInput(pesos.peso_liquido ?? null) ||
    calcularPesoLiquidoLinha(bruto, tara);

  return linhas.map((l, i) =>
    i === 0 ? { ...l, peso_tara: tara, peso_bruto: bruto, peso_liquido: liquido } : l
  );
}

export function combinarResiduosTexto(itens: ResiduoPesagemItem[]): string {
  return itens
    .map((i) => i.texto.trim())
    .filter(Boolean)
    .join(SEPARADOR_RESIDUOS_TEXTO);
}

export function catalogoIdPrincipal(itens: ResiduoPesagemItem[]): string | null {
  const ids = itens
    .map((i) => residuoCatalogoIdParaDb(i.catalogo_id))
    .filter((id): id is string => Boolean(id));
  if (ids.length === 1) return ids[0];
  return null;
}

export function enriquecerLinhaResiduo(
  linha: ResiduoPesagemItem,
  catalogoPorId: Map<string, ResiduoCatalogo>
): ResiduoPesagemItem {
  const textoManual = linha.texto.trim();
  if (textoManual) return { ...linha, texto: textoManual };

  const dbId = residuoCatalogoIdParaDb(linha.catalogo_id);
  if (dbId) {
    const r = catalogoPorId.get(dbId);
    if (r) return { ...linha, texto: `${r.codigo} — ${r.nome}` };
  }

  if (linha.catalogo_id === RESIDUO_CATALOGO_ID_OUTROS_URBANOS) {
    return { ...linha, texto: TEXTO_RESIDUO_OUTROS_URBANOS_PADRAO };
  }

  return linha;
}

export function linhasComConteudo(linhas: ResiduoPesagemItem[]): ResiduoPesagemItem[] {
  return linhas.filter((l) => l.texto.trim() || l.catalogo_id.trim());
}

export function serializarResiduosItensDb(
  linhas: ResiduoPesagemItem[],
  catalogoPorId: Map<string, ResiduoCatalogo>
): ResiduoPesagemItemDb[] {
  return linhasComConteudo(linhas)
    .map((l) => enriquecerLinhaResiduo(l, catalogoPorId))
    .filter((l) => l.texto.trim())
    .map((l) => {
      const tara = converterNumeroPeso(l.peso_tara);
      const bruto = converterNumeroPeso(l.peso_bruto);
      const liqStr = l.peso_liquido.trim() || calcularPesoLiquidoLinha(l.peso_bruto, l.peso_tara);
      const liquido = converterNumeroPeso(liqStr);
      return {
        catalogo_id: residuoCatalogoIdParaDb(l.catalogo_id),
        texto: l.texto.trim(),
        peso_tara: tara,
        peso_bruto: bruto,
        peso_liquido: liquido,
      };
    });
}

export function linhasParaFormLegacy(linhas: ResiduoPesagemItem[]): {
  residuo: string;
  residuo_catalogo_id: string;
} {
  const comConteudo = linhasComConteudo(linhas);
  const texto = combinarResiduosTexto(
    comConteudo.length > 0 ? comConteudo : linhas
  );
  const catPrincipal = catalogoIdPrincipal(comConteudo);
  const sentinela =
    comConteudo.length === 1 &&
    comConteudo[0]!.catalogo_id === RESIDUO_CATALOGO_ID_OUTROS_URBANOS;

  return {
    residuo: texto,
    residuo_catalogo_id:
      sentinela
        ? RESIDUO_CATALOGO_ID_OUTROS_URBANOS
        : comConteudo.length === 1
          ? comConteudo[0]!.catalogo_id
          : catPrincipal ?? "",
  };
}

export function resolverResiduosParaGravacao(
  linhas: ResiduoPesagemItem[],
  catalogoPorId: Map<string, ResiduoCatalogo>,
  fallbacks: { tipoResiduoColeta?: string; tipoResiduoMtr?: string }
): {
  texto: string;
  residuos_itens: ResiduoPesagemItemDb[];
  catalogo_id: string | null;
  erro: string | null;
} {
  const enriquecidas = linhasComConteudo(linhas).map((l) =>
    enriquecerLinhaResiduo(l, catalogoPorId)
  );
  const residuos_itens = serializarResiduosItensDb(linhas, catalogoPorId);
  const texto =
    combinarResiduosTexto(enriquecidas) ||
    (fallbacks.tipoResiduoColeta ?? "").trim() ||
    (fallbacks.tipoResiduoMtr ?? "").trim();

  if (!texto) {
    return {
      texto: "",
      residuos_itens: [],
      catalogo_id: null,
      erro:
        "Informe ao menos um resíduo (catálogo ou texto) ou use uma coleta/MTR com tipo de resíduo definido.",
    };
  }

  const erroPeso = validarPesosResiduosLinhas(linhas);

  return {
    texto,
    residuos_itens,
    catalogo_id: catalogoIdPrincipal(enriquecidas),
    erro: erroPeso,
  };
}

/** Compatível com rascunhos de sessão antigos (só `residuo` + `residuo_catalogo_id`). */
export function normalizarFormResiduosLinhas<
  T extends {
    residuo: string;
    residuo_catalogo_id: string;
    residuos_linhas?: ResiduoPesagemItem[];
  },
>(form: T): T {
  if (Array.isArray(form.residuos_linhas) && form.residuos_linhas.length > 0) {
    return { ...form, ...linhasParaFormLegacy(form.residuos_linhas) };
  }
  const linhas = parseResiduosFromRow({
    tipo_residuo: form.residuo,
    residuo_catalogo_id: form.residuo_catalogo_id || null,
  });
  return { ...form, residuos_linhas: linhas, ...linhasParaFormLegacy(linhas) };
}

/** Omite `residuos_itens` se a coluna ainda não existir no Supabase remoto. */
export function isErroColunaResiduosItens(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  const code = err.code ?? "";
  return (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("residuos_itens") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}
