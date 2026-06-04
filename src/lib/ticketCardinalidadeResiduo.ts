import { numeroTicketFromMtr } from "./numeroTicketMtr";
import {
  linhasComConteudo,
  parseResiduosFromRow,
  type ResiduoPesagemItem,
} from "./residuosPesagem";

/** Cada ticket operacional representa exatamente um resíduo. */
export const MAX_RESIDUOS_POR_TICKET = 1;

export function chaveResiduoTicket(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Vários resíduos na pesagem com MTR → um ticket (coleta) por linha. */
export function deveSegmentarTicketsPorMtr(
  mtrId: string | null | undefined,
  linhas: ResiduoPesagemItem[]
): boolean {
  if (!String(mtrId ?? "").trim()) return false;
  return linhasComConteudo(linhas).length > MAX_RESIDUOS_POR_TICKET;
}

export function segmentosResiduoParaTickets(
  linhas: ResiduoPesagemItem[]
): ResiduoPesagemItem[] {
  return linhasComConteudo(linhas);
}

/** Número do ticket por segmento (usa sufixo da MTR quando informado). */
export function numeroTicketParaSegmento(
  numeroMtr: string,
  indiceSegmento: number,
  totalSegmentos: number,
  numeroBaseLegado?: string
): string {
  const mtr = numeroMtr.trim();
  if (mtr) {
    return numeroTicketFromMtr(mtr, indiceSegmento, totalSegmentos);
  }
  const base = (numeroBaseLegado ?? "").trim();
  if (totalSegmentos <= 1 || !base) return base;
  return `${base}-${indiceSegmento + 1}`;
}

export function coletaCorrespondeResiduo(
  coleta: {
    tipo_residuo?: string | null;
    residuos_itens?: ResiduoPesagemItem[] | null;
  },
  textoResiduo: string
): boolean {
  const alvo = chaveResiduoTicket(textoResiduo);
  if (!alvo) return false;

  if (chaveResiduoTicket(String(coleta.tipo_residuo ?? "")) === alvo) return true;

  const itens =
    coleta.residuos_itens ??
    parseResiduosFromRow({ tipo_residuo: coleta.tipo_residuo ?? "" });
  return linhasComConteudo(itens).some((l) => chaveResiduoTicket(l.texto) === alvo);
}

export type ColetaComResiduoTicket = {
  id: string;
  numero?: string | null;
  tipo_residuo?: string | null;
  residuos_itens?: ResiduoPesagemItem[] | null;
};

/** Índice do sufixo «-1», «-2» no número do ticket (1 se não houver sufixo). */
export function indiceSufixoNumeroTicket(numeroTicket: string | null | undefined): number {
  const n = (numeroTicket ?? "").trim();
  if (!n) return 9999;
  const m = /-(\d+)$/.exec(n);
  if (m) {
    const i = Number(m[1]);
    return Number.isFinite(i) && i > 0 ? i : 9999;
  }
  return 1;
}

/**
 * Ordem canónica dos tickets: mesma das linhas de resíduo (1.ª linha = Ticket 1).
 * Coletas sem linha correspondente vão ao final.
 */
export function ordenarColetasPorLinhasResiduo<T extends ColetaComResiduoTicket>(
  coletas: T[],
  linhas: Array<{ texto: string }>
): T[] {
  const usadas = new Set<string>();
  const ordenadas: T[] = [];
  for (const linha of linhas) {
    const texto = linha.texto.trim();
    if (!texto) continue;
    const c = coletas.find(
      (x) => !usadas.has(x.id) && coletaCorrespondeResiduo(x, texto)
    );
    if (c) {
      usadas.add(c.id);
      ordenadas.push(c);
    }
  }
  for (const c of coletas) {
    if (!usadas.has(c.id)) ordenadas.push(c);
  }
  return ordenadas;
}

/** Ordem de exibição/impressão: linhas de resíduo → sufixo do ticket → n.º da coleta. */
export function ordenarColetasParaTickets<T extends ColetaComResiduoTicket>(
  coletas: T[],
  opts: {
    linhasResiduo: Array<{ texto: string }>;
    numeroTicketPorColeta?: Map<string, string>;
  }
): T[] {
  const linhas = linhasComConteudo(
    opts.linhasResiduo as ResiduoPesagemItem[]
  );
  if (linhas.length >= 2) {
    return ordenarColetasPorLinhasResiduo(coletas, linhas);
  }

  const comNumero = coletas.filter((c) =>
    (opts.numeroTicketPorColeta?.get(c.id) ?? "").trim()
  );
  if (comNumero.length >= 2) {
    return [...coletas].sort((a, b) => {
      const ia = indiceSufixoNumeroTicket(opts.numeroTicketPorColeta?.get(a.id));
      const ib = indiceSufixoNumeroTicket(opts.numeroTicketPorColeta?.get(b.id));
      if (ia !== ib) return ia - ib;
      return String(a.numero ?? "").localeCompare(String(b.numero ?? ""), "pt-BR", {
        numeric: true,
      });
    });
  }

  return [...coletas].sort((a, b) =>
    String(a.numero ?? "").localeCompare(String(b.numero ?? ""), "pt-BR", {
      numeric: true,
    })
  );
}

/** Resolve coleta para uma linha de resíduo sem reutilizar a mesma coleta em outro ticket. */
export function resolverColetaIdParaLinhaResiduo(
  coletas: ColetaComResiduoTicket[],
  textoResiduo: string,
  coletasUsadas: Set<string>,
  opts?: { coletaPreferida?: ColetaComResiduoTicket | null }
): string {
  const pref = opts?.coletaPreferida;
  if (pref && !coletasUsadas.has(pref.id) && coletaCorrespondeResiduo(pref, textoResiduo)) {
    return pref.id;
  }

  const existente = coletas.find(
    (c) => !coletasUsadas.has(c.id) && coletaCorrespondeResiduo(c, textoResiduo)
  );
  return existente?.id ?? "";
}
