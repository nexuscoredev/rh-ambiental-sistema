import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  decodificarImagemParaEditor,
  fecharImagemEditorDecodificada,
} from '../../lib/imagemEditorUtils'

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

function desenharSegmentoTraco(
  ctx: CanvasRenderingContext2D,
  de: Ponto,
  para: Ponto,
  cor: string,
  largura: number
) {
  ctx.save()
  ctx.strokeStyle = cor
  ctx.lineWidth = largura
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(de.x, de.y)
  ctx.lineTo(para.x, para.y)
  ctx.stroke()
  ctx.restore()
}

function pontoNoCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number): Ponto {
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return { x: 0, y: 0 }
  return {
    x: ((clientX - rect.left) * canvas.width) / rect.width,
    y: ((clientY - rect.top) * canvas.height) / rect.height,
  }
}

function nomeArquivoAnotado(nomeOriginal: string): string {
  const base = nomeOriginal.replace(/\.[^.]+$/, '') || 'print'
  return `${base}-anotado.png`
}

export function ChatImagemAnexoEditor({ open, file, enviando = false, onCancel, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const imagemBaseRef = useRef<ImageBitmap | null>(null)
  const tracoAtualRef = useRef<Traco | null>(null)
  const aDesenharRef = useRef(false)
  const tracosRef = useRef<Traco[]>([])

  const [carregando, setCarregando] = useState(false)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const [imagemCarregada, setImagemCarregada] = useState(false)
  const [tracos, setTracos] = useState<Traco[]>([])
  const [cor, setCor] = useState<string>(CORES[0].value)

  useEffect(() => {
    tracosRef.current = tracos
  }, [tracos])

  const repintarCompleto = useCallback((lista: Traco[]) => {
    const canvas = canvasRef.current
    const bitmap = imagemBaseRef.current
    const ctx = ctxRef.current ?? canvas?.getContext('2d', { alpha: false }) ?? null
    if (!canvas || !bitmap || !ctx) return
    ctxRef.current = ctx
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const traco of lista) desenharTraco(ctx, traco)
  }, [])

  useEffect(() => {
    if (!open || !file) {
      setTracos([])
      tracosRef.current = []
      setCor(CORES[0].value)
      fecharImagemEditorDecodificada(imagemBaseRef.current)
      imagemBaseRef.current = null
      ctxRef.current = null
      tracoAtualRef.current = null
      aDesenharRef.current = false
      setImagemCarregada(false)
      setErroCarregamento(null)
      setCarregando(false)
      return
    }

    let cancelado = false
    setCarregando(true)
    setErroCarregamento(null)
    setImagemCarregada(false)
    setTracos([])

    void decodificarImagemParaEditor(file)
      .then(({ bitmap, width, height }) => {
        if (cancelado) {
          fecharImagemEditorDecodificada(bitmap)
          return
        }

        fecharImagemEditorDecodificada(imagemBaseRef.current)
        imagemBaseRef.current = bitmap

        requestAnimationFrame(() => {
          if (cancelado) return
          const canvas = canvasRef.current
          if (!canvas) {
            setCarregando(false)
            setErroCarregamento('Não foi possível preparar o editor.')
            return
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false })
          if (!ctx) {
            setCarregando(false)
            setErroCarregamento('Não foi possível preparar o editor.')
            return
          }
          ctxRef.current = ctx
          ctx.drawImage(bitmap, 0, 0, width, height)
          setImagemCarregada(true)
          setCarregando(false)
        })
      })
      .catch(() => {
        if (!cancelado) {
          setCarregando(false)
          setErroCarregamento(
            'Não foi possível carregar a imagem. Tente colar de novo ou anexar o ficheiro.'
          )
        }
      })

    return () => {
      cancelado = true
    }
  }, [open, file])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, enviando, onCancel])

  useEffect(() => {
    return () => {
      fecharImagemEditorDecodificada(imagemBaseRef.current)
      imagemBaseRef.current = null
    }
  }, [])

  function iniciarTraco(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas || carregando || enviando || !imagemCarregada) return
    const ponto = pontoNoCanvas(canvas, clientX, clientY)
    const traco: Traco = { pontos: [ponto], cor, largura: LARGURA_TRACO }
    tracoAtualRef.current = traco
    aDesenharRef.current = true
  }

  function continuarTraco(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    const traco = tracoAtualRef.current
    if (!canvas || !ctx || !traco || !aDesenharRef.current) return

    const ponto = pontoNoCanvas(canvas, clientX, clientY)
    const anterior = traco.pontos[traco.pontos.length - 1]
    if (!anterior) return

    if (anterior.x === ponto.x && anterior.y === ponto.y) return

    traco.pontos.push(ponto)
    desenharSegmentoTraco(ctx, anterior, ponto, traco.cor, traco.largura)
  }

  function terminarTraco() {
    const traco = tracoAtualRef.current
    aDesenharRef.current = false
    tracoAtualRef.current = null
    if (!traco || traco.pontos.length < 2) return
    setTracos((prev) => {
      const next = [...prev, traco]
      tracosRef.current = next
      return next
    })
  }

  function desfazer() {
    const next = tracosRef.current.slice(0, -1)
    tracosRef.current = next
    setTracos(next)
    repintarCompleto(next)
  }

  function limparDesenhos() {
    tracosRef.current = []
    setTracos([])
    repintarCompleto([])
  }

  function confirmar() {
    const canvas = canvasRef.current
    if (!canvas || !file || carregando || enviando || !imagemCarregada) return
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onConfirm(new File([blob], nomeArquivoAnotado(file.name), { type: 'image/png' }))
      },
      'image/png',
      0.82
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
            disabled={enviando || carregando || !imagemCarregada}
            onClick={confirmar}
          >
            {enviando ? 'A enviar…' : 'Enviar'}
          </button>
        </header>

        <div className="chat-imagem-editor__stage">
          <canvas
            ref={canvasRef}
            className={
              imagemCarregada
                ? 'chat-imagem-editor__canvas'
                : 'chat-imagem-editor__canvas chat-imagem-editor__canvas--oculto'
            }
            onPointerDown={(e) => {
              e.preventDefault()
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
          {carregando ? (
            <p className="chat-imagem-editor__loading">A carregar imagem…</p>
          ) : null}
          {erroCarregamento ? (
            <p className="chat-imagem-editor__erro" role="alert">
              {erroCarregamento}
            </p>
          ) : null}
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
                disabled={enviando || carregando || !imagemCarregada}
                onClick={() => setCor(c.value)}
              />
            ))}
          </div>
          <div className="chat-imagem-editor__acoes">
            <button
              type="button"
              className="chat-imagem-editor__acao"
              disabled={enviando || carregando || !imagemCarregada || tracos.length === 0}
              onClick={desfazer}
              title="Desfazer último traço"
            >
              Desfazer
            </button>
            <button
              type="button"
              className="chat-imagem-editor__acao"
              disabled={enviando || carregando || !imagemCarregada || tracos.length === 0}
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
