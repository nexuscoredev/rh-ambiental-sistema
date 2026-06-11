/**
 * Lista slots de captura da KB de treinamentos.
 * PNGs reais: `npm run capturar:treinamento` (dev server em :4173).
 * SVGs legados mantidos como fallback offline.
 */
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'public', 'assets', 'treinamento')

/** Base names alinhados com src/lib/treinamentoKb/conteudo.ts */
export const SLOTS_TREINAMENTO = [
  'fluxo-completo-visao-etapas',
  'programacao-calendario',
  'programacao-formulario',
  'mtr-formulario',
  'mtr-gerenciador',
  'controle-massa-fila',
  'controle-massa-pesagem',
  'faturamento-fila',
  'faturamento-resumo',
  'financeiro-hub',
  'financeiro-contas-receber',
  'frota-hub-transportes',
  'frota-movimentacao-formulario',
  'frota-historico-movimentacoes',
  'clientes-lista-busca',
  'clientes-formulario-cadastro',
  'clientes-contrato-residuos-precos',
  'conferencia-transporte-selecao-coleta',
  'conferencia-transporte-checklist-motorista',
  'conferencia-transporte-folha-modelo',
]

function status() {
  if (!existsSync(OUT)) {
    console.error('Pasta inexistente:', OUT)
    process.exit(1)
  }
  const files = new Set(readdirSync(OUT))
  let png = 0
  let svgOnly = 0
  for (const base of SLOTS_TREINAMENTO) {
    const hasPng = files.has(`${base}.png`)
    const hasSvg = files.has(`${base}.svg`)
    if (hasPng) png++
    else if (hasSvg) svgOnly++
    console.log(
      hasPng ? 'PNG' : hasSvg ? 'SVG' : 'MISS',
      base,
      hasPng && hasSvg ? '(+ svg fallback)' : '',
    )
  }
  console.log(`\n${png} PNG · ${svgOnly} só SVG · ${SLOTS_TREINAMENTO.length - png - svgOnly} em falta`)
}

status()
