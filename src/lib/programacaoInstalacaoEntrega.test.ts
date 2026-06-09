import { describe, expect, it } from 'vitest'
import {
  programacaoEhInstalacaoEntrega,
  programacaoInstalacaoFinalizada,
  rotuloStatusProgramacaoExibir,
} from './programacaoInstalacaoEntrega'

describe('programacaoInstalacaoEntrega', () => {
  it('reconhece Instalações/Entregas e alias Instalação', () => {
    expect(programacaoEhInstalacaoEntrega('Instalações/Entregas')).toBe(true)
    expect(programacaoEhInstalacaoEntrega('Instalação')).toBe(true)
    expect(programacaoEhInstalacaoEntrega('Coleta')).toBe(false)
  })

  it('instalação concluída exibe Finalizado na UI', () => {
    expect(rotuloStatusProgramacaoExibir('CONCLUIDA', 'Instalações/Entregas')).toBe('Finalizado')
    expect(rotuloStatusProgramacaoExibir('CONCLUIDA', 'Coleta')).toBe('Concluída')
    expect(programacaoInstalacaoFinalizada('CONCLUIDA')).toBe(true)
  })
})
