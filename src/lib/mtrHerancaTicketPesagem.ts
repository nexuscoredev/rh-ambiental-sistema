import {
  listaResiduosParaDocumentoMtr,
  residuoDetalhesVazio,
  type MtrResiduoDetalhesCampos,
} from "./mtrClienteContratoAutofill";
import { MTR_TEXTO_VIDE_FICHA } from "./mtrPrintTexto";
import { supabase } from "./supabase";
import {
  linhaVaziaResiduoPesagem,
  linhasComConteudo,
  parseResiduosFromRow,
  parseResiduosItensJson,
  SEPARADOR_RESIDUOS_TEXTO,
  type ResiduoPesagemItem,
} from "./residuosPesagem";

export type MtrHerancaPesagem = {
  placa: string;
  motorista: string;
  tipo_residuo: string;
  linhas_residuo: ResiduoPesagemItem[];
  programacao_id: string | null;
  tipo_caminhao: string;
};

const MTR_SELECT_HERANCA =
  "id, tipo_residuo, detalhes, programacao_id, quantidade, unidade";

function parseDetalhesTransportador(detalhes: unknown): { placa: string; motorista: string } {
  if (!detalhes || typeof detalhes !== "object") {
    return { placa: "", motorista: "" };
  }
  const tr = (detalhes as Record<string, unknown>).transportador;
  if (!tr || typeof tr !== "object") {
    return { placa: "", motorista: "" };
  }
  const t = tr as Record<string, unknown>;
  return {
    placa: String(t.placa ?? "").trim(),
    motorista: String(t.motorista ?? "").trim(),
  };
}

function residuoCamposFromDetalhes(det: Record<string, unknown>): MtrResiduoDetalhesCampos {
  const r = det.residuo;
  if (!r || typeof r !== "object") return residuoDetalhesVazio();
  const o = r as Record<string, unknown>;
  return {
    fonte_origem: String(o.fonte_origem ?? "").trim() || "Industrial",
    caracterizacao: String(o.caracterizacao ?? "").trim(),
    estado_fisico: String(o.estado_fisico ?? "").trim() || "SÓLIDO",
    acondicionamento: String(o.acondicionamento ?? "").trim(),
    quantidade_aproximada: String(o.quantidade_aproximada ?? "").trim(),
    onu: String(o.onu ?? "").trim(),
  };
}

/** Texto de uma linha da MTR para o campo «tipo de resíduo» do ticket. */
export function textoLinhaPesagemFromMtrResiduo(l: MtrResiduoDetalhesCampos): string {
  const t = l.caracterizacao.trim();
  const c = l.estado_fisico.trim();
  if (t && c && !t.toLowerCase().includes(c.toLowerCase())) return `${t} — ${c}`;
  return t || c;
}

function linhasPesagemFromListaMtr(
  det: Record<string, unknown>,
  tipoResiduoTopo: string
): ResiduoPesagemItem[] {
  const lista = listaResiduosParaDocumentoMtr(
    {
      residuo: residuoCamposFromDetalhes(det),
      residuos_lista: Array.isArray(det.residuos_lista)
        ? (det.residuos_lista as MtrResiduoDetalhesCampos[])
        : undefined,
      residuos_itens: parseResiduosItensJson(det.residuos_itens) ?? undefined,
    },
    tipoResiduoTopo
  );

  const linhas = lista
    .map((l) => ({
      ...linhaVaziaResiduoPesagem(),
      texto: textoLinhaPesagemFromMtrResiduo(l),
    }))
    .filter((l) => l.texto.trim());

  return linhas.length > 0 ? linhas : [linhaVaziaResiduoPesagem()];
}

function textoResiduoPrincipalMtr(row: {
  tipo_residuo?: string | null;
  detalhes?: unknown;
}): string {
  const tipo = String(row.tipo_residuo ?? "").trim();
  if (tipo) return tipo;

  const linhas = linhasResiduoFromMtrRow(row);
  const textos = linhasComConteudo(linhas).map((l) => l.texto.trim()).filter(Boolean);
  if (textos.length > 1) return textos.join(SEPARADOR_RESIDUOS_TEXTO);
  if (textos.length === 1) return textos[0];
  return "";
}

function linhasResiduoFromMtrRow(row: {
  tipo_residuo?: string | null;
  detalhes?: unknown;
}): ResiduoPesagemItem[] {
  const tipoTopo = String(row.tipo_residuo ?? "").trim();

  if (row.detalhes && typeof row.detalhes === "object") {
    const det = row.detalhes as Record<string, unknown>;

    const fromJson = parseResiduosItensJson(det.residuos_itens);
    if (fromJson && linhasComConteudo(fromJson).length > 0) return fromJson;

    const fromLista = linhasPesagemFromListaMtr(det, tipoTopo);
    if (linhasComConteudo(fromLista).length > 0) return fromLista;

    const blocos = det.blocos;
    if (blocos && typeof blocos === "object") {
      const desc = String(
        (blocos as Record<string, unknown>).descricoes_adicionais_residuos ?? ""
      ).trim();
      if (desc && desc !== MTR_TEXTO_VIDE_FICHA) {
        return parseResiduosFromRow({ tipo_residuo: desc });
      }
    }
  }

  return parseResiduosFromRow({ tipo_residuo: tipoTopo || textoResiduoPrincipalMtr(row) });
}

/** Extrai placa, motorista, resíduos e tipo de caminhão a partir de uma linha `mtrs`. */
export function extrairHerancaMtrParaPesagem(
  mtr: Record<string, unknown>,
  tipoCaminhao?: string | null
): MtrHerancaPesagem {
  const { placa, motorista } = parseDetalhesTransportador(mtr.detalhes);
  const tipo_residuo = textoResiduoPrincipalMtr(mtr);
  const linhas_residuo = linhasResiduoFromMtrRow(mtr);

  return {
    placa,
    motorista,
    tipo_residuo,
    linhas_residuo,
    programacao_id:
      mtr.programacao_id != null && String(mtr.programacao_id).trim() !== ""
        ? String(mtr.programacao_id)
        : null,
    tipo_caminhao: (tipoCaminhao ?? "").trim(),
  };
}

/**
 * Texto e estrutura vêm da MTR; pesos já lançados na coleta são preservados por linha.
 */
export function mesclarLinhasResiduoHerancaMtr(
  linhasColeta: ResiduoPesagemItem[],
  linhasMtr: ResiduoPesagemItem[]
): ResiduoPesagemItem[] {
  const mtrCom = linhasComConteudo(linhasMtr);
  if (mtrCom.length === 0) return linhasColeta;

  return mtrCom.map((ml, i) => {
    const cl = linhasColeta[i] ?? linhasColeta[0];
    if (!cl) return ml;
    return {
      ...ml,
      peso_tara: cl.peso_tara.trim() ? cl.peso_tara : ml.peso_tara,
      peso_bruto: cl.peso_bruto.trim() ? cl.peso_bruto : ml.peso_bruto,
      peso_liquido: cl.peso_liquido.trim() ? cl.peso_liquido : ml.peso_liquido,
    };
  });
}

export function aplicarHerancaMtrEmCamposPesagem(
  coleta: { placa: string; motorista: string },
  heranca: MtrHerancaPesagem
): { placa: string; motorista: string } {
  return {
    placa: heranca.placa.trim() || coleta.placa.trim(),
    motorista: heranca.motorista.trim() || coleta.motorista.trim(),
  };
}

/** Busca MTR + programação e devolve dados para preencher pesagem/ticket. */
export async function buscarMtrHerancaPesagem(
  mtrId: string
): Promise<MtrHerancaPesagem | null> {
  const { data, error } = await supabase
    .from("mtrs")
    .select(MTR_SELECT_HERANCA)
    .eq("id", mtrId)
    .maybeSingle();

  if (error || !data) return null;

  let tipoCaminhao = "";
  const progId = (data as { programacao_id?: string | null }).programacao_id;
  if (progId) {
    const { data: prog } = await supabase
      .from("programacoes")
      .select("tipo_caminhao")
      .eq("id", progId)
      .maybeSingle();
    tipoCaminhao = String(prog?.tipo_caminhao ?? "").trim();
  }

  return extrairHerancaMtrParaPesagem(data as Record<string, unknown>, tipoCaminhao);
}

export function linhasResiduoHerancaOuColeta(
  linhasColeta: ResiduoPesagemItem[],
  heranca: MtrHerancaPesagem | null
): ResiduoPesagemItem[] {
  if (!heranca) return linhasColeta;
  const mescladas = mesclarLinhasResiduoHerancaMtr(linhasColeta, heranca.linhas_residuo);
  return mescladas.length > 0 ? mescladas : [linhaVaziaResiduoPesagem()];
}
