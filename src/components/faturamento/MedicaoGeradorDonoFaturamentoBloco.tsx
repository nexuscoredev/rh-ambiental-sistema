import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import {
  isMissingGeradorDonoFaturamentoColumnsError,
  normalizarGeradorDonoFaturamentoOpcao,
  type ClienteGeradorDonoFaturamentoCampos,
} from '../../lib/clienteGeradorDonoFaturamento'

type Props = {
  clienteId: string
}

/** Mesmo padrão da linha meta do card em `FaturamentoFilaMedicao`. */
const metaLinha: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
  lineHeight: 1.5,
  color: '#64748b',
}

const metaSep: CSSProperties = { color: '#94a3b8' }

const metaTitulo: CSSProperties = {
  fontSize: '13px',
  fontWeight: 800,
  color: '#334155',
}

const metaValor: CSSProperties = {
  fontWeight: 600,
  color: '#475569',
}

function MetaSeparador() {
  return <span style={metaSep}> · </span>
}

function OpcaoMeta({ ativo, rotulo }: { ativo: boolean; rotulo: string }) {
  return (
    <span
      style={{
        fontWeight: ativo ? 700 : 500,
        color: ativo ? '#0f172a' : '#94a3b8',
      }}
    >
      {rotulo}
    </span>
  )
}

export function MedicaoGeradorDonoFaturamentoBloco({ clienteId }: Props) {
  const [dados, setDados] = useState<ClienteGeradorDonoFaturamentoCampos | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    const id = clienteId.trim()
    if (!id) {
      setDados(null)
      return
    }
    let cancel = false
    void supabase
      .from('clientes')
      .select(
        'gerador_dono_faturamento, faturamento_titular_razao_social, faturamento_titular_cnpj'
      )
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancel) return
        if (error) {
          if (isMissingGeradorDonoFaturamentoColumnsError(error)) {
            setIndisponivel(true)
            setDados(null)
            return
          }
          setDados(null)
          return
        }
        setIndisponivel(false)
        setDados((data as ClienteGeradorDonoFaturamentoCampos) ?? null)
      })
    return () => {
      cancel = true
    }
  }, [clienteId])

  const opcao = normalizarGeradorDonoFaturamentoOpcao(dados?.gerador_dono_faturamento)
  const razao = (dados?.faturamento_titular_razao_social ?? '').trim() || '—'
  const cnpj = (dados?.faturamento_titular_cnpj ?? '').trim() || '—'

  if (indisponivel) {
    return (
      <p style={{ ...metaLinha, color: '#b45309' }}>
        Gerador é dono do Faturamento? — cadastro indisponível (migração 20260528120000).
      </p>
    )
  }

  return (
    <p style={metaLinha} role="group" aria-label="Gerador e faturamento">
      <span style={metaTitulo}>Gerador é dono do Faturamento?</span>
      <MetaSeparador />
      <span aria-label="Resposta no cadastro">
        <OpcaoMeta ativo={opcao === 'sim'} rotulo="Sim" />
        <span style={metaSep}> / </span>
        <OpcaoMeta ativo={opcao === 'nao'} rotulo="Não" />
      </span>
      {!opcao ? (
        <>
          <MetaSeparador />
          <span style={{ fontWeight: 600, color: '#b45309' }}>não definido no cadastro</span>
        </>
      ) : null}
      {opcao === 'nao' ? (
        <>
          <MetaSeparador />
          <span>
            <span style={metaTitulo}>Razão Social do dono do faturamento: </span>
            <span style={metaValor}>{razao}</span>
          </span>
          <MetaSeparador />
          <span>
            <span style={metaTitulo}>CNPJ do dono do faturamento: </span>
            <span style={metaValor}>{cnpj}</span>
          </span>
        </>
      ) : null}
    </p>
  )
}
