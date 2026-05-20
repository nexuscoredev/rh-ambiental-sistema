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
