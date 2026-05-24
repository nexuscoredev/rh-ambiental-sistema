import {
  formatarCnpjParaArmazenar,
  formatarCpfParaArmazenar,
  validarCPF,
} from './brasilCadastro'
import { supabase } from './supabase'
import {
  CLINICA_GRUPO_NOME_PADRAO,
  type ClinicaContaReceberFilaRow,
  type ClinicaGrupo,
  type ClinicaOrdemServicoGerada,
  type ClinicaOrdemServicoDetalhe,
  type ListarOsClinicasFiltros,
  type ClinicaRelatorio30dRow,
  type ClinicaUnidade,
  type ClinicaUnidadeForm,
} from './clinicasTypes'

const UNIDADE_SELECT =
  'id, grupo_id, razao_social, cnpj, cpf, endereco_coleta, emite_nota, pagamento_pix, ativo, created_at'

function limparTexto(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

export async function obterGrupoClinicaPadrao(): Promise<
  { ok: true; grupo: ClinicaGrupo } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('clinicas_grupos')
    .select('id, nome, ativo')
    .eq('nome', CLINICA_GRUPO_NOME_PADRAO)
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message || 'Não foi possível carregar o grupo CLINICA.' }
  }
  if (!data?.id) {
    return {
      ok: false,
      message:
        'Grupo mãe CLINICA não encontrado. Execute a migration 20260625140000_clinicas_modulo.sql no Supabase.',
    }
  }
  return { ok: true, grupo: data as ClinicaGrupo }
}

export async function listarUnidadesClinicas(apenasAtivas = true): Promise<
  { ok: true; unidades: ClinicaUnidade[] } | { ok: false; message: string }
> {
  let q = supabase.from('clinicas_unidades').select(UNIDADE_SELECT).order('razao_social', { ascending: true })
  if (apenasAtivas) q = q.eq('ativo', true)

  const { data, error } = await q
  if (error) {
    return { ok: false, message: error.message || 'Erro ao listar unidades.' }
  }
  return { ok: true, unidades: (data || []) as ClinicaUnidade[] }
}

export async function salvarUnidadeClinica(
  grupoId: string,
  form: ClinicaUnidadeForm,
  unidadeId?: string | null
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const razao = form.razao_social.trim()
  if (!razao) return { ok: false, message: 'Informe a razão social.' }

  const cnpjRaw = form.cnpj.trim()
  const cpfRaw = form.cpf.trim()
  let cnpj: string | null = null
  let cpf: string | null = null

  if (cnpjRaw) {
    cnpj = formatarCnpjParaArmazenar(cnpjRaw)
    if (!cnpj) return { ok: false, message: 'CNPJ deve ter exatamente 14 dígitos.' }
  }
  if (cpfRaw) {
    cpf = formatarCpfParaArmazenar(cpfRaw)
    if (!cpf) return { ok: false, message: 'CPF deve ter exatamente 11 dígitos.' }
    if (!validarCPF(cpf)) return { ok: false, message: 'CPF inválido (dígitos verificadores).' }
  }

  const payload = {
    grupo_id: grupoId,
    razao_social: razao,
    cnpj,
    cpf,
    endereco_coleta: limparTexto(form.endereco_coleta),
    emite_nota: form.emite_nota,
    pagamento_pix: form.pagamento_pix,
    ativo: form.ativo,
    updated_at: new Date().toISOString(),
  }

  if (unidadeId) {
    const { error } = await supabase.from('clinicas_unidades').update(payload).eq('id', unidadeId)
    if (error) return { ok: false, message: error.message }
    return { ok: true, id: unidadeId }
  }

  const { data, error } = await supabase
    .from('clinicas_unidades')
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select('id')
    .single()

  if (error) return { ok: false, message: error.message }
  return { ok: true, id: String(data.id) }
}

export async function gerarOrdensServicoClinicasLote(
  unidadeIds: string[],
  dataServico?: string
): Promise<{ ok: true; geradas: ClinicaOrdemServicoGerada[] } | { ok: false; message: string }> {
  if (unidadeIds.length === 0) {
    return { ok: false, message: 'Selecione pelo menos uma clínica.' }
  }

  const { data, error } = await supabase.rpc('gerar_clinicas_ordens_servico_lote', {
    p_unidade_ids: unidadeIds,
    p_data_servico: dataServico || new Date().toISOString().slice(0, 10),
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('Could not find')) {
      return {
        ok: false,
        message:
          'RPC de clínicas não encontrada. Aplique a migration 20260625140000_clinicas_modulo.sql no Supabase.',
      }
    }
    return { ok: false, message: msg || 'Erro ao gerar ordens de serviço.' }
  }

  return { ok: true, geradas: (data || []) as ClinicaOrdemServicoGerada[] }
}

export async function listarRelatorioClinicas30d(): Promise<
  { ok: true; linhas: ClinicaRelatorio30dRow[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('vw_clinicas_relatorio_30d')
    .select('*')
    .order('razao_social', { ascending: true })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('Could not find')) {
      return {
        ok: false,
        message: 'View de relatório clínicas não encontrada. Aplique a migration no Supabase.',
      }
    }
    return { ok: false, message: msg }
  }

  const linhas = (data || []).map((r) => ({
    ...r,
    qtd_os: Number(r.qtd_os) || 0,
    valor_emitido_total: Number(r.valor_emitido_total) || 0,
    valor_pendente_total: Number(r.valor_pendente_total) || 0,
  })) as ClinicaRelatorio30dRow[]

  return { ok: true, linhas }
}

function mapearContaReceberEmbutida(
  cr: { id: string; status_pagamento: string | null; valor_pago: number | null; data_pagamento: string | null } | null
) {
  if (!cr) {
    return {
      conta_receber_id: null as string | null,
      conta_status_pagamento: null as string | null,
      conta_data_pagamento: null as string | null,
      conta_valor_pago: null as number | null,
    }
  }
  return {
    conta_receber_id: String(cr.id),
    conta_status_pagamento: cr.status_pagamento ?? null,
    conta_data_pagamento: cr.data_pagamento != null ? String(cr.data_pagamento) : null,
    conta_valor_pago: cr.valor_pago != null ? Number(cr.valor_pago) : null,
  }
}

function mapearOrdemServicoClinica(row: Record<string, unknown>): ClinicaOrdemServicoDetalhe {
  const u = row.clinicas_unidades as
    | { razao_social: string; cnpj: string | null; cpf: string | null }
    | { razao_social: string; cnpj: string | null; cpf: string | null }[]
    | null
  const unidade = Array.isArray(u) ? u[0] : u
  const fr = row.clinicas_faturamento_registros as
    | { valor: number | null; status: string | null }
    | { valor: number | null; status: string | null }[]
    | null
  const reg = Array.isArray(fr) ? fr[0] : fr
  const crRaw = row.contas_receber as
    | { id: string; status_pagamento: string | null; valor_pago: number | null; data_pagamento: string | null }
    | { id: string; status_pagamento: string | null; valor_pago: number | null; data_pagamento: string | null }[]
    | null
  const cr = Array.isArray(crRaw) ? crRaw[0] ?? null : crRaw
  const conta = mapearContaReceberEmbutida(cr)
  return {
    id: String(row.id),
    numero_os: String(row.numero_os),
    status: String(row.status),
    data_servico: String(row.data_servico),
    created_at: String(row.created_at),
    unidade_id: String(row.unidade_id),
    razao_social: unidade?.razao_social ?? '—',
    cnpj: unidade?.cnpj ?? null,
    cpf: unidade?.cpf ?? null,
    emite_nota_snapshot: Boolean(row.emite_nota_snapshot),
    pagamento_pix_snapshot: Boolean(row.pagamento_pix_snapshot),
    referencia_nf: row.referencia_nf != null ? String(row.referencia_nf) : null,
    nf_registrada_em: row.nf_registrada_em != null ? String(row.nf_registrada_em) : null,
    enviado_financeiro_em:
      row.enviado_financeiro_em != null ? String(row.enviado_financeiro_em) : null,
    faturamento_valor: reg?.valor != null ? Number(reg.valor) : null,
    faturamento_status: reg?.status ?? null,
    ...conta,
  }
}

export async function listarOrdensServicoClinicas(
  filtros?: ListarOsClinicasFiltros
): Promise<{ ok: true; ordens: ClinicaOrdemServicoDetalhe[] } | { ok: false; message: string }> {
  const limite = filtros?.limite ?? 200

  let q = supabase
    .from('clinicas_ordens_servico')
    .select(
      `
      id,
      numero_os,
      status,
      data_servico,
      created_at,
      unidade_id,
      emite_nota_snapshot,
      pagamento_pix_snapshot,
      referencia_nf,
      nf_registrada_em,
      enviado_financeiro_em,
      clinicas_unidades!inner ( razao_social, cnpj, cpf ),
      clinicas_faturamento_registros ( valor, status ),
      contas_receber ( id, status_pagamento, valor_pago, data_pagamento )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limite)

  if (filtros?.status) {
    const statuses = Array.isArray(filtros.status) ? filtros.status : [filtros.status]
    q = q.in('status', statuses)
  }
  if (filtros?.dataServicoDe) {
    q = q.gte('data_servico', filtros.dataServicoDe)
  }
  if (filtros?.dataServicoAte) {
    q = q.lte('data_servico', filtros.dataServicoAte)
  }

  const { data, error } = await q

  if (error) {
    return { ok: false, message: error.message || 'Erro ao listar ordens de serviço.' }
  }

  const ordens = (data || []).map((row) => mapearOrdemServicoClinica(row as Record<string, unknown>))

  return { ok: true, ordens }
}

/** O.S. já emitidas no faturamento — histórico para relatórios. */
export async function listarHistoricoOsClinicasEmitidas(
  filtros: Omit<ListarOsClinicasFiltros, 'status'>
): Promise<{ ok: true; ordens: ClinicaOrdemServicoDetalhe[] } | { ok: false; message: string }> {
  return listarOrdensServicoClinicas({
    ...filtros,
    status: 'emitida',
    limite: filtros.limite ?? 500,
  })
}

export async function enviarClinicaOsAoFinanceiro(
  ordemId: string,
  dataVencimento?: string
): Promise<{ ok: true; contaReceberId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('enviar_clinica_os_ao_financeiro', {
    p_ordem_id: ordemId,
    p_data_vencimento: dataVencimento || null,
  })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('Could not find')) {
      return {
        ok: false,
        message:
          'Envio ao financeiro indisponível. Aplique a migration 20260625170000_clinicas_financeiro_fila.sql.',
      }
    }
    return { ok: false, message: msg || 'Não foi possível enviar ao financeiro.' }
  }
  return { ok: true, contaReceberId: String(data) }
}

export async function excluirClinicaOrdemServicoEmitida(
  ordemId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('excluir_clinica_ordem_servico_emitida', { p_ordem_id: ordemId })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('Could not find')) {
      return {
        ok: false,
        message:
          'Exclusão de O.S. emitida indisponível. Aplique a migration 20260625170000_clinicas_financeiro_fila.sql.',
      }
    }
    return { ok: false, message: msg || 'Não foi possível excluir a O.S.' }
  }
  return { ok: true }
}

export async function listarFilaFinanceiroClinicas(): Promise<
  { ok: true; linhas: ClinicaContaReceberFilaRow[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('contas_receber')
    .select(
      `
      id,
      valor,
      valor_pago,
      status_pagamento,
      data_vencimento,
      data_pagamento,
      referencia_clinica_os_id,
      clinicas_ordens_servico!inner (
        id,
        numero_os,
        data_servico,
        referencia_nf,
        enviado_financeiro_em,
        clinicas_unidades!inner ( razao_social )
      )
    `
    )
    .not('referencia_clinica_os_id', 'is', null)
    .order('data_vencimento', { ascending: true, nullsFirst: false })

  if (error) {
    return { ok: false, message: error.message || 'Erro ao carregar fila de clínicas.' }
  }

  const linhas: ClinicaContaReceberFilaRow[] = (data || [])
    .map((row) => {
      const os = row.clinicas_ordens_servico as
        | {
            id: string
            numero_os: string
            data_servico: string
            referencia_nf: string | null
            enviado_financeiro_em: string | null
            clinicas_unidades: { razao_social: string } | { razao_social: string }[]
          }
        | {
            id: string
            numero_os: string
            data_servico: string
            referencia_nf: string | null
            enviado_financeiro_em: string | null
            clinicas_unidades: { razao_social: string } | { razao_social: string }[]
          }[]
        | null
      const ordem = Array.isArray(os) ? os[0] : os
      if (!ordem) return null
      const u = ordem.clinicas_unidades
      const razao = Array.isArray(u) ? u[0]?.razao_social : u?.razao_social
      return {
        conta_id: String(row.id),
        ordem_servico_id: String(ordem.id),
        numero_os: String(ordem.numero_os),
        razao_social: razao ?? '—',
        data_servico: String(ordem.data_servico),
        valor: Number(row.valor) || 0,
        valor_pago: Number(row.valor_pago) || 0,
        status_pagamento: String(row.status_pagamento || 'Pendente'),
        data_vencimento: (row.data_vencimento as string | null) ?? null,
        data_pagamento: (row.data_pagamento as string | null) ?? null,
        referencia_nf: ordem.referencia_nf,
        enviado_financeiro_em: ordem.enviado_financeiro_em,
      }
    })
    .filter((r): r is ClinicaContaReceberFilaRow => r != null)
    .filter((r) => Boolean(r.enviado_financeiro_em))

  return { ok: true, linhas }
}

export async function salvarPagamentoContaClinica(
  contaId: string,
  pago: boolean,
  dataPagamento?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('salvar_pagamento_conta_clinica', {
    p_conta_id: contaId,
    p_pago: pago,
    p_data_pagamento: pago ? dataPagamento || null : null,
  })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('Could not find')) {
      return {
        ok: false,
        message:
          'Atualização de pagamento indisponível. Aplique a migration 20260625170000_clinicas_financeiro_fila.sql.',
      }
    }
    return { ok: false, message: msg || 'Não foi possível guardar o pagamento.' }
  }
  return { ok: true }
}

export function clinicaOsNoFinanceiro(o: ClinicaOrdemServicoDetalhe): boolean {
  return Boolean(o.enviado_financeiro_em && o.conta_receber_id)
}

export function clinicaOsPodeExcluirEmitida(o: ClinicaOrdemServicoDetalhe): boolean {
  if (o.status !== 'emitida') return false
  const pago = (o.conta_valor_pago ?? 0) > 0 || o.conta_status_pagamento === 'Pago'
  return !pago
}

export async function excluirUnidadeClinica(
  unidadeId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('excluir_clinica_unidade', { p_unidade_id: unidadeId })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('Could not find')) {
      return {
        ok: false,
        message:
          'Função de exclusão de unidade não encontrada. Aplique a migration 20260625160000_clinicas_excluir_unidade.sql.',
      }
    }
    return { ok: false, message: msg || 'Não foi possível excluir a unidade.' }
  }
  return { ok: true }
}

export async function excluirOrdemServicoClinica(
  ordemId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('excluir_clinica_ordem_servico', { p_ordem_id: ordemId })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('Could not find')) {
      return {
        ok: false,
        message: 'Função de exclusão não encontrada. Aplique a migration 20260625150000_clinicas_excluir_os.sql.',
      }
    }
    return { ok: false, message: msg || 'Não foi possível excluir a O.S.' }
  }
  return { ok: true }
}

export function rotuloStatusOsClinica(status: string): string {
  switch (status) {
    case 'aguardando_faturamento':
      return 'Aguardando faturamento'
    case 'emitida':
      return 'Emitida'
    case 'cancelada':
      return 'Cancelada'
    default:
      return status
  }
}

export function rotuloMeioCobranca(emiteNota: boolean, pagamentoPix: boolean): string {
  if (emiteNota) return 'Emite NF'
  if (pagamentoPix) return 'PIX (sem NF)'
  return 'Padrão'
}
