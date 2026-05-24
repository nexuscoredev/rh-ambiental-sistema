import { describe, expect, it } from 'vitest'
import { consolidarRelatorioClinicas30d } from './clinicasRelatorio'

describe('consolidarRelatorioClinicas30d', () => {
  it('mantém uma linha por unidade vinda da view', () => {
    const linhas = consolidarRelatorioClinicas30d([
      {
        unidade_id: 'u1',
        razao_social: 'Clínica A',
        cnpj: '11',
        grupo_nome: 'CLINICA',
        qtd_os: 3,
        valor_emitido_total: 1500,
        valor_pendente_total: 200,
        primeira_data: '2026-05-01',
        ultima_data: '2026-05-20',
      },
    ])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.qtd_os).toBe(3)
    expect(linhas[0]?.valor_emitido_total).toBe(1500)
  })
})
