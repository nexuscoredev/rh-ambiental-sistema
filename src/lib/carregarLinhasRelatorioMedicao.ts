import { supabase } from './supabase'
import type { FaturamentoResumoViewRow } from './faturamentoResumo'
import { montarInputPrecoContratoColeta } from './faturamentoContratoDesdeMtr'
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
        'id, residuos_contrato, veiculos_contrato, equipamentos_contrato, mao_obra_contrato, tipo_residuo, descricao_veiculo, equipamentos'
      )
      .eq('id', clienteId)
      .maybeSingle()

    if (errCli) return { linhas: [], erro: errCli.message }
    if (!cli) return { linhas: [], erro: 'Cadastro do cliente não encontrado.' }

    const contrato: ContratoRelatorioMedicao = {
      residuos_contrato: cli.residuos_contrato,
      veiculos_contrato: cli.veiculos_contrato,
      equipamentos_contrato: cli.equipamentos_contrato,
      mao_obra_contrato: cli.mao_obra_contrato,
      tipo_residuo_legado: cli.tipo_residuo,
      descricao_veiculo_legado: cli.descricao_veiculo,
      equipamentos_texto_legado: cli.equipamentos,
    }

    const contratoClienteFallback = {
      residuos_contrato: cli.residuos_contrato,
      veiculos_contrato: cli.veiculos_contrato,
      equipamentos_contrato: cli.equipamentos_contrato,
      mao_obra_contrato: cli.mao_obra_contrato,
      tipo_residuo_legado: cli.tipo_residuo,
      descricao_veiculo_legado: cli.descricao_veiculo,
      equipamentos_texto_legado: cli.equipamentos,
    }

    const mtrIds = [...new Set(linhasColeta.map((r) => r.mtr_id).filter(Boolean) as string[])]
    const progIds = [
      ...new Set(linhasColeta.map((r) => r.programacao_id).filter(Boolean) as string[]),
    ]

    const ctxPorColeta: Record<string, ContextoMtrMedicao> = {}
    const mtrMap = new Map<string, { detalhes: unknown; tipo_residuo: string | null }>()
    if (mtrIds.length > 0) {
      const { data: mtrs } = await supabase
        .from('mtrs')
        .select('id, detalhes, tipo_residuo')
        .in('id', mtrIds)
      for (const m of mtrs ?? []) {
        const row = m as { id?: string; detalhes?: unknown; tipo_residuo?: string | null }
        const id = String(row.id ?? '')
        if (!id) continue
        const tr = row.tipo_residuo
        mtrMap.set(id, {
          detalhes: row.detalhes ?? null,
          tipo_residuo: typeof tr === 'string' && tr.trim() ? tr.trim() : null,
        })
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
      const tipoCaminhao = r.programacao_id ? progMap.get(r.programacao_id) ?? null : null
      const mtrSnap = r.mtr_id ? mtrMap.get(r.mtr_id) : undefined
      let acondicionamento: string | null = null
      if (mtrSnap?.detalhes && typeof mtrSnap.detalhes === 'object') {
        const res = (mtrSnap.detalhes as { residuo?: { acondicionamento?: string } }).residuo
        const raw = res?.acondicionamento
        acondicionamento = typeof raw === 'string' && raw.trim() ? raw.trim() : null
      }
      const inputPrecoContrato =
        montarInputPrecoContratoColeta({
          contratoCliente: contratoClienteFallback,
          mtr: mtrSnap
            ? { detalhes: mtrSnap.detalhes, tipo_residuo: mtrSnap.tipo_residuo }
            : null,
          tipoCaminhaoProgramacao: tipoCaminhao,
          tipoResiduoColetaFallback: r.tipo_residuo,
          pesoLiquidoKg: r.peso_liquido,
        }) ?? undefined
      ctxPorColeta[r.coleta_id] = {
        tipoCaminhao,
        acondicionamento,
        inputPrecoContrato,
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
