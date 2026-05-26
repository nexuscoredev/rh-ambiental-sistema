import { formatarCNPJ } from './clienteCadastroForm'

export type GeradorDonoFaturamentoOpcao = 'sim' | 'nao'

export type ClienteGeradorDonoFaturamentoCampos = {
  gerador_dono_faturamento?: string | null
  faturamento_titular_razao_social?: string | null
  faturamento_titular_cnpj?: string | null
}

export function normalizarGeradorDonoFaturamentoOpcao(
  raw: string | null | undefined
): GeradorDonoFaturamentoOpcao | null {
  const t = (raw ?? '').trim().toLowerCase()
  if (t === 'sim' || t === 's') return 'sim'
  if (t === 'nao' || t === 'não' || t === 'n') return 'nao'
  return null
}

export function validarGeradorDonoFaturamentoForm(form: {
  gerador_dono_faturamento: string
  faturamento_titular_razao_social: string
  faturamento_titular_cnpj: string
}): { ok: true } | { ok: false; message: string } {
  const opcao = normalizarGeradorDonoFaturamentoOpcao(form.gerador_dono_faturamento)
  if (!opcao) {
    return {
      ok: false,
      message: 'Indique se o gerador é dono do faturamento (Sim ou Não).',
    }
  }
  if (opcao === 'nao') {
    if (!form.faturamento_titular_razao_social.trim()) {
      return { ok: false, message: 'Informe a Razão Social do dono do faturamento.' }
    }
    if (!form.faturamento_titular_cnpj.trim()) {
      return { ok: false, message: 'Informe o CNPJ do dono do faturamento.' }
    }
  }
  return { ok: true }
}

export function payloadGeradorDonoFaturamento(form: {
  gerador_dono_faturamento: string
  faturamento_titular_razao_social: string
  faturamento_titular_cnpj: string
}): ClienteGeradorDonoFaturamentoCampos {
  const opcao = normalizarGeradorDonoFaturamentoOpcao(form.gerador_dono_faturamento)
  if (!opcao) {
    return {
      gerador_dono_faturamento: null,
      faturamento_titular_razao_social: null,
      faturamento_titular_cnpj: null,
    }
  }
  if (opcao === 'sim') {
    return {
      gerador_dono_faturamento: 'sim',
      faturamento_titular_razao_social: null,
      faturamento_titular_cnpj: null,
    }
  }
  return {
    gerador_dono_faturamento: 'nao',
    faturamento_titular_razao_social: form.faturamento_titular_razao_social.trim(),
    faturamento_titular_cnpj: formatarCNPJ(form.faturamento_titular_cnpj),
  }
}

export function isMissingGeradorDonoFaturamentoColumnsError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  if (!msg) return false
  return (
    msg.includes('gerador_dono_faturamento') ||
    msg.includes('faturamento_titular_razao_social') ||
    msg.includes('faturamento_titular_cnpj')
  )
}
