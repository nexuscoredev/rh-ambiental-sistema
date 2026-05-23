/**
 * Contrato de proteção da lógica de faturamento (RG Ambiental).
 * Versão aprovada: ver docs/faturamento-logica-aprovada.md
 *
 * Ao mudar regra de negócio: incrementar LOGICA_VERSION, atualizar testes e documentação.
 */
export const FATURAMENTO_LOGICA_VERSION = '2026-05-22.v1' as const

/** Caminhos relativos à raiz do repositório — alterações exigem revisão + guard. */
export const FATURAMENTO_ARQUIVOS_PROTEGIDOS = [
  'src/lib/faturamentoPrecoContrato.ts',
  'src/lib/faturamentoConsolidacaoMtr.ts',
  'src/lib/faturamentoRelatorioMedicao.ts',
  'src/lib/faturamentoDetalheConta.ts',
  'src/lib/faturamentoDesvinculacao.ts',
  'src/lib/faturamentoEsteira.ts',
  'src/lib/faturamentoOperacionalSync.ts',
  'src/lib/faturamentoTicketFluxo.ts',
  'src/lib/faturamentoResumo.ts',
  'src/lib/carregarLinhasRelatorioMedicao.ts',
  'src/lib/faturamentoLogicaCongelada.manifest.ts',
  'src/lib/faturamentoLogicaCongelada.test.ts',
  'src/components/faturamento',
  'docs/faturamento-logica-aprovada.md',
] as const

export type InvarianteFaturamento = {
  id: string
  titulo: string
  descricao: string
}

/** Invariantes que os testes de contrato devem preservar. */
export const FATURAMENTO_INVARIANTES: InvarianteFaturamento[] = [
  {
    id: 'ref-mtr-caminhao-uma-vez',
    titulo: 'Referência: caminhão/equipamento uma vez por MTR',
    descricao:
      'calcularPrecoContratoMtrConsolidado cobra veículo e equipamento só na primeira parte; tickets seguintes só resíduo.',
  },
  {
    id: 'rel-frete-primeira-coleta-mtr',
    titulo: 'Relatório: frete na primeira coleta de cada MTR',
    descricao: 'coletasComFretePorMtr + montarLinhasRelatorioMedicao: valorFrete > 0 só no líder por mtr_id.',
  },
  {
    id: 'rel-linha-por-coleta',
    titulo: 'Relatório: uma linha por coleta com mínimo na linha',
    descricao:
      'Cada coleta usa calcularPrecoContratoColetaMtr; total da linha inclui frete só se for líder da MTR.',
  },
  {
    id: 'ref-diferente-relatorio-multi-mtr',
    titulo: 'Referência ≠ total do relatório (multi-MTR / lote)',
    descricao:
      'Total referência de uma MTR consolidada não deve ser igual à soma do relatório de medição do lote cliente quando há várias MTRs ou mais coletas no período.',
  },
  {
    id: 'detalhe-referencia-separado',
    titulo: 'UI: Total referência separado de Total a faturar',
    descricao:
      'montarDetalheReferenciaContrato é grupo referencia; montarDetalheContaFaturamento expõe total operacional à parte.',
  },
]

export const FATURAMENTO_TESTES_CONTRATO = [
  'src/lib/faturamentoLogicaCongelada.test.ts',
  'src/lib/faturamentoPrecoContrato.test.ts',
  'src/lib/faturamentoConsolidacaoMtr.test.ts',
  'src/lib/faturamentoRelatorioMedicao.test.ts',
  'src/lib/faturamentoDetalheConta.test.ts',
  'src/lib/faturamentoDesvinculacao.test.ts',
  'src/lib/faturamentoEsteira.test.ts',
] as const
