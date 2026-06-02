import { useRef, useState } from 'react'

type Props = {
  urls: string[]
  onUrlsChange: (urls: string[]) => void
  onFilesSelect: (files: File[]) => void
  disabled?: boolean
}

export function FrotaUploadFotos({ urls, onUrlsChange, onFilesSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewFiles, setPreviewFiles] = useState<string[]>([])

  function handleFiles(list: FileList | null) {
    if (!list?.length) return
    const files = Array.from(list)
    onFilesSelect(files)
    const previews = files.map((f) => URL.createObjectURL(f))
    setPreviewFiles((p) => [...p, ...previews])
  }

  return (
    <div className="frota-fotos">
      <div className="frota-fotos__head">
        <span className="frota-fotos__title">Fotos</span>
        <button
          type="button"
          className="frota-btn frota-btn--ghost"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Adicionar fotos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      <div className="frota-fotos__grid">
        {urls.map((url) => (
          <figure key={url} className="frota-fotos__item">
            <img src={url} alt="" />
            <button
              type="button"
              className="frota-fotos__remove"
              disabled={disabled}
              onClick={() => onUrlsChange(urls.filter((u) => u !== url))}
            >
              Remover
            </button>
          </figure>
        ))}
        {previewFiles.map((url) => (
          <figure key={url} className="frota-fotos__item frota-fotos__item--pending">
            <img src={url} alt="" />
            <span className="frota-fotos__badge">Nova</span>
          </figure>
        ))}
      </div>
    </div>
  )
}
