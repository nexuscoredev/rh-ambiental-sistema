const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Separa e-mails de NF (vírgula ou ponto e vírgula), trim e deduplica (case-insensitive). */
export function parsearEmailsNf(raw: string | null | undefined): string[] {
  const partes = (raw ?? "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const p of partes) {
    const chave = p.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(p);
  }
  return lista;
}

export function emailsNfValidos(raw: string | null | undefined): string[] {
  return parsearEmailsNf(raw).filter((e) => EMAIL_RE.test(e));
}

export function emailNfTemAlgum(raw: string | null | undefined): boolean {
  return emailsNfValidos(raw).length > 0;
}

/** Mantém só endereços válidos, gravados separados por `;`. */
export function normalizarEmailNfLista(raw: string | null | undefined): string | null {
  const validos = emailsNfValidos(raw);
  if (validos.length === 0) return null;
  return validos.join("; ");
}
