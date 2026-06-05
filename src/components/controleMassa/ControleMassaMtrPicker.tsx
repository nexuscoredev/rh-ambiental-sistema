import { useMemo, type CSSProperties, type RefObject } from "react";
import { formatarDataProgramacaoExibicao } from "../../lib/controleMassaFetch";
import { formatarEtapaParaUI, type EtapaFluxo } from "../../lib/fluxoEtapas";

export type MtrPickerMtr = {
  id: string;
  numero: string;
  cliente: string;
  tipo_residuo: string;
  status: string;
  /** Data da programação vinculada (`programacoes.data_programada`). */
  data_programada?: string | null;
};

export type MtrPickerColeta = {
  id: string;
  numero: string;
  cliente: string;
  tipo_residuo: string;
  etapaFluxo: EtapaFluxo;
  mtr_id?: string | null;
};

type LinhaOpcao = { mtr: MtrPickerMtr; coleta: MtrPickerColeta | null };

export type GrupoMtrPicker = {
  mtr: MtrPickerMtr;
  coletas: MtrPickerColeta[];
  /** Linha «pesar todos os resíduos» (só quando há 2+ coletas). */
  modoTodos: boolean;
};

export function agruparOpcoesMtrPicker(linhas: LinhaOpcao[]): GrupoMtrPicker[] {
  const map = new Map<string, GrupoMtrPicker>();

  for (const { mtr, coleta } of linhas) {
    if (!map.has(mtr.id)) {
      map.set(mtr.id, { mtr, coletas: [], modoTodos: false });
    }
    const g = map.get(mtr.id)!;
    if (!coleta) g.modoTodos = true;
    else g.coletas.push(coleta);
  }

  // Mantém a ordem canónica (linhas de resíduo / sufixo do ticket) vinda de `opcoesMtrParaPesagem`.
  return Array.from(map.values());
}

/** Paleta do passo 1 — tons suaves, fácil de distinguir sem poluir. */
const C = {
  ink: "#0f172a",
  inkMuted: "#475569",
  inkSoft: "#64748b",
  line: "#e2e8f0",
  surface: "#f8fafc",
  surfaceCard: "#ffffff",
  /** Ação recomendada / pesar todos */
  teal: "#0d9488",
  tealBg: "#f0fdfa",
  tealBorder: "#99f6e4",
  /** MTR sem coleta — atenção */
  amber: "#b45309",
  amberBg: "#fffbeb",
  amberBorder: "#fcd34d",
  /** Vários tickets */
  violet: "#6d28d9",
  violetBg: "#f5f3ff",
  violetBorder: "#c4b5fd",
  /** Ticket / coleta nova */
  sky: "#0369a1",
  skyBg: "#f0f9ff",
  skyBorder: "#7dd3fc",
  /** Etapa concluída */
  slate: "#334155",
  slateBg: "#f1f5f9",
  slateBorder: "#cbd5e1",
  /** Ticket gerado / ok */
  green: "#15803d",
  greenBg: "#ecfdf5",
  greenBorder: "#86efac",
  /** Financeiro / aprovação */
  blue: "#1d4ed8",
  blueBg: "#eff6ff",
  blueBorder: "#93c5fd",
} as const;

function estiloEtapaBadge(etapa: EtapaFluxo): CSSProperties {
  if (etapa === "TICKET_GERADO" || etapa === "APROVADO" || etapa === "FATURADO") {
    return { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` };
  }
  if (etapa === "FINALIZADO" || etapa === "ARQUIVADO") {
    return { background: C.slateBg, color: C.slate, border: `1px solid ${C.slateBorder}` };
  }
  if (etapa === "ENVIADO_APROVACAO" || etapa === "ENVIADO_FINANCEIRO") {
    return { background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBorder}` };
  }
  return { background: C.amberBg, color: C.amber, border: `1px solid ${C.amberBorder}` };
}

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

function LinhaDataProgramacao({ data }: { data?: string | null }) {
  const fmt = formatarDataProgramacaoExibicao(data);
  if (!fmt) return null;
  return (
    <div style={{ fontSize: "12px", color: C.inkSoft, marginTop: "4px" }}>
      Programação:{" "}
      <strong style={{ fontWeight: 700, color: C.inkMuted }}>{fmt}</strong>
    </div>
  );
}

type Props = {
  comboRef: RefObject<HTMLDivElement | null>;
  aberto: boolean;
  onToggleAberto: () => void;
  loading: boolean;
  filtro: string;
  onFiltroChange: (v: string) => void;
  linhasFiltradas: LinhaOpcao[];
  valorExibido: string;
  coletaIdSelecionada: string;
  mtrSemColetaId: string | null;
  resumoSelecao: ResumoSelecaoMtr | null;
  coletasAtalho: MtrPickerColeta[];
  onSelecionar: (valor: string) => void;
  mostrarColetaSemMtr: boolean;
  coletaSemMtr: MtrPickerColeta | null;
  semResultados: boolean;
  filtroAtivo: string;
};

export type ResumoSelecaoMtr =
  | { tipo: "vazio" }
  | { tipo: "mtr_todos"; mtr: MtrPickerMtr; qtdTickets: number }
  | { tipo: "mtr_unica"; mtr: MtrPickerMtr; coleta: MtrPickerColeta }
  | { tipo: "coleta"; mtrNumero: string; coleta: MtrPickerColeta; indiceTicket?: number }
  | { tipo: "mtr_nova"; mtr: MtrPickerMtr }
  | { tipo: "coleta_sem_mtr"; coleta: MtrPickerColeta };

export function ControleMassaMtrPicker({
  comboRef,
  aberto,
  onToggleAberto,
  loading,
  filtro,
  onFiltroChange,
  linhasFiltradas,
  valorExibido,
  coletaIdSelecionada,
  mtrSemColetaId,
  resumoSelecao,
  coletasAtalho,
  onSelecionar,
  mostrarColetaSemMtr,
  coletaSemMtr,
  semResultados,
  filtroAtivo,
}: Props) {
  const grupos = useMemo(
    () => agruparOpcoesMtrPicker(linhasFiltradas),
    [linhasFiltradas]
  );

  const multiAtalho = coletasAtalho.length > 1;
  /** MTR do grupo — permite voltar a «Pesar todos» mesmo com um ticket já selecionado. */
  const mtrIdGrupoAtalho =
    mtrSemColetaId ?? coletasAtalho[0]?.mtr_id?.trim() ?? null;

  return (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: "13px", color: C.inkSoft, lineHeight: 1.45 }}>
        Escolha a MTR. Com vários resíduos, use{" "}
        <strong style={{ color: C.teal }}>Pesar todos</strong> ou um{" "}
        <strong style={{ color: C.violet }}>ticket</strong> específico.
      </p>

      <div ref={comboRef} style={{ position: "relative", width: "100%" }}>
        <button
          type="button"
          disabled={loading}
          onClick={onToggleAberto}
          aria-expanded={aberto}
          aria-haspopup="listbox"
          style={{
            width: "100%",
            minHeight: "52px",
            borderRadius: "12px",
            border: `1px solid ${resumoSelecao && resumoSelecao.tipo !== "vazio" ? C.tealBorder : C.line}`,
            background:
              resumoSelecao && resumoSelecao.tipo !== "vazio" ? C.tealBg : C.surfaceCard,
            padding: "10px 14px",
            textAlign: "left",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.65 : 1,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "space-between",
            gap: "12px",
            boxSizing: "border-box",
          }}
        >
          {loading ? (
            <span style={{ fontSize: "14px", color: C.inkSoft, alignSelf: "center" }}>
              A carregar…
            </span>
          ) : resumoSelecao && resumoSelecao.tipo !== "vazio" ? (
            <ResumoTrigger resumo={resumoSelecao} />
          ) : (
            <span style={{ fontSize: "14px", color: "#94a3b8", alignSelf: "center" }}>
              Escolher MTR ou ticket…
            </span>
          )}
          <span
            style={{
              flexShrink: 0,
              alignSelf: "center",
              color: C.teal,
              fontSize: "12px",
              fontWeight: 700,
            }}
            aria-hidden
          >
            {aberto ? "▲" : "▼"}
          </span>
        </button>

        {aberto && !loading ? (
          <div
            role="listbox"
            style={{
              position: "absolute",
              zIndex: 50,
              left: 0,
              right: 0,
              top: "calc(100% + 6px)",
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: "14px",
              boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "min(420px, 72vh)",
            }}
          >
            <input
              type="search"
              autoComplete="off"
              autoFocus
              value={filtro}
              onChange={(e) => onFiltroChange(e.target.value)}
              placeholder="Buscar MTR, cliente ou resíduo…"
              onKeyDown={(e) => {
                if (e.key === "Escape") e.stopPropagation();
              }}
              style={{
                width: "100%",
                height: "44px",
                border: "none",
                borderBottom: `1px solid ${C.line}`,
                background: C.surfaceCard,
                padding: "0 14px",
                fontSize: "14px",
                color: C.ink,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "10px" }}>
              <button
                type="button"
                onClick={() => onSelecionar("")}
                style={btnLimparStyle}
              >
                Limpar seleção
              </button>

              {mostrarColetaSemMtr && coletaSemMtr ? (
                <button
                  type="button"
                  onClick={() => onSelecionar(`coleta:${coletaSemMtr.id}`)}
                  style={{
                    ...cardOpcaoStyle,
                    marginTop: "8px",
                    ...(valorExibido === `coleta:${coletaSemMtr.id}`
                      ? cardSelecionadoSkyStyle
                      : {}),
                  }}
                >
                  <div style={cardTituloStyle}>Coleta {coletaSemMtr.numero}</div>
                  <div style={cardSubStyle}>Sem MTR vinculada · {coletaSemMtr.cliente}</div>
                </button>
              ) : null}

              {grupos.map((grupo) => (
                <GrupoMtrCard
                  key={grupo.mtr.id}
                  grupo={grupo}
                  coletaIdSelecionada={coletaIdSelecionada}
                  mtrSemColetaId={mtrSemColetaId}
                  onSelecionar={onSelecionar}
                />
              ))}

              {semResultados ? (
                <div style={{ padding: "16px", fontSize: "13px", color: "#64748b" }}>
                  Nenhum resultado para «{filtroAtivo.trim()}».
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {multiAtalho ? (
        <div
          style={{
            marginTop: "12px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: C.inkSoft, marginRight: "4px" }}>
            Atalho:
          </span>
          <AtalhoChip
            ativo={!coletaIdSelecionada && Boolean(mtrSemColetaId)}
            rotulo="Pesar todos"
            onClick={() => {
              if (mtrIdGrupoAtalho) onSelecionar(mtrIdGrupoAtalho);
            }}
          />
          {coletasAtalho.map((c, i) => (
            <AtalhoChip
              key={c.id}
              ativo={coletaIdSelecionada === c.id}
              rotulo={`Ticket ${i + 1}`}
              detalhe={c.tipo_residuo || undefined}
              onClick={() => onSelecionar(`coleta:${c.id}`)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResumoTrigger({ resumo }: { resumo: ResumoSelecaoMtr }) {
  if (resumo.tipo === "mtr_todos") {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={resumoLinha1Style}>
          <span style={resumoMtrStyle}>{resumo.mtr.numero}</span>
          <span style={badgeTodosStyle}>{resumo.qtdTickets} tickets</span>
        </div>
        <div style={resumoLinha2Style}>{resumo.mtr.cliente}</div>
        <LinhaDataProgramacao data={resumo.mtr.data_programada} />
        <div style={resumoLinha3Style}>Pesar todos os resíduos</div>
      </div>
    );
  }
  if (resumo.tipo === "mtr_unica" || resumo.tipo === "coleta") {
    const coleta = resumo.coleta;
    const mtrNum = resumo.tipo === "coleta" ? resumo.mtrNumero : resumo.mtr.numero;
    const idx = resumo.tipo === "coleta" ? resumo.indiceTicket : undefined;
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={resumoLinha1Style}>
          <span style={resumoMtrStyle}>{mtrNum}</span>
          {idx != null ? <span style={badgeTicketStyle}>Ticket {idx}</span> : null}
          <EtapaBadge etapa={coleta.etapaFluxo} />
        </div>
        <div style={resumoLinha2Style}>{coleta.tipo_residuo || "Resíduo"}</div>
        <div style={resumoLinha3Style}>Coleta {coleta.numero}</div>
      </div>
    );
  }
  if (resumo.tipo === "mtr_nova") {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={resumoLinha1Style}>
          <span style={resumoMtrStyle}>{resumo.mtr.numero}</span>
          <span style={badgeSemColetaStyle}>Nova pesagem</span>
        </div>
        <div style={resumoLinha2Style}>{resumo.mtr.cliente}</div>
        <LinhaDataProgramacao data={resumo.mtr.data_programada} />
      </div>
    );
  }
  if (resumo.tipo === "coleta_sem_mtr") {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={resumoLinha1Style}>
          <span style={resumoMtrStyle}>Coleta {resumo.coleta.numero}</span>
        </div>
        <div style={resumoLinha2Style}>{resumo.coleta.cliente}</div>
      </div>
    );
  }
  return null;
}

function GrupoMtrCard({
  grupo,
  coletaIdSelecionada,
  mtrSemColetaId,
  onSelecionar,
}: {
  grupo: GrupoMtrPicker;
  coletaIdSelecionada: string;
  mtrSemColetaId: string | null;
  onSelecionar: (valor: string) => void;
}) {
  const { mtr, coletas, modoTodos } = grupo;
  const qtd = coletas.length;
  const varios = qtd > 1;
  const semColeta = qtd === 0;
  const faixaCor = semColeta ? C.amber : varios ? C.violet : C.teal;

  return (
    <div
      style={{
        ...grupoCardStyle,
        borderLeft: `4px solid ${faixaCor}`,
        background: semColeta ? C.amberBg : varios ? C.violetBg : C.surfaceCard,
      }}
    >
      <div style={grupoHeaderStyle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={grupoMtrNumStyle}>{mtr.numero}</div>
          <div style={grupoClienteStyle}>{mtr.cliente}</div>
          <LinhaDataProgramacao data={mtr.data_programada} />
        </div>
        {varios ? (
          <span style={badgeContagemStyle}>{qtd} tickets</span>
        ) : semColeta ? (
          <span style={badgeSemColetaStyle}>Sem coleta</span>
        ) : (
          <span style={badgeUmTicketStyle}>1 ticket</span>
        )}
      </div>

      {modoTodos && varios ? (
        <button
          type="button"
          onClick={() => onSelecionar(mtr.id)}
          style={{
            ...opcaoDestaqueStyle,
            background: C.tealBg,
            border: `1px solid ${C.tealBorder}`,
            ...(mtrSemColetaId === mtr.id && !coletaIdSelecionada
              ? cardSelecionadoTealStyle
              : {}),
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "13px", color: C.teal }}>
            Pesar todos os resíduos
          </div>
          <div style={{ fontSize: "12px", color: C.inkMuted, marginTop: "4px" }}>
            Recomendado · gera ou atualiza {qtd} tickets (1 por resíduo)
          </div>
        </button>
      ) : null}

      {qtd === 0 ? (
        <button
          type="button"
          onClick={() => onSelecionar(mtr.id)}
          style={{
            ...cardOpcaoStyle,
            background: C.skyBg,
            border: `1px solid ${C.skyBorder}`,
            ...(mtrSemColetaId === mtr.id && !coletaIdSelecionada
              ? cardSelecionadoSkyStyle
              : {}),
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "13px", color: C.sky }}>
            Iniciar pesagem nesta MTR
          </div>
          <div style={{ fontSize: "12px", color: C.inkMuted, marginTop: "4px" }}>
            Coleta e ticket criados ao salvar
          </div>
        </button>
      ) : null}

      {qtd === 1 && !modoTodos ? (
        <ColetaOpcaoRow
          coleta={coletas[0]!}
          indice={1}
          selecionada={coletaIdSelecionada === coletas[0]!.id}
          onClick={() => onSelecionar(`coleta:${coletas[0]!.id}`)}
        />
      ) : null}

      {varios ? (
        <div style={{ marginTop: modoTodos ? "8px" : 0 }}>
          <div style={subtituloTicketsStyle}>Ou um ticket específico</div>
          {coletas.map((c, i) => (
            <ColetaOpcaoRow
              key={c.id}
              coleta={c}
              indice={i + 1}
              selecionada={coletaIdSelecionada === c.id}
              onClick={() => onSelecionar(`coleta:${c.id}`)}
            />
          ))}
        </div>
      ) : null}

      {qtd === 1 && modoTodos ? (
        <ColetaOpcaoRow
          coleta={coletas[0]!}
          indice={1}
          selecionada={coletaIdSelecionada === coletas[0]!.id}
          onClick={() => onSelecionar(`coleta:${coletas[0]!.id}`)}
        />
      ) : null}
    </div>
  );
}

function ColetaOpcaoRow({
  coleta,
  indice,
  selecionada,
  onClick,
}: {
  coleta: MtrPickerColeta;
  indice: number;
  selecionada: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...cardOpcaoStyle,
        marginTop: "6px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        ...(selecionada ? cardSelecionadoVioletStyle : {}),
      }}
    >
      <span
        style={{
          ...indiceTicketStyle,
          background: selecionada ? C.violet : C.violetBg,
          borderColor: C.violetBorder,
          color: selecionada ? "#ffffff" : C.violet,
        }}
      >
        {indice}
      </span>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
          {coleta.tipo_residuo || "Resíduo"}
        </div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
          Coleta {coleta.numero}
        </div>
      </div>
      <EtapaBadge etapa={coleta.etapaFluxo} />
    </button>
  );
}

function EtapaBadge({ etapa }: { etapa: EtapaFluxo }) {
  return (
    <span style={{ ...badgeBase, ...estiloEtapaBadge(etapa) }}>
      {formatarEtapaParaUI(etapa)}
    </span>
  );
}

function AtalhoChip({
  ativo,
  rotulo,
  detalhe,
  onClick,
}: {
  ativo: boolean;
  rotulo: string;
  detalhe?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={detalhe}
      style={{
        height: "34px",
        padding: "0 12px",
        borderRadius: "10px",
        border: ativo
          ? `1px solid ${rotulo === "Pesar todos" ? C.teal : C.violet}`
          : `1px solid ${C.line}`,
        background: ativo
          ? rotulo === "Pesar todos"
            ? C.teal
            : C.violet
          : C.surfaceCard,
        color: ativo ? "#ffffff" : C.inkMuted,
        fontWeight: 700,
        fontSize: "12px",
        cursor: "pointer",
      }}
    >
      {rotulo}
    </button>
  );
}

const resumoLinha1Style: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
};

const badgeTodosStyle: CSSProperties = {
  ...badgeBase,
  background: C.tealBg,
  color: C.teal,
  border: `1px solid ${C.tealBorder}`,
};

const badgeTicketStyle: CSSProperties = {
  ...badgeBase,
  background: C.violet,
  color: "#ffffff",
  border: `1px solid ${C.violet}`,
};

const badgeSemColetaStyle: CSSProperties = {
  ...badgeBase,
  background: C.amberBg,
  color: C.amber,
  border: `1px solid ${C.amberBorder}`,
};

const badgeUmTicketStyle: CSSProperties = {
  ...badgeBase,
  background: C.tealBg,
  color: C.teal,
  border: `1px solid ${C.tealBorder}`,
};

const badgeContagemStyle: CSSProperties = {
  ...badgeBase,
  background: C.violetBg,
  color: C.violet,
  border: `1px solid ${C.violetBorder}`,
};

const grupoCardStyle: CSSProperties = {
  marginTop: "10px",
  border: `1px solid ${C.line}`,
  borderRadius: "12px",
  padding: "12px",
  background: C.surfaceCard,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const grupoHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px",
  marginBottom: "8px",
};

const grupoMtrNumStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  color: C.ink,
  letterSpacing: "-0.01em",
};

const grupoClienteStyle: CSSProperties = {
  fontSize: "12px",
  color: C.inkMuted,
  marginTop: "2px",
};

const opcaoDestaqueStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: "10px",
  cursor: "pointer",
};

const cardOpcaoStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: "10px",
  border: `1px solid ${C.line}`,
  background: C.surfaceCard,
  cursor: "pointer",
};

const cardSelecionadoTealStyle: CSSProperties = {
  borderColor: C.teal,
  background: C.tealBg,
  boxShadow: `0 0 0 2px ${C.tealBorder}`,
};

const cardSelecionadoSkyStyle: CSSProperties = {
  borderColor: C.sky,
  background: C.skyBg,
  boxShadow: `0 0 0 2px ${C.skyBorder}`,
};

const cardSelecionadoVioletStyle: CSSProperties = {
  borderColor: C.violet,
  background: C.violetBg,
  boxShadow: `0 0 0 2px ${C.violetBorder}`,
};

const cardTituloStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: "13px",
  color: C.ink,
};

const cardSubStyle: CSSProperties = {
  fontSize: "12px",
  color: C.inkMuted,
  marginTop: "4px",
};

const btnLimparStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "none",
  background: "transparent",
  color: C.inkSoft,
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
  borderRadius: "8px",
};

const subtituloTicketsStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: C.violet,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "6px",
  marginTop: "4px",
};

const indiceTicketStyle: CSSProperties = {
  flexShrink: 0,
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "13px",
  fontWeight: 800,
};

const resumoMtrStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 800,
  color: C.ink,
};

const resumoLinha2Style: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: C.inkMuted,
  marginTop: "2px",
};

const resumoLinha3Style: CSSProperties = {
  fontSize: "12px",
  color: C.inkSoft,
  marginTop: "2px",
};
