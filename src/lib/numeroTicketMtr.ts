/**
 * Número do ticket operacional derivado do sufixo (parte final) do número da MTR.
 * Ex.: `2650/2026` → `2650`; `MTR-20260520-143022` → `143022`.
 */

/** Extrai o sufixo final usado como base do número do ticket. */
export function extrairSufixoFinalNumeroMtr(numeroMtr: string): string {
  const bruto = String(numeroMtr ?? "").trim();
  if (!bruto) return "";

  const formatoBarra = /^(\d+)\s*\/\s*(\d{4})$/.exec(bruto);
  if (formatoBarra) {
    return formatoBarra[1]!.trim();
  }

  const partes = bruto.split(/[/-]/).map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) {
    const soDigitos = bruto.replace(/\D/g, "");
    return soDigitos || bruto;
  }

  const ultima = partes[partes.length - 1]!;
  if (/^\d{4}$/.test(ultima) && partes.length > 1) {
    return partes[partes.length - 2]!;
  }

  return ultima;
}

/**
 * Gera o número do ticket a partir da MTR.
 * Vários resíduos (vários tickets): sufixo-1, sufixo-2, …
 */
export function numeroTicketFromMtr(
  numeroMtr: string,
  indiceSegmento = 0,
  totalSegmentos = 1
): string {
  const sufixo = extrairSufixoFinalNumeroMtr(numeroMtr);
  if (!sufixo) return "";

  const total = Math.max(1, totalSegmentos);
  const idx = Math.max(0, indiceSegmento);
  if (total <= 1) return sufixo;
  return `${sufixo}-${idx + 1}`;
}

export function podeGerarNumeroTicketFromMtr(numeroMtr: string | null | undefined): boolean {
  return extrairSufixoFinalNumeroMtr(String(numeroMtr ?? "")).length > 0;
}
