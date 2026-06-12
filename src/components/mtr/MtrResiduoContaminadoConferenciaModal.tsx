import { useEffect, useState } from 'react'
import {
  avisosConferenciaDeclaracao,
  type DeclaracaoResiduoContaminadoDados,
  type EstadoFisicoDeclaracao,
} from '../../lib/mtrResiduoContaminadoDeclaracao'
import { MtrResiduoContaminadoPrint } from './MtrResiduoContaminadoPrint'

type Props = {
  open: boolean
  dadosIniciais: DeclaracaoResiduoContaminadoDados | null
  onClose: () => void
  onGerarImpressao: (dados: DeclaracaoResiduoContaminadoDados) => void
}

const ESTADOS: { id: EstadoFisicoDeclaracao; label: string }[] = [
  { id: 'solido', label: 'Sólido' },
  { id: 'liquido', label: 'Líquido' },
  { id: 'pastoso', label: 'Pastoso' },
  { id: 'lodo', label: 'Lodo' },
]

export function MtrResiduoContaminadoConferenciaModal({
  open,
  dadosIniciais,
  onClose,
  onGerarImpressao,
}: Props) {
  const [draft, setDraft] = useState<DeclaracaoResiduoContaminadoDados | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (open && dadosIniciais) {
      setDraft({
        ...dadosIniciais,
        gerador: { ...dadosIniciais.gerador },
        assinatura: { ...dadosIniciais.assinatura },
        residuos:
          dadosIniciais.residuos?.length > 0 ? [...dadosIniciais.residuos] : [''],
      })
      setErro('')
    }
  }, [open, dadosIniciais])

  if (!open || !draft) return null

  const avisos = avisosConferenciaDeclaracao(draft)

  function atualizarGerador(campo: keyof DeclaracaoResiduoContaminadoDados['gerador'], valor: string) {
    setDraft((prev) =>
      prev ? { ...prev, gerador: { ...prev.gerador, [campo]: valor } } : prev
    )
  }

  function atualizarAssinatura(campo: keyof DeclaracaoResiduoContaminadoDados['assinatura'], valor: string) {
    setDraft((prev) =>
      prev ? { ...prev, assinatura: { ...prev.assinatura, [campo]: valor } } : prev
    )
  }

  function handleGerar() {
    if (!draft) return
    const pend = avisosConferenciaDeclaracao(draft)
    if (pend.length > 0) {
      setErro(`Preencha ou corrija: ${pend.join('; ')}.`)
      return
    }
    onGerarImpressao(draft)
  }

  return (
    <div className="modal-overlay no-print mtr-rc-modal-overlay" role="dialog" aria-modal aria-labelledby="mtr-rc-modal-title">
      <div className="modal-card mtr-rc-modal-card">
        <div className="modal-head">
          <div>
            <h3 id="mtr-rc-modal-title">Conferência — Resíduo contaminado (Anexo 2)</h3>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: "var(--text-secondary, #64748b)" }}>
              Revise os campos do gerador e da quantidade. Destino e transporte seguem o modelo RG Ambiental.
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mtr-rc-modal-body">
          {avisos.length > 0 ? (
            <div className="alert-box alert-warning" style={{ marginBottom: 12 }}>
              <strong>Atenção:</strong> {avisos.join('; ')}.
            </div>
          ) : null}

          {erro ? (
            <div className="alert-box alert-danger" style={{ marginBottom: 12 }} role="alert">
              {erro}
            </div>
          ) : null}

          <div className="mtr-rc-modal-grid">
            <section className="mtr-rc-modal-form">
              <h4 className="mtr-rc-modal-form-title">1. Entidade geradora (editável)</h4>
              <label className="mtr-rc-modal-field">
                <span>Razão social</span>
                <input
                  value={draft.gerador.razaoSocial}
                  onChange={(e) => atualizarGerador('razaoSocial', e.target.value)}
                />
              </label>
              <label className="mtr-rc-modal-field">
                <span>CNPJ</span>
                <input value={draft.gerador.cnpj} onChange={(e) => atualizarGerador('cnpj', e.target.value)} />
              </label>
              <label className="mtr-rc-modal-field">
                <span>Endereço</span>
                <input
                  value={draft.gerador.endereco}
                  onChange={(e) => atualizarGerador('endereco', e.target.value)}
                />
              </label>
              <label className="mtr-rc-modal-field">
                <span>Quantidade (Kg) (opcional)</span>
                <input
                  value={draft.quantidadeKg}
                  onChange={(e) => setDraft((p) => (p ? { ...p, quantidadeKg: e.target.value } : p))}
                />
              </label>

              <div className="mtr-rc-modal-residuos">
                <span className="mtr-rc-modal-residuos__label">Resíduo(s) — tipo/classe</span>
                {draft.residuos.map((valor, idx) => (
                  <div key={idx} className="mtr-rc-modal-residuos__row">
                    <input
                      value={valor}
                      placeholder="Ex.: EFLUENTE, RSS, óleo contaminado…"
                      onChange={(e) =>
                        setDraft((p) => {
                          if (!p) return p
                          const next = [...p.residuos]
                          next[idx] = e.target.value
                          return { ...p, residuos: next }
                        })
                      }
                    />
                    {draft.residuos.length > 1 ? (
                      <button
                        type="button"
                        className="mtr-rc-modal-residuos__remove"
                        aria-label={`Remover resíduo ${idx + 1}`}
                        onClick={() =>
                          setDraft((p) => {
                            if (!p || p.residuos.length <= 1) return p
                            return {
                              ...p,
                              residuos: p.residuos.filter((_, i) => i !== idx),
                            }
                          })
                        }
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="mtr-rc-modal-residuos__add"
                  onClick={() =>
                    setDraft((p) => (p ? { ...p, residuos: [...p.residuos, ''] } : p))
                  }
                >
                  + Adicionar mais
                </button>
              </div>

              <fieldset className="mtr-rc-modal-estados">
                <legend>Estado físico</legend>
                {ESTADOS.map(({ id, label }) => (
                  <label key={id} className="mtr-rc-modal-estado-opt">
                    <input
                      type="radio"
                      name="estado-fisico-rc"
                      checked={draft.estadoFisico === id}
                      onChange={() => setDraft((p) => (p ? { ...p, estadoFisico: id } : p))}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              <h4 className="mtr-rc-modal-form-title" style={{ marginTop: 16 }}>
                Assinatura (opcional)
              </h4>
              <label className="mtr-rc-modal-field">
                <span>Responsável</span>
                <input
                  value={draft.assinatura.responsavel}
                  onChange={(e) => atualizarAssinatura('responsavel', e.target.value)}
                />
              </label>
              <label className="mtr-rc-modal-field">
                <span>Departamento</span>
                <input
                  value={draft.assinatura.departamento}
                  onChange={(e) => atualizarAssinatura('departamento', e.target.value)}
                />
              </label>
              <label className="mtr-rc-modal-field">
                <span>E-mail</span>
                <input
                  type="email"
                  value={draft.assinatura.email}
                  onChange={(e) => atualizarAssinatura('email', e.target.value)}
                />
              </label>
              <label className="mtr-rc-modal-field">
                <span>Telefone</span>
                <input
                  value={draft.assinatura.telefone}
                  onChange={(e) => atualizarAssinatura('telefone', e.target.value)}
                />
              </label>
              <label className="mtr-rc-modal-field">
                <span>Data</span>
                <input
                  value={draft.assinatura.data}
                  onChange={(e) => atualizarAssinatura('data', e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </label>
            </section>

            <section className="mtr-rc-modal-preview" aria-label="Pré-visualização do documento">
              <MtrResiduoContaminadoPrint dados={draft} exibirReferenciaMtr />
            </section>
          </div>
        </div>

        <div className="mtr-rc-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleGerar}>
            Gerar para impressão
          </button>
        </div>
      </div>
    </div>
  )
}
