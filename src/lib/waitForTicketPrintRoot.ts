/** Aguarda o portal de impressão do ticket estar no DOM com conteúdo legível. */
export function waitForTicketPrintRoot(options?: { timeoutMs?: number }): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 6000
  const minChars = 24

  return new Promise((resolve) => {
    const started = Date.now()

    const check = () => {
      const col = document.querySelector('.ticket-print-root .ticket-print-col')
      const text = col?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (text.length >= minChars) {
        resolve(true)
        return
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false)
        return
      }
      requestAnimationFrame(check)
    }

    check()
  })
}
