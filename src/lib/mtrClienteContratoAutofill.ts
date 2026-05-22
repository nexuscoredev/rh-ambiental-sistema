/**
 * Preenche MTR a partir do cadastro do cliente (veículos, equipamentos, resíduos de contrato).
 */
import {
  parseEquipamentosContratoJsonb,
  parseResiduosContratoJsonb,
  parseVeiculosContratoJsonb,
  rotuloEquipamentosContratoResumo,
  rotuloVeiculosContratoResumo,
  equipamentosContratoSemValoresMtr,
  veiculosContratoSemValoresMtr,
  formatarPesoKgCampoContrato,
  type EquipamentoContratoItem,
  type ResiduoContratoItem,
  type VeiculoContratoItem,
} from './clienteContratoCadastro'
import {
  linhaVaziaResiduoPesagem,
  SEPARADOR_RESIDUOS_TEXTO,
  type ResiduoPesagemItem,
} from './residuosPesagem'

export type ClienteRowContratoMtr = {
  nome?: string | null
  razao_social?: string | null
  tipo_residuo?: string | null
  unidade_medida?: string | null
  classificacao?: string | null
  descricao_veiculo?: string | null
  equipamentos?: string | null
  veiculos_contrato?: unknown
  equipamentos_contrato?: unknown
  residuos_contrato?: unknown
  frequencia_coleta?: string | null
}

export type MtrContratoClienteSnapshot = {
  veiculos: VeiculoContratoItem[]
  equipamentos: EquipamentoContratoItem[]
  residuos: ResiduoContratoItem[]
  rotuloVeiculos: string
  rotuloEquipamentos: string
  rotuloResiduos: string
}

export function parseContratoClienteMtr(row: ClienteRowContratoMtr): MtrContratoClienteSnapshot {
  const veiculos = parseVeiculosContratoJsonb(row.veiculos_contrato, row.descricao_veiculo).filter(
    (v) => v.tipo_veiculo.trim()
  )
  const equipamentos = parseEquipamentosContratoJsonb(row.equipamentos_contrato, row.equipamentos).filter(
    (e) => e.descricao.trim()
  )
  const residuos = parseResiduosContratoJsonb(row.residuos_contrato, {
    tipo_residuo: row.tipo_residuo,
    classificacao: row.classificacao,
    unidade_medida: row.unidade_medida,
    frequencia_coleta: row.frequencia_coleta,
  }).filter(residuoContratoTemConteudo)

  const rotuloResiduos =
    residuos.length > 0
      ? residuos
          .map((r) => {
            const p = [r.tipo_residuo.trim(), r.classificacao.trim()].filter(Boolean).join(' — ')
            const u = r.unidade_medida.trim()
            return u ? `${p} (${u})` : p
          })
          .join(' · ')
      : '—'

  return {
    veiculos: veiculosContratoSemValoresMtr(veiculos),
    equipamentos: equipamentosContratoSemValoresMtr(equipamentos),
    residuos,
    rotuloVeiculos: rotuloVeiculosContratoResumo(row.veiculos_contrato, row.descricao_veiculo),
    rotuloEquipamentos: rotuloEquipamentosContratoResumo(row.equipamentos_contrato, row.equipamentos),
    rotuloResiduos,
  }
}

export function residuoContratoTemConteudo(r: ResiduoContratoItem): boolean {
  return Boolean(r.tipo_residuo.trim() || r.classificacao.trim())
}

/** Rótulo exibido na pesagem / tipo resíduo da MTR. */
export function rotuloResiduoContrato(r: ResiduoContratoItem): string {
  const t = r.tipo_residuo.trim()
  const c = r.classificacao.trim()
  if (t && c) return `${t} — ${c}`
  return t || c || ''
}

/** Linhas de pesagem (sem pesos) para `detalhes.residuos_itens` e herança no Controle de Massa. */
export function residuosContratoParaLinhasPesagem(residuos: ResiduoContratoItem[]): ResiduoPesagemItem[] {
  const validos = residuos.filter(residuoContratoTemConteudo)
  if (validos.length === 0) return [linhaVaziaResiduoPesagem()]
  return validos.map((r) => ({
    ...linhaVaziaResiduoPesagem(),
    texto: rotuloResiduoContrato(r),
  }))
}

export function residuoDetalhesVazio(): MtrResiduoDetalhesCampos {
  return {
    fonte_origem: 'Industrial',
    caracterizacao: '',
    estado_fisico: 'SÓLIDO',
    acondicionamento: '',
    quantidade_aproximada: '',
    onu: '',
  }
}

/** Todos os campos em branco (ex.: botão «Limpar» na MTR — sem defaults Industrial/SÓLIDO). */
export function residuoDetalhesLimpo(): MtrResiduoDetalhesCampos {
  return {
    fonte_origem: '',
    caracterizacao: '',
    estado_fisico: '',
    acondicionamento: '',
    quantidade_aproximada: '',
    onu: '',
  }
}

/** Todos os resíduos do contrato → linhas da secção 2 do manifesto. */
export function residuosContratoParaListaDetalhesMtr(
  residuos: ResiduoContratoItem[],
  acondicionamentoPadrao: string
): MtrResiduoDetalhesCampos[] {
  const validos = residuos.filter(residuoContratoTemConteudo)
  if (validos.length === 0) return [residuoDetalhesVazio()]
  return validos.map((r, index) => {
    const qtd = formatarPesoKgCampoContrato(r.faturamento_minimo.trim())
    const classe = r.classificacao.trim()
    const tipo = r.tipo_residuo.trim()
    return {
      fonte_origem: 'Industrial',
      caracterizacao: tipo || classe || '',
      estado_fisico: classe || 'SÓLIDO',
      acondicionamento:
        index === 0
          ? acondicionamentoPadrao.trim() || classe || ''
          : classe || acondicionamentoPadrao.trim() || '',
      quantidade_aproximada: qtd,
      onu: '',
    }
  })
}

/** Divide texto com vários resíduos (pipe, ponto médio, ponto e vírgula). */
export function dividirTextoMultiResiduo(texto: string): string[] {
  const t = texto.trim()
  if (!t) return []
  const porBarra = t.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
  if (porBarra.length > 1) return porBarra
  if (t.includes(SEPARADOR_RESIDUOS_TEXTO)) {
    return t.split(SEPARADOR_RESIDUOS_TEXTO).map((s) => s.trim()).filter(Boolean)
  }
  if (/[;]/.test(t)) {
    return t.split(/[;]/).map((s) => s.trim()).filter(Boolean)
  }
  return [t]
}

export function listaResiduosFromDetalhesMtr(detalhes: {
  residuo: MtrResiduoDetalhesCampos
  residuos_lista?: MtrResiduoDetalhesCampos[]
}): MtrResiduoDetalhesCampos[] {
  if (detalhes.residuos_lista && detalhes.residuos_lista.length > 0) {
    return detalhes.residuos_lista
  }
  return [detalhes.residuo]
}

/** Lista para impressão/formulário: JSON, itens de pesagem ou texto legado com pipe/· */
export function listaResiduosParaDocumentoMtr(
  detalhes: {
    residuo: MtrResiduoDetalhesCampos
    residuos_lista?: MtrResiduoDetalhesCampos[]
    residuos_itens?: Array<ResiduoPesagemItem | { texto: string }>
  },
  tipoResiduoTopo?: string
): MtrResiduoDetalhesCampos[] {
  if (detalhes.residuos_lista && detalhes.residuos_lista.length > 0) {
    return detalhes.residuos_lista
  }

  const itens = detalhes.residuos_itens ?? []
  const textosPesagem = itens.map((l) => l.texto.trim()).filter(Boolean)
  if (textosPesagem.length > 0) {
    const base = detalhes.residuo
    return textosPesagem.map((texto, index) => ({
      fonte_origem: base.fonte_origem.trim() || 'Industrial',
      caracterizacao: texto,
      estado_fisico: index === 0 ? base.estado_fisico : '',
      acondicionamento: index === 0 ? base.acondicionamento : '',
      quantidade_aproximada: index === 0 ? base.quantidade_aproximada : '',
      onu: index === 0 ? base.onu : '',
    }))
  }

  const base = detalhes.residuo
  const merged =
    (tipoResiduoTopo ?? '').trim() ||
    base.caracterizacao.trim() ||
    ''
  const partes = dividirTextoMultiResiduo(merged)
  if (partes.length > 1) {
    return partes.map((caracterizacao, index) => ({
      fonte_origem: base.fonte_origem.trim() || 'Industrial',
      caracterizacao,
      estado_fisico: index === 0 ? base.estado_fisico : '',
      acondicionamento: index === 0 ? base.acondicionamento : '',
      quantidade_aproximada: index === 0 ? base.quantidade_aproximada : '',
      onu: index === 0 ? base.onu : '',
    }))
  }

  const partesCarac = dividirTextoMultiResiduo(base.caracterizacao)
  if (partesCarac.length > 1) {
    return partesCarac.map((caracterizacao, index) => ({
      fonte_origem: base.fonte_origem.trim() || 'Industrial',
      caracterizacao,
      estado_fisico: index === 0 ? base.estado_fisico : '',
      acondicionamento: index === 0 ? base.acondicionamento : '',
      quantidade_aproximada: index === 0 ? base.quantidade_aproximada : '',
      onu: index === 0 ? base.onu : '',
    }))
  }

  return [base]
}

export function syncResiduoPrincipalComLista(
  detalhes: { residuo: MtrResiduoDetalhesCampos; residuos_lista?: MtrResiduoDetalhesCampos[] }
): { residuo: MtrResiduoDetalhesCampos; residuos_lista: MtrResiduoDetalhesCampos[] } {
  const lista =
    detalhes.residuos_lista && detalhes.residuos_lista.length > 0
      ? detalhes.residuos_lista
      : [detalhes.residuo]
  const primeiro = lista[0] ?? residuoDetalhesVazio()
  return { residuo: { ...primeiro }, residuos_lista: lista }
}

export function tipoResiduoResumoContrato(residuos: ResiduoContratoItem[]): string {
  const tipos = residuos.map((r) => rotuloResiduoContrato(r)).filter(Boolean)
  if (tipos.length === 0) return ''
  if (tipos.length === 1) return tipos[0]
  return tipos.join(SEPARADOR_RESIDUOS_TEXTO)
}

export type MtrResiduoDetalhesCampos = {
  fonte_origem: string
  caracterizacao: string
  estado_fisico: string
  acondicionamento: string
  quantidade_aproximada: string
  onu: string
}

/** Primeiro resíduo do contrato → bloco «2. Descrição dos resíduos» do manifesto. */
export function residuoDetalhesFromContrato(
  primeiro: ResiduoContratoItem | undefined,
  fallback: MtrResiduoDetalhesCampos,
  acondicionamentoExtra: string
): MtrResiduoDetalhesCampos {
  if (!primeiro || !residuoContratoTemConteudo(primeiro)) {
    return {
      ...fallback,
      acondicionamento: acondicionamentoExtra.trim() || fallback.acondicionamento,
    }
  }
  const qtd = formatarPesoKgCampoContrato(primeiro.faturamento_minimo.trim())
  const tipo = primeiro.tipo_residuo.trim()
  const classe = primeiro.classificacao.trim()
  return {
    fonte_origem: fallback.fonte_origem.trim() || 'Industrial',
    caracterizacao: tipo || classe || fallback.caracterizacao,
    estado_fisico: classe || fallback.estado_fisico || 'SÓLIDO',
    acondicionamento:
      acondicionamentoExtra.trim() ||
      primeiro.classificacao.trim() ||
      fallback.acondicionamento,
    quantidade_aproximada: qtd || fallback.quantidade_aproximada,
    onu: fallback.onu,
  }
}

export function acondicionamentoFromContratoVeiculoEquipamento(
  contrato: MtrContratoClienteSnapshot,
  tipoCaminhaoProgramacao: string
): string {
  const cam = contrato.veiculos[0]?.tipo_veiculo.trim()
  const eq = contrato.equipamentos[0]?.descricao.trim()
  return (tipoCaminhaoProgramacao || cam || eq || '').trim()
}

/** Reconstrói painel do contrato a partir de `mtrs.detalhes` já gravados. */
export function snapshotContratoFromDetalhesMtr(detalhes: {
  contrato_veiculos?: VeiculoContratoItem[]
  contrato_equipamentos?: EquipamentoContratoItem[]
  residuos_lista?: MtrResiduoDetalhesCampos[]
  residuo?: MtrResiduoDetalhesCampos
  residuos_itens?: ResiduoPesagemItem[]
} | null | undefined): MtrContratoClienteSnapshot | null {
  if (!detalhes) return null
  const veiculos = detalhes.contrato_veiculos ?? []
  const equipamentos = detalhes.contrato_equipamentos ?? []
  const listaDesc = listaResiduosFromDetalhesMtr({
    residuo: detalhes.residuo ?? residuoDetalhesVazio(),
    residuos_lista: detalhes.residuos_lista,
  })
  const residuos: ResiduoContratoItem[] = listaDesc.map((l) => ({
    tipo_residuo: l.caracterizacao.trim(),
    classificacao: l.estado_fisico.trim(),
    unidade_medida: 'kg',
    valor: '',
    frequencia_coleta: '',
    faturamento_minimo: l.quantidade_aproximada.trim(),
  }))
  if (veiculos.length === 0 && equipamentos.length === 0 && residuos.length === 0) return null
  return {
    veiculos,
    equipamentos,
    residuos,
    rotuloVeiculos: rotuloVeiculosContratoResumo(veiculos, null),
    rotuloEquipamentos: rotuloEquipamentosContratoResumo(equipamentos, null),
    rotuloResiduos: residuos.map((r) => rotuloResiduoContrato(r)).join(' · ') || '—',
  }
}
