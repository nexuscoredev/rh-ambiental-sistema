import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { FormCliente } from '../../lib/clienteCadastroForm'
import type { EmpresaGrupoFaturamentoForm } from '../../lib/clienteEmpresaGrupoFaturamento'

type Props = {
  form: FormCliente
  setForm: Dispatch<SetStateAction<FormCliente>>
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

const subWrapStyle: CSSProperties = {
  marginTop: '10px',
  marginLeft: '28px',
  padding: '10px 12px',
  borderRadius: '8px',
  background: "var(--bg-card, #ffffff)",
  border: "1px solid var(--border-color, #e2e8f0)",
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

function patchEmpresa(
  prev: FormCliente,
  patch: Partial<EmpresaGrupoFaturamentoForm>
): FormCliente {
  const atual = prev.empresa_grupo_faturamento
  const next = { ...atual, ...patch }
  if (patch.rg1 === false) {
    next.rg1_brasdeco = false
    next.rg1_caixa = false
    next.rg1_itau = false
  }
  return { ...prev, empresa_grupo_faturamento: next }
}

export function ClienteEmpresaGrupoFaturamentoCampos({ form, setForm }: Props) {
  const eg = form.empresa_grupo_faturamento

  return (
    <div
      style={{
        padding: '12px 14px',
        marginBottom: '12px',
        borderRadius: '10px',
        background: "var(--bg-subtle, #f8fafc)",
        border: "1px solid var(--border-color, #e2e8f0)",
      }}
    >
      <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: "var(--text-secondary, #475569)" }}>
        Empresa do grupo responsável pelo faturamento
        <span style={{ fontWeight: 500, color: "var(--text-secondary, #94a3b8)" }}> (opcional)</span>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={labelCheckStyle}>
            <input
              type="checkbox"
              checked={eg.rg1}
              onChange={(e) =>
                setForm((prev) => patchEmpresa(prev, { rg1: e.target.checked }))
              }
            />
            RG 1
          </label>
          {eg.rg1 ? (
            <div style={subWrapStyle} role="group" aria-label="Sub-opções RG 1">
              <label style={labelCheckStyle}>
                <input
                  type="checkbox"
                  checked={eg.rg1_brasdeco}
                  onChange={(e) =>
                    setForm((prev) => patchEmpresa(prev, { rg1_brasdeco: e.target.checked }))
                  }
                />
                Bradesco
              </label>
              <label style={labelCheckStyle}>
                <input
                  type="checkbox"
                  checked={eg.rg1_caixa}
                  onChange={(e) =>
                    setForm((prev) => patchEmpresa(prev, { rg1_caixa: e.target.checked }))
                  }
                />
                Caixa
              </label>
              <label style={labelCheckStyle}>
                <input
                  type="checkbox"
                  checked={eg.rg1_itau}
                  onChange={(e) =>
                    setForm((prev) => patchEmpresa(prev, { rg1_itau: e.target.checked }))
                  }
                />
                Itaú
              </label>
            </div>
          ) : null}
        </div>
        <label style={labelCheckStyle}>
          <input
            type="checkbox"
            checked={eg.rg2}
            onChange={(e) => setForm((prev) => patchEmpresa(prev, { rg2: e.target.checked }))}
          />
          RG 2
        </label>
        <label style={labelCheckStyle}>
          <input
            type="checkbox"
            checked={eg.sdl}
            onChange={(e) => setForm((prev) => patchEmpresa(prev, { sdl: e.target.checked }))}
          />
          SDL
        </label>
      </div>
    </div>
  )
}
