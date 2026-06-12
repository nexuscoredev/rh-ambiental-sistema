import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { buscarClientesAtivos, obterClienteAtivoPorId, type ClienteAtivoOpt } from '../../lib/buscarClientesAtivos'
import { useDebouncedValue } from '../../lib/useDebouncedValue'

type Props = {
  value: string
  onChange: (clienteId: string) => void
  placeholder?: string
  style?: CSSProperties
  disabled?: boolean
  id?: string
}

const listStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 'calc(100% + 4px)',
  zIndex: 50,
  margin: 0,
  padding: '4px 0',
  listStyle: 'none',
  maxHeight: '220px',
  overflowY: 'auto',
  borderRadius: '8px',
  border: "1px solid var(--border-color, #e2e8f0)",
  background: "var(--bg-card, #ffffff)",
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
}

const itemStyle: CSSProperties = {
  padding: '8px 12px',
  fontSize: '14px',
  cursor: 'pointer',
  color: "var(--text-primary, #0f172a)",
}

export function ClienteBuscaSelect({
  value,
  onChange,
  placeholder = 'Cliente a cobrar…',
  style,
  disabled,
  id,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [nomeSel, setNomeSel] = useState('')
  const [opcoes, setOpcoes] = useState<ClienteAtivoOpt[]>([])
  const [loading, setLoading] = useState(false)
  const textoDeb = useDebouncedValue(texto, 300)

  useEffect(() => {
    if (!value) {
      setNomeSel('')
      return
    }
    void obterClienteAtivoPorId(value).then((c) => {
      if (c) setNomeSel(c.nome)
    })
  }, [value])

  useEffect(() => {
    if (!aberto) return
    let cancel = false
    setLoading(true)
    void buscarClientesAtivos({ termo: textoDeb, limit: 40 }).then((rows) => {
      if (!cancel) {
        setOpcoes(rows)
        setLoading(false)
      }
    })
    return () => {
      cancel = true
    }
  }, [aberto, textoDeb])

  useEffect(() => {
    if (!aberto) return
    const fn = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAberto(false)
        setTexto(nomeSel)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [aberto, nomeSel])

  function selecionar(c: ClienteAtivoOpt) {
    onChange(c.id)
    setNomeSel(c.nome)
    setTexto(c.nome)
    setAberto(false)
  }

  const inputValue = aberto ? texto : nomeSel

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          const v = e.target.value
          setTexto(v)
          setAberto(true)
          if (!v.trim()) {
            onChange('')
            setNomeSel('')
          }
        }}
        onFocus={() => {
          setAberto(true)
          setTexto(nomeSel || texto)
        }}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '8px',
          border: `1px solid ${aberto ? '#0d9488' : '#cbd5e1'}`,
          fontSize: '14px',
          boxSizing: 'border-box',
          background: "var(--bg-card, #ffffff)",
          color: "var(--text-primary, #0f172a)",
          boxShadow: aberto ? '0 0 0 3px rgba(13, 148, 136, 0.12)' : 'none',
          ...style,
        }}
      />
      {aberto && !disabled ? (
        <ul role="listbox" style={listStyle}>
          {loading ? (
            <li style={{ ...itemStyle, color: "var(--text-secondary, #64748b)", cursor: 'default' }}>A carregar…</li>
          ) : opcoes.length === 0 ? (
            <li style={{ ...itemStyle, color: "var(--text-secondary, #64748b)", cursor: 'default' }}>
              {textoDeb.trim() ? 'Nenhum cliente encontrado' : 'Digite o nome do cliente'}
            </li>
          ) : (
            opcoes.map((c) => (
              <li
                key={c.id}
                role="option"
                aria-selected={c.id === value}
                style={{
                  ...itemStyle,
                  background: c.id === value ? '#f0fdfa' : undefined,
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(c)}
              >
                {c.nome}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
