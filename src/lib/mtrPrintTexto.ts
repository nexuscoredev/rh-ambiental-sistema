/** Texto padrão usado nos blocos informativos do modelo MTR (alinhado ao manifesto físico de referência). */
export const MTR_TEXTO_VIDE_FICHA = 'VIDE FICHA DE EMERGÊNCIA'

/** Rodapé com distribuição das vias do manifesto. */
export const MTR_RODAPE_VIAS =
  '1ª via UNIDADE DESTINATÁRIA · 2ª via TRANSPORTADOR · 3ª via GERADOR · 4ª via ÓRGÃO DE CONTROLE AMBIENTAL · 5ª via CONTROLE DO GERADOR'

/** Telefone padrão — secção 7 (discrepâncias), conforme manifesto físico RG. */
export const MTR_TELEFONE_DISCREPANCIA_PADRAO = '(11) 94798-5543'

export const MTR_CERTIFICACAO_GERADOR_TEXTO =
  'Eu, por meio deste manifesto, declaro que os resíduos acima listados estão integralmente e corretamente descritos pelo nome, classificados, embalados e rotulados seguindo as normas vigentes e estão sob os aspectos em condições adequadas para transporte de acordo com os regulamentos nacionais e internacionais vigentes.'

export const MTR_CERTIFICACAO_RECEPTORA_TEXTO =
  'Certificação de recebimento do material perigoso descrito neste manifesto, na quantidade e tipo discriminados, exceto quando ocorrer o disposto na Seção 7 (Comunicação de discrepâncias), acima.'

export const MTR_SECAO7_DISCREPANCIA_TEXTO =
  'COMUNICAR AO RESPONSÁVEL ATRAVÉS DO NÚMERO'

export const MTR_STTADE_DESTINATARIO_SUBTITULO =
  '(STTADE: Sistema que trata, transfere, armazena ou dispõe resíduos).'

/** Exibe célula sem traço "—": vazio vira espaço fino para manter altura da linha na impressão. */
export function mtrTextoCelula(val: string | null | undefined): string {
  const t = String(val ?? '').trim()
  return t.length > 0 ? t : '\u00A0'
}
