import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

type Ponto = { x: number; y: number }

type Traco = {
  pontos: Ponto[]
  cor: string
  largura: number
}

type Props = {
  open: boolean
  file: File | null
  enviando?: boolean
  onCancel: () => void
  onConfirm: (file: File) => void
}

const CORES = [
  { id: 'vermelho', value: '#ef4444', label: 'Vermelho' },
  { id: 'amarelo', value: '#facc15', label: 'Amarelo' },
  { id: 'verde', value: '#22c55e', label: 'Verde' },
  { id: 'branco', value: '#ffffff', label: 'Branco' },
  { id: 'preto', value: '#0f172a', label: 'Preto' },
] as const

const LARGURA_TRACO = 4
const MAX_DIM = 2048

function desenharTraco(ctx: CanvasRenderingContext2D, traco: Traco) {
  const { pontos, cor, largura } = traco
  if (pontos.length < 2) return
  ctx.save()
  ctx.strokeStyle = cor
  ctx.lineWidth = largura
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pontos[0].x, pontos[0].y)
  for (let i = 1; i < pontos.length; i += 1) {
    ctx.lineTo(pontos[i].x, pontos[i].y)
  }
  ctx.stroke()
  ctx.restore()
}

function pontoNoCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number): Ponto {
  const rect = canvas.getBoundingClientRect()
  const escalaX = canvas.width / rect.width
  const escalaY = canvas.height / rect.height
  return {
    x: (clientX - rect.left) * escalaX,
    y: (clientY - rect.top) * escalaY,
  }
}

function nomeArquivoAnotado(nomeOriginal: string): string {
  const base = nomeOriginal.replace(/\.[^.]+$/, '') || 'print'
  return `${base}-anotado.png`
}

export function ChatImagemAnexoEditor({ open, file, enviando = false, onCancel, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagemBaseRef = useRef<HTMLImageElement | null>(null)
  const tracoAtualRef = useRef<Traco | null>(null)
  const aDesenharRef = useRef(false)

  const [carregando, setCarregando] = useState(false)
  const [tracos, setTracos] = useState<Traco[]>([])
  const [cor, setCor] = useState<string>(CORES[0].value)

  const repintar = useCallback((lista: Traco[], tracoExtra?: Traco | null) => {
    const canvas = canvasRef.current
    const img = imagemBaseRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const traco of lista) desenharTraco(ctx, traco)
    if (tracoExtra) desenharTraco(ctx, tracoExtra)
  }, [])

  useEffect(() => {
    if (!open || !file) {
      setTracos([])
      setCor(CORES[0].value)
      imagemBaseRef.current = null
      tracoAtualRef.current = null
      aDesenharRef.current = false
      return
    }

    let cancelado = false
    setCarregando(true)
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      if (cancelado) return
      let largura = img.naturalWidth
      let altura = img.naturalHeight
      if (largura > MAX_DIM || altura > MAX_DIM) {
        const escala = MAX_DIM / Math.max(largura, altura)
        largura = Math.round(largura * escala)
        altura = Math.round(altura * escala)
      }

      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = largura
      canvas.height = altura
      imagemBaseRef.current = img
      setTracos([])
      repintar([])
      setCarregando(false)
    }

    img.onerror = () => {
      if (!cancelado) setCarregando(false)
    }

    img.src = url

    return () => {
      cancelado = true
      URL.revokeObjectURL(url)
    }
  }, [open, file, repintar])

  useEffect(() => {
    repintar(tracos)
  }, [tracos, repintar])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, enviando, onCancel])

  function iniciarTraco(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas || carregando || enviando) return
    const ponto = pontoNoCanvas(canvas, clientX, clientY)
    const traco: Traco = { pontos: [ponto], cor, largura: LARGURA_TRACO }
    tracoAtualRef.current = traco
    aDesenharRef.current = true
    repintar(tracos, traco)
  }

  function continuarTraco(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    const traco = tracoAtualRef.current
    if (!canvas || !traco || !aDesenharRef.current) return
    traco.pontos.push(pontoNoCanvas(canvas, clientX, clientY))
    repintar(tracos, traco)
  }

  function terminarTraco() {
    const traco = tracoAtualRef.current
    aDesenharRef.current = false
    tracoAtualRef.current = null
    if (!traco || traco.pontos.length < 2) return
    setTracos((prev) => [...prev, traco])
  }

  function desfazer() {
    setTracos((prev) => prev.slice(0, -1))
  }

  function limparDesenhos() {
    setTracos([])
  }

  function confirmar() {
    const canvas = canvasRef.current
    if (!canvas || !file || carregando || enviando) return
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onConfirm(new File([blob], nomeArquivoAnotado(file.name), { type: 'image/png' }))
      },
      'image/png',
      0.92
    )
  }

  if (!open || !file || typeof document === 'undefined') return null

  return createPortal(
    <div className="chat-imagem-editor" role="dialog" aria-modal="true" aria-label="Desenhar no print">
      <div className="chat-imagem-editor__backdrop" aria-hidden onClick={() => !enviando && onCancel()} />
      <div className="chat-imagem-editor__panel">
        <header className="chat-imagem-editor__head">
          <button
            type="button"
            className="chat-imagem-editor__head-btn"
            disabled={enviando}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <span className="chat-imagem-editor__title">Desenhar no print</span>
          <button
            type="button"
            className="chat-imagem-editor__head-btn chat-imagem-editor__head-btn--primary"
            disabled={enviando || carregando}
            onClick={confirmar}
          >
            {enviando ? 'A enviar…' : 'Enviar'}
          </button>
        </header>

        <div className="chat-imagem-editor__stage">
          {carregando ? (
            <p className="chat-imagem-editor__loading">A carregar imagem…</p>
          ) : (
            <canvas
              ref={canvasRef}
              className="chat-imagem-editor__canvas"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                iniciarTraco(e.clientX, e.clientY)
              }}
              onPointerMove={(e) => {
                if (!aDesenharRef.current) return
                continuarTraco(e.clientX, e.clientY)
              }}
              onPointerUp={() => terminarTraco()}
              onPointerCancel={() => terminarTraco()}
              onPointerLeave={() => {
                if (aDesenharRef.current) terminarTraco()
              }}
            />
          )}
        </div>

        <footer className="chat-imagem-editor__toolbar">
          <div className="chat-imagem-editor__cores" role="group" aria-label="Cor do lápis">
            {CORES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={
                  cor === c.value
                    ? 'chat-imagem-editor__cor chat-imagem-editor__cor--ativa'
                    : 'chat-imagem-editor__cor'
                }
                style={{ '--cor-lapis': c.value } as CSSProperties}
                title={c.label}
                aria-label={c.label}
                aria-pressed={cor === c.value}
                disabled={enviando || carregando}
                onClick={() => setCor(c.value)}
              />
            ))}
          </div>
          <div className="chat-imagem-editor__acoes">
            <button
              type="button"
              className="chat-imagem-editor__acao"
              disabled={enviando || carregando || tracos.length === 0}
              onClick={desfazer}
              title="Desfazer último traço"
            >
              Desfazer
            </button>
            <button
              type="button"
              className="chat-imagem-editor__acao"
              disabled={enviando || carregando || tracos.length === 0}
              onClick={limparDesenhos}
              title="Limpar todos os desenhos"
            >
              Limpar
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}
