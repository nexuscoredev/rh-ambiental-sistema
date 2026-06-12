import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { formatarCNPJ, type FormCliente } from '../../lib/clienteCadastroForm'
import {
  clienteFieldLabelStackStyle,
  clienteFieldLabelTextStyle,
} from '../../lib/clienteCadastroUi'
import {
  normalizarGeradorDonoFaturamentoOpcao,
  type GeradorDonoFaturamentoOpcao,
} from '../../lib/clienteGeradorDonoFaturamento'
import { ClienteEmpresaGrupoFaturamentoCampos } from './ClienteEmpresaGrupoFaturamentoCampos'

type Props = {
  form: FormCliente
  setForm: Dispatch<SetStateAction<FormCliente>>
  inputStyle: CSSProperties
  tituloSecao?: string
  gridColsDuas?: string
}

const labelCheckStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: "var(--text-primary, #334155)",
  cursor: 'pointer',
  userSelect: 'none',
}

export function ClienteGeradorDonoFaturamentoCampos({
  form,
  setForm,
  inputStyle,
  tituloSecao = 'Endereço de Faturamento',
  gridColsDuas = 'repeat(auto-fit, minmax(280px, 1fr))',
}: Props) {
  const opcao = normalizarGeradorDonoFaturamentoOpcao(form.gerador_dono_faturamento)

  function marcar(op: GeradorDonoFaturamentoOpcao) {
    setForm((prev) => ({
      ...prev,
      gerador_dono_faturamento: op,
      ...(op === 'sim'
        ? { faturamento_titular_razao_social: '', faturamento_titular_cnpj: '' }
        : {}),
    }))
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 800,
          color: "var(--text-primary, #334155)",
          marginBottom: '12px',
        }}
      >
        {tituloSecao}
      </div>

      <ClienteEmpresaGrupoFaturamentoCampos form={form} setForm={setForm} />

      <div
        style={{
          padding: '12px 14px',
          marginBottom: opcao === 'nao' ? '12px' : 0,
          borderRadius: '10px',
          background: "var(--bg-subtle, #f8fafc)",
          border: "1px solid var(--border-color, #e2e8f0)",
        }}
      >
        <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: "var(--text-secondary, #475569)" }}>
          Gerador é dono do Faturamento?
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px' }}>
          <label style={labelCheckStyle}>
            <input type="checkbox" checked={opcao === 'sim'} onChange={() => marcar('sim')} />
            Sim
          </label>
          <label style={labelCheckStyle}>
            <input type="checkbox" checked={opcao === 'nao'} onChange={() => marcar('nao')} />
            Não
          </label>
        </div>
      </div>

      {opcao === 'nao' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridColsDuas,
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <label style={clienteFieldLabelStackStyle}>
            <span style={clienteFieldLabelTextStyle}>Razão Social do dono do faturamento</span>
            <input
              name="faturamento_titular_razao_social"
              value={form.faturamento_titular_razao_social}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, faturamento_titular_razao_social: e.target.value }))
              }
              placeholder="Razão social"
              style={inputStyle}
            />
          </label>
          <label style={clienteFieldLabelStackStyle}>
            <span style={clienteFieldLabelTextStyle}>CNPJ do dono do faturamento</span>
            <input
              name="faturamento_titular_cnpj"
              value={form.faturamento_titular_cnpj}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  faturamento_titular_cnpj: formatarCNPJ(e.target.value),
                }))
              }
              placeholder="CNPJ"
              style={inputStyle}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
