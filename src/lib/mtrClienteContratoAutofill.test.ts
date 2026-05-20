import { describe, expect, it } from 'vitest'
import {
  dividirTextoMultiResiduo,
  listaResiduosParaDocumentoMtr,
  parseContratoClienteMtr,
  residuosContratoParaLinhasPesagem,
  residuosContratoParaListaDetalhesMtr,
  residuoDetalhesVazio,
  tipoResiduoResumoContrato,
} from './mtrClienteContratoAutofill'

describe('mtrClienteContratoAutofill', () => {
  it('monta linhas de pesagem e tipo resumo a partir do contrato', () => {
    const c = parseContratoClienteMtr({
      residuos_contrato: [
        { tipo_residuo: 'Classe II', classificacao: 'Sólido', unidade_medida: 'kg' },
        { tipo_residuo: 'Óleo', classificacao: '', unidade_medida: 'kg' },
      ],
      veiculos_contrato: [{ tipo_veiculo: 'BAU', sem_custo: true, valor: null }],
      equipamentos_contrato: [{ descricao: 'Baú', com_custo: false, valor: null }],
    })
    expect(c.residuos).toHaveLength(2)
    expect(tipoResiduoResumoContrato(c.residuos)).toContain('Classe II')
    expect(residuosContratoParaLinhasPesagem(c.residuos)).toHaveLength(2)
    expect(residuosContratoParaListaDetalhesMtr(c.residuos, 'BAU')).toHaveLength(2)
    expect(c.veiculos[0].tipo_veiculo).toBe('BAU')
  })

  it('aceita resíduo só com classificação (sem tipo)', () => {
    const c = parseContratoClienteMtr({
      residuos_contrato: [{ tipo_residuo: '', classificacao: 'Classe I', unidade_medida: 'kg' }],
    })
    expect(c.residuos).toHaveLength(1)
    expect(residuosContratoParaListaDetalhesMtr(c.residuos, '')[0].caracterizacao).toBe('Classe I')
  })

  it('expande tipo_residuo com pipe em várias linhas na impressão', () => {
    const lista = listaResiduosParaDocumentoMtr(
      {
        residuo: { ...residuoDetalhesVazio(), caracterizacao: '', estado_fisico: 'SÓLIDO' },
      },
      'Classe I | Classe II'
    )
    expect(lista).toHaveLength(2)
    expect(lista[0].caracterizacao).toBe('Classe I')
    expect(lista[1].caracterizacao).toBe('Classe II')
    expect(dividirTextoMultiResiduo('A | B')).toEqual(['A', 'B'])
  })
})
