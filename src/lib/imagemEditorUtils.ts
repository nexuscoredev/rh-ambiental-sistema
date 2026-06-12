/** Dimensão máxima no editor — equilíbrio entre nitidez e velocidade. */
export const IMAGEM_EDITOR_MAX_DIM = 1600

export type ImagemEditorDecodificada = {
  bitmap: ImageBitmap
  width: number
  height: number
}

function calcularDimensaoEditor(largura: number, altura: number, maxDim = IMAGEM_EDITOR_MAX_DIM) {
  if (!largura || !altura) return { width: 0, height: 0 }
  if (largura <= maxDim && altura <= maxDim) {
    return { width: largura, height: altura }
  }
  const escala = maxDim / Math.max(largura, altura)
  return {
    width: Math.round(largura * escala),
    height: Math.round(altura * escala),
  }
}

/** Decodifica e redimensiona a imagem num único passo (mais rápido que Image + blob URL). */
export async function decodificarImagemParaEditor(
  file: Blob,
  maxDim = IMAGEM_EDITOR_MAX_DIM
): Promise<ImagemEditorDecodificada> {
  const probe = await createImageBitmap(file)
  const origW = probe.width
  const origH = probe.height
  probe.close()

  const alvo = calcularDimensaoEditor(origW, origH, maxDim)

  if (!alvo.width || !alvo.height) {
    throw new Error('Imagem inválida')
  }

  const precisaRedimensionar = alvo.width !== origW || alvo.height !== origH
  if (precisaRedimensionar) {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: alvo.width,
      resizeHeight: alvo.height,
      resizeQuality: 'medium',
    })
    return { bitmap, width: alvo.width, height: alvo.height }
  }

  const bitmap = await createImageBitmap(file)
  return { bitmap, width: alvo.width, height: alvo.height }
}

export function fecharImagemEditorDecodificada(img: ImageBitmap | null | undefined) {
  try {
    img?.close()
  } catch {
    /* ignore */
  }
}
