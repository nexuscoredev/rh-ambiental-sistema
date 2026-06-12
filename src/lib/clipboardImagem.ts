/** Extrai imagem colada (Ctrl+V / captura de ecrã) do clipboard. */
export function imagemColadaDoClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items
  if (!items?.length) return null

  for (const item of items) {
    if (item.kind !== 'file') continue
    const blob = item.getAsFile()
    if (!blob) continue

    const tipo = (blob.type || item.type || '').toLowerCase()
    if (tipo && !tipo.startsWith('image/')) continue

    const mime = tipo.startsWith('image/') ? tipo : 'image/png'
    const ext =
      mime === 'image/jpeg'
        ? 'jpg'
        : mime === 'image/webp'
          ? 'webp'
          : mime === 'image/gif'
            ? 'gif'
            : 'png'
    const nome =
      blob.name?.trim() && !/^image\.\w+$/i.test(blob.name)
        ? blob.name
        : `captura-${Date.now()}.${ext}`

    return new File([blob], nome, { type: mime })
  }

  return null
}
