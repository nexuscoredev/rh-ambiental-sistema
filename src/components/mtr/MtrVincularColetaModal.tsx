import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { rgAlert } from '../../lib/RgDialogProvider'
import {
  listarColetasCandidatasVinculo,
  vincularColetasPorProgramacaoDaMtr,
  vincularColetasSelecionadasAMtr,
  type ColetaCandidataVinculo,
  type MtrVinculoContexto,
} from '../../lib/mtrGerenciadorVinculoColeta'

type Props = {
  open: boolean
  mtrId: string
  mtrNumero: string
  onClose: () => void
  onVinculado: () => void | Promise<void>
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
}

const panel: CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  maxWidth: '520px',
  width: '100%',
  maxHeight: 'min(85vh, 640px)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
}

export function MtrVincularColetaModal({
  open,
  mtrId,
  mtrNumero,
  onClose,
  onVinculado,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [vinculando, setVinculando] = useState(false)
  const [contexto, setContexto] = useState<MtrVinculoContexto | null>(null)
  const [candidatas, setCandidatas] = useState<ColetaCandidataVinculo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())

  const carregar = useCallback(async () => {
    if (!open || !mtrId) return
    setLoading(true)
    setErro(null)
    const res = await listarColetasCandidatasVinculo(mtrId)
    setContexto(res.contexto)
    setCandidatas(res.candidatas)
    setErro(res.erro)
    setSelecionadas(new Set())
    setLoading(false)
  }, [open, mtrId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  if (!open) return null

  function toggle(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleVincularProgramacao() {
    setVinculando(true)
    const res = await vincularColetasPorProgramacaoDaMtr(mtrId)
    setVinculando(false)
    if (!res.ok) {
      await rgAlert({ title: 'Vincular coleta', message: res.message, variant: 'warning' })
      return
    }
    if (res.vinculadas === 0) {
      await rgAlert({
        title: 'Vincular coleta',
        message: 'Nenhuma coleta livre na programação desta MTR.',
        variant: 'default',
      })
      await carregar()
      return
    }
    await rgAlert({
      title: 'Vincular coleta',
      message:
        res.vinculadas === 1
          ? '1 coleta vinculada pela programação.'
          : `${res.vinculadas} coletas vinculadas pela programação.`,
      variant: 'success',
    })
    await onVinculado()
    onClose()
  }

  async function handleVincularSelecionadas() {
    const ids = [...selecionadas]
    if (!ids.length) {
      await rgAlert({
        title: 'Vincular coleta',
        message: 'Marque ao menos uma coleta na lista.',
        variant: 'warning',
      })
      return
    }
    setVinculando(true)
    const res = await vincularColetasSelecionadasAMtr(mtrId, ids)
    setVinculando(false)
    if (!res.ok) {
      await rgAlert({ title: 'Vincular coleta', message: res.message, variant: 'warning' })
      return
    }
    await rgAlert({
      title: 'Vincular coleta',
      message:
        res.vinculadas === 1
          ? '1 coleta vinculada à MTR.'
          : `${res.vinculadas} coletas vinculadas à MTR.`,
      variant: 'success',
    })
    await onVinculado()
    onClose()
  }

  const elegiveis = candidatas.filter((c) => c.podeVincular)

  return (
    <div style={overlay} role="presentation" onClick={onClose}>
      <div
        style={panel}
        role="dialog"
        aria-labelledby="mtr-vincular-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 id="mtr-vincular-titulo" style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
            Vincular coleta — MTR {mtrNumero}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
            Escolha a coleta operacional para liberar o envio à fila do faturamento.
            {contexto?.programacaoId
              ? ' Esta MTR tem programação: pode vincular todas as coletas livres de uma vez.'
              : ' Sem programação na MTR: selecione manualmente na lista.'}
          </p>
        </div>

        <div style={{ padding: '12px 18px', overflowY: 'auto', flex: 1 }}>
          {erro ? <div className="alert-box alert-warning">{erro}</div> : null}
          {loading ? (
            <p style={{ fontSize: '13px', color: '#64748b' }}>Carregando coletas…</p>
          ) : elegiveis.length === 0 && !contexto?.programacaoId ? (
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Nenhuma coleta sem MTR encontrada
              {contexto?.cliente ? ` para o cliente «${contexto.cliente}»` : ''}. Crie o ticket na
              programação ou na página MTR.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {candidatas.map((c) => (
                <li
                  key={c.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid #f1f5f9',
                    opacity: c.podeVincular ? 1 : 0.55,
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                      cursor: c.podeVincular ? 'pointer' : 'not-allowed',
                      fontSize: '13px',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!c.podeVincular || vinculando}
                      checked={selecionadas.has(c.id)}
                      onChange={() => c.podeVincular && toggle(c.id)}
                      style={{ marginTop: '3px' }}
                    />
                    <span>
                      <strong>#{c.numeroColeta}</strong> — {c.cliente}
                      {c.motivoBloqueio ? (
                        <span style={{ display: 'block', fontSize: '11px', color: '#b45309' }}>
                          {c.motivoBloqueio}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="rg-btn rg-btn--outline" disabled={vinculando} onClick={onClose}>
            Cancelar
          </button>
          {contexto?.programacaoId ? (
            <button
              type="button"
              className="rg-btn rg-btn--outline"
              disabled={vinculando || loading}
              onClick={() => void handleVincularProgramacao()}
            >
              Vincular pela programação
            </button>
          ) : null}
          <button
            type="button"
            className="rg-btn rg-btn--primary"
            disabled={vinculando || loading || selecionadas.size === 0}
            onClick={() => void handleVincularSelecionadas()}
          >
            {vinculando ? 'A vincular…' : 'Vincular selecionadas'}
          </button>
        </div>
      </div>
    </div>
  )
}
