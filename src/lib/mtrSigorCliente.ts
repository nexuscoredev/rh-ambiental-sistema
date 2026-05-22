/** Opção SIGOR no cadastro de clientes (coluna `clientes.mtr_sigor` — texto). */
export type MtrSigorOpcao = 'cliente' | 'rg' | 'nao_tem'

const OPCOES_VALIDAS: MtrSigorOpcao[] = ['cliente', 'rg', 'nao_tem']

export function rotuloMtrSigor(valor: unknown): string {
  const op = normalizarMtrSigorValor(valor)
  if (op === 'cliente') return 'Cliente'
  if (op === 'rg') return 'RG'
  if (op === 'nao_tem') return 'Não tem'
  return '—'
}

/** Aceita valor novo (texto), legado boolean (true→cliente, false→nao_tem) ou null. */
export function normalizarMtrSigorValor(raw: unknown): MtrSigorOpcao | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'boolean') {
    if (raw === true) return 'cliente'
    if (raw === false) return 'nao_tem'
    return null
  }
  const t = String(raw).trim().toLowerCase()
  if (!t) return null
  if (t === 'cliente' || t === 'cli') return 'cliente'
  if (t === 'rg' || t === 'r.g.' || t === 'r g') return 'rg'
  if (
    t === 'nao_tem' ||
    t === 'nao tem' ||
    t === 'não tem' ||
    t === 'nao' ||
    t === 'não' ||
    t === 'n' ||
    t === 'sem' ||
    t === 'nenhum'
  ) {
    return 'nao_tem'
  }
  if (['sim', 's', 'yes', 'y', '1', 'true', 'x'].includes(t)) return 'cliente'
  return null
}

export function parseMtrSigorImport(raw: string | undefined | null): MtrSigorOpcao | null {
  return normalizarMtrSigorValor(raw)
}

export function mtrSigorOpcaoValida(op: string | null | undefined): op is MtrSigorOpcao {
  return OPCOES_VALIDAS.includes(op as MtrSigorOpcao)
}
