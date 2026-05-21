/** Cabeçalhos do relatório de medição (modelo RG Ambiental impresso). */
export const COLUNAS_RELATORIO_MEDICAO = [
  { key: 'data', label: 'Data', align: 'center' as const },
  { key: 'mtr', label: 'MTR', align: 'center' as const },
  { key: 'gerador', label: 'Gerador', align: 'left' as const },
  { key: 'tipoResiduo', label: 'Tipo de Resíduo', align: 'left' as const },
  { key: 'placa', label: 'Placa', align: 'center' as const },
  { key: 'quantViagens', label: 'Quant. Viagens', align: 'center' as const },
  { key: 'valorFrete', label: 'Valor Frete', align: 'right' as const },
  { key: 'pesoKg', label: 'Peso', align: 'right' as const },
  /** No modelo impresso: «Valor da Taxa» (R$/kg do contrato). */
  { key: 'valorTaxa', label: 'Valor da Taxa', align: 'right' as const },
  { key: 'total', label: 'Total', align: 'right' as const },
]
