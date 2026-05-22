import { describe, expect, it } from 'vitest'
import { normalizarResiduoContratoParaKg } from './clienteContratoCadastro'
import {
  dividirTextoMultiResiduo,
  expandirListaResiduosMtrParaContrato,
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

  it('formata quantidade aproximada em kg (10 t legado → 10.000)', () => {
    const residuo = normalizarResiduoContratoParaKg({
      tipo_residuo: 'A',
      classificacao: '',
      unidade_medida: 'ton',
      valor: '',
      frequencia_coleta: '',
      faturamento_minimo: '10',
    })
    const lista = residuosContratoParaListaDetalhesMtr([residuo], '')
    expect(lista[0]?.quantidade_aproximada).toBe('10.000')
  })

  it('aceita resíduo só com classificação (sem tipo)', () => {
    const c = parseContratoClienteMtr({
      residuos_contrato: [{ tipo_residuo: '', classificacao: 'Classe I', unidade_medida: 'kg' }],
    })
    expect(c.residuos).toHaveLength(1)
    expect(residuosContratoParaListaDetalhesMtr(c.residuos, '')[0].caracterizacao).toBe('Classe I')
  })

  it('expandirListaResiduosMtrParaContrato abre linhas conforme cadastro do cliente', () => {
    const contrato = parseContratoClienteMtr({
      residuos_contrato: [
        { tipo_residuo: 'A', classificacao: 'Sólido', unidade_medida: 'kg' },
        { tipo_residuo: 'B', classificacao: 'Líquido', unidade_medida: 'kg' },
        { tipo_residuo: 'C', classificacao: '', unidade_medida: 'kg' },
      ],
    }).residuos
    const expandida = expandirListaResiduosMtrParaContrato(
      [{ ...residuoDetalhesVazio(), caracterizacao: 'A manual' }],
      contrato,
      'BAU'
    )
    expect(expandida).toHaveLength(3)
    expect(expandida[0]?.caracterizacao).toBe('A manual')
    expect(expandida[1]?.caracterizacao).toBe('B')
    expect(expandida[2]?.caracterizacao).toBe('C')
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
