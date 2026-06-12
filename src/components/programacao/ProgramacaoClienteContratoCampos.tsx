import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { EquipamentoContratoItem, ResiduoContratoItem } from '../../lib/clienteContratoCadastro'
import {
  fetchClienteRowContratoMtr,
  parseContratoClienteMtr,
  residuoContratoTemConteudo,
  rotuloResiduoContrato,
  type MtrContratoClienteSnapshot,
} from '../../lib/mtrClienteContratoAutofill'
import {
  alternarEquipamentoProgramacao,
  alternarResiduoProgramacao,
  atualizarQuantidadeEquipamentoProgramacao,
  atualizarQuantidadeResiduoProgramacao,
  equipamentoProgramacaoSelecionado,
  quantidadeEquipamentoProgramacao,
  quantidadeResiduoProgramacao,
  residuoProgramacaoSelecionado,
  type EquipamentoProgramacaoItem,
  type ResiduoProgramacaoItem,
} from '../../lib/programacaoContratoSelecao'

type Props = {
  clienteId: string
  residuosSelecionados: ResiduoProgramacaoItem[]
  equipamentosSelecionados: EquipamentoProgramacaoItem[]
  onResiduosChange: (itens: ResiduoProgramacaoItem[]) => void
  onEquipamentosChange: (itens: EquipamentoProgramacaoItem[]) => void
  labelStyle: CSSProperties
}

const blocoStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '10px',
  border: "1px solid var(--border-color, #e2e8f0)",
  background: "var(--bg-subtle, #f8fafc)",
}

const tituloSecaoStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '13px',
  fontWeight: 800,
  color: "var(--text-primary, #334155)",
}

const inputQtdStyle: CSSProperties = {
  width: '76px',
  flexShrink: 0,
  padding: '6px 8px',
  fontSize: '13px',
  fontWeight: 600,
  borderRadius: '6px',
  border: "1px solid var(--input-border, #cbd5e1)",
  background: "var(--bg-card, #ffffff)",
  color: "var(--text-primary, #0f172a)",
  textAlign: 'right',
}

function ListaMultiplaContrato<T extends ResiduoContratoItem | EquipamentoContratoItem>({
  titulo,
  vazio,
  itens,
  selecionado,
  quantidade,
  onToggle,
  onQuantidadeChange,
  rotuloItem,
  detalheItem,
}: {
  titulo: string
  vazio: string
  itens: T[]
  selecionado: (item: T) => boolean
  quantidade: (item: T) => string
  onToggle: (item: T) => void
  onQuantidadeChange: (item: T, valor: string) => void
  rotuloItem: (item: T) => string
  detalheItem?: (item: T) => string | null
}) {
  return (
    <div style={blocoStyle}>
      {titulo ? <p style={tituloSecaoStyle}>{titulo}</p> : null}
      {itens.length === 0 ? (
        <p style={{ margin: 0, fontSize: '13px', color: "var(--text-secondary, #64748b)" }}>{vazio}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {itens.map((item, i) => {
            const ativo = selecionado(item)
            const detalhe = detalheItem?.(item)
            return (
              <div
                key={`${rotuloItem(item)}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: ativo ? '#f0fdfa' : '#ffffff',
                  border: `1px solid ${ativo ? '#99f6e4' : '#e2e8f0'}`,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    flex: 1,
                    minWidth: 0,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={() => onToggle(item)}
                    style={{ marginTop: '3px', flexShrink: 0 }}
                  />
                  <span style={{ lineHeight: 1.45, minWidth: 0 }}>
                    <span style={{ color: "var(--text-primary, #0f172a)" }}>{rotuloItem(item)}</span>
                    {detalhe ? (
                      <span
                        style={{
                          display: 'block',
                          fontWeight: 500,
                          color: "var(--text-secondary, #64748b)",
                          fontSize: '12px',
                        }}
                      >
                        {detalhe}
                      </span>
                    ) : null}
                  </span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: "var(--text-secondary, #64748b)" }}>Qtd.</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={quantidade(item)}
                    disabled={!ativo}
                    onChange={(e) => onQuantidadeChange(item, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Quantidade — ${rotuloItem(item)}`}
                    style={{
                      ...inputQtdStyle,
                      opacity: ativo ? 1 : 0.55,
                      cursor: ativo ? 'text' : 'not-allowed',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ProgramacaoClienteContratoCampos({
  clienteId,
  residuosSelecionados,
  equipamentosSelecionados,
  onResiduosChange,
  onEquipamentosChange,
  labelStyle,
}: Props) {
  const [contrato, setContrato] = useState<MtrContratoClienteSnapshot | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    const id = clienteId.trim()
    if (!id) {
      setContrato(null)
      return
    }
    let cancel = false
    setCarregando(true)
    void fetchClienteRowContratoMtr(supabase, id).then(({ row, error }) => {
      if (cancel) return
      setCarregando(false)
      if (error || !row) {
        setContrato(null)
        return
      }
      setContrato(parseContratoClienteMtr(row))
    })
    return () => {
      cancel = true
    }
  }, [clienteId])

  const residuos = (contrato?.residuos ?? []).filter(residuoContratoTemConteudo)
  const equipamentos = (contrato?.equipamentos ?? []).filter((e) => e.descricao.trim())

  if (!clienteId.trim()) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: "var(--text-secondary, #64748b)" }}>
        Selecione um cliente para escolher resíduos e equipamentos do contrato.
      </p>
    )
  }

  if (carregando) {
    return <p style={{ margin: 0, fontSize: '13px', color: "var(--text-secondary, #64748b)" }}>Carregando contrato do cliente…</p>
  }

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div>
        <span style={{ ...labelStyle, display: 'block', marginBottom: '6px' }}>
          Resíduos <span style={{ fontWeight: 500, color: "var(--text-secondary, #64748b)" }}>(pode marcar mais de um)</span>
        </span>
        <ListaMultiplaContrato
          titulo=""
          vazio="Nenhum resíduo cadastrado no contrato deste cliente."
          itens={residuos}
          selecionado={(r) => residuoProgramacaoSelecionado(residuosSelecionados, r)}
          quantidade={(r) => quantidadeResiduoProgramacao(residuosSelecionados, r)}
          onToggle={(r) => onResiduosChange(alternarResiduoProgramacao(residuosSelecionados, r))}
          onQuantidadeChange={(r, valor) =>
            onResiduosChange(atualizarQuantidadeResiduoProgramacao(residuosSelecionados, r, valor))
          }
          rotuloItem={(r) => rotuloResiduoContrato(r) || '—'}
          detalheItem={(r) => {
            const partes: string[] = []
            if (r.unidade_medida.trim()) partes.push(r.unidade_medida.trim())
            if (r.frequencia_coleta.trim()) partes.push(`Frequência: ${r.frequencia_coleta.trim()}`)
            return partes.length > 0 ? partes.join(' · ') : null
          }}
        />
      </div>

      <div>
        <span style={{ ...labelStyle, display: 'block', marginBottom: '6px' }}>
          Equipamentos <span style={{ fontWeight: 500, color: "var(--text-secondary, #64748b)" }}>(pode marcar mais de um)</span>
        </span>
        <ListaMultiplaContrato
          titulo=""
          vazio="Nenhum equipamento cadastrado no contrato deste cliente."
          itens={equipamentos}
          selecionado={(e) => equipamentoProgramacaoSelecionado(equipamentosSelecionados, e)}
          quantidade={(e) => quantidadeEquipamentoProgramacao(equipamentosSelecionados, e)}
          onToggle={(e) => onEquipamentosChange(alternarEquipamentoProgramacao(equipamentosSelecionados, e))}
          onQuantidadeChange={(e, valor) =>
            onEquipamentosChange(atualizarQuantidadeEquipamentoProgramacao(equipamentosSelecionados, e, valor))
          }
          rotuloItem={(e) => e.descricao.trim()}
          detalheItem={(e) => (e.com_custo ? 'Com custo no contrato' : 'Sem custo no contrato')}
        />
      </div>
    </div>
  )
}
