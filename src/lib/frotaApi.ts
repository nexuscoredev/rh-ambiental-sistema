import { parseEquipamentosContratoJsonb } from './clienteContratoCadastro'
import { parseOsClassificacao } from './frotaOrdemServico'
import { supabase } from './supabase'
import { parseFotosJson } from './frotaFotos'
import type {
  EquipamentoClienteCatalogo,
  FrotaAssinatura,
  FrotaDiarioChecklist,
  FrotaDiarioRow,
  FrotaManutencaoRow,
  FrotaMovimentacaoRow,
  FrotaOsClassificacao,
  FrotaResumoDashboard,
  TipoManutencaoFrota,
  TipoMovimentacaoFrota,
} from './frotaTypes'

export async function fetchCatalogoEquipamentosClientes(): Promise<EquipamentoClienteCatalogo[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, equipamentos_contrato, status')
    .eq('status', 'ativo')
    .order('nome')

  if (error) throw error

  const out: EquipamentoClienteCatalogo[] = []
  for (const row of data ?? []) {
    const nome = String(row.nome ?? '').trim() || 'Cliente'
    const lista = parseEquipamentosContratoJsonb(row.equipamentos_contrato)
    for (const eq of lista) {
      const desc = String(eq.descricao ?? '').trim()
      if (!desc) continue
      out.push({
        cliente_id: String(row.id),
        cliente_nome: nome,
        descricao: desc,
        com_custo: Boolean(eq.com_custo),
      })
    }
  }
  return out.sort((a, b) =>
    a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR') || a.descricao.localeCompare(b.descricao, 'pt-BR')
  )
}

function mapMovimentacao(r: Record<string, unknown>): FrotaMovimentacaoRow {
  return {
    id: String(r.id),
    tipo_movimentacao: r.tipo_movimentacao as TipoMovimentacaoFrota,
    cliente_id: r.cliente_id ? String(r.cliente_id) : null,
    cliente_nome: r.cliente_nome ? String(r.cliente_nome) : null,
    equipamento_descricao: String(r.equipamento_descricao ?? ''),
    caminhao_id: r.caminhao_id ? String(r.caminhao_id) : null,
    programacao_id: r.programacao_id ? String(r.programacao_id) : null,
    km: r.km != null ? Number(r.km) : null,
    observacoes: r.observacoes ? String(r.observacoes) : null,
    fotos: parseFotosJson(r.fotos),
    assinatura_responsavel_nome: r.assinatura_responsavel_nome ? String(r.assinatura_responsavel_nome) : null,
    assinatura_responsavel_cargo: r.assinatura_responsavel_cargo
      ? String(r.assinatura_responsavel_cargo)
      : null,
    assinatura_em: r.assinatura_em ? String(r.assinatura_em) : null,
    created_at: String(r.created_at ?? ''),
  }
}

export async function fetchMovimentacoesFrota(limite = 80): Promise<FrotaMovimentacaoRow[]> {
  const { data, error } = await supabase
    .from('frota_movimentacao')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) throw error
  return (data ?? []).map((r) => mapMovimentacao(r as Record<string, unknown>))
}

export async function criarMovimentacaoFrota(input: {
  tipo_movimentacao: TipoMovimentacaoFrota
  cliente_id: string | null
  cliente_nome: string
  equipamento_descricao: string
  caminhao_id: string | null
  km: number | null
  observacoes: string
  fotos: string[]
  assinatura: FrotaAssinatura
  created_by: string | null
}) {
  const { data, error } = await supabase
    .from('frota_movimentacao')
    .insert({
      tipo_movimentacao: input.tipo_movimentacao,
      cliente_id: input.cliente_id,
      cliente_nome: input.cliente_nome,
      equipamento_descricao: input.equipamento_descricao,
      caminhao_id: input.caminhao_id,
      km: input.km,
      observacoes: input.observacoes || null,
      fotos: input.fotos,
      assinatura_responsavel_nome: input.assinatura.responsavel_nome,
      assinatura_responsavel_cargo: input.assinatura.responsavel_cargo,
      assinatura_em: input.assinatura.assinatura_em,
      created_by: input.created_by,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapMovimentacao(data as Record<string, unknown>)
}

function mapManutencao(r: Record<string, unknown>): FrotaManutencaoRow {
  const cam = r.caminhoes as { placa?: string; modelo?: string } | null
  return {
    id: String(r.id),
    caminhao_id: String(r.caminhao_id),
    tipo_manutencao: r.tipo_manutencao as TipoManutencaoFrota,
    titulo: String(r.titulo ?? ''),
    descricao: r.descricao ? String(r.descricao) : null,
    km_atual: r.km_atual != null ? Number(r.km_atual) : null,
    oleo_ultima_troca_km: r.oleo_ultima_troca_km != null ? Number(r.oleo_ultima_troca_km) : null,
    oleo_ultima_troca_data: r.oleo_ultima_troca_data ? String(r.oleo_ultima_troca_data) : null,
    oleo_proxima_troca_km: r.oleo_proxima_troca_km != null ? Number(r.oleo_proxima_troca_km) : null,
    custo: r.custo != null ? Number(r.custo) : null,
    realizado_em: String(r.realizado_em ?? ''),
    status: String(r.status ?? 'registrada'),
    fotos: parseFotosJson(r.fotos),
    assinatura_responsavel_nome: r.assinatura_responsavel_nome ? String(r.assinatura_responsavel_nome) : null,
    assinatura_responsavel_cargo: r.assinatura_responsavel_cargo
      ? String(r.assinatura_responsavel_cargo)
      : null,
    assinatura_em: r.assinatura_em ? String(r.assinatura_em) : null,
    numero_os: r.numero_os != null ? Number(r.numero_os) : null,
    ano_os: r.ano_os != null ? Number(r.ano_os) : null,
    os_classificacao: parseOsClassificacao(r.os_classificacao),
    solicitante: r.solicitante ? String(r.solicitante) : null,
    ocorrido_solicitacao: r.ocorrido_solicitacao ? String(r.ocorrido_solicitacao) : null,
    compra_solucao: r.compra_solucao ? String(r.compra_solucao) : null,
    data_inicio: r.data_inicio ? String(r.data_inicio) : null,
    data_termino: r.data_termino ? String(r.data_termino) : null,
    assinatura_autorizado_nome: r.assinatura_autorizado_nome ? String(r.assinatura_autorizado_nome) : null,
    assinatura_execucao_nome: r.assinatura_execucao_nome ? String(r.assinatura_execucao_nome) : null,
    assinatura_solicitacao_nome: r.assinatura_solicitacao_nome
      ? String(r.assinatura_solicitacao_nome)
      : null,
    created_at: String(r.created_at ?? ''),
    caminhao_placa: cam?.placa ?? null,
    caminhao_modelo: cam?.modelo ?? null,
  }
}

export async function fetchManutencoesFrota(caminhaoId?: string): Promise<FrotaManutencaoRow[]> {
  let q = supabase
    .from('frota_manutencao')
    .select('*, caminhoes(placa, modelo)')
    .order('realizado_em', { ascending: false })
    .limit(120)

  if (caminhaoId) q = q.eq('caminhao_id', caminhaoId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => mapManutencao(r as Record<string, unknown>))
}

export async function criarManutencaoFrota(input: {
  caminhao_id: string
  tipo_manutencao: TipoManutencaoFrota
  titulo?: string
  descricao?: string
  km_atual?: number | null
  oleo_ultima_troca_km?: number | null
  oleo_ultima_troca_data?: string | null
  oleo_proxima_troca_km?: number | null
  custo?: number | null
  realizado_em: string
  fotos?: string[]
  assinatura?: FrotaAssinatura
  os_classificacao?: FrotaOsClassificacao
  solicitante?: string
  ocorrido_solicitacao?: string
  compra_solucao?: string
  data_inicio?: string | null
  data_termino?: string | null
  assinatura_autorizado_nome?: string
  assinatura_execucao_nome?: string
  assinatura_solicitacao_nome?: string
  created_by: string | null
}) {
  const { data, error } = await supabase
    .from('frota_manutencao')
    .insert({
      caminhao_id: input.caminhao_id,
      tipo_manutencao: input.tipo_manutencao,
      titulo: input.titulo?.trim() || '',
      descricao: input.descricao || null,
      km_atual: input.km_atual ?? null,
      oleo_ultima_troca_km: input.oleo_ultima_troca_km ?? null,
      oleo_ultima_troca_data: input.oleo_ultima_troca_data ?? null,
      oleo_proxima_troca_km: input.oleo_proxima_troca_km ?? null,
      custo: input.custo ?? null,
      realizado_em: input.realizado_em,
      fotos: input.fotos ?? [],
      assinatura_responsavel_nome: input.assinatura?.responsavel_nome ?? null,
      assinatura_responsavel_cargo: input.assinatura?.responsavel_cargo ?? null,
      assinatura_em: input.assinatura?.assinatura_em ?? null,
      os_classificacao: input.os_classificacao ?? {},
      solicitante: input.solicitante?.trim() || null,
      ocorrido_solicitacao: input.ocorrido_solicitacao?.trim() || null,
      compra_solucao: input.compra_solucao?.trim() || null,
      data_inicio: input.data_inicio || null,
      data_termino: input.data_termino || null,
      assinatura_autorizado_nome: input.assinatura_autorizado_nome?.trim() || null,
      assinatura_execucao_nome: input.assinatura_execucao_nome?.trim() || null,
      assinatura_solicitacao_nome: input.assinatura_solicitacao_nome?.trim() || null,
      created_by: input.created_by,
      status: 'concluida',
    })
    .select('*, caminhoes(placa, modelo)')
    .single()

  if (error) throw error
  return mapManutencao(data as Record<string, unknown>)
}

export async function excluirManutencaoFrota(id: string): Promise<void> {
  const { error } = await supabase.from('frota_manutencao').delete().eq('id', id)
  if (error) throw error
}

export async function excluirDiarioFrota(id: string): Promise<void> {
  const { error } = await supabase.from('frota_diario_veiculo').delete().eq('id', id)
  if (error) throw error
}

function mapDiario(r: Record<string, unknown>): FrotaDiarioRow {
  const cam = r.caminhoes as { placa?: string; modelo?: string } | null
  const checklist = (r.checklist && typeof r.checklist === 'object' ? r.checklist : {}) as FrotaDiarioChecklist
  return {
    id: String(r.id),
    caminhao_id: String(r.caminhao_id),
    data_diario: String(r.data_diario ?? ''),
    km_odometro: r.km_odometro != null ? Number(r.km_odometro) : null,
    ultima_troca_oleo_km: r.ultima_troca_oleo_km != null ? Number(r.ultima_troca_oleo_km) : null,
    ultima_troca_oleo_data: r.ultima_troca_oleo_data ? String(r.ultima_troca_oleo_data) : null,
    checklist,
    observacoes: r.observacoes ? String(r.observacoes) : null,
    fotos: parseFotosJson(r.fotos),
    assinatura_responsavel_nome: r.assinatura_responsavel_nome ? String(r.assinatura_responsavel_nome) : null,
    assinatura_responsavel_cargo: r.assinatura_responsavel_cargo
      ? String(r.assinatura_responsavel_cargo)
      : null,
    assinatura_em: r.assinatura_em ? String(r.assinatura_em) : null,
    created_at: String(r.created_at ?? ''),
    caminhao_placa: cam?.placa ?? null,
    caminhao_modelo: cam?.modelo ?? null,
  }
}

export async function fetchDiariosFrota(caminhaoId: string, limite = 60): Promise<FrotaDiarioRow[]> {
  const { data, error } = await supabase
    .from('frota_diario_veiculo')
    .select('*, caminhoes(placa, modelo)')
    .eq('caminhao_id', caminhaoId)
    .order('data_diario', { ascending: false })
    .limit(limite)

  if (error) throw error
  return (data ?? []).map((r) => mapDiario(r as Record<string, unknown>))
}

export async function fetchDiarioPorData(
  caminhaoId: string,
  dataDiario: string
): Promise<FrotaDiarioRow | null> {
  const { data, error } = await supabase
    .from('frota_diario_veiculo')
    .select('*, caminhoes(placa, modelo)')
    .eq('caminhao_id', caminhaoId)
    .eq('data_diario', dataDiario)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapDiario(data as Record<string, unknown>)
}

export async function salvarDiarioFrota(input: {
  id?: string
  caminhao_id: string
  data_diario: string
  km_odometro: number | null
  ultima_troca_oleo_km: number | null
  ultima_troca_oleo_data: string | null
  checklist: FrotaDiarioChecklist
  observacoes: string
  fotos: string[]
  assinatura: FrotaAssinatura
  created_by: string | null
}) {
  const payload = {
    caminhao_id: input.caminhao_id,
    data_diario: input.data_diario,
    km_odometro: input.km_odometro,
    ultima_troca_oleo_km: input.ultima_troca_oleo_km,
    ultima_troca_oleo_data: input.ultima_troca_oleo_data || null,
    checklist: input.checklist,
    observacoes: input.observacoes || null,
    fotos: input.fotos,
    assinatura_responsavel_nome: input.assinatura.responsavel_nome,
    assinatura_responsavel_cargo: input.assinatura.responsavel_cargo,
    assinatura_em: input.assinatura.assinatura_em,
    created_by: input.created_by,
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('frota_diario_veiculo')
      .update(payload)
      .eq('id', input.id)
      .select('*, caminhoes(placa, modelo)')
      .single()
    if (error) throw error
    return mapDiario(data as Record<string, unknown>)
  }

  const { data, error } = await supabase
    .from('frota_diario_veiculo')
    .upsert(payload, { onConflict: 'caminhao_id,data_diario' })
    .select('*, caminhoes(placa, modelo)')
    .single()

  if (error) throw error
  return mapDiario(data as Record<string, unknown>)
}

export async function fetchResumoFrotaDashboard(): Promise<FrotaResumoDashboard> {
  const hoje = new Date().toISOString().slice(0, 10)
  const seteDias = new Date(Date.now() - 7 * 86400000).toISOString()

  const [veiculos, diarios, manut, mov, ultimosDiarios] = await Promise.all([
    supabase.from('caminhoes').select('id', { count: 'exact', head: true }),
    supabase
      .from('frota_diario_veiculo')
      .select('id', { count: 'exact', head: true })
      .eq('data_diario', hoje),
    supabase
      .from('frota_manutencao')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'registrada'),
    supabase
      .from('frota_movimentacao')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', seteDias),
    supabase
      .from('frota_diario_veiculo')
      .select('km_odometro, ultima_troca_oleo_km, caminhoes(placa)')
      .order('data_diario', { ascending: false })
      .limit(80),
  ])

  const alertasOleo: FrotaResumoDashboard['alertasOleo'] = []
  for (const row of ultimosDiarios.data ?? []) {
    const km = row.km_odometro != null ? Number(row.km_odometro) : null
    const oleoKm = row.ultima_troca_oleo_km != null ? Number(row.ultima_troca_oleo_km) : null
    const cam = row.caminhoes as { placa?: string } | null
    const placa = cam?.placa ?? '—'
    if (km == null || oleoKm == null) continue
    const proxima = oleoKm + 10000
    if (km >= proxima - 500) {
      alertasOleo.push({ placa, km_atual: km, proxima_km: proxima })
    }
  }

  return {
    totalVeiculos: veiculos.count ?? 0,
    diariosHoje: diarios.count ?? 0,
    manutencoesAbertas: manut.count ?? 0,
    movimentacoes7d: mov.count ?? 0,
    alertasOleo: alertasOleo.slice(0, 8),
  }
}

function erroTabelaFrotaAusente(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = String(err.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    msg.includes('frota_movimentacao') ||
    msg.includes('frota_manutencao') ||
    msg.includes('frota_diario_veiculo') ||
    msg.includes('schema cache')
  )
}

function montarErroRelatorioFrota(
  mov: { error: { code?: string; message?: string } | null },
  man: { error: { code?: string; message?: string } | null },
  diario: { error: { code?: string; message?: string } | null }
): Error {
  const err = mov.error ?? man.error ?? diario.error
  if (err && erroTabelaFrotaAusente(err)) {
    return new Error(
      'Módulo de frota ainda não está na base de dados. Aplique a migration operacional-frota no Supabase (npm run db:apply:operacional-frota).'
    )
  }
  const parts = [mov.error?.message, man.error?.message, diario.error?.message].filter(Boolean)
  return new Error(parts.join(' · ') || 'Não foi possível carregar o relatório.')
}

export async function fetchDadosRelatorioFrota(de: string, ate: string) {
  if (!de || !ate) {
    throw new Error('Informe o período (data inicial e final).')
  }
  if (de > ate) {
    throw new Error('A data «De» deve ser anterior ou igual à data «Até».')
  }

  const inicio = `${de}T00:00:00.000Z`
  const fim = `${ate}T23:59:59.999Z`

  const { data: caminhoesData, error: camErr } = await supabase.from('caminhoes').select('id, placa, modelo')
  if (camErr && !erroTabelaFrotaAusente(camErr)) throw camErr

  const placaPorId = new Map<string, { placa: string; modelo: string | null }>()
  for (const c of caminhoesData ?? []) {
    placaPorId.set(String(c.id), {
      placa: String(c.placa ?? '—'),
      modelo: c.modelo ? String(c.modelo) : null,
    })
  }

  const enriquecerVeiculo = (row: Record<string, unknown>) => {
    const id = row.caminhao_id ? String(row.caminhao_id) : ''
    const cam = id ? placaPorId.get(id) : undefined
    return {
      ...row,
      caminhoes: cam ? { placa: cam.placa, modelo: cam.modelo } : null,
    }
  }

  const [mov, man, diario] = await Promise.all([
    supabase
      .from('frota_movimentacao')
      .select('*')
      .gte('created_at', inicio)
      .lte('created_at', fim)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('frota_manutencao')
      .select('*')
      .gte('realizado_em', de)
      .lte('realizado_em', ate)
      .order('realizado_em', { ascending: false })
      .limit(500),
    supabase
      .from('frota_diario_veiculo')
      .select('*')
      .gte('data_diario', de)
      .lte('data_diario', ate)
      .order('data_diario', { ascending: false })
      .limit(500),
  ])

  if (mov.error || man.error || diario.error) {
    throw montarErroRelatorioFrota(mov, man, diario)
  }

  return {
    movimentacoes: (mov.data ?? []).map((r) => mapMovimentacao(r as Record<string, unknown>)),
    manutencoes: (man.data ?? []).map((r) =>
      mapManutencao(enriquecerVeiculo(r as Record<string, unknown>))
    ),
    diarios: (diario.data ?? []).map((r) => mapDiario(enriquecerVeiculo(r as Record<string, unknown>))),
  }
}
