import { describe, expect, it } from 'vitest'
import { resolverDestinadorMtrForm, sincronizarDestinatarioDetalhesComDestinador } from './mtrDestinadorForm'

describe('resolverDestinadorMtrForm', () => {
  it('usa campo topo quando preenchido', () => {
    expect(
      resolverDestinadorMtrForm({
        destinador: 'Destino LTDA',
        detalhes: { destinatario: { razao_social: 'Outro' } },
      })
    ).toBe('Destino LTDA')
  })

  it('usa razão social do modelo quando topo vazio', () => {
    expect(
      resolverDestinadorMtrForm({
        destinador: '',
        detalhes: { destinatario: { razao_social: '  Instalação XYZ  ' } },
      })
    ).toBe('Instalação XYZ')
  })

  it('retorna vazio quando nada preenchido', () => {
    expect(resolverDestinadorMtrForm({ destinador: '  ', detalhes: null })).toBe('')
  })
})

describe('sincronizarDestinatarioDetalhesComDestinador', () => {
  it('copia destinador topo para razão social vazia', () => {
    expect(
      sincronizarDestinatarioDetalhesComDestinador({ razao_social: '', atividade: '' }, 'RG Ambiental')
    ).toEqual({ razao_social: 'RG Ambiental', atividade: '' })
  })
})
