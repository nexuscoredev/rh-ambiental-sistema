import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  TicketOperacionalPanel,
  type TicketColetaSnapshot,
} from "../components/TicketOperacionalPanel";
import {
  ControleMassaMtrPicker,
  type ResumoSelecaoMtr,
} from "../components/controleMassa/ControleMassaMtrPicker";
import { queryColetasListaFluxoControle } from "../lib/coletasSelectSeguimento";
import {
  buscarColetasPorIdsControleMassa,
  fetchColetaIdsComPesagemRecente,
  fetchTicketOperacionalPorColetaIds,
  fetchTipoCaminhaoPorProgramacaoIds,
  fetchUltimaPesagemPorColetaIds,
} from "../lib/controleMassaFetch";
import { obterProximoNumeroTicketOperacional } from "../lib/nextTicketOperacionalNumero";
import { isoDataHojeLocal } from "../lib/ticketOperacionalData";
import { waitForTicketPrintRoot } from "../lib/waitForTicketPrintRoot";
import { atualizarColetaAposPesagemControleMassa } from "../lib/controleMassaAtualizarColeta";
import { supabase } from "../lib/supabase";
import MainLayout from "../layouts/MainLayout";
import { rgConfirm } from "../lib/RgDialogProvider";
import {
  cargoEhOperadoresTimeR,
  cargoPerfilSomenteLancamentoTicketPadrao,
  cargoPodeLancarPesagem,
  cargoPodeExcluirTicketPesagem,
} from "../lib/workflowPermissions";
import { excluirColetaPorId } from "../lib/excluirOperacionalCascata";
import {
  type EtapaFluxo,
  formatarEtapaParaUI,
  formatarFaseFluxoOficialParaUI,
  normalizarEtapaColeta,
} from "../lib/fluxoEtapas";
import { useSessionObjectDraft } from "../lib/usePageSessionPersistence";
import { registrarTicketImpressoColeta } from "../lib/faturamentoTicketFluxo";
import { PesagemResiduosLista } from "../components/controleMassa/PesagemResiduosLista";
import {
  agregarPesosDasLinhas,
  aplicarPesosColetaNasLinhas,
  isErroColunaResiduosItens,
  linhaVaziaResiduoPesagem,
  linhasComConteudo,
  linhasParaFormLegacy,
  normalizarFormResiduosLinhas,
  parseResiduosFromRow,
  parseResiduosItensJson,
  residuoCatalogoIdParaDb,
  resolverResiduosParaGravacao,
  type ResiduoPesagemItem,
} from "../lib/residuosPesagem";
import type { ResiduoContratoItem } from "../lib/clienteContratoCadastro";
import {
  aplicarHerancaMtrEmCamposPesagem,
  buscarMtrHerancaPesagem,
  linhasResiduoHerancaOuColeta,
  type MtrHerancaPesagem,
} from "../lib/mtrHerancaTicketPesagem";
import {
  expandirLinhasPesagemComContrato,
  fetchContratoClientePorNomeEmpresa,
  residuoContratoTemConteudo,
} from "../lib/mtrClienteContratoAutofill";
import {
  coletaCorrespondeResiduo,
  deveSegmentarTicketsPorMtr,
  numeroTicketParaSegmento,
  segmentosResiduoParaTickets,
} from "../lib/ticketCardinalidadeResiduo";
import {
  numeroTicketFromMtr,
  podeGerarNumeroTicketFromMtr,
} from "../lib/numeroTicketMtr";

function preencherNumeroTicketNoForm(
  prev: FormRegistro,
  opts: {
    numeroMtr?: string | null;
    ticketExistenteColeta?: string | null;
    totalSegmentos?: number;
  }
): FormRegistro {
  const existente = (opts.ticketExistenteColeta ?? "").trim();
  if (existente) {
    return existente === prev.numero_ticket ? prev : { ...prev, numero_ticket: existente };
  }
  const mtr = (opts.numeroMtr ?? "").trim();
  if (!podeGerarNumeroTicketFromMtr(mtr)) return prev;
  const total =
    opts.totalSegmentos ??
    Math.max(1, linhasComConteudo(prev.residuos_linhas).length);
  const gerado = numeroTicketFromMtr(mtr, 0, total);
  if (!gerado || gerado === prev.numero_ticket) return prev;
  return { ...prev, numero_ticket: gerado };
}

function mergeFormResiduosLinhas(
  prev: FormRegistro,
  linhas: ResiduoPesagemItem[]
): FormRegistro {
  return {
    ...prev,
    residuos_linhas: linhas,
    ...linhasParaFormLegacy(linhas),
    ...agregarPesosDasLinhas(linhas),
  };
}

/** Busca insensível a maiúsculas e acentos (MTR / cliente / coleta). */
function normalizarTextoBusca(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

type ColetaOpcao = {
  id: string;
  numero: string;
  cliente: string;
  tipo_residuo: string;
  /** FK opcional para `public.residuos` (catálogo com código). */
  residuo_catalogo_id: string | null;
  placa: string;
  motorista: string;
  status: string;
  /** Etapa canônica (fluxo_status + etapa_operacional + legado). */
  etapaFluxo: EtapaFluxo;
  peso_tara: number | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
  mtr_id?: string | null;
  programacao_id?: string | null;
  cliente_id?: string | null;
  /** Para ordenar a lista (mais recente primeiro). */
  created_at?: string | null;
  residuos_itens?: ResiduoPesagemItem[] | null;
};

/** Campos mínimos da tabela `mtrs` para o vínculo na pesagem. */
type MtrResumo = {
  id: string;
  numero: string;
  cliente: string;
  tipo_residuo: string;
  status: string;
};

type FormRegistro = {
  coleta_id: string;
  numero_ticket: string;
  tipo_ticket: "entrada" | "saida" | "frete";
  descricao_ticket: string;
  data: string;
  empresa: string;
  residuo: string;
  residuo_catalogo_id: string;
  residuos_linhas: ResiduoPesagemItem[];
  placa: string;
  motorista: string;
  peso_tara: string;
  peso_bruto: string;
  peso_liquido: string;
  status: string;
};

const formInicial: FormRegistro = {
  coleta_id: "",
  numero_ticket: "",
  tipo_ticket: "saida",
  descricao_ticket: "",
  data: "",
  empresa: "",
  residuo: "",
  residuo_catalogo_id: "",
  residuos_linhas: [linhaVaziaResiduoPesagem()],
  placa: "",
  motorista: "",
  peso_tara: "",
  peso_bruto: "",
  peso_liquido: "",
  status: "Pendente",
};

const massaAcaoFinalCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: "16px",
  padding: "18px",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
};

const massaAcaoFinalTituloStyle: CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 800,
  color: "#0f172a",
};

const massaAcaoFinalDescStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: "13px",
  color: "#64748b",
  lineHeight: 1.45,
  fontWeight: 500,
};

const massaAcoesBarStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  alignItems: "stretch",
  minWidth: "min(100%, 320px)",
};

const massaAcoesLinhaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  justifyContent: "flex-end",
  alignItems: "center",
};

const massaBtnPrimarioStyle: CSSProperties = {
  height: "40px",
  padding: "0 16px",
  borderRadius: "12px",
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const massaBtnSecundarioStyle: CSSProperties = {
  height: "40px",
  padding: "0 14px",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const massaImpressaoGrupoStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  justifyContent: "flex-end",
  alignItems: "center",
  paddingTop: "10px",
  borderTop: "1px solid #f1f5f9",
};

const massaImpressaoLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "#94a3b8",
  marginRight: "auto",
};

function limparOuNull(valor: string) {
  const texto = valor.trim();
  return texto === "" ? null : texto;
}

function mapRowToColetaOpcao(item: Record<string, unknown>): ColetaOpcao {
  const etapaFluxo = normalizarEtapaColeta({
    fluxo_status: item.fluxo_status == null ? null : String(item.fluxo_status),
    etapa_operacional: item.etapa_operacional == null ? null : String(item.etapa_operacional),
  });
  return {
    id: String(item.id),
    numero: String(item.numero_coleta ?? item.numero ?? item.id ?? ""),
    cliente: String(item.cliente ?? item.nome_cliente ?? ""),
    tipo_residuo: String(item.tipo_residuo ?? item.residuo ?? ""),
    residuo_catalogo_id:
      item.residuo_catalogo_id != null && String(item.residuo_catalogo_id).trim() !== ""
        ? String(item.residuo_catalogo_id)
        : null,
    placa: String(item.placa ?? ""),
    motorista: String(item.motorista_nome ?? item.motorista ?? ""),
    status: String(item.status ?? item.status_processo ?? ""),
    etapaFluxo,
    peso_tara:
      item.peso_tara !== null && item.peso_tara !== undefined
        ? Number(item.peso_tara)
        : null,
    peso_bruto:
      item.peso_bruto !== null && item.peso_bruto !== undefined
        ? Number(item.peso_bruto)
        : null,
    peso_liquido:
      item.peso_liquido !== null && item.peso_liquido !== undefined
        ? Number(item.peso_liquido)
        : null,
    mtr_id: item.mtr_id != null ? String(item.mtr_id) : null,
    programacao_id: item.programacao_id != null ? String(item.programacao_id) : null,
    cliente_id: item.cliente_id != null ? String(item.cliente_id) : null,
    created_at: item.created_at != null ? String(item.created_at) : null,
    residuos_itens: parseResiduosItensJson(item.residuos_itens),
  };
}

function formatarHoraRelogio(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "—";
  const s = String(raw).trim();
  if (s.includes("T")) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
  }
  if (/^\d{1,2}:\d{2}/.test(s)) return s.length > 8 ? s.slice(0, 8) : s;
  return s;
}

function formatarDataIsoCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = iso.includes("T") ? iso.split("T")[0]! : iso;
  if (t.length >= 10) {
    const [y, m, d] = t.slice(0, 10).split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
  }
  return iso;
}

async function buscarColetasPorIds(ids: string[]): Promise<ColetaOpcao[]> {
  const rows = await buscarColetasPorIdsControleMassa(supabase, ids);
  return rows.map((row) => mapRowToColetaOpcao(row));
}

function formatarTipoTicketLista(raw: string | null | undefined): string {
  const r = (raw ?? "").trim().toLowerCase();
  if (r === "frete") return "Frete";
  if (r === "entrada") return "Entrada";
  if (r === "saida") return "Saída";
  return "—";
}

function mensagemErroTicketOperacionalDb(msg: string): string {
  const m = msg.trim();
  if (m.toLowerCase().includes("row-level security")) {
    return (
      "Sem permissão para gravar o ticket operacional neste perfil. " +
      "Peça ao administrador para executar no Supabase o ficheiro " +
      "supabase/sql_editor_tickets_operacionais_rls.sql (política RLS alinhada à pesagem)."
    );
  }
  return m;
}

/**
 * Cria ou atualiza o ticket operacional ligado à coleta após pesagem gravada,
 * para o painel poder imprimir de imediato.
 */
async function garantirTicketAposPesagem(params: {
  coletaId: string;
  numeroTicket: string;
  tipoTicket: "entrada" | "saida" | "frete";
  /** Observação opcional do formulário de pesagem; não duplica empresa/resíduo/peso. */
  descricaoExtra?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const descExtra = (params.descricaoExtra ?? "").trim();
  const descricao = descExtra || null;

  let numeroFinal = params.numeroTicket.trim();
  if (!numeroFinal) {
    const nx = await obterProximoNumeroTicketOperacional(supabase);
    if (!nx.ok) return { ok: false, message: nx.message };
    numeroFinal = nx.numero;
  }

  const { data: existentes, error: errSel } = await supabase
    .from("tickets_operacionais")
    .select("id")
    .eq("coleta_id", params.coletaId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (errSel) {
    return { ok: false, message: mensagemErroTicketOperacionalDb(errSel.message) };
  }

  const existente = existentes?.[0];

  if (existente?.id) {
    const { error } = await supabase
      .from("tickets_operacionais")
      .update({
        numero: numeroFinal || null,
        descricao,
        tipo_ticket: params.tipoTicket,
      })
      .eq("id", existente.id);

    if (error) return { ok: false, message: mensagemErroTicketOperacionalDb(error.message) };
    return { ok: true };
  }

  const { error } = await supabase.from("tickets_operacionais").insert({
    coleta_id: params.coletaId,
    numero: numeroFinal || null,
    descricao,
    tipo_ticket: params.tipoTicket,
    created_by: user?.id ?? null,
  });

  if (error) {
    const msg = error.message || "";
    const code = (error as { code?: string }).code;
    if (code === "23505" || msg.toLowerCase().includes("duplicate") || msg.includes("unique")) {
      const { data: retryRows, error: errRetry } = await supabase
        .from("tickets_operacionais")
        .select("id")
        .eq("coleta_id", params.coletaId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (errRetry || !retryRows?.[0]?.id) {
        return { ok: false, message: mensagemErroTicketOperacionalDb(error.message) };
      }
      const { error: upErr } = await supabase
        .from("tickets_operacionais")
        .update({
          numero: numeroFinal || null,
          descricao,
          tipo_ticket: params.tipoTicket,
        })
        .eq("id", retryRows[0].id);
      if (upErr) return { ok: false, message: mensagemErroTicketOperacionalDb(upErr.message) };
      return { ok: true };
    }
    return { ok: false, message: mensagemErroTicketOperacionalDb(error.message) };
  }

  return { ok: true };
}

/** Grava pesagem + ticket para uma coleta com um único resíduo (cardinalidade do ticket). */
async function persistirPesagemUmSegmento(params: {
  coletaId: string;
  numeroTicket: string;
  tipoTicket: "entrada" | "saida" | "frete";
  descricaoTicket: string;
  data: string;
  empresa: string;
  placa: string;
  motorista: string;
  linhaResiduo: ResiduoPesagemItem;
  tipoResiduoMtr: string;
  tipoResiduoColeta: string;
  status: string;
}): Promise<
  | { ok: true; ticketOk: boolean; filaConferenciaOk: boolean }
  | { ok: false; message: string }
> {
  const resolvido = resolverResiduosParaGravacao([params.linhaResiduo], {
    tipoResiduoColeta: params.tipoResiduoColeta,
    tipoResiduoMtr: params.tipoResiduoMtr,
  });

  if (resolvido.erro) {
    return { ok: false, message: resolvido.erro };
  }

  const agregado = agregarPesosDasLinhas([params.linhaResiduo]);
  const payloadCampos: Record<string, unknown> = {
    numero_ticket: params.numeroTicket.trim(),
    data: params.data,
    empresa: params.empresa,
    residuo: resolvido.texto,
    residuos_itens: resolvido.residuos_itens,
    placa: limparOuNull(params.placa),
    motorista: limparOuNull(params.motorista),
    peso_liquido: agregado.pesoLiquidoNum,
    status: params.status || "Pendente",
  };
  const payloadSemItens = { ...payloadCampos };
  delete payloadSemItens.residuos_itens;

  const { data: cmExistenteRows, error: errBuscaCm } = await supabase
    .from("controle_massa")
    .select("id")
    .eq("coleta_id", params.coletaId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (errBuscaCm) {
    return { ok: false, message: errBuscaCm.message };
  }

  const cmExistenteId = (cmExistenteRows?.[0] as { id?: string } | undefined)?.id;
  let error: { message: string; details?: string; code?: string } | null = null;

  if (cmExistenteId) {
    let upErr = (
      await supabase.from("controle_massa").update(payloadCampos).eq("id", cmExistenteId)
    ).error;
    if (isErroColunaResiduosItens(upErr)) {
      upErr = (
        await supabase.from("controle_massa").update(payloadSemItens).eq("id", cmExistenteId)
      ).error;
    }
    error = upErr;
  } else {
    let insCmErr = (
      await supabase.from("controle_massa").insert([
        { coleta_id: limparOuNull(params.coletaId), ...payloadCampos },
      ])
    ).error;
    if (isErroColunaResiduosItens(insCmErr)) {
      insCmErr = (
        await supabase.from("controle_massa").insert([
          { coleta_id: limparOuNull(params.coletaId), ...payloadSemItens },
        ])
      ).error;
    }
    error = insCmErr;
  }

  if (error) {
    const msg = error.message || "";
    const code = (error as { code?: string }).code;
    if (
      code === "23505" ||
      msg.includes("controle_massa_numero_ticket") ||
      (msg.toLowerCase().includes("duplicate") && msg.toLowerCase().includes("numero_ticket"))
    ) {
      return {
        ok: false,
        message:
          "Este número de ticket já está em uso. Use outro número ou atualize a pesagem na coleta correspondente.",
      };
    }
    return { ok: false, message: msg };
  }

  const ticketAuto = await garantirTicketAposPesagem({
    coletaId: params.coletaId,
    numeroTicket: params.numeroTicket,
    tipoTicket: params.tipoTicket,
    descricaoExtra: params.descricaoTicket,
  });

  const fluxoPosPesagem = ticketAuto.ok ? "TICKET_GERADO" : "CONTROLE_PESAGEM_LANCADO";

  const dataIso = params.data.trim().slice(0, 10)
  const resColeta = await atualizarColetaAposPesagemControleMassa(supabase, params.coletaId, {
    peso_tara: agregado.pesoTaraNum,
    peso_bruto: agregado.pesoBrutoNum,
    peso_liquido: agregado.pesoLiquidoNum,
    tipo_residuo: resolvido.texto,
    residuo_catalogo_id: resolvido.catalogo_id,
    residuos_itens: resolvido.residuos_itens,
    placa: limparOuNull(params.placa),
    motorista: limparOuNull(params.motorista),
    motorista_nome: limparOuNull(params.motorista),
    data_execucao: dataIso || null,
    data_agendada: dataIso || null,
    fluxo_status: fluxoPosPesagem,
    etapa_operacional: fluxoPosPesagem,
    status_processo: "EM_CONFERENCIA",
    liberado_financeiro: false,
  });

  if (!resColeta.ok) {
    return {
      ok: false,
      message: `Pesagem gravada, mas a coleta não foi atualizada no fluxo. ${resColeta.message}`,
    };
  }

  if (!ticketAuto.ok) {
    return { ok: true, ticketOk: false, filaConferenciaOk: false };
  }

  const resFila = await registrarTicketImpressoColeta(params.coletaId);
  if (!resFila.ok) {
    return { ok: false, message: resFila.message };
  }

  return { ok: true, ticketOk: true, filaConferenciaOk: true };
}

function coletaOpcaoParaTicketSnapshot(c: ColetaOpcao): TicketColetaSnapshot {
  return {
    id: c.id,
    numero: String(c.numero),
    cliente: c.cliente,
    etapaFluxo: c.etapaFluxo,
    mtr_id: c.mtr_id ?? null,
    programacao_id: c.programacao_id ?? null,
    cliente_id: c.cliente_id ?? null,
    placa: c.placa,
    motorista: c.motorista,
    tipo_residuo: c.tipo_residuo,
    peso_tara: c.peso_tara,
    peso_bruto: c.peso_bruto,
    peso_liquido: c.peso_liquido,
  };
}

function enriquecerTicketSnapshotComCampos(
  s: TicketColetaSnapshot,
  opts: {
    formColetaId: string;
    formPlaca: string;
    formMotorista: string;
    imprimindoColetaId: string | null;
    impressaoPesagem: { coletaId: string; motorista: string; placa: string } | null;
  }
): TicketColetaSnapshot {
  const imp = opts.impressaoPesagem;
  if (imp && imp.coletaId === s.id) {
    return {
      ...s,
      placa: imp.placa.trim() || s.placa,
      motorista: imp.motorista.trim() || s.motorista,
    };
  }
  const podeForm =
    opts.formColetaId === s.id && !opts.imprimindoColetaId;
  if (!podeForm) return s;
  const placa = opts.formPlaca.trim() || s.placa;
  const motorista = opts.formMotorista.trim() || s.motorista;
  if (placa === s.placa && motorista === s.motorista) return s;
  return { ...s, placa, motorista };
}

function resolverColetaContexto(
  coletas: ColetaOpcao[],
  ids: {
    coleta: string | null;
    mtr: string | null;
    programacao: string | null;
    cliente: string | null;
  }
): ColetaOpcao | null {
  if (ids.coleta) {
    const c = coletas.find((x) => x.id === ids.coleta);
    if (c) return c;
  }
  if (ids.mtr) {
    const c = coletas.find((x) => x.mtr_id && x.mtr_id === ids.mtr);
    if (c) return c;
  }
  if (ids.programacao) {
    const c = coletas.find((x) => x.programacao_id && x.programacao_id === ids.programacao);
    if (c) return c;
  }
  if (ids.cliente) {
    const c = coletas.find((x) => x.cliente_id && x.cliente_id === ids.cliente);
    if (c) return c;
  }
  return null;
}

function formatarNumero(valor?: number | null) {
  if (
    valor === null ||
    valor === undefined ||
    Number.isNaN(Number(valor)) ||
    Number(valor) === 0
  ) {
    return "-";
  }

  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Cria coleta vinculada à MTR quando ainda não existe (pesagem pode ser a primeira operação no fluxo).
 */
async function criarColetaVinculadaAMtr(
  mtrId: string,
  opts: {
    dataRef: string;
    pesoTara: number | null;
    pesoBruto: number | null;
    pesoLiquido: number | null;
    motorista: string;
    placa: string;
    residuoFallback: string;
    residuo_catalogo_id?: string | null;
    residuos_itens?: { catalogo_id: string | null; texto: string; peso_tara: number | null; peso_bruto: number | null; peso_liquido: number | null }[];
  }
): Promise<{ ok: true; coletaId: string } | { ok: false; message: string }> {
  const { data: mtr, error: errMtr } = await supabase
    .from("mtrs")
    .select("id, programacao_id, cliente, cidade, tipo_residuo, endereco")
    .eq("id", mtrId)
    .maybeSingle();

  if (errMtr || !mtr) {
    return { ok: false, message: "MTR não encontrada. Atualize a lista e tente de novo." };
  }

  const herancaMtr = await buscarMtrHerancaPesagem(mtrId);

  const m = mtr as Record<string, unknown>;
  let clienteId: string | null = null;
  let clienteNome = String(m.cliente ?? "");
  const progId = m.programacao_id != null ? String(m.programacao_id) : null;
  if (progId) {
    const { data: prog } = await supabase
      .from("programacoes")
      .select("cliente_id, cliente")
      .eq("id", progId)
      .maybeSingle();
    if (prog?.cliente_id) clienteId = String(prog.cliente_id);
    if (prog?.cliente) clienteNome = String(prog.cliente);
  }

  const { data: maxRow } = await supabase
    .from("coletas")
    .select("numero_coleta")
    .order("numero_coleta", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 90001;
  const rawMax = maxRow as { numero_coleta?: number } | null;
  if (
    rawMax &&
    typeof rawMax.numero_coleta === "number" &&
    !Number.isNaN(rawMax.numero_coleta)
  ) {
    nextNum = rawMax.numero_coleta + 1;
  }

  const dataAg =
    opts.dataRef.trim() || new Date().toISOString().slice(0, 10);
  const camposHeranca = herancaMtr
    ? aplicarHerancaMtrEmCamposPesagem(
        { placa: opts.placa, motorista: opts.motorista },
        herancaMtr
      )
    : { placa: opts.placa.trim(), motorista: opts.motorista.trim() };

  const tipoRes =
    opts.residuoFallback.trim() ||
    herancaMtr?.tipo_residuo.trim() ||
    String(m.tipo_residuo ?? "");

  const resCat = residuoCatalogoIdParaDb(String(opts.residuo_catalogo_id ?? ""));

  const row: Record<string, unknown> = {
    mtr_id: mtrId,
    programacao_id: progId ?? herancaMtr?.programacao_id ?? null,
    cliente_id: clienteId,
    cliente: clienteNome,
    cidade: String(m.cidade ?? ""),
    tipo_residuo: tipoRes || "—",
    residuo_catalogo_id: resCat,
    residuos_itens: opts.residuos_itens ?? [],
    endereco: String(m.endereco ?? "—"),
    responsavel_interno: "—",
    data_agendada: dataAg,
    data_programada: dataAg,
    numero: String(nextNum),
    numero_coleta: nextNum,
    fluxo_status: "BRUTO_REGISTRADO",
    etapa_operacional: "BRUTO_REGISTRADO",
    status_processo: "EM_CONFERENCIA",
    liberado_financeiro: false,
    motorista: camposHeranca.motorista.trim() || null,
    motorista_nome: camposHeranca.motorista.trim() || null,
    placa: camposHeranca.placa.trim() || null,
    peso_tara: opts.pesoTara,
    peso_bruto: opts.pesoBruto,
    peso_liquido: opts.pesoLiquido,
    assinatura_coletada: true,
    assinatura_no_local: true,
  };

  let ins = await supabase.from("coletas").insert([row]).select("id").single();
  if (isErroColunaResiduosItens(ins.error)) {
    const rowSemItens = { ...row };
    delete rowSemItens.residuos_itens;
    ins = await supabase.from("coletas").insert([rowSemItens]).select("id").single();
  }

  const insErr = ins.error;
  if (insErr || !ins.data?.id) {
    console.error(insErr);
    return {
      ok: false,
      message:
        insErr?.message ??
        "Não foi possível criar a coleta para esta MTR. Verifique permissões e campos obrigatórios no cadastro.",
    };
  }

  const coletaId = String(ins.data.id);

  if (progId) {
    await supabase.from("programacoes").update({ coleta_id: coletaId }).eq("id", progId);
  }

  return { ok: true, coletaId };
}

export default function ControleMassa() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlColetaId = searchParams.get("coleta");
  const urlMtrId = searchParams.get("mtr");
  const urlProgramacaoId = searchParams.get("programacao");
  const urlClienteId = searchParams.get("cliente");

  const prevContextoUrlKeyRef = useRef<string>("");
  const ultimoEnriquecimentoKeyRef = useRef<string>("");

  /** Todas as coletas (validação, URL e atualização no save). */
  const [todasColetas, setTodasColetas] = useState<ColetaOpcao[]>([]);
  const [mtrsLista, setMtrsLista] = useState<MtrResumo[]>([]);
  const [loadingVinculo, setLoadingVinculo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [imprimindoTicketColetaId, setImprimindoTicketColetaId] = useState<string | null>(null);
  /** Placa/motorista da última pesagem, carregados antes de `window.print()`. */
  const [camposImpressaoPesagem, setCamposImpressaoPesagem] = useState<{
    coletaId: string;
    motorista: string;
    placa: string;
  } | null>(null);
  /** Coletas do último save — mantém botões de impressão mesmo após atualizar o formulário. */
  const [coletasImpressaoSessao, setColetasImpressaoSessao] = useState<string[]>([]);
  const [secaoPesagemAberta, setSecaoPesagemAberta] = useState(true);
  const [modoTela, setModoTela] = useState<"operacao" | "auditoria">("operacao");
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const [filtroOperacao, setFiltroOperacao] = useState<"pendentes" | "hoje" | "todas">("pendentes");
  const [buscaColetasLista, setBuscaColetasLista] = useState("");
  const [tipoCaminhaoPorProgramacao, setTipoCaminhaoPorProgramacao] = useState<Record<string, string>>(
    {}
  );
  const [ultimaPesagemPorColeta, setUltimaPesagemPorColeta] = useState<
    Map<string, { data: string | null; hora_entrada: string | null; hora_saida: string | null }>
  >(() => new Map());
  const [tipoTicketPorColeta, setTipoTicketPorColeta] = useState<Map<string, string>>(() => new Map());
  const [numeroTicketPorColeta, setNumeroTicketPorColeta] = useState<Map<string, string>>(
    () => new Map()
  );
  const [sucesso, setSucesso] = useState("");
  const [erroTela, setErroTela] = useState("");
  const [form, setForm] = useState<FormRegistro>(formInicial);
  /** MTR escolhida no select quando ainda não existe coleta — mantém o valor visível no `<select>`. */
  const [mtrSemColetaSelecionado, setMtrSemColetaSelecionado] = useState<string | null>(null);
  /** Tipo de caminhão da programação da MTR selecionada (antes de existir coleta). */
  const [tipoVeiculoMtrSelecionada, setTipoVeiculoMtrSelecionada] = useState("");
  const [mtrPickerAberto, setMtrPickerAberto] = useState(false);
  const [filtroMtr, setFiltroMtr] = useState("");
  const mtrComboRef = useRef<HTMLDivElement | null>(null);
  const dataInputRef = useRef<HTMLInputElement | null>(null);
  const placaInputRef = useRef<HTMLInputElement | null>(null);
  const tipoTicketRef = useRef<HTMLSelectElement | null>(null);
  const [usuarioCargo, setUsuarioCargo] = useState<string | null>(null);
  const [usuarioNome, setUsuarioNome] = useState<string | null>(null);
  const [excluindoColetaId, setExcluindoColetaId] = useState<string | null>(null);
  const [residuosContratoCliente, setResiduosContratoCliente] = useState<ResiduoContratoItem[]>([]);

  const controleMassaDraft = useMemo(
    () => ({
      form,
      secaoPesagemAberta,
      tabelaAberta,
      filtroOperacao,
      buscaColetasLista,
      mtrSemColetaSelecionado,
      mtrPickerAberto,
      filtroMtr,
      sp: searchParams.toString(),
    }),
    [
      form,
      secaoPesagemAberta,
      tabelaAberta,
      filtroOperacao,
      buscaColetasLista,
      mtrSemColetaSelecionado,
      mtrPickerAberto,
      filtroMtr,
      searchParams,
    ]
  );

  useSessionObjectDraft({
    cacheKey: "controle-massa",
    data: controleMassaDraft,
    onRestore: (d) => {
      const f = normalizarFormResiduosLinhas(d.form);
      setForm({ ...f, ...agregarPesosDasLinhas(f.residuos_linhas) });
      setSecaoPesagemAberta(d.secaoPesagemAberta);
      setModoTela("operacao");
      setTabelaAberta(d.tabelaAberta);
      setFiltroOperacao(d.filtroOperacao);
      setBuscaColetasLista(d.buscaColetasLista);
      setMtrSemColetaSelecionado(d.mtrSemColetaSelecionado);
      setMtrPickerAberto(d.mtrPickerAberto);
      setFiltroMtr(d.filtroMtr);
      setSearchParams(new URLSearchParams(d.sp), { replace: true });
    },
  });

  const ehOperadoresTimeR = cargoEhOperadoresTimeR(usuarioCargo);
  const somenteTicketPadrao = cargoPerfilSomenteLancamentoTicketPadrao(usuarioCargo);
  const podeMutarMassa = cargoPodeLancarPesagem(usuarioCargo);
  const podeEditarOuExcluirColeta = cargoPodeExcluirTicketPesagem(
    usuarioCargo,
    usuarioNome,
  );

  const coletaSelecionada = useMemo(() => {
    const id = form.coleta_id.trim();
    if (!id) return null;
    return todasColetas.find((x) => x.id === id) ?? null;
  }, [form.coleta_id, todasColetas]);

  const mtrSelecionada = useMemo(() => {
    const id =
      mtrSemColetaSelecionado ||
      (coletaSelecionada?.mtr_id != null ? String(coletaSelecionada.mtr_id) : "");
    if (!id) return null;
    return mtrsLista.find((m) => m.id === id) ?? null;
  }, [mtrSemColetaSelecionado, coletaSelecionada, mtrsLista]);

  const qtdResiduosNoForm = useMemo(
    () => linhasComConteudo(form.residuos_linhas).length,
    [form.residuos_linhas]
  );

  const numeroTicketAutoMtr = useMemo(
    () => podeGerarNumeroTicketFromMtr(mtrSelecionada?.numero),
    [mtrSelecionada?.numero]
  );

  useEffect(() => {
    if (!ehOperadoresTimeR) return;
    setForm((prev) =>
      prev.tipo_ticket === "saida" ? prev : { ...prev, tipo_ticket: "saida" }
    );
  }, [ehOperadoresTimeR, form.coleta_id, mtrSemColetaSelecionado]);

  useEffect(() => {
    const mtrNo = mtrSelecionada?.numero;
    if (!mtrNo) return;
    const cid = form.coleta_id.trim();
    const ticketEx = cid ? numeroTicketPorColeta.get(cid) : undefined;
    setForm((prev) =>
      preencherNumeroTicketNoForm(prev, {
        numeroMtr: mtrNo,
        ticketExistenteColeta: ticketEx,
        totalSegmentos: Math.max(1, qtdResiduosNoForm),
      })
    );
  }, [
    mtrSelecionada?.numero,
    mtrSelecionada?.id,
    form.coleta_id,
    qtdResiduosNoForm,
    numeroTicketPorColeta,
  ]);

  const estadoFluxo = useMemo(() => {
    const id = form.coleta_id.trim();
    const temSelecao = Boolean(id || mtrSemColetaSelecionado);
    const temPesagem = id ? ultimaPesagemPorColeta.has(id) : false;
    const temTicket = id
      ? Boolean(tipoTicketPorColeta.get(id) || (numeroTicketPorColeta.get(id) ?? "").trim())
      : false;
    return { temSelecao, temPesagem, temTicket, prontoImprimir: temTicket };
  }, [
    form.coleta_id,
    mtrSemColetaSelecionado,
    ultimaPesagemPorColeta,
    tipoTicketPorColeta,
    numeroTicketPorColeta,
  ]);

  const coletaIdImpressaoUnica =
    form.coleta_id.trim() || coletasImpressaoSessao[0]?.trim() || "";
  const podeImprimirTicket = Boolean(
    coletaIdImpressaoUnica &&
      (coletasImpressaoSessao.includes(coletaIdImpressaoUnica) || estadoFluxo.prontoImprimir)
  );

  const ticketsSegmentoImpressao = useMemo(() => {
    const linhasForm = segmentosResiduoParaTickets(form.residuos_linhas);

    const mtrId =
      mtrSemColetaSelecionado ||
      (form.coleta_id.trim()
        ? todasColetas.find((c) => c.id === form.coleta_id.trim())?.mtr_id ?? null
        : null) ||
      (coletasImpressaoSessao[0]
        ? todasColetas.find((c) => c.id === coletasImpressaoSessao[0])?.mtr_id ?? null
        : null);

    type LinhaSeg = { texto: string; coletaIdFixo?: string };
    let linhas: LinhaSeg[] = linhasForm.map((l) => ({ texto: l.texto }));

    if (linhas.length < 2 && coletasImpressaoSessao.length >= 2) {
      linhas = coletasImpressaoSessao.map((id) => {
        const c = todasColetas.find((x) => x.id === id);
        return {
          texto: (c?.tipo_residuo ?? "").trim() || `Coleta ${id.slice(0, 8)}`,
          coletaIdFixo: id,
        };
      });
    }

    if (linhas.length < 2) return [];

    const mtrNum = mtrId
      ? (mtrsLista.find((m) => m.id === mtrId)?.numero ?? "").trim()
      : "";
    const coletasMtr = mtrId ? todasColetas.filter((c) => c.mtr_id === mtrId) : [];

    return linhas.map((linha, i) => {
      let coletaId = linha.coletaIdFixo?.trim() ?? "";

      if (!coletaId) {
        const coletaForm =
          i === 0 && form.coleta_id.trim()
            ? todasColetas.find((c) => c.id === form.coleta_id.trim())
            : undefined;
        if (coletaForm && coletaCorrespondeResiduo(coletaForm, linha.texto)) {
          coletaId = coletaForm.id;
        } else {
          const existente = coletasMtr.find((c) => coletaCorrespondeResiduo(c, linha.texto));
          if (existente) coletaId = existente.id;
        }
      }

      const numeroPrevisto =
        (coletaId ? numeroTicketPorColeta.get(coletaId) : undefined)?.trim() ||
        (mtrNum
          ? numeroTicketParaSegmento(mtrNum, i, linhas.length, form.numero_ticket)
          : "");

      const prontoImprimir = Boolean(
        coletaId &&
          (coletasImpressaoSessao.includes(coletaId) ||
            numeroTicketPorColeta.get(coletaId)?.trim() ||
            tipoTicketPorColeta.has(coletaId) ||
            ultimaPesagemPorColeta.has(coletaId))
      );

      return {
        indice: i + 1,
        texto: linha.texto,
        coletaId,
        numeroTicket: numeroPrevisto,
        prontoImprimir,
      };
    });
  }, [
    form.residuos_linhas,
    form.coleta_id,
    form.numero_ticket,
    mtrSemColetaSelecionado,
    mtrsLista,
    todasColetas,
    coletasImpressaoSessao,
    numeroTicketPorColeta,
    tipoTicketPorColeta,
    ultimaPesagemPorColeta,
  ]);

  const multiTicketImpressao = ticketsSegmentoImpressao.length >= 2;

  const listaOperacao = useMemo(() => {
    const hojeIso = new Date().toISOString().slice(0, 10);
    // base será definido mais abaixo via `coletasListaOrdenadas`; aqui usamos `todasColetas` como fallback
    const base = [...todasColetas].sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      if (tb !== ta) return tb - ta;
      return String(b.numero).localeCompare(String(a.numero), undefined, { numeric: true });
    });
    const pendentes = base.filter((c) => !ultimaPesagemPorColeta.has(c.id));
    const hoje = base.filter((c) => {
      const up = ultimaPesagemPorColeta.get(c.id);
      return up?.data === hojeIso;
    });
    if (filtroOperacao === "hoje") return hoje;
    if (filtroOperacao === "todas") return base;
    return pendentes;
  }, [todasColetas, ultimaPesagemPorColeta, filtroOperacao]);

  /** Evita 3 queries auxiliares em todas as 500 coletas — só no contexto visível. */
  const ENRIQUECIMENTO_MAX_COLETAS = 150;

  const coletasParaEnriquecer = useMemo(() => {
    const limitar = (arr: ColetaOpcao[]) => arr.slice(0, ENRIQUECIMENTO_MAX_COLETAS);
    const urlId = (urlColetaId ?? "").trim();
    if (urlId) {
      const c = todasColetas.find((x) => x.id === urlId);
      return c ? [c] : [];
    }
    if (secaoPesagemAberta) {
      const cid = form.coleta_id.trim();
      if (cid) {
        const alvo = todasColetas.find((c) => c.id === cid);
        if (!alvo) return [];
        const mid = (alvo.mtr_id ?? "").trim();
        if (mid) return limitar(todasColetas.filter((c) => c.mtr_id === mid));
        return [alvo];
      }
      const mid = (mtrSemColetaSelecionado ?? "").trim();
      if (mid) return limitar(todasColetas.filter((c) => c.mtr_id === mid));
      return [];
    }
    if (modoTela === "auditoria") return limitar(listaOperacao);
    return [];
  }, [
    urlColetaId,
    secaoPesagemAberta,
    form.coleta_id,
    mtrSemColetaSelecionado,
    todasColetas,
    modoTela,
    listaOperacao,
  ]);

  const enriquecimentoKey = useMemo(
    () => coletasParaEnriquecer.map((c) => c.id).sort().join("|"),
    [coletasParaEnriquecer]
  );

  const temParametrosContexto = !!(
    urlColetaId ||
    urlMtrId ||
    urlProgramacaoId ||
    urlClienteId
  );

  const itemContextoResolvido = useMemo(
    () =>
      resolverColetaContexto(todasColetas, {
        coleta: urlColetaId,
        mtr: urlMtrId,
        programacao: urlProgramacaoId,
        cliente: urlClienteId,
      }),
    [todasColetas, urlColetaId, urlMtrId, urlProgramacaoId, urlClienteId]
  );

  const coletaTicketSnapshot = useMemo((): TicketColetaSnapshot | null => {
    const enriquecer = (s: TicketColetaSnapshot) =>
      enriquecerTicketSnapshotComCampos(s, {
        formColetaId: form.coleta_id.trim(),
        formPlaca: form.placa,
        formMotorista: form.motorista,
        imprimindoColetaId: imprimindoTicketColetaId,
        impressaoPesagem: camposImpressaoPesagem,
      });

    const porId = (id: string) => {
      const c = todasColetas.find((x) => x.id === id);
      return c ? enriquecer(coletaOpcaoParaTicketSnapshot(c)) : null;
    };
    const formId = form.coleta_id.trim();
    if (formId) {
      const s = porId(formId);
      if (s) return s;
    }
    if (itemContextoResolvido) {
      return enriquecer(coletaOpcaoParaTicketSnapshot(itemContextoResolvido));
    }
    return null;
  }, [
    form.coleta_id,
    form.placa,
    form.motorista,
    todasColetas,
    itemContextoResolvido,
    imprimindoTicketColetaId,
    camposImpressaoPesagem,
  ]);

  const coletasTicketOpcoes = useMemo(
    () => todasColetas.map(coletaOpcaoParaTicketSnapshot),
    [todasColetas]
  );

  function limparContextoUrl() {
    setSearchParams({}, { replace: true });
    prevContextoUrlKeyRef.current = "";
  }

  async function imprimirTicketDaColeta(coletaId: string, rotulo: string) {
    if (!podeMutarMassa) {
      setErroTela(
        "Seu perfil não pode registar impressão do ticket. Apenas balanceiro ou administrador."
      );
      return;
    }
    if (!coletaId.trim()) {
      setErroTela(`Salve a pesagem antes de imprimir o ${rotulo}.`);
      return;
    }

    const numeroTicket =
      (form.coleta_id.trim() === coletaId
        ? form.numero_ticket
        : numeroTicketPorColeta.get(coletaId))?.trim() ?? "";
    const tipoRaw =
      (form.coleta_id.trim() === coletaId
        ? form.tipo_ticket
        : tipoTicketPorColeta.get(coletaId)) ?? "saida";
    const tipoTicket: "entrada" | "saida" | "frete" =
      tipoRaw === "frete" ? "frete" : tipoRaw === "entrada" ? "entrada" : "saida";

    const formJaEraColeta = form.coleta_id.trim() === coletaId;
    setForm((prev) => ({ ...prev, coleta_id: coletaId }));
    setCamposImpressaoPesagem(null);

    const { data: cmImpressao } = await supabase
      .from("controle_massa")
      .select("motorista, placa")
      .eq("coleta_id", coletaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const camposPesagem = {
      coletaId,
      motorista:
        String((cmImpressao as { motorista?: string | null } | null)?.motorista ?? "").trim() ||
        (formJaEraColeta ? form.motorista.trim() : ""),
      placa:
        String((cmImpressao as { placa?: string | null } | null)?.placa ?? "").trim() ||
        (formJaEraColeta ? form.placa.trim() : ""),
    };
    setCamposImpressaoPesagem(camposPesagem);
    setImprimindoTicketColetaId(coletaId);

    const gt = await garantirTicketAposPesagem({
      coletaId,
      numeroTicket,
      tipoTicket,
      descricaoExtra:
        form.coleta_id.trim() === coletaId ? form.descricao_ticket || null : null,
    });
    if (!gt.ok) {
      setErroTela(gt.message);
      setSucesso("");
      setImprimindoTicketColetaId(null);
      setCamposImpressaoPesagem(null);
      return;
    }

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const pronto = await waitForTicketPrintRoot({ timeoutMs: 6000 });
    if (!pronto) {
      setErroTela(
        "Não foi possível preparar o ticket para impressão. Aguarde um instante e tente de novo."
      );
      setSucesso("");
      setImprimindoTicketColetaId(null);
      setCamposImpressaoPesagem(null);
      return;
    }

    const res = await registrarTicketImpressoColeta(coletaId);
    if (!res.ok) {
      setErroTela(res.message);
      setSucesso("");
      setImprimindoTicketColetaId(null);
      setCamposImpressaoPesagem(null);
      return;
    }

    setErroTela("");
    setSucesso(`${rotulo} enviado para impressão.`);
    setTimeout(() => setSucesso(""), 5000);
    window.print();
    setImprimindoTicketColetaId(null);
    setCamposImpressaoPesagem(null);
  }

  function montarParamsFluxo(c: ColetaOpcao) {
    const p = new URLSearchParams();
    p.set("coleta", c.id);
    if (c.mtr_id) p.set("mtr", c.mtr_id);
    if (c.programacao_id) p.set("programacao", c.programacao_id);
    if (c.cliente_id) p.set("cliente", c.cliente_id);
    return p;
  }

  function irProgramacao(c: ColetaOpcao) {
    navigate(`/programacao?${montarParamsFluxo(c).toString()}`);
  }
  function irMtr(c: ColetaOpcao) {
    navigate(`/mtr?${montarParamsFluxo(c).toString()}`);
  }

  const enriquecerListaColetas = useCallback(async (merged: ColetaOpcao[]) => {
    const coletaIds = merged.map((c) => c.id);
    const progIds = [...new Set(merged.map((c) => c.programacao_id).filter(Boolean))] as string[];
    const [tipoCam, ultima, ticketPorColeta] = await Promise.all([
      fetchTipoCaminhaoPorProgramacaoIds(supabase, progIds),
      fetchUltimaPesagemPorColetaIds(supabase, coletaIds),
      fetchTicketOperacionalPorColetaIds(supabase, coletaIds),
    ]);
    setTipoCaminhaoPorProgramacao(tipoCam);
    setUltimaPesagemPorColeta(ultima);
    setTipoTicketPorColeta(ticketPorColeta.tipoPorColeta);
    setNumeroTicketPorColeta(ticketPorColeta.numeroPorColeta);
  }, []);

  useEffect(() => {
    if (loadingVinculo || !enriquecimentoKey || coletasParaEnriquecer.length === 0) return;
    if (ultimoEnriquecimentoKeyRef.current === enriquecimentoKey) return;

    ultimoEnriquecimentoKeyRef.current = enriquecimentoKey;
    let cancelled = false;
    void (async () => {
      await enriquecerListaColetas(coletasParaEnriquecer);
      if (cancelled) ultimoEnriquecimentoKeyRef.current = "";
    })();
    return () => {
      cancelled = true;
    };
  }, [loadingVinculo, enriquecimentoKey, coletasParaEnriquecer, enriquecerListaColetas]);

  const fetchMtrsEColetas = useCallback(async (opts?: { silent?: boolean; extraColetaIds?: string[] }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoadingVinculo(true);
    ultimoEnriquecimentoKeyRef.current = "";

    try {
      const [mRes, cRes, idsMassa] = await Promise.all([
        supabase
          .from("mtrs")
          .select("id, numero, cliente, tipo_residuo, status, created_at")
          .order("created_at", { ascending: false })
          .limit(300),
        queryColetasListaFluxoControle(500),
        fetchColetaIdsComPesagemRecente(supabase),
      ]);

      if (mRes.error) {
        console.error("Erro ao buscar MTRs:", mRes.error);
        setMtrsLista([]);
      } else {
        const mrows = ((mRes.data as Record<string, unknown>[]) || []).map(
          (item) => ({
            id: String(item.id),
            numero: String(item.numero ?? ""),
            cliente: String(item.cliente ?? ""),
            tipo_residuo: String(item.tipo_residuo ?? ""),
            status: String(item.status ?? "Rascunho"),
          })
        );
        setMtrsLista(mrows);
      }

      let base: ColetaOpcao[] = [];
      if (cRes.error) {
        console.error("Erro ao buscar coletas (lista principal):", cRes.error);
      } else {
        base = ((cRes.data as Record<string, unknown>[]) || []).map((item) =>
          mapRowToColetaOpcao(item)
        );
      }

      const extrasParam = (opts?.extraColetaIds ?? []).filter(Boolean);
      const baseIds = new Set(base.map((c) => c.id));
      const faltando = [
        ...new Set([...idsMassa, ...extrasParam].filter((id) => id && !baseIds.has(id))),
      ] as string[];

      let merged = base;
      if (faltando.length > 0) {
        const porId = new Map(base.map((c) => [c.id, c]));
        const extraRows = await buscarColetasPorIds(faltando);
        for (const c of extraRows) {
          porId.set(c.id, c);
        }
        merged = Array.from(porId.values());
      }

      setTodasColetas(merged);
    } finally {
      setLoadingVinculo(false);
    }
  }, []);


  /** Atualiza só as coletas gravadas (evita recarregar 500+ coletas após salvar). */
  const atualizarColetasAposSalvar = useCallback(async (coletaIds: string[]) => {
    const ids = [...new Set(coletaIds.filter(Boolean))];
    if (ids.length === 0) return;

    const [extraRows, ultima, ticketPorColeta] = await Promise.all([
      buscarColetasPorIds(ids),
      fetchUltimaPesagemPorColetaIds(supabase, ids),
      fetchTicketOperacionalPorColetaIds(supabase, ids),
    ]);

    setTodasColetas((prev) => {
      const porId = new Map(prev.map((c) => [c.id, c]));
      for (const c of extraRows) porId.set(c.id, c);
      return Array.from(porId.values());
    });
    setUltimaPesagemPorColeta((prev) => new Map([...prev, ...ultima]));
    setTipoTicketPorColeta((prev) => new Map([...prev, ...ticketPorColeta.tipoPorColeta]));
    setNumeroTicketPorColeta((prev) => new Map([...prev, ...ticketPorColeta.numeroPorColeta]));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setLoadingVinculo(true);
      setErroTela("");
      const extraUrl = urlColetaId ? [urlColetaId] : [];
      void fetchMtrsEColetas({ silent: true, extraColetaIds: extraUrl });
    })
  }, [fetchMtrsEColetas, urlColetaId]);

  useEffect(() => {
    if (location.hash !== "#ticket-operacional-anchor") return;
    const t = window.setTimeout(() => {
      document.getElementById("ticket-operacional-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
    return () => window.clearTimeout(t);
  }, [location.hash, loadingVinculo]);

  /** Opções do passo 1: MTR (com ou sem coleta) e coletas filhas quando há vários tickets por MTR. */
  const opcoesMtrParaPesagem = useMemo(() => {
    const linhas: { mtr: MtrResumo; coleta: ColetaOpcao | null }[] = [];

    for (const m of mtrsLista) {
      if (m.status === "Cancelado") continue;
      const coletasMtr = todasColetas.filter((c) => c.mtr_id === m.id);
      if (coletasMtr.length === 0) {
        linhas.push({ mtr: m, coleta: null });
      } else if (coletasMtr.length === 1) {
        linhas.push({ mtr: m, coleta: coletasMtr[0]! });
      } else {
        linhas.push({ mtr: m, coleta: null });
        for (const c of coletasMtr) {
          linhas.push({ mtr: m, coleta: c });
        }
      }
    }

    linhas.sort((a, b) => {
      const na = a.mtr.numero;
      const nb = b.mtr.numero;
      if (na !== nb) return nb.localeCompare(na, "pt-BR", { numeric: true });
      if (!a.coleta && b.coleta) return -1;
      if (a.coleta && !b.coleta) return 1;
      return String(b.coleta?.numero ?? "").localeCompare(
        String(a.coleta?.numero ?? ""),
        "pt-BR",
        { numeric: true }
      );
    });

    return linhas;
  }, [mtrsLista, todasColetas]);

  /** Valor do `<select>`: id da MTR ou `coleta:uuid` para coleta sem MTR. */
  const valorSelectVinculo = useMemo(() => {
    if (!form.coleta_id.trim()) return "";
    const c = todasColetas.find((x) => x.id === form.coleta_id.trim());
    if (!c) return "";
    if (c.mtr_id) return c.mtr_id;
    return `coleta:${c.id}`;
  }, [form.coleta_id, todasColetas]);

  const valorSelectMtrExibido = mtrSemColetaSelecionado ?? valorSelectVinculo;

  const filtroMtrNorm = useMemo(
    () => normalizarTextoBusca(filtroMtr),
    [filtroMtr]
  );

  const opcoesMtrFiltradas = useMemo(() => {
    if (!filtroMtrNorm) return opcoesMtrParaPesagem;
    return opcoesMtrParaPesagem.filter(({ mtr, coleta }) => {
      const blob = [
        mtr.numero,
        mtr.cliente,
        mtr.tipo_residuo,
        mtr.status,
        coleta?.numero ?? "",
        coleta?.cliente ?? "",
        coleta ? formatarEtapaParaUI(coleta.etapaFluxo) : "",
        coleta?.placa ?? "",
        coleta?.motorista ?? "",
      ]
        .filter(Boolean)
        .join(" ");
      return normalizarTextoBusca(blob).includes(filtroMtrNorm);
    });
  }, [opcoesMtrParaPesagem, filtroMtrNorm]);

  useEffect(() => {
    async function carregarCargo() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUsuarioCargo(null);
        setUsuarioNome(null);
        return;
      }
      const { data } = await supabase
        .from("usuarios")
        .select("cargo, nome")
        .eq("id", user.id)
        .maybeSingle();
      setUsuarioCargo(data?.cargo ?? null);
      setUsuarioNome(data?.nome ?? null);
    }
    void carregarCargo();
  }, []);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function registrarTipoCaminhaoHeranca(heranca: MtrHerancaPesagem | null) {
    if (!heranca?.programacao_id || !heranca.tipo_caminhao) return;
    setTipoVeiculoMtrSelecionada("");
    setTipoCaminhaoPorProgramacao((prev) => ({
      ...prev,
      [heranca.programacao_id!]: heranca.tipo_caminhao,
    }));
  }

  async function aplicarContratoResiduosNaPesagem(empresa: string, coletaId: string, mtrId: string) {
    const emp = empresa.trim();
    if (emp.length < 2) {
      setResiduosContratoCliente([]);
      return;
    }
    if (coletaId && ultimaPesagemPorColeta.has(coletaId)) {
      return;
    }
    const snap = await fetchContratoClientePorNomeEmpresa(supabase, emp);
    ultimoEnriquecimentoKeyRef.current = `${coletaId}|${mtrId}|${emp}`;
    if (!snap) {
      setResiduosContratoCliente([]);
      return;
    }
    setResiduosContratoCliente(snap.residuos);
    if (snap.residuos.filter(residuoContratoTemConteudo).length <= 1) return;
    setForm((prev) =>
      mergeFormResiduosLinhas(
        prev,
        expandirLinhasPesagemComContrato(prev.residuos_linhas, snap.residuos)
      )
    );
  }

  useEffect(() => {
    const emp = form.empresa.trim();
    if (emp.length < 3) {
      setResiduosContratoCliente([]);
      return;
    }
    const key = `${form.coleta_id}|${mtrSemColetaSelecionado ?? ""}|${emp}`;
    if (ultimoEnriquecimentoKeyRef.current === key) return;
    const t = window.setTimeout(() => {
      void aplicarContratoResiduosNaPesagem(emp, form.coleta_id, mtrSemColetaSelecionado ?? "");
    }, 500);
    return () => window.clearTimeout(t);
  }, [form.empresa, form.coleta_id, mtrSemColetaSelecionado]);

  function montarFormPesagemComColeta(
    prev: FormRegistro,
    coletaSelecionada: ColetaOpcao,
    heranca: MtrHerancaPesagem | null
  ): FormRegistro {
    let herancaEfetiva = heranca;
    if (heranca) {
      const linhasMtr = linhasComConteudo(heranca.linhas_residuo);
      if (linhasMtr.length > 1) {
        const filtradas = heranca.linhas_residuo.filter((l) =>
          coletaCorrespondeResiduo(coletaSelecionada, l.texto)
        );
        const filtradasCom = linhasComConteudo(filtradas);
        const coletaItens = linhasComConteudo(
          coletaSelecionada.residuos_itens ??
            parseResiduosFromRow({
              tipo_residuo: coletaSelecionada.tipo_residuo,
              residuo_catalogo_id: coletaSelecionada.residuo_catalogo_id,
            })
        );
        // Coleta já é de um único resíduo → mantém só a linha correspondente da MTR
        if (filtradasCom.length === 1 && coletaItens.length === 1) {
          herancaEfetiva = { ...heranca, linhas_residuo: filtradas };
        }
      }
    }

    const linhasBase =
      coletaSelecionada.residuos_itens ??
      parseResiduosFromRow({
        tipo_residuo: coletaSelecionada.tipo_residuo,
        residuo_catalogo_id: coletaSelecionada.residuo_catalogo_id,
      });
    const linhas = aplicarPesosColetaNasLinhas(
      linhasResiduoHerancaOuColeta(linhasBase, herancaEfetiva),
      {
        peso_tara: coletaSelecionada.peso_tara,
        peso_bruto: coletaSelecionada.peso_bruto,
        peso_liquido: coletaSelecionada.peso_liquido,
      }
    );
    const campos = herancaEfetiva
      ? aplicarHerancaMtrEmCamposPesagem(
          { placa: coletaSelecionada.placa, motorista: coletaSelecionada.motorista },
          herancaEfetiva
        )
      : { placa: coletaSelecionada.placa, motorista: coletaSelecionada.motorista };

    const mtrNo =
      mtrsLista.find((m) => m.id === coletaSelecionada.mtr_id)?.numero ?? null;
    const ticketEx = numeroTicketPorColeta.get(coletaSelecionada.id);
    const pesagemPrev = ultimaPesagemPorColeta.get(coletaSelecionada.id);
    const dataCampo =
      (pesagemPrev?.data?.trim().slice(0, 10) ?? "") || isoDataHojeLocal();

    return preencherNumeroTicketNoForm(
      mergeFormResiduosLinhas(
        {
          ...prev,
          coleta_id: coletaSelecionada.id,
          data: dataCampo,
          empresa: coletaSelecionada.cliente || prev.empresa,
          placa: campos.placa || prev.placa,
          motorista: campos.motorista || prev.motorista,
        },
        linhas
      ),
      {
        numeroMtr: mtrNo,
        ticketExistenteColeta: ticketEx,
        totalSegmentos: linhasComConteudo(linhas).length || 1,
      }
    );
  }

  function aplicarColetaNoForm(coletaSelecionada: ColetaOpcao) {
    setMtrSemColetaSelecionado(null);
    setTipoVeiculoMtrSelecionada("");

    const aplicar = (heranca: MtrHerancaPesagem | null) => {
      registrarTipoCaminhaoHeranca(heranca);
      setForm((prev) => montarFormPesagemComColeta(prev, coletaSelecionada, heranca));
      const empresa = (coletaSelecionada.cliente || "").trim();
      if (empresa) {
        void aplicarContratoResiduosNaPesagem(
          empresa,
          coletaSelecionada.id,
          coletaSelecionada.mtr_id ?? ""
        );
      }
    };

    if (coletaSelecionada.mtr_id) {
      void buscarMtrHerancaPesagem(coletaSelecionada.mtr_id).then((heranca) => {
        aplicar(heranca);
      });
      return;
    }

    aplicar(null);
  }

  function aplicarHerancaMtrSemColeta(mtrId: string, clienteMtr: string) {
    setMtrSemColetaSelecionado(mtrId);
    void buscarMtrHerancaPesagem(mtrId).then((heranca) => {
      const linhas = linhasResiduoHerancaOuColeta(
        [linhaVaziaResiduoPesagem()],
        heranca
      );
      if (heranca?.tipo_caminhao) {
        setTipoVeiculoMtrSelecionada(heranca.tipo_caminhao);
        registrarTipoCaminhaoHeranca(heranca);
      } else {
        setTipoVeiculoMtrSelecionada("");
      }

      const mtrNo = mtrsLista.find((m) => m.id === mtrId)?.numero ?? null;

      setForm((prev) =>
        preencherNumeroTicketNoForm(
          mergeFormResiduosLinhas(
            {
              ...prev,
              coleta_id: "",
              empresa: clienteMtr || prev.empresa,
              placa: heranca?.placa ?? "",
              motorista: heranca?.motorista ?? "",
              peso_tara: "",
              peso_bruto: "",
              peso_liquido: "",
            },
            linhas
          ),
          {
            numeroMtr: mtrNo,
            totalSegmentos: linhasComConteudo(linhas).length || 1,
          }
        )
      );
      const empresa = (clienteMtr || "").trim();
      if (empresa) {
        void aplicarContratoResiduosNaPesagem(empresa, "", mtrId);
      }
    });
  }

  function aplicarSelecaoVinculo(v: string) {
    if (!v) {
      setMtrSemColetaSelecionado(null);
      setTipoVeiculoMtrSelecionada("");
      setResiduosContratoCliente([]);
      ultimoEnriquecimentoKeyRef.current = "";
      setErroTela("");
      setForm((prev) => ({
        ...prev,
        coleta_id: "",
        empresa: "",
        residuo: "",
        residuo_catalogo_id: "",
        residuos_linhas: [linhaVaziaResiduoPesagem()],
        placa: "",
        motorista: "",
        peso_tara: "",
        peso_bruto: "",
        peso_liquido: "",
      }));
      return;
    }

    if (v.startsWith("coleta:")) {
      const id = v.slice("coleta:".length);
      const c = todasColetas.find((item) => item.id === id);
      if (c) {
        setErroTela("");
        aplicarColetaNoForm(c);
      }
      return;
    }

    const coletasMtr = todasColetas.filter((item) => item.mtr_id === v);
    const m = mtrsLista.find((x) => x.id === v);

    if (coletasMtr.length === 0) {
      aplicarHerancaMtrSemColeta(v, m?.cliente ?? "");
      setErroTela("");
      return;
    }

    if (coletasMtr.length === 1) {
      setErroTela("");
      aplicarColetaNoForm(coletasMtr[0]!);
      return;
    }

    aplicarHerancaMtrSemColeta(v, m?.cliente ?? "");
    setErroTela(
      "Esta MTR tem vários resíduos/tickets. Preencha os pesos de cada linha e salve — será gerado ou atualizado um ticket por resíduo."
    );
  }

  function limparFormularioPesagem() {
    setMtrSemColetaSelecionado(null);
    setTipoVeiculoMtrSelecionada("");
    setMtrPickerAberto(false);
    setColetasImpressaoSessao([]);
    setForm(formInicial);
    setErroTela("");
    setSucesso("");
  }

  // Auto foco operacional: ao selecionar MTR/coleta e abrir o fluxo, foca no 1º campo.
  useEffect(() => {
    if (!secaoPesagemAberta) return;
    if (!form.coleta_id && !mtrSemColetaSelecionado) return;
    window.setTimeout(() => {
      dataInputRef.current?.focus();
    }, 60);
  }, [secaoPesagemAberta, form.coleta_id, mtrSemColetaSelecionado]);

  function selecionarColetaParaPesagem(c: ColetaOpcao) {
    setMtrSemColetaSelecionado(null);
    setErroTela("");
    aplicarColetaNoForm(c);
    setSecaoPesagemAberta(true);
    window.setTimeout(() => {
      document.getElementById("massa-form-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  async function excluirColetaDaLista(c: ColetaOpcao) {
    if (!podeEditarOuExcluirColeta) {
      setErroTela(
        "Seu perfil não pode excluir coletas. Apenas operacional ou administrador."
      );
      return;
    }
    const ok = await rgConfirm({
      title: 'Excluir coleta',
      message: `Excluir a coleta ${c.numero} (${c.cliente || "sem cliente"})?`,
      details: ['Esta ação não pode ser desfeita.'],
      confirmLabel: 'Excluir',
      variant: 'danger',
    });
    if (!ok) return;

    setExcluindoColetaId(c.id);
    setErroTela("");
    setSucesso("");

    try {
      const res = await excluirColetaPorId(c.id);
      if (!res.ok) {
        setErroTela(res.message);
        return;
      }

      if (form.coleta_id.trim() === c.id) {
        limparFormularioPesagem();
      }
      setSucesso(`Coleta ${c.numero} excluída.`);
      setTimeout(() => setSucesso(""), 4000);
      await fetchMtrsEColetas();
    } finally {
      setExcluindoColetaId(null);
    }
  }

  const opcaoColetaSemMtr = useMemo(() => {
    const id = form.coleta_id.trim();
    if (!id) return null;
    const c = todasColetas.find((x) => x.id === id);
    if (!c || c.mtr_id) return null;
    return c;
  }, [form.coleta_id, todasColetas]);

  const resumoSelecaoMtr = useMemo((): ResumoSelecaoMtr => {
    if (opcaoColetaSemMtr && form.coleta_id.trim() === opcaoColetaSemMtr.id) {
      return { tipo: "coleta_sem_mtr", coleta: opcaoColetaSemMtr };
    }

    if (mtrSemColetaSelecionado) {
      const m = mtrsLista.find((x) => x.id === mtrSemColetaSelecionado);
      if (!m) return { tipo: "vazio" };
      const qtd = todasColetas.filter((c) => c.mtr_id === mtrSemColetaSelecionado).length;
      if (qtd > 1) return { tipo: "mtr_todos", mtr: m, qtdTickets: qtd };
      return { tipo: "mtr_nova", mtr: m };
    }

    const cid = form.coleta_id.trim();
    if (!cid) return { tipo: "vazio" };

    const c = todasColetas.find((x) => x.id === cid);
    if (!c?.mtr_id) return { tipo: "vazio" };

    const m = mtrsLista.find((x) => x.id === c.mtr_id);
    if (!m) return { tipo: "vazio" };

    const coletasMtr = todasColetas
      .filter((x) => x.mtr_id === c.mtr_id)
      .sort((a, b) =>
        String(b.numero).localeCompare(String(a.numero), "pt-BR", { numeric: true })
      );

    if (coletasMtr.length === 1) {
      return { tipo: "mtr_unica", mtr: m, coleta: c };
    }

    const indiceTicket = coletasMtr.findIndex((x) => x.id === c.id) + 1;
    return {
      tipo: "coleta",
      mtrNumero: m.numero,
      coleta: c,
      indiceTicket: indiceTicket > 0 ? indiceTicket : undefined,
    };
  }, [
    form.coleta_id,
    mtrSemColetaSelecionado,
    opcaoColetaSemMtr,
    todasColetas,
    mtrsLista,
  ]);

  const mtrAtivoParaAtalhos = useMemo(() => {
    if (mtrSemColetaSelecionado) return mtrSemColetaSelecionado;
    const cid = form.coleta_id.trim();
    if (!cid) return null;
    return todasColetas.find((c) => c.id === cid)?.mtr_id ?? null;
  }, [mtrSemColetaSelecionado, form.coleta_id, todasColetas]);

  const coletasAtalhoMtr = useMemo(() => {
    if (!mtrAtivoParaAtalhos) return [];
    return todasColetas
      .filter((c) => c.mtr_id === mtrAtivoParaAtalhos)
      .sort((a, b) =>
        String(b.numero).localeCompare(String(a.numero), "pt-BR", { numeric: true })
      );
  }, [mtrAtivoParaAtalhos, todasColetas]);

  const mostrarOpcaoColetaSemMtr = useMemo(() => {
    if (!opcaoColetaSemMtr) return false;
    if (!filtroMtrNorm) return true;
    const blob = `coleta ${opcaoColetaSemMtr.numero} sem mtr ${opcaoColetaSemMtr.cliente} ${opcaoColetaSemMtr.tipo_residuo}`;
    return normalizarTextoBusca(blob).includes(filtroMtrNorm);
  }, [opcaoColetaSemMtr, filtroMtrNorm]);

  useEffect(() => {
    if (!mtrPickerAberto) return;
    function fecharFora(e: MouseEvent) {
      if (mtrComboRef.current && !mtrComboRef.current.contains(e.target as Node)) {
        setMtrPickerAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharFora);
    return () => document.removeEventListener("mousedown", fecharFora);
  }, [mtrPickerAberto]);

  useEffect(() => {
    if (!mtrPickerAberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMtrPickerAberto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mtrPickerAberto]);

  useEffect(() => {
    if (loadingVinculo) return;
    if (!temParametrosContexto) {
      prevContextoUrlKeyRef.current = "";
      return;
    }

    const target = resolverColetaContexto(todasColetas, {
      coleta: urlColetaId,
      mtr: urlMtrId,
      programacao: urlProgramacaoId,
      cliente: urlClienteId,
    });

    const urlKey = [urlColetaId, urlMtrId, urlProgramacaoId, urlClienteId].join("|");
    if (prevContextoUrlKeyRef.current === urlKey) return;

    if (!target) {
      if (urlMtrId) {
        prevContextoUrlKeyRef.current = urlKey;
        setSecaoPesagemAberta(true);
        const m = mtrsLista.find((x) => x.id === urlMtrId);
        queueMicrotask(() => {
          aplicarHerancaMtrSemColeta(urlMtrId, m?.cliente ?? "");
        });
      }
      return;
    }

    prevContextoUrlKeyRef.current = urlKey;
    setSecaoPesagemAberta(true);
    queueMicrotask(() => {
      aplicarColetaNoForm(target);
    });

    window.setTimeout(() => {
      document.getElementById("massa-form-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
    // aplicarColetaNoForm / aplicarHerancaMtrSemColeta omitidos: incluir re-dispararia o efeito de URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadingVinculo,
    todasColetas,
    temParametrosContexto,
    urlColetaId,
    urlMtrId,
    urlProgramacaoId,
    urlClienteId,
    mtrsLista,
  ]);

  function abrirFormularioPesagem() {
    setSecaoPesagemAberta(true);
    window.setTimeout(() => {
      document.getElementById("massa-form-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  async function handleSalvarRegistro(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!podeMutarMassa) {
      setErroTela(
        "Seu perfil não pode lançar pesagem. Apenas balanceiro ou administrador."
      );
      return;
    }

    setErroTela("");
    setSucesso("");

    if (!form.data.trim()) {
      setErroTela("Preencha a data.");
      return;
    }

    const mtrIdParaEmpresa =
      mtrSemColetaSelecionado ||
      (form.coleta_id.trim()
        ? todasColetas.find((c) => c.id === form.coleta_id.trim())?.mtr_id ?? null
        : null);

    const mtrLinha = mtrIdParaEmpresa
      ? mtrsLista.find((m) => m.id === mtrIdParaEmpresa)
      : undefined;
    const mtrNumeroParaTicket = (mtrLinha?.numero ?? "").trim();

    if (!form.numero_ticket.trim() && !podeGerarNumeroTicketFromMtr(mtrNumeroParaTicket)) {
      setErroTela(
        "Preencha o número do ticket ou selecione uma MTR com número válido para gerar automaticamente."
      );
      return;
    }

    const empresaDaMtr = (mtrLinha?.cliente ?? "").trim();

    const empresaFinal = (form.empresa.trim() || empresaDaMtr).trim();
    if (!empresaFinal) {
      setErroTela("Preencha a empresa (ou selecione uma MTR com cliente cadastrado).");
      return;
    }

    const coletaVinculoPre = form.coleta_id.trim()
      ? todasColetas.find((c) => c.id === form.coleta_id.trim())
      : undefined;
    const tipoResiduoColeta = (coletaVinculoPre?.tipo_residuo ?? "").trim();
    const tipoResiduoMtr = (mtrLinha?.tipo_residuo != null ? String(mtrLinha.tipo_residuo) : "").trim();
    const resolvido = resolverResiduosParaGravacao(form.residuos_linhas, {
      tipoResiduoColeta,
      tipoResiduoMtr,
    });

    if (resolvido.erro) {
      setErroTela(resolvido.erro);
      return;
    }

    const mtrIdPreSegmentacao =
      mtrSemColetaSelecionado || coletaVinculoPre?.mtr_id || null;

    if (
      !mtrIdPreSegmentacao &&
      linhasComConteudo(form.residuos_linhas).length > 1
    ) {
      setErroTela(
        "Cada ticket aceita apenas um resíduo. Vincule uma MTR com vários resíduos para gerar vários tickets (um por resíduo), ou deixe uma única linha de resíduo."
      );
      return;
    }

    const mtrIdSegmentacao =
      mtrSemColetaSelecionado ||
      coletaVinculoPre?.mtr_id ||
      null;

    if (deveSegmentarTicketsPorMtr(mtrIdSegmentacao, form.residuos_linhas)) {
      const segmentos = segmentosResiduoParaTickets(form.residuos_linhas);
      const mtrNumeroSeg =
        mtrsLista.find((m) => m.id === mtrIdSegmentacao)?.numero?.trim() ?? "";
      let coletasMtr = todasColetas.filter((c) => c.mtr_id === mtrIdSegmentacao);
      const coletasUsadas = new Set<string>();
      const coletasGravadas: string[] = [];
      let ticketsOk = 0;
      let filaConferenciaOk = 0;

      setSalvando(true);

      for (let i = 0; i < segmentos.length; i++) {
        const linha = segmentos[i]!;
        const numeroTicketSeg = numeroTicketParaSegmento(
          mtrNumeroSeg,
          i,
          segmentos.length,
          form.numero_ticket
        );

        if (!numeroTicketSeg.trim()) {
          setErroTela(
            "Não foi possível gerar o número do ticket a partir da MTR. Verifique o número da MTR."
          );
          setSalvando(false);
          return;
        }

        let coletaIdSeg = "";

        const coletaForm =
          form.coleta_id.trim() && i === 0
            ? todasColetas.find((c) => c.id === form.coleta_id.trim())
            : undefined;

        if (coletaForm && coletaCorrespondeResiduo(coletaForm, linha.texto)) {
          coletaIdSeg = coletaForm.id;
        } else {
          const existente = coletasMtr.find(
            (c) => !coletasUsadas.has(c.id) && coletaCorrespondeResiduo(c, linha.texto)
          );
          if (existente) coletaIdSeg = existente.id;
        }

        if (!coletaIdSeg) {
          const agSeg = agregarPesosDasLinhas([linha]);
          const resSeg = resolverResiduosParaGravacao([linha], {
            tipoResiduoMtr: tipoResiduoMtr,
          });
          if (resSeg.erro) {
            setErroTela(resSeg.erro);
            setSalvando(false);
            return;
          }

          const criada = await criarColetaVinculadaAMtr(mtrIdSegmentacao!, {
            dataRef: form.data,
            pesoTara: agSeg.pesoTaraNum,
            pesoBruto: agSeg.pesoBrutoNum,
            pesoLiquido: agSeg.pesoLiquidoNum,
            motorista: form.motorista,
            placa: form.placa,
            residuoFallback: resSeg.texto,
            residuo_catalogo_id: resSeg.catalogo_id,
            residuos_itens: resSeg.residuos_itens,
          });

          if (!criada.ok) {
            setErroTela(criada.message);
            setSalvando(false);
            return;
          }

          coletaIdSeg = criada.coletaId;
          coletasMtr = [
            ...coletasMtr,
            {
              id: criada.coletaId,
              numero: "—",
              cliente: empresaFinal,
              tipo_residuo: resSeg.texto,
              residuo_catalogo_id: null,
              placa: form.placa,
              motorista: form.motorista,
              status: "",
              etapaFluxo: "BRUTO_REGISTRADO",
              peso_tara: agSeg.pesoTaraNum,
              peso_bruto: agSeg.pesoBrutoNum,
              peso_liquido: agSeg.pesoLiquidoNum,
              mtr_id: mtrIdSegmentacao,
            },
          ];
        }

        coletasUsadas.add(coletaIdSeg);

        const coletaSeg = todasColetas.find((c) => c.id === coletaIdSeg) ?? coletasMtr.find((c) => c.id === coletaIdSeg);
        const persist = await persistirPesagemUmSegmento({
          coletaId: coletaIdSeg,
          numeroTicket: numeroTicketSeg,
          tipoTicket: form.tipo_ticket,
          descricaoTicket: form.descricao_ticket,
          data: form.data,
          empresa: empresaFinal,
          placa: form.placa,
          motorista: form.motorista,
          linhaResiduo: linha,
          tipoResiduoMtr,
          tipoResiduoColeta: (coletaSeg?.tipo_residuo ?? "").trim(),
          status: form.status,
        });

        if (!persist.ok) {
          setErroTela(persist.message);
          setSalvando(false);
          return;
        }

        if (persist.ticketOk) {
          ticketsOk++;
        }
        if (persist.filaConferenciaOk) {
          filaConferenciaOk++;
        }

        coletasGravadas.push(coletaIdSeg);
      }

      setMtrSemColetaSelecionado(null);
      await atualizarColetasAposSalvar(coletasGravadas);
      setColetasImpressaoSessao(coletasGravadas);
      setForm((prev) => ({
        ...prev,
        coleta_id: coletasGravadas[0] ?? prev.coleta_id,
      }));
      setSalvando(false);

      setSucesso(
        ticketsOk === segmentos.length && filaConferenciaOk === segmentos.length
          ? `${segmentos.length} tickets gerados (1 resíduo cada), vinculados à mesma MTR. Entraram na fila de conferência do Faturamento.`
          : ticketsOk === segmentos.length
            ? `${segmentos.length} tickets gerados; verifique aviso sobre a fila do Faturamento.`
            : `${segmentos.length} pesagens gravadas; verifique avisos sobre tickets ou fila do Faturamento.`
      );
      setTimeout(() => setSucesso(""), 6000);
      return;
    }

    const agregado = agregarPesosDasLinhas(form.residuos_linhas);
    const pesoTaraNumero = agregado.pesoTaraNum;
    const pesoBrutoNumero = agregado.pesoBrutoNum;
    const pesoLiquidoNumero = agregado.pesoLiquidoNum;

    let coletaId = form.coleta_id.trim();
    let coletaAcabouDeSerCriada = false;

    if (!coletaId) {
      if (!mtrSemColetaSelecionado) {
        setErroTela(
          "Selecione uma MTR (ou coleta) no passo 1 para lançar a pesagem."
        );
        return;
      }

      setSalvando(true);
      const criada = await criarColetaVinculadaAMtr(mtrSemColetaSelecionado, {
        dataRef: form.data,
        pesoTara: pesoTaraNumero,
        pesoBruto: pesoBrutoNumero,
        pesoLiquido: pesoLiquidoNumero,
        motorista: form.motorista,
        placa: form.placa,
        residuoFallback: resolvido.texto,
        residuo_catalogo_id: resolvido.catalogo_id,
        residuos_itens: resolvido.residuos_itens,
      });

      if (!criada.ok) {
        setErroTela(criada.message);
        setSalvando(false);
        return;
      }

      coletaId = criada.coletaId;
      coletaAcabouDeSerCriada = true;
      setMtrSemColetaSelecionado(null);
      setForm((prev) => ({ ...prev, coleta_id: coletaId }));
    }

    const coletaVinculo = coletaVinculoPre ?? todasColetas.find((c) => c.id === coletaId);

    if (!coletaAcabouDeSerCriada && !coletaVinculo) {
      setErroTela(
        "Coleta não encontrada na lista. Recarregue a página ou navegue de novo e tente outra vez."
      );
      return;
    }

    const residuoParaInsert = resolvido.texto;
    const catalogIdPersist = resolvido.catalogo_id;
    const residuosItensPersist = resolvido.residuos_itens;

    setSalvando(true);

    const numeroTicketTrim =
      form.numero_ticket.trim() ||
      (podeGerarNumeroTicketFromMtr(mtrNumeroParaTicket)
        ? numeroTicketFromMtr(
            mtrNumeroParaTicket,
            0,
            Math.max(1, linhasComConteudo(form.residuos_linhas).length)
          )
        : "");
    const payloadCampos: Record<string, unknown> = {
      numero_ticket: numeroTicketTrim,
      data: form.data,
      empresa: empresaFinal,
      residuo: residuoParaInsert,
      residuos_itens: residuosItensPersist,
      placa: limparOuNull(form.placa),
      motorista: limparOuNull(form.motorista),
      peso_liquido: pesoLiquidoNumero,
      status: form.status || "Pendente",
    };
    const payloadSemItens = { ...payloadCampos };
    delete payloadSemItens.residuos_itens;

    const { data: cmExistenteRows, error: errBuscaCm } = await supabase
      .from("controle_massa")
      .select("id")
      .eq("coleta_id", coletaId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (errBuscaCm) {
      console.error(errBuscaCm);
      setErroTela(`Erro ao verificar pesagem existente: ${errBuscaCm.message}`);
      setSalvando(false);
      return;
    }

    const cmExistenteId = (cmExistenteRows?.[0] as { id?: string } | undefined)?.id;
    let error: { message: string; details?: string; code?: string } | null = null;

    if (cmExistenteId) {
      let upErr = (
        await supabase.from("controle_massa").update(payloadCampos).eq("id", cmExistenteId)
      ).error;
      if (isErroColunaResiduosItens(upErr)) {
        upErr = (
          await supabase.from("controle_massa").update(payloadSemItens).eq("id", cmExistenteId)
        ).error;
      }
      error = upErr;
    } else {
      let insCmErr = (
        await supabase.from("controle_massa").insert([
          { coleta_id: limparOuNull(coletaId), ...payloadCampos },
        ])
      ).error;
      if (isErroColunaResiduosItens(insCmErr)) {
        insCmErr = (
          await supabase.from("controle_massa").insert([
            { coleta_id: limparOuNull(coletaId), ...payloadSemItens },
          ])
        ).error;
      }
      error = insCmErr;
    }

    if (error) {
      console.error("Erro ao salvar registro de massa:", error);
      const msg = error.message || "";
      const code = (error as { code?: string }).code;
      if (
        code === "23505" ||
        msg.includes("controle_massa_numero_ticket") ||
        (msg.toLowerCase().includes("duplicate") && msg.toLowerCase().includes("numero_ticket"))
      ) {
        setErroTela(
          "Este número de ticket já está em uso em outra pesagem. Use um número novo ou salve de novo na mesma coleta para atualizar o registro já lançado."
        );
      } else {
        setErroTela(`Erro ao salvar registro: ${msg}${error.details ? ` (${error.details})` : ""}`);
      }
      setSalvando(false);
      return;
    }

    const ticketAuto = await garantirTicketAposPesagem({
      coletaId,
      numeroTicket: form.numero_ticket,
      tipoTicket: form.tipo_ticket,
      descricaoExtra: form.descricao_ticket,
    });

    const fluxoPosPesagem = ticketAuto.ok ? "TICKET_GERADO" : "CONTROLE_PESAGEM_LANCADO";

    const tipoResGravar = residuoParaInsert;
    const resCatGravar = catalogIdPersist;

    const dataIsoSalvar = form.data.trim().slice(0, 10);
    const resColeta = await atualizarColetaAposPesagemControleMassa(supabase, coletaId, {
      peso_tara: pesoTaraNumero,
      peso_bruto: pesoBrutoNumero,
      peso_liquido: pesoLiquidoNumero,
      tipo_residuo: tipoResGravar,
      residuo_catalogo_id: resCatGravar,
      residuos_itens: residuosItensPersist,
      placa: limparOuNull(form.placa),
      motorista: limparOuNull(form.motorista),
      motorista_nome: limparOuNull(form.motorista),
      data_execucao: dataIsoSalvar || null,
      data_agendada: dataIsoSalvar || null,
      fluxo_status: fluxoPosPesagem,
      etapa_operacional: fluxoPosPesagem,
      status_processo: "EM_CONFERENCIA",
      liberado_financeiro: false,
    });

    const errorColeta = resColeta.ok ? null : { message: resColeta.message };

    if (!resColeta.ok) {
      console.error("Erro ao atualizar coleta após controle de massa:", resColeta.message);
      setErroTela(
        `Pesagem gravada, mas a coleta não foi atualizada no fluxo. ${resColeta.message}`
      );
    } else if (!ticketAuto.ok) {
      setErroTela(
        `Pesagem gravada, mas o ticket automático falhou (${ticketAuto.message}). Abra «Mais opções do ticket» e use «Gravar ticket».`
      );
    } else {
      setErroTela("");
    }

    let filaConferenciaOk = false;
    if (!errorColeta && ticketAuto.ok) {
      const resFila = await registrarTicketImpressoColeta(coletaId);
      if (!resFila.ok) {
        setErroTela((prev) => prev || resFila.message);
      } else {
        filaConferenciaOk = true;
      }
    }

    setMtrSemColetaSelecionado(null);
    await atualizarColetasAposSalvar([coletaId]);
    setColetasImpressaoSessao([coletaId]);
    setForm((prev) => ({
      ...prev,
      coleta_id: coletaId,
    }));
    setSalvando(false);

    setTimeout(() => {
      document.getElementById("massa-finalizar-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    setSucesso(
      errorColeta
        ? "Pesagem registrada; verifique o aviso em vermelho sobre a etapa da coleta."
        : !ticketAuto.ok
          ? "Pesagem registrada. Abra «Mais opções do ticket» em baixo para gravar o ticket manualmente."
          : filaConferenciaOk
            ? "Pesagem e ticket guardados. A coleta entrou na fila de conferência do Faturamento."
            : "Pesagem e ticket guardados. Verifique o aviso em vermelho sobre a fila do Faturamento."
    );
    setTimeout(() => {
      setSucesso("");
    }, 5000);
  }

  const coletasListaOrdenadas = useMemo(() => {
    const arr = [...todasColetas];
    arr.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      if (tb !== ta) return tb - ta;
      return String(b.numero).localeCompare(String(a.numero), undefined, { numeric: true });
    });
    return arr;
  }, [todasColetas]);

  const coletasListaFiltradas = useMemo(() => {
    const base = modoTela === "operacao" ? listaOperacao : coletasListaOrdenadas;
    const t = normalizarTextoBusca(buscaColetasLista);
    if (!t) return base;
    return base.filter((c) => {
      const mtrNo = c.mtr_id ? mtrsLista.find((m) => m.id === c.mtr_id)?.numero ?? "" : "";
      const tc = c.programacao_id ? tipoCaminhaoPorProgramacao[c.programacao_id] ?? "" : "";
      const up = c.id ? ultimaPesagemPorColeta.get(c.id) : undefined;
      const ticketNo = c.id ? (numeroTicketPorColeta.get(c.id) ?? "").trim() : "";
      const ticketTipo = c.id ? formatarTipoTicketLista(tipoTicketPorColeta.get(c.id)) : "";
      const blob = [
        c.numero,
        c.cliente,
        c.tipo_residuo,
        c.placa,
        c.motorista,
        mtrNo,
        tc,
        formatarEtapaParaUI(c.etapaFluxo),
        up?.data ?? "",
        ticketNo,
        ticketTipo,
      ]
        .join(" ");
      return normalizarTextoBusca(blob).includes(t);
    });
  }, [
    coletasListaOrdenadas,
    listaOperacao,
    modoTela,
    buscaColetasLista,
    mtrsLista,
    tipoCaminhaoPorProgramacao,
    ultimaPesagemPorColeta,
    tipoTicketPorColeta,
    numeroTicketPorColeta,
  ]);

  return (
    <MainLayout>
      <div className="page-shell">
      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        {sucesso && (
          <div
            style={{
              background: "#16a34a",
              color: "#ffffff",
              padding: "14px 16px",
              borderRadius: "12px",
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(22, 163, 74, 0.18)",
              border: "1px solid #15803d",
            }}
          >
            {sucesso}
          </div>
        )}

        {erroTela && (
          <div
            style={{
              background: "#fef2f2",
              color: "#991b1b",
              padding: "14px 16px",
              borderRadius: "12px",
              fontWeight: 700,
              border: "1px solid #fecaca",
            }}
          >
            {erroTela}
          </div>
        )}

        {temParametrosContexto && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              padding: "12px 14px",
              borderRadius: "12px",
              fontSize: "13px",
              border: "1px solid",
              ...(itemContextoResolvido
                ? { background: "#f8fafc", borderColor: "#e2e8f0" }
                : { background: "#fffbeb", borderColor: "#fcd34d" }),
            }}
          >
            <div style={{ flex: "1", minWidth: "200px", color: "#475569", lineHeight: 1.45 }}>
              {itemContextoResolvido ? (
                <>
                  <strong style={{ color: "#0f172a" }}>Link na URL:</strong> coleta{" "}
                  {itemContextoResolvido.numero} · {itemContextoResolvido.cliente}
                </>
              ) : (
                <span style={{ color: "#92400e" }}>
                  Não encontrámos coleta para estes parâmetros da URL. Ajuste o mês na Programação ou
                  os filtros e volte a abrir o link.
                </span>
              )}
            </div>
            {itemContextoResolvido ? (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => irProgramacao(itemContextoResolvido)}
                  style={botaoContextoSecundarioStyle}
                >
                  Ver programação
                </button>
                <button
                  type="button"
                  onClick={() => irMtr(itemContextoResolvido)}
                  style={botaoContextoSecundarioStyle}
                >
                  Ver MTR
                </button>
              </div>
            ) : null}
            <button type="button" onClick={limparContextoUrl} style={botaoLimparUrlStyle}>
              Limpar URL
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "26px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Pesagem, MTR e ticket no mesmo ecrã
            </h1>
            <p className="page-header__lead" style={{ margin: "6px 0 0", maxWidth: "720px" }}>
              <strong>Resumo:</strong> escolha a coleta → preencha a pesagem → defina o ticket (tipo e número) →{' '}
              <strong>Salvar pesagem e ticket</strong> envia a coleta à conferência do Faturamento. <strong>Imprimir ticket</strong> é
              opcional (papel). Opções de
              correção ficam em «Mais opções», abaixo do formulário.
            </p>
            {usuarioCargo ? (
              <p
                style={{
                  marginTop: "8px",
                  marginBottom: 0,
                  fontSize: "12px",
                  color: "#64748b",
                  fontWeight: 600,
                }}
              >
                Perfil: <span style={{ color: "#0f172a" }}>{usuarioCargo}</span>
                {!podeMutarMassa ? " · somente consulta" : " · pode lançar pesagem"}
              </p>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
              }}
            >
              <button
                type="button"
                onClick={() => setModoTela("operacao")}
                style={{
                  padding: "10px 12px",
                  border: "none",
                  background: modoTela === "operacao" ? "#0f172a" : "#ffffff",
                  color: modoTela === "operacao" ? "#ffffff" : "#0f172a",
                  fontWeight: 900,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Operação
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoTela("auditoria");
                  setTabelaAberta(true);
                }}
                style={{
                  padding: "10px 12px",
                  border: "none",
                  background: modoTela === "auditoria" ? "#0f172a" : "#ffffff",
                  color: modoTela === "auditoria" ? "#ffffff" : "#0f172a",
                  fontWeight: 900,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Auditoria
              </button>
            </div>

            <button
              type="button"
              onClick={abrirFormularioPesagem}
              disabled={!podeMutarMassa}
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1px solid #0f766e",
                background: podeMutarMassa ? "#0d9488" : "#e2e8f0",
                color: podeMutarMassa ? "#ffffff" : "#64748b",
                fontWeight: 900,
                fontSize: "13px",
                cursor: podeMutarMassa ? "pointer" : "not-allowed",
                boxShadow: podeMutarMassa ? "0 6px 16px rgba(13, 148, 136, 0.22)" : "none",
              }}
              title={podeMutarMassa ? "Abrir o formulário de pesagem" : "Sem permissão para lançar pesagem"}
            >
              + Nova pesagem
            </button>
          </div>
        </div>

        {/* Stepper sticky: guia rápido do fluxo */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            marginTop: "14px",
            padding: "10px 12px",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {[
              { k: "1", t: "MTR", ok: estadoFluxo.temSelecao },
              { k: "2", t: "Pesagem", ok: estadoFluxo.temPesagem },
              { k: "3", t: "Ticket", ok: estadoFluxo.temTicket },
              { k: "4", t: "Imprimir", ok: estadoFluxo.prontoImprimir },
            ].map((s) => (
              <div
                key={s.k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "999px",
                  border: "1px solid",
                  borderColor: s.ok ? "#bbf7d0" : "#e2e8f0",
                  background: s.ok ? "#f0fdf4" : "#ffffff",
                  color: s.ok ? "#065f46" : "#0f172a",
                  fontWeight: 900,
                  fontSize: "12px",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: s.ok ? "#16a34a" : "#e2e8f0",
                    color: s.ok ? "#ffffff" : "#64748b",
                    fontSize: "11px",
                    fontWeight: 900,
                  }}
                >
                  {s.ok ? "✓" : s.k}
                </span>
                {s.t}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
              minWidth: 220,
              justifyContent: "flex-end",
            }}
          >
            <div style={{ fontSize: "12px", color: "#475569", fontWeight: 700 }}>
              {coletaSelecionada ? (
                <>
                  Coleta <strong style={{ color: "#0f172a" }}>{coletaSelecionada.numero}</strong> ·{" "}
                  {(coletaSelecionada.cliente || "—").slice(0, 36)}
                </>
              ) : mtrSelecionada ? (
                <>
                  MTR <strong style={{ color: "#0f172a" }}>{mtrSelecionada.numero}</strong> ·{" "}
                  {(mtrSelecionada.cliente || "—").slice(0, 36)}
                </>
              ) : (
                "Selecione uma MTR para começar"
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
            order: modoTela === "operacao" ? 2 : 1,
          }}
        >
          <button
            type="button"
            onClick={() => setTabelaAberta((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "14px 18px",
              border: "none",
              borderBottom: tabelaAberta ? "1px solid #e5e7eb" : "none",
              background: "#ffffff",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "17px", fontWeight: 900, color: "#0f172a" }}>
                {modoTela === "operacao" ? "Lista de coletas (apoio)" : "Todas as coletas — auditoria"}
              </div>
              <div style={{ marginTop: 4, fontSize: "12px", color: "#64748b", fontWeight: 600, lineHeight: 1.45 }}>
                {modoTela === "operacao"
                  ? "Opcional: abra para escolher uma linha ou confirmar dados. O trabalho principal é o formulário acima."
                  : "Vista completa com colunas técnicas e ações de edição/exclusão."}
              </div>
            </div>
            <span style={{ flexShrink: 0, fontSize: "12px", color: "#64748b" }} aria-hidden>
              {tabelaAberta ? "▲" : "▼"}
            </span>
          </button>

          {tabelaAberta ? (
            <>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
                {modoTela === "operacao" ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                    {[
                      { id: "pendentes" as const, label: "Pendentes" },
                      { id: "hoje" as const, label: "Hoje" },
                      { id: "todas" as const, label: "Todas" },
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setFiltroOperacao(b.id)}
                        style={{
                          height: "34px",
                          padding: "0 12px",
                          borderRadius: "999px",
                          border: "1px solid",
                          borderColor: filtroOperacao === b.id ? "#0f766e" : "#cbd5e1",
                          background: filtroOperacao === b.id ? "#0d9488" : "#ffffff",
                          color: filtroOperacao === b.id ? "#ffffff" : "#0f172a",
                          fontWeight: 900,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        {b.label}
                      </button>
                    ))}

                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 800 }}>
                      {filtroOperacao === "pendentes"
                        ? `Pendentes: ${listaOperacao.length}`
                        : filtroOperacao === "hoje"
                          ? `Hoje: ${listaOperacao.length}`
                          : `Total: ${listaOperacao.length}`}
                    </span>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    value={buscaColetasLista}
                    onChange={(e) => setBuscaColetasLista(e.target.value)}
                    placeholder={
                      modoTela === "operacao"
                        ? "Filtrar por coleta, cliente, MTR, placa…"
                        : "Filtrar por coleta, cliente, MTR, placa, etapa…"
                    }
                    style={{
                      width: "100%",
                      maxWidth: "440px",
                      height: "36px",
                      borderRadius: "10px",
                      border: "1px solid #d1d5db",
                      padding: "0 12px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                  {buscaColetasLista.trim() ? (
                    <button
                      type="button"
                      onClick={() => setBuscaColetasLista("")}
                      style={{
                        height: "36px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontWeight: 800,
                        fontSize: "12px",
                        cursor: "pointer",
                        color: "#0f172a",
                      }}
                    >
                      Limpar filtro
                    </button>
                  ) : null}
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
                    Mostrando{" "}
                    <strong style={{ color: "#0f172a" }}>
                      {coletasListaFiltradas.length}
                    </strong>{" "}
                    de {coletasListaOrdenadas.length}
                  </span>
                </div>
              </div>

              <div
                style={{
                  overflowX: "auto",
                  maxHeight: modoTela === "operacao" ? "min(38vh, 380px)" : "min(52vh, 520px)",
                  overflowY: "auto",
                }}
              >
            {loadingVinculo ? (
              <div
                style={{
                  padding: "28px",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                A carregar coletas…
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "11px",
                  color: "#111827",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      borderBottom: "1px solid #e5e7eb",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <th style={thListaColetaStyle}>Coleta</th>
                    <th style={thListaColetaStyle}>MTR</th>
                    <th style={thListaColetaStyle}>Data</th>
                    {modoTela === "auditoria" ? (
                      <>
                        <th style={thListaColetaStyle}>Hora entrada</th>
                        <th style={thListaColetaStyle}>Hora saída</th>
                        <th style={thListaColetaStyle}>Tipo ticket</th>
                        <th style={{ ...thListaColetaStyle, whiteSpace: "nowrap" }}>N.º ticket</th>
                      </>
                    ) : null}
                    <th style={thListaColetaStyle}>Placa</th>
                    {modoTela === "auditoria" ? (
                      <th style={thListaColetaStyle}>Tipo cam.</th>
                    ) : null}
                    <th style={{ ...thListaColetaStyle, minWidth: "140px" }}>Cliente</th>
                    <th style={{ ...thListaColetaStyle, minWidth: "120px" }}>Resíduo</th>
                    {modoTela === "auditoria" ? (
                      <>
                        <th style={{ ...thListaColetaStyle, textAlign: "right" }}>Bruto</th>
                        <th style={{ ...thListaColetaStyle, textAlign: "right" }}>Tara</th>
                      </>
                    ) : null}
                    <th style={{ ...thListaColetaStyle, textAlign: "right" }}>Líq.</th>
                    {modoTela === "auditoria" ? <th style={thListaColetaStyle}>Etapa</th> : null}
                    <th style={{ ...thListaColetaStyle, whiteSpace: "nowrap" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {coletasListaFiltradas.map((c) => {
                    const mtrNo = c.mtr_id
                      ? mtrsLista.find((m) => m.id === c.mtr_id)?.numero ?? "—"
                      : "—";
                    const up = ultimaPesagemPorColeta.get(c.id);
                    const dataP = up?.data ? formatarDataIsoCurta(up.data) : "—";
                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          cursor: podeMutarMassa ? "pointer" : "default",
                          background: form.coleta_id && form.coleta_id === c.id ? "#ecfeff" : "#ffffff",
                        }}
                        onMouseEnter={(e) => {
                          if (!podeMutarMassa) return;
                          if (form.coleta_id && form.coleta_id === c.id) return;
                          e.currentTarget.style.background = "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            form.coleta_id && form.coleta_id === c.id ? "#ecfeff" : "#ffffff";
                        }}
                        onClick={() => {
                          if (!podeMutarMassa) return;
                          selecionarColetaParaPesagem(c);
                        }}
                        title={
                          podeMutarMassa
                            ? "Clique para carregar esta coleta no lançamento de pesagem"
                            : undefined
                        }
                      >
                        <td style={tdListaColetaStyle}>{c.numero}</td>
                        <td style={tdListaColetaStyle}>{mtrNo}</td>
                        <td style={tdListaColetaStyle}>{dataP}</td>
                        {modoTela === "auditoria" ? (
                          <>
                            <td style={tdListaColetaStyle}>
                              {formatarHoraRelogio(up?.hora_entrada)}
                            </td>
                            <td style={tdListaColetaStyle}>
                              {formatarHoraRelogio(up?.hora_saida)}
                            </td>
                            <td
                              style={{
                                ...tdListaColetaStyle,
                                fontWeight: 700,
                                color: tipoTicketPorColeta.get(c.id) ? "#0f766e" : "#94a3b8",
                                whiteSpace: "nowrap",
                              }}
                              title={
                                tipoTicketPorColeta.get(c.id)
                                  ? `Ticket operacional: ${formatarTipoTicketLista(tipoTicketPorColeta.get(c.id))}${
                                      (numeroTicketPorColeta.get(c.id) ?? "").trim()
                                        ? ` · n.º ${(numeroTicketPorColeta.get(c.id) ?? "").trim()}`
                                        : ""
                                    }`
                                  : "Sem ticket operacional — use o bloco abaixo após a pesagem"
                              }
                            >
                              {formatarTipoTicketLista(tipoTicketPorColeta.get(c.id))}
                            </td>
                            <td
                              style={{
                                ...tdListaColetaStyle,
                                fontWeight: 800,
                                color: (numeroTicketPorColeta.get(c.id) ?? "").trim() ? "#0f172a" : "#94a3b8",
                                whiteSpace: "nowrap",
                              }}
                              title="Número do ticket operacional (impresso)"
                            >
                              {(numeroTicketPorColeta.get(c.id) ?? "").trim() || "—"}
                            </td>
                          </>
                        ) : null}
                        <td style={tdListaColetaStyle}>{c.placa || "—"}</td>
                        {modoTela === "auditoria" ? (
                          <td style={tdListaColetaStyle}>
                            {c.programacao_id
                              ? tipoCaminhaoPorProgramacao[c.programacao_id] ?? "—"
                              : "—"}
                          </td>
                        ) : null}
                        <td
                          style={{
                            ...tdListaColetaStyle,
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.cliente || "—"}
                        </td>
                        <td
                          style={{
                            ...tdListaColetaStyle,
                            maxWidth: "160px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={c.tipo_residuo || undefined}
                        >
                          {c.tipo_residuo || "—"}
                        </td>
                        {modoTela === "auditoria" ? (
                          <>
                            <td style={{ ...tdListaColetaStyle, textAlign: "right" }}>
                              {formatarNumero(c.peso_bruto)}
                            </td>
                            <td style={{ ...tdListaColetaStyle, textAlign: "right" }}>
                              {formatarNumero(c.peso_tara)}
                            </td>
                          </>
                        ) : null}
                        <td style={{ ...tdListaColetaStyle, textAlign: "right" }}>
                          {formatarNumero(c.peso_liquido)}
                        </td>
                        {modoTela === "auditoria" ? (
                          <td style={tdListaColetaStyle}>
                            <div style={{ fontWeight: 700, fontSize: "12px", color: "#0f766e" }}>
                              {formatarFaseFluxoOficialParaUI(c.etapaFluxo)}
                            </div>
                            <div
                              style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}
                              title={formatarEtapaParaUI(c.etapaFluxo)}
                            >
                              {formatarEtapaParaUI(c.etapaFluxo)}
                            </div>
                          </td>
                        ) : null}
                        <td
                          style={{ ...tdListaColetaStyle, whiteSpace: "nowrap" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                              alignItems: "center",
                              justifyContent: "flex-start",
                            }}
                          >
                            <button
                              type="button"
                              className="coleta-acao-btn"
                              onClick={() => selecionarColetaParaPesagem(c)}
                              title="Abrir no lançamento de pesagem"
                              style={botaoAcaoColetaListaStyle}
                            >
                              {modoTela === "operacao" ? "Abrir" : "Acessar"}
                            </button>
                            {modoTela === "auditoria" ? (
                              <>
                                <button
                                  type="button"
                                  className="coleta-acao-btn"
                                  onClick={() =>
                                    navigate(`/mtr?${montarParamsFluxo(c).toString()}`)
                                  }
                                  disabled={!podeEditarOuExcluirColeta}
                                  title={
                                    podeEditarOuExcluirColeta
                                      ? "Editar na página MTR"
                                      : "Apenas operacional ou administrador"
                                  }
                                  style={{
                                    ...botaoAcaoColetaListaStyle,
                                    ...(!podeEditarOuExcluirColeta
                                      ? botaoAcaoColetaListaDisabledStyle
                                      : {}),
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="coleta-acao-btn"
                                  onClick={() => void excluirColetaDaLista(c)}
                                  disabled={
                                    !podeEditarOuExcluirColeta || excluindoColetaId === c.id
                                  }
                                  title={
                                    podeEditarOuExcluirColeta
                                      ? "Excluir esta coleta"
                                      : "Apenas operacional ou administrador"
                                  }
                                  style={{
                                    ...botaoAcaoColetaListaStyle,
                                    background: "#fef2f2",
                                    color: "#b91c1c",
                                    borderColor: "#fecaca",
                                    ...(!podeEditarOuExcluirColeta || excluindoColetaId === c.id
                                      ? botaoAcaoColetaListaDisabledStyle
                                      : {}),
                                  }}
                                >
                                  {excluindoColetaId === c.id ? "…" : "Excluir"}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loadingVinculo && coletasListaFiltradas.length === 0 ? (
              <div
                style={{
                  padding: "22px",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                Nenhuma coleta com este filtro.
              </div>
            ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div
          id="massa-form-anchor"
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
            order: modoTela === "operacao" ? 1 : 2,
          }}
        >
          <button
            type="button"
            onClick={() => setSecaoPesagemAberta((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "16px 20px",
              border: "none",
              borderBottom: secaoPesagemAberta ? "1px solid #e5e7eb" : "none",
              background: "#ffffff",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Lançar pesagem
                {modoTela === "operacao" ? (
                  <span
                    style={{
                      marginLeft: "10px",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#0f766e",
                      verticalAlign: "middle",
                    }}
                  >
                    passo principal
                  </span>
                ) : null}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#64748b", lineHeight: 1.45 }}>
                {secaoPesagemAberta
                  ? "Preencha os passos 1–4 e use «Salvar pesagem e ticket» — a coleta segue para o Faturamento."
                  : "Abra para lançar pesagem e ticket. Pode fechar para ver mais da lista em Auditoria."}
              </p>
            </div>
            <span style={{ flexShrink: 0, fontSize: "12px", color: "#64748b" }} aria-hidden>
              {secaoPesagemAberta ? "▲" : "▼"}
            </span>
          </button>

          {secaoPesagemAberta ? (
            <>
            <form
              onSubmit={handleSalvarRegistro}
              style={{
                padding: "22px 20px 20px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {somenteTicketPadrao ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #99f6e4",
                    background: "#f0fdfa",
                    fontSize: "13px",
                    color: "#0f766e",
                    fontWeight: 600,
                    lineHeight: 1.45,
                  }}
                >
                  Perfil <strong>Operadores (Time R)</strong>: lançamento de pesagem e ticket no formato
                  padrão (saída, número da MTR). Sem acesso a alterações de faturamento ou
                  financeiro.
                </div>
              ) : null}
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: "10px",
                  }}
                >
                  1. MTR
                </div>

                <ControleMassaMtrPicker
                  comboRef={mtrComboRef}
                  aberto={mtrPickerAberto}
                  onToggleAberto={() => {
                    if (loadingVinculo) return;
                    setMtrPickerAberto((aberto) => {
                      const prox = !aberto;
                      if (prox) setFiltroMtr("");
                      return prox;
                    });
                  }}
                  loading={loadingVinculo}
                  filtro={filtroMtr}
                  onFiltroChange={setFiltroMtr}
                  linhasFiltradas={opcoesMtrFiltradas}
                  valorExibido={valorSelectMtrExibido}
                  coletaIdSelecionada={form.coleta_id.trim()}
                  mtrSemColetaId={mtrSemColetaSelecionado}
                  resumoSelecao={resumoSelecaoMtr}
                  coletasAtalho={coletasAtalhoMtr}
                  onSelecionar={(v) => {
                    aplicarSelecaoVinculo(v);
                    setMtrPickerAberto(false);
                    setFiltroMtr("");
                  }}
                  mostrarColetaSemMtr={mostrarOpcaoColetaSemMtr}
                  coletaSemMtr={opcaoColetaSemMtr}
                  semResultados={
                    Boolean(filtroMtrNorm) &&
                    mtrsLista.length > 0 &&
                    opcoesMtrFiltradas.length === 0 &&
                    !(mostrarOpcaoColetaSemMtr && opcaoColetaSemMtr)
                  }
                  filtroAtivo={filtroMtr}
                />

                {!loadingVinculo && mtrsLista.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#b45309", margin: "10px 0 0", lineHeight: 1.4 }}>
                    Ainda não há dados. Crie programação e MTR primeiro.
                  </p>
                ) : null}
              </div>

              {/* CARD 2 — PESAGEM (principal) */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "16px",
                  background: "#ffffff",
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: "14px" }}>2. Pesagem</div>
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                      Preencha os campos essenciais. O peso líquido é calculado automaticamente.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                    gap: "12px",
                    marginTop: "14px",
                  }}
                >
                  <div style={{ gridColumn: "span 3" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Data</label>
                    <input
                      ref={dataInputRef}
                      type="date"
                      name="data"
                      value={form.data}
                      onChange={handleInputChange}
                      style={{ ...inputStyle, height: "44px", fontSize: "14px" }}
                    />
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, lineHeight: 1.35 }}>
                      Data da operação (aparece no ticket impresso).
                    </div>
                  </div>

                  <div style={{ gridColumn: "span 3" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Placa</label>
                    <input
                      ref={placaInputRef}
                      name="placa"
                      value={form.placa}
                      onChange={handleInputChange}
                      placeholder="ABC-1234"
                      style={{ ...inputStyle, height: "44px", fontSize: "14px" }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 6" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Tipo veículo</label>
                    <input
                      value={
                        form.coleta_id.trim()
                          ? tipoCaminhaoPorProgramacao[
                              (todasColetas.find((x) => x.id === form.coleta_id.trim())
                                ?.programacao_id ?? "") as string
                            ] ?? "—"
                          : mtrSemColetaSelecionado
                            ? tipoVeiculoMtrSelecionada || "—"
                            : "—"
                      }
                      readOnly
                      style={{ ...inputStyle, height: "44px", fontSize: "14px", background: "#f8fafc" }}
                      placeholder="—"
                    />
                  </div>

                  <div style={{ gridColumn: "span 4" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Motorista</label>
                    <input
                      name="motorista"
                      value={form.motorista}
                      onChange={handleInputChange}
                      placeholder="Motorista"
                      style={{ ...inputStyle, height: "44px", fontSize: "14px" }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 4" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Empresa</label>
                    <input
                      name="empresa"
                      value={form.empresa}
                      onChange={handleInputChange}
                      placeholder="Empresa"
                      style={{ ...inputStyle, height: "44px", fontSize: "14px" }}
                    />
                  </div>

                  <PesagemResiduosLista
                    linhas={form.residuos_linhas}
                    onLinhasChange={(linhas) =>
                      setForm((prev) => mergeFormResiduosLinhas(prev, linhas))
                    }
                    inputStyle={inputStyle}
                    residuosContrato={residuosContratoCliente}
                  />


                </div>
              </div>

              {/* CARD 3 — GERAÇÃO DE TICKET */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "16px",
                  background: "#ffffff",
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: "14px" }}>3. Dados do ticket</div>
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                      Tipo (entrada / saída / frete), número do ticket e, se quiser, uma nota curta. Isto é o que vai para
                      o documento impresso.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                    gap: "12px",
                    marginTop: "14px",
                    alignItems: "start",
                  }}
                >
                  <div style={{ gridColumn: "span 4" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Tipo de ticket</label>
                    <select
                      ref={tipoTicketRef}
                      name="tipo_ticket"
                      value={form.tipo_ticket}
                      onChange={handleInputChange}
                      disabled={somenteTicketPadrao}
                      title={
                        somenteTicketPadrao
                          ? "Perfil com ticket apenas no formato padrão (saída)."
                          : undefined
                      }
                      style={{
                        ...inputStyle,
                        height: "44px",
                        fontSize: "14px",
                        ...(somenteTicketPadrao ? { background: "#f8fafc" } : {}),
                      }}
                    >
                      <option value="saida">Saída</option>
                      <option value="entrada">Entrada</option>
                      <option value="frete">Frete</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: "span 4" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                      Número
                      {numeroTicketAutoMtr ? (
                        <span style={{ fontWeight: 600, color: "#64748b", marginLeft: 6 }}>
                          (sufixo MTR)
                        </span>
                      ) : null}
                    </label>
                    <input
                      name="numero_ticket"
                      value={form.numero_ticket}
                      onChange={handleInputChange}
                      readOnly={numeroTicketAutoMtr || somenteTicketPadrao}
                      placeholder={
                        numeroTicketAutoMtr || somenteTicketPadrao
                          ? "Gerado da MTR"
                          : "N.º ticket"
                      }
                      title={
                        numeroTicketAutoMtr && mtrSelecionada?.numero
                          ? `Gerado automaticamente a partir da MTR ${mtrSelecionada.numero}`
                          : undefined
                      }
                      style={{
                        ...inputStyle,
                        height: "44px",
                        fontSize: "14px",
                        ...(numeroTicketAutoMtr ? { background: "#f8fafc" } : {}),
                      }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 4" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Prévia</label>
                    <div
                      style={{
                        border: "1px dashed #cbd5e1",
                        borderRadius: "12px",
                        padding: "10px 12px",
                        background: "#f8fafc",
                        fontSize: "12px",
                        color: "#0f172a",
                        lineHeight: 1.4,
                        fontWeight: 700,
                      }}
                    >
                      <div style={{ fontWeight: 900, marginBottom: 4 }}>Ticket {formatarTipoTicketLista(form.tipo_ticket)}</div>
                      <div style={{ color: "#475569", fontWeight: 700 }}>
                        Nº: <span style={{ color: "#0f172a" }}>{form.numero_ticket.trim() || "—"}</span>
                      </div>
                      <div style={{ color: "#475569", fontWeight: 700 }}>
                        Líq.: <span style={{ color: "#0f172a" }}>{form.peso_liquido.trim() || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ gridColumn: "span 12" }} className="field">
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                      Nota no ticket (opcional)
                    </label>
                    <textarea
                      name="descricao_ticket"
                      value={form.descricao_ticket}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, descricao_ticket: e.target.value }))
                      }
                      rows={2}
                      placeholder="Ex.: observação interna que deve aparecer no ticket impresso. Deixe vazio se não precisar."
                      style={{
                        width: "100%",
                        borderRadius: "12px",
                        border: "1px solid #d1d5db",
                        padding: "10px 12px",
                        fontSize: "13px",
                        outline: "none",
                        resize: "vertical",
                        lineHeight: 1.45,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* CARD 4 — AÇÃO FINAL */}
              <div id="massa-finalizar-anchor" style={massaAcaoFinalCardStyle}>
                <div style={{ flex: "1 1 220px", maxWidth: "420px" }}>
                  <h3 style={massaAcaoFinalTituloStyle}>4. Guardar e imprimir</h3>
                  <p style={massaAcaoFinalDescStyle}>
                    {multiTicketImpressao
                      ? "Salve uma vez para gerar os tickets. Depois imprima cada um separadamente."
                      : form.coleta_id.trim() || coletasImpressaoSessao.length > 0
                        ? "Salvar envia ao Faturamento. Imprimir abre só o ticket em papel."
                        : "Selecione uma MTR ou coleta no passo 1 antes de salvar."}
                  </p>
                </div>

                <div style={massaAcoesBarStyle}>
                  <div style={massaAcoesLinhaStyle}>
                    <button
                      type="submit"
                      disabled={salvando || !podeMutarMassa}
                      title={
                        !podeMutarMassa
                          ? "Apenas balanceiro ou administrador pode salvar."
                          : undefined
                      }
                      style={{
                        ...massaBtnPrimarioStyle,
                        background: podeMutarMassa ? "#0f172a" : "#e2e8f0",
                        borderColor: podeMutarMassa ? "#0f172a" : "#e2e8f0",
                        color: podeMutarMassa ? "#ffffff" : "#64748b",
                        cursor: salvando || !podeMutarMassa ? "not-allowed" : "pointer",
                        opacity: salvando || !podeMutarMassa ? 0.75 : 1,
                      }}
                    >
                      {salvando ? "Salvando…" : "Salvar pesagem e ticket"}
                    </button>
                    <button
                      type="button"
                      onClick={() => limparFormularioPesagem()}
                      style={massaBtnSecundarioStyle}
                    >
                      Limpar
                    </button>
                  </div>

                  {(multiTicketImpressao || coletasImpressaoSessao.length >= 2) && (
                    <div style={massaImpressaoGrupoStyle}>
                      <span style={massaImpressaoLabelStyle}>Impressão</span>
                      {ticketsSegmentoImpressao.map((seg) => {
                        const ocupado = Boolean(imprimindoTicketColetaId);
                        const ativo = imprimindoTicketColetaId === seg.coletaId;
                        const habilitado =
                          podeMutarMassa && seg.prontoImprimir && !ocupado && !salvando;
                        return (
                          <button
                            key={`imprimir-ticket-${seg.indice}`}
                            type="button"
                            onClick={() =>
                              void imprimirTicketDaColeta(
                                seg.coletaId,
                                `Ticket ${seg.indice}`
                              )
                            }
                            disabled={!habilitado}
                            title={
                              seg.prontoImprimir
                                ? `Ticket ${seg.numeroTicket || seg.indice} — ${seg.texto}`
                                : "Salve a pesagem deste resíduo antes de imprimir."
                            }
                            style={{
                              ...massaBtnSecundarioStyle,
                              borderColor: habilitado ? "#0f172a" : "#e2e8f0",
                              color: habilitado ? "#0f172a" : "#94a3b8",
                              background: habilitado ? "#f8fafc" : "#ffffff",
                              cursor: habilitado ? "pointer" : "not-allowed",
                              opacity: ativo ? 0.7 : 1,
                            }}
                          >
                            {ativo ? "Abrindo…" : `Ticket ${seg.indice}`}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {!multiTicketImpressao && coletasImpressaoSessao.length < 2 && (
                    <div style={massaImpressaoGrupoStyle}>
                      <span style={massaImpressaoLabelStyle}>Impressão</span>
                      <button
                        type="button"
                        onClick={() => {
                          const cid = coletaIdImpressaoUnica;
                          if (!cid) return;
                          void imprimirTicketDaColeta(cid, "Ticket");
                        }}
                        disabled={
                          !podeImprimirTicket ||
                          !podeMutarMassa ||
                          salvando ||
                          Boolean(imprimindoTicketColetaId)
                        }
                        title={
                          !podeMutarMassa
                            ? "Sem permissão para registar impressão do ticket."
                            : podeImprimirTicket
                              ? "Abre a impressão do ticket (papel térmico / A4)."
                              : "Guarde primeiro com «Salvar»."
                        }
                        style={{
                          ...massaBtnSecundarioStyle,
                          borderColor: podeImprimirTicket ? "#0f172a" : "#e2e8f0",
                          color: podeImprimirTicket ? "#0f172a" : "#94a3b8",
                          background: podeImprimirTicket ? "#f8fafc" : "#ffffff",
                          cursor: podeImprimirTicket ? "pointer" : "not-allowed",
                        }}
                      >
                        {imprimindoTicketColetaId ? "Abrindo…" : "Imprimir ticket"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </form>

            <div
              id="ticket-operacional-anchor"
              style={{
                marginTop: "10px",
                borderTop: "1px solid #e5e7eb",
                padding: "12px 16px 16px",
                background: "#f8fafc",
                borderRadius: "0 0 16px 16px",
              }}
            >
              <details
                style={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  padding: "10px 14px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontWeight: 800,
                    color: "#334155",
                    fontSize: "13px",
                    listStyle: "none",
                  }}
                >
                  Mais opções do ticket — corrigir dados, gravar de novo ou enviar para aprovação
                  <span style={{ color: "#94a3b8", fontWeight: 700, marginLeft: "8px" }}>(clique para expandir)</span>
                </summary>
                <p style={{ margin: "10px 0 12px", fontSize: "12px", color: "#64748b", lineHeight: 1.45 }}>
                  Use apenas se precisar alterar o ticket depois de salvar, se o sistema avisar falha ao gerar o ticket, ou
                  para enviar a coleta à aprovação. O fluxo normal é: preencher o passo 3 acima, salvar e imprimir.
                </p>
                <TicketOperacionalPanel
                  variant="embedded"
                  simplifyEmbedded
                  coletaAtiva={coletaTicketSnapshot}
                  dataPesagemAtual={form.coleta_id.trim() ? form.data : null}
                  numeroTicketExterno={
                    form.coleta_id.trim()
                      ? form.numero_ticket || numeroTicketPorColeta.get(form.coleta_id.trim()) || null
                      : null
                  }
                  impressaoPendenteColetaId={imprimindoTicketColetaId}
                  camposImpressaoPesagem={
                    camposImpressaoPesagem &&
                    coletaTicketSnapshot?.id === camposImpressaoPesagem.coletaId
                      ? {
                          motorista: camposImpressaoPesagem.motorista,
                          placa: camposImpressaoPesagem.placa,
                        }
                      : null
                  }
                  cargo={usuarioCargo}
                  coletasOpcoes={coletasTicketOpcoes}
                  carregandoColetas={loadingVinculo}
                  ocultarSeletorColeta={Boolean(form.coleta_id.trim())}
                  onTrocarColeta={(id) => {
                    void (async () => {
                      if (!id) {
                        setMtrSemColetaSelecionado(null);
                        setForm((prev) => ({ ...prev, coleta_id: "" }));
                        return;
                      }
                      let c = todasColetas.find((x) => x.id === id);
                      if (!c) {
                        const extra = await buscarColetasPorIds([id]);
                        c = extra[0];
                        if (c) {
                          setTodasColetas((prev) =>
                            prev.some((x) => x.id === c!.id) ? prev : [...prev, c!]
                          );
                        }
                      }
                      if (c) aplicarColetaNoForm(c);
                    })();
                  }}
                  onEtapaColetaAlterada={() => {
                    void fetchMtrsEColetas();
                  }}
                />
              </details>
            </div>
            </>
          ) : null}
        </div>
      </div>
      </div>
    </MainLayout>
  );
}

const botaoContextoSecundarioStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "8px 12px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "13px",
  color: "#334155",
};

const botaoLimparUrlStyle: CSSProperties = {
  background: "#ffffff",
  color: "#64748b",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "8px 12px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "13px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: "40px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  outline: "none",
  padding: "0 12px",
  fontSize: "14px",
  color: "#0f172a",
  boxSizing: "border-box",
};

const thListaColetaStyle: CSSProperties = {
  textAlign: "left",
  padding: "5px 8px",
  fontWeight: 700,
  color: "#0f172a",
  whiteSpace: "nowrap",
  fontSize: "11px",
};

const tdListaColetaStyle: CSSProperties = {
  padding: "4px 8px",
  verticalAlign: "top",
  fontSize: "11px",
  color: "#1f2937",
};

const botaoAcaoColetaListaStyle: CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  padding: "3px 7px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1d4ed8",
  cursor: "pointer",
  lineHeight: 1.2,
};

const botaoAcaoColetaListaDisabledStyle: CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};
