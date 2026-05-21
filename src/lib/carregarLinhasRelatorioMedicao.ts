import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import {
  montarLinhasRelatorioMedicao,
  type ContratoRelatorioMedicao,
  type ContextoMtrMedicao,
  type LinhaRelatorioMedicao,
} from './faturamentoRelatorioMedicao'

export async function carregarLinhasRelatorioMedicao(
  linhasColeta: FaturamentoResumoViewRow[]
): Promise<{ linhas: LinhaRelatorioMedicao[]; erro: string | null }> {
  const clienteId = linhasColeta[0]?.cliente_id
  if (!clienteId) {
    return { linhas: [], erro: 'Cliente não identificado nas coletas.' }
  }
  if (linhasColeta.length === 0) {
    return { linhas: [], erro: null }
  }

  try {
    const { data: cli, error: errCli } = await supabase
      .from('clientes')
      .select(
        'id, residuos_contrato, veiculos_contrato, equipamentos_contrato, tipo_residuo, descricao_veiculo, equipamentos'
      )
      .eq('id', clienteId)
      .maybeSingle()

    if (errCli) return { linhas: [], erro: errCli.message }
    if (!cli) return { linhas: [], erro: 'Cadastro do cliente não encontrado.' }

    const contrato: ContratoRelatorioMedicao = {
      residuos_contrato: cli.residuos_contrato,
      veiculos_contrato: cli.veiculos_contrato,
      equipamentos_contrato: cli.equipamentos_contrato,
      tipo_residuo_legado: cli.tipo_residuo,
      descricao_veiculo_legado: cli.descricao_veiculo,
      equipamentos_texto_legado: cli.equipamentos,
    }

    const mtrIds = [...new Set(linhasColeta.map((r) => r.mtr_id).filter(Boolean) as string[])]
    const progIds = [
      ...new Set(linhasColeta.map((r) => r.programacao_id).filter(Boolean) as string[]),
    ]

    const ctxPorColeta: Record<string, ContextoMtrMedicao> = {}
    const acondMtrMap = new Map<string, string | null>()
    if (mtrIds.length > 0) {
      const { data: mtrs } = await supabase.from('mtrs').select('id, detalhes').in('id', mtrIds)
      for (const m of mtrs ?? []) {
        let ac: string | null = null
        const det = (m as { detalhes?: unknown }).detalhes
        if (det && typeof det === 'object') {
          const res = (det as { residuo?: { acondicionamento?: string } }).residuo
          const raw = res?.acondicionamento
          ac = typeof raw === 'string' && raw.trim() ? raw.trim() : null
        }
        acondMtrMap.set(String(m.id), ac)
      }
    }
    const progMap = new Map<string, string | null>()
    if (progIds.length > 0) {
      const { data: progs } = await supabase
        .from('programacoes')
        .select('id, tipo_caminhao')
        .in('id', progIds)
      for (const p of progs ?? []) {
        const tc = (p as { tipo_caminhao?: string | null }).tipo_caminhao
        progMap.set(String(p.id), typeof tc === 'string' && tc.trim() ? tc.trim() : null)
      }
    }

    for (const r of linhasColeta) {
      ctxPorColeta[r.coleta_id] = {
        tipoCaminhao: r.programacao_id ? progMap.get(r.programacao_id) ?? null : null,
        acondicionamento: r.mtr_id ? acondMtrMap.get(r.mtr_id) ?? null : null,
      }
    }

    return {
      linhas: montarLinhasRelatorioMedicao(linhasColeta, contrato, ctxPorColeta),
      erro: null,
    }
  } catch (e) {
    return {
      linhas: [],
      erro: e instanceof Error ? e.message : 'Erro ao calcular relatório de medição.',
    }
  }
}
