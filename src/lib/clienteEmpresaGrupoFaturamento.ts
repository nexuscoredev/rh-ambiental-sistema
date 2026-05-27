export type EmpresaGrupoFaturamentoForm = {
  rg1: boolean
  rg1_brasdeco: boolean
  rg1_caixa: boolean
  rg1_itau: boolean
  rg2: boolean
  sdl: boolean
}

export type EmpresaGrupoFaturamentoDb = {
  rg1?: boolean | null
  rg1_brasdeco?: boolean | null
  rg1_caixa?: boolean | null
  rg1_itau?: boolean | null
  rg2?: boolean | null
  sdl?: boolean | null
}

export const empresaGrupoFaturamentoInicial: EmpresaGrupoFaturamentoForm = {
  rg1: false,
  rg1_brasdeco: false,
  rg1_caixa: false,
  rg1_itau: false,
  rg2: false,
  sdl: false,
}

function bool(raw: unknown): boolean {
  return raw === true
}

export function normalizarEmpresaGrupoFaturamentoForm(
  raw: unknown
): EmpresaGrupoFaturamentoForm {
  if (!raw || typeof raw !== 'object') return { ...empresaGrupoFaturamentoInicial }
  const o = raw as EmpresaGrupoFaturamentoDb
  return {
    rg1: bool(o.rg1),
    rg1_brasdeco: bool(o.rg1_brasdeco),
    rg1_caixa: bool(o.rg1_caixa),
    rg1_itau: bool(o.rg1_itau),
    rg2: bool(o.rg2),
    sdl: bool(o.sdl),
  }
}

export function empresaGrupoFaturamentoTemSelecao(form: EmpresaGrupoFaturamentoForm): boolean {
  return form.rg1 || form.rg2 || form.sdl
}

export function payloadEmpresaGrupoFaturamento(
  form: EmpresaGrupoFaturamentoForm
): { empresa_grupo_faturamento: EmpresaGrupoFaturamentoDb | null } {
  const limpo: EmpresaGrupoFaturamentoForm = {
    rg1: form.rg1,
    rg1_brasdeco: form.rg1 ? form.rg1_brasdeco : false,
    rg1_caixa: form.rg1 ? form.rg1_caixa : false,
    rg1_itau: form.rg1 ? form.rg1_itau : false,
    rg2: form.rg2,
    sdl: form.sdl,
  }
  if (!empresaGrupoFaturamentoTemSelecao(limpo)) {
    return { empresa_grupo_faturamento: null }
  }
  return {
    empresa_grupo_faturamento: {
      rg1: limpo.rg1 || null,
      rg1_brasdeco: limpo.rg1_brasdeco || null,
      rg1_caixa: limpo.rg1_caixa || null,
      rg1_itau: limpo.rg1_itau || null,
      rg2: limpo.rg2 || null,
      sdl: limpo.sdl || null,
    },
  }
}

export function rotuloEmpresaGrupoFaturamento(
  form: EmpresaGrupoFaturamentoForm | null | undefined
): string | null {
  if (!form || !empresaGrupoFaturamentoTemSelecao(form)) return null
  const partes: string[] = []
  if (form.rg1) {
    const subs: string[] = []
    if (form.rg1_brasdeco) subs.push('Bradesco')
    if (form.rg1_caixa) subs.push('Caixa')
    if (form.rg1_itau) subs.push('Itaú')
    partes.push(subs.length > 0 ? `RG 1 (${subs.join(', ')})` : 'RG 1')
  }
  if (form.rg2) partes.push('RG 2')
  if (form.sdl) partes.push('SDL')
  return partes.length > 0 ? partes.join(' · ') : null
}

export function isMissingEmpresaGrupoFaturamentoColumnError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  if (!msg) return false
  return msg.includes('empresa_grupo_faturamento')
}
