import type { PrecoBreakdownLinha } from './faturamentoPrecoContrato'
import {
  parseNumeroCampo,
  totalResumoFinanceiro,
  totalResumoMtr,
  type ResumoFinanceiroDesvinculado,
} from './faturamentoDesvinculacao'

export type GrupoDetalheConta = 'ticket' | 'mtr' | 'ajuste' | 'subtotal' | 'total' | 'referencia'

export type LinhaDetalheConta = {
  grupo: GrupoDetalheConta
  rotulo: string
  /** Ex.: «576 kg × R$ 300,00/kg» */
  detalhe?: string
  valor: number
  indent?: boolean
}

function fmtBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function detalheResiduoMtr(
  mtr: ResumoFinanceiroDesvinculado['mtr'],
  residuoValor: number
): string | undefined {
  const qtd = parseNumeroCampo(mtr.residuo_quantidade)
  const unit = parseNumeroCampo(mtr.residuo_valor_unitario)
  const un = (mtr.residuo_unidade ?? 'kg').trim() || 'kg'
  const esperado = qtd > 0 && unit > 0 ? Math.round(qtd * unit * 100) / 100 : 0
  const linhaUnica = Math.abs(esperado - residuoValor) < 0.05
  if (qtd > 0 && unit > 0 && linhaUnica) {
    return `${qtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${un} × ${fmtBrl(unit)}/${un}`
  }
  if (qtd > 0 && unit > 0 && !linhaUnica) {
    return `Total ${qtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${un} — ver referência (vários resíduos/preços)`
  }
  const peso = parseNumeroCampo(mtr.peso_liquido_kg)
  if (peso > 0) return `Peso líq. MTR: ${peso.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
  return undefined
}

/** Linhas legíveis para o detalhamento da conta (resumos editáveis). */
export function montarDetalheContaFaturamento(resumo: ResumoFinanceiroDesvinculado): LinhaDetalheConta[] {
  const linhas: LinhaDetalheConta[] = []
  const ticketVal = parseNumeroCampo(resumo.ticket.valor_total)
  const caminhao = parseNumeroCampo(resumo.mtr.caminhao_valor)
  const equip = parseNumeroCampo(resumo.mtr.equipamento_valor)
  const residuo = parseNumeroCampo(resumo.mtr.residuo_valor)
  const acrescimo = parseNumeroCampo(resumo.ajustes?.acrescimo ?? '')
  const desconto = parseNumeroCampo(resumo.ajustes?.desconto ?? '')
  const subMtr = totalResumoMtr(resumo.mtr)
  const total = totalResumoFinanceiro(resumo)

  const tickets = resumo.ticket.linhas_tickets ?? []

  if (tickets.length > 1) {
    for (const t of tickets) {
      linhas.push({
        grupo: 'ticket',
        rotulo: `Ticket ${t.ticket_numero} (coleta ${t.coleta_numero})`,
        detalhe: t.residuo,
        valor: 0,
        indent: true,
      })
    }
    linhas.push({
      grupo: 'ticket',
      rotulo: 'Valor ticket (total no resumo)',
      valor: ticketVal,
    })
  } else if (tickets.length === 1) {
    const t = tickets[0]!
    linhas.push({
      grupo: 'ticket',
      rotulo: `Ticket ${t.ticket_numero} (coleta ${t.coleta_numero})`,
      detalhe: t.residuo,
      valor: ticketVal,
      indent: true,
    })
  } else {
    linhas.push({
      grupo: 'ticket',
      rotulo: 'Valor ticket',
      detalhe: resumo.ticket.tipo_residuo.trim() || undefined,
      valor: ticketVal,
    })
  }

  const camRot = resumo.mtr.caminhao_rotulo.trim() || 'Caminhão'
  linhas.push({
    grupo: 'mtr',
    rotulo: camRot,
    valor: caminhao,
    indent: true,
  })

  const eqRot = resumo.mtr.equipamento_rotulo.trim() || 'Equipamento'
  linhas.push({
    grupo: 'mtr',
    rotulo: eqRot,
    valor: equip,
    indent: true,
  })

  const resRot = resumo.mtr.residuo_rotulo.trim() || 'Resíduo (MTR)'
  linhas.push({
    grupo: 'mtr',
    rotulo: resRot,
    detalhe: detalheResiduoMtr(resumo.mtr, residuo),
    valor: residuo,
    indent: true,
  })

  linhas.push({ grupo: 'subtotal', rotulo: 'Subtotal ticket', valor: ticketVal })
  linhas.push({ grupo: 'subtotal', rotulo: 'Subtotal MTR (caminhão + equip. + resíduo)', valor: subMtr })

  if (acrescimo > 0) {
    linhas.push({ grupo: 'ajuste', rotulo: 'Acréscimo', valor: acrescimo })
  }
  if (desconto > 0) {
    linhas.push({ grupo: 'ajuste', rotulo: 'Desconto', valor: -desconto })
  }

  linhas.push({ grupo: 'total', rotulo: 'Total a faturar', valor: total })

  return linhas
}

export function montarDetalheReferenciaContrato(
  linhasContrato: PrecoBreakdownLinha[],
  total: number
): LinhaDetalheConta[] {
  if (total <= 0 || linhasContrato.length === 0) return []
  const out: LinhaDetalheConta[] = linhasContrato.map((l) => ({
    grupo: 'referencia' as const,
    rotulo: l.rotulo,
    valor: l.valor,
    indent: true,
  }))
  out.push({ grupo: 'referencia', rotulo: 'Total referência (contrato/regra)', valor: total })
  return out
}

/**
 * Espelha na referência o caminhão escolhido no resumo editável (dropdown).
 * Só ajusta a linha de caminhão e o total referência; resíduos/mínimos permanecem do contrato.
 */
export function referenciaContratoComCaminhaoResumo(
  linhasContrato: PrecoBreakdownLinha[],
  total: number,
  caminhaoRotulo: string,
  caminhaoValor: number
): { linhas: PrecoBreakdownLinha[]; total: number } {
  if (linhasContrato.length === 0 || total <= 0) {
    return { linhas: linhasContrato, total }
  }
  const idx = linhasContrato.findIndex(
    (l) => l.chave === 'caminhao' || l.rotulo.trim().toLowerCase().startsWith('caminhão')
  )
  if (idx < 0) return { linhas: linhasContrato, total }

  const antigo = linhasContrato[idx]!.valor
  const rotulo = caminhaoRotulo.trim()
    ? `Caminhão (${caminhaoRotulo.trim()})`
    : linhasContrato[idx]!.rotulo
  const valor = Math.round(caminhaoValor * 100) / 100
  const linhas = linhasContrato.map((l, i) =>
    i === idx ? { ...l, rotulo, valor } : l
  )
  const totalNovo = Math.round((total - antigo + valor) * 100) / 100
  return { linhas, total: totalNovo }
}

export { fmtBrl as fmtBrlDetalheConta }
