import { describe, expect, it } from 'vitest'
import { normalizarResiduoContratoParaKg } from './clienteContratoCadastro'
import {
  dividirTextoMultiResiduo,
  expandirLinhasPesagemComContrato,
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

  it('expandirLinhasPesagemComContrato abre linhas e preserva pesos da linha correspondente', () => {
    const contrato = parseContratoClienteMtr({
      residuos_contrato: [
        { tipo_residuo: 'Resíduos sólidos contaminado', classificacao: 'Classe I', unidade_medida: 'kg' },
        { tipo_residuo: 'Óleo usado', classificacao: 'Classe I', unidade_medida: 'kg' },
      ],
    }).residuos
    const expandida = expandirLinhasPesagemComContrato(
      [
        {
          catalogo_id: '',
          texto: 'Resíduos sólidos contaminado — Classe I',
          peso_tara: '100',
          peso_bruto: '500',
          peso_liquido: '400',
        },
      ],
      contrato
    )
    expect(expandida).toHaveLength(2)
    expect(expandida[0]?.peso_liquido).toBe('400')
    expect(expandida[1]?.texto).toContain('Óleo')
  })

  it('expandirLinhasPesagemComContrato não repõe linhas removidas pelo utilizador', () => {
    const contrato = parseContratoClienteMtr({
      residuos_contrato: [
        { tipo_residuo: 'Resíduo A', classificacao: 'Classe I', unidade_medida: 'kg' },
        { tipo_residuo: 'Resíduo B', classificacao: 'Classe I', unidade_medida: 'kg' },
        { tipo_residuo: 'Resíduo C', classificacao: 'Classe I', unidade_medida: 'kg' },
      ],
    }).residuos
    const duasLinhasAposRemover = expandirLinhasPesagemComContrato(
      [
        {
          catalogo_id: '',
          texto: 'Resíduo A',
          peso_tara: '10',
          peso_bruto: '100',
          peso_liquido: '90',
        },
        {
          catalogo_id: '',
          texto: 'Resíduo C',
          peso_tara: '',
          peso_bruto: '',
          peso_liquido: '',
        },
      ],
      contrato
    )
    expect(duasLinhasAposRemover).toHaveLength(2)
    expect(duasLinhasAposRemover.map((l) => l.texto)).toEqual(['Resíduo A', 'Resíduo C'])
  })

  it('expandirListaResiduosMtrParaContrato preserva linhas gravadas na edição', () => {
    const contrato = parseContratoClienteMtr({
      residuos_contrato: [
        { tipo_residuo: 'Solventes', classificacao: 'Classe I', unidade_medida: 'kg' },
        { tipo_residuo: 'Borras Diversas', classificacao: 'Classe I', unidade_medida: 'kg' },
      ],
    }).residuos
    const gravada = [
      {
        ...residuoDetalhesVazio(),
        fonte_origem: 'Industrial',
        caracterizacao: 'Solventes editado',
        estado_fisico: 'Classe I',
        acondicionamento: 'Tambor',
        quantidade_aproximada: '2.500',
      },
      {
        ...residuoDetalhesVazio(),
        fonte_origem: 'Industrial',
        caracterizacao: 'Borra customizada',
        estado_fisico: 'Classe I',
        acondicionamento: 'Big bag',
        quantidade_aproximada: '800',
      },
    ]
    const expandida = expandirListaResiduosMtrParaContrato(gravada, contrato, 'BAU', {
      preservarLinhasGravadas: true,
    })
    expect(expandida[0]?.caracterizacao).toBe('Solventes editado')
    expect(expandida[0]?.acondicionamento).toBe('Tambor')
    expect(expandida[1]?.caracterizacao).toBe('Borra customizada')
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
