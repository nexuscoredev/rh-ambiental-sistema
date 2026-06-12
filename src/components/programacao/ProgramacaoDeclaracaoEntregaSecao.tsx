import type { CSSProperties } from 'react'
import { RgReportPdfIcon } from '../ui/RgReportPdfIcon'
import { INSTALACAO_ENTREGA_CHIP_FLUXO } from '../../lib/programacaoInstalacaoEntrega'
import type { FrotaDeclaracaoEntregaDados } from '../../lib/frotaDeclaracaoEntrega'

type Props = {
  draft: FrotaDeclaracaoEntregaDados
  onChange: (campo: keyof FrotaDeclaracaoEntregaDados, valor: string) => void
  onGerar: () => void
  carregando?: boolean
  gerando?: boolean
  podeGerar?: boolean
  avisoSemId?: string | null
  inputStyle: CSSProperties
  labelStyle: CSSProperties
}

export function ProgramacaoDeclaracaoEntregaSecao({
  draft,
  onChange,
  onGerar,
  carregando = false,
  gerando = false,
  podeGerar = true,
  avisoSemId,
  inputStyle,
  labelStyle,
}: Props) {
  const textareaStyle: CSSProperties = {
    ...inputStyle,
    minHeight: '72px',
    resize: 'vertical',
    fontFamily: 'inherit',
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '14px',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #99f6e4',
        background: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)',
      }}
    >
      <div>
        <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#0f766e' }}>
          Declaração de entrega de equipamento
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: "var(--text-secondary, #64748b)", lineHeight: 1.45 }}>
          Preencha os dados do documento (Anexo 2). Este fluxo não gera MTR, ticket nem faturamento — ao
          confirmar a impressão, a programação passa a <strong style={{ color: "var(--text-primary, #334155)" }}>Finalizado</strong>.
        </p>
        <span
          style={{
            display: 'inline-block',
            marginTop: '10px',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#0f766e',
            background: '#ccfbf1',
          }}
        >
          {INSTALACAO_ENTREGA_CHIP_FLUXO}
        </span>
      </div>

      {carregando ? (
        <p style={{ margin: 0, fontSize: '13px', color: "var(--text-secondary, #64748b)" }}>A carregar dados do cliente…</p>
      ) : (
        <form
          onSubmit={(ev) => {
            ev.preventDefault()
            onGerar()
          }}
          style={{ display: 'grid', gap: '12px' }}
        >
          <label style={{ display: 'grid', gap: '6px', ...labelStyle }}>
            Razão social
            <input
              value={draft.razaoSocial}
              onChange={(ev) => onChange('razaoSocial', ev.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: '6px', ...labelStyle }}>
            Endereço
            <textarea
              value={draft.endereco}
              onChange={(ev) => onChange('endereco', ev.target.value)}
              rows={3}
              style={textareaStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: '6px', ...labelStyle }}>
            Telefone
            <input
              value={draft.telefone}
              onChange={(ev) => onChange('telefone', ev.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: '6px', ...labelStyle }}>
            Equipamento(s)
            <textarea
              value={draft.equipamento}
              onChange={(ev) => onChange('equipamento', ev.target.value)}
              rows={2}
              style={textareaStyle}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ display: 'grid', gap: '6px', ...labelStyle }}>
              Data da entrega
              <input
                type="date"
                value={draft.dataEntrega}
                onChange={(ev) => onChange('dataEntrega', ev.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px', ...labelStyle }}>
              Data do documento
              <input
                type="date"
                value={draft.dataDocumento}
                onChange={(ev) => onChange('dataDocumento', ev.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: "var(--text-secondary, #64748b)", lineHeight: 1.5 }}>
            No documento impresso, a linha de assinatura identifica a{' '}
            <strong style={{ color: "var(--text-primary, #334155)" }}>empresa responsável pelo recebimento</strong> (
            {draft.razaoSocial.trim() || 'razão social do cliente'}).
          </p>
          {avisoSemId ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#b45309', lineHeight: 1.45 }}>{avisoSemId}</p>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="rg-btn rg-btn--primary"
              disabled={!podeGerar || gerando}
              style={{
                opacity: !podeGerar || gerando ? 0.55 : 1,
                cursor: !podeGerar || gerando ? 'not-allowed' : 'pointer',
              }}
            >
              <RgReportPdfIcon />
              {gerando ? 'A gerar…' : 'Gerar declaração de entrega'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
