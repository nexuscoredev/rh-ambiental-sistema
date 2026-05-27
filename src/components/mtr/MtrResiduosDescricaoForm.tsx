import { useEffect, useRef, type CSSProperties } from 'react'
import type { ResiduoContratoItem } from '../../lib/clienteContratoCadastro'
import {
  expandirListaResiduosMtrParaContrato,
  listaResiduosFromDetalhesMtr,
  residuoContratoTemConteudo,
  residuoDetalhesLimpo,
  residuoDetalhesVazio,
  syncResiduoPrincipalComLista,
  type MtrResiduoDetalhesCampos,
} from '../../lib/mtrClienteContratoAutofill'
import { linhaVaziaResiduoPesagem } from '../../lib/residuosPesagem'
import { rgConfirm } from '../../lib/RgDialogProvider'

type DetalhesComLista = {
  residuo: MtrResiduoDetalhesCampos
  residuos_lista?: MtrResiduoDetalhesCampos[]
  blocos?: { descricoes_adicionais_residuos?: string }
  [key: string]: unknown
}

type Props = {
  detalhes: DetalhesComLista
  onChange: (next: DetalhesComLista) => void
  disabled?: boolean
  /** Resíduos cadastrados no cliente — define quantas linhas abrir na MTR. */
  residuosContratoCatalogo?: ResiduoContratoItem[]
  acondicionamentoPadrao?: string
}

const card: CSSProperties = {
  marginBottom: '12px',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  background: '#fafafa',
}

const label: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
  marginBottom: '4px',
}

const input: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  boxSizing: 'border-box',
}

const grid3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
}

const grid2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
}

function patchLista(
  lista: MtrResiduoDetalhesCampos[],
  index: number,
  partial: Partial<MtrResiduoDetalhesCampos>
): MtrResiduoDetalhesCampos[] {
  return lista.map((row, i) => (i === index ? { ...row, ...partial } : row))
}

const btnLimpar: CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid #d97706',
  background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
  color: '#92400e',
  fontWeight: 800,
  fontSize: '12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxShadow: '0 1px 3px rgba(217, 119, 6, 0.25)',
}

export function MtrResiduosDescricaoForm({
  detalhes,
  onChange,
  disabled = false,
  residuosContratoCatalogo = [],
  acondicionamentoPadrao = '',
}: Props) {
  const catalogoValidos = residuosContratoCatalogo.filter(residuoContratoTemConteudo)
  const lista = listaResiduosFromDetalhesMtr(detalhes)
  const faltamLinhasContrato = Math.max(0, catalogoValidos.length - lista.length)

  function abrirLinhasFaltantesDoContrato() {
    if (disabled || catalogoValidos.length === 0) return
    const expandida = expandirListaResiduosMtrParaContrato(
      lista,
      catalogoValidos,
      acondicionamentoPadrao,
      { preservarLinhasGravadas: true }
    )
    aplicarLista(expandida)
  }

  const autoExpandiuRef = useRef(false)
  useEffect(() => {
    autoExpandiuRef.current = false
  }, [catalogoValidos.length, detalhes.residuos_lista?.length])

  useEffect(() => {
    if (disabled || autoExpandiuRef.current || catalogoValidos.length === 0) return
    if (lista.length >= catalogoValidos.length) return
    autoExpandiuRef.current = true
    abrirLinhasFaltantesDoContrato()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expande uma vez ao carregar catálogo do cliente
  }, [disabled, catalogoValidos.length, lista.length])

  function aplicarLista(novaLista: MtrResiduoDetalhesCampos[]) {
    const sync = syncResiduoPrincipalComLista({ ...detalhes, residuos_lista: novaLista })
    onChange({ ...detalhes, ...sync })
  }

  function patchRow(index: number, partial: Partial<MtrResiduoDetalhesCampos>) {
    aplicarLista(patchLista(lista, index, partial))
  }

  function limparResiduoNoIndex(index: number) {
    if (disabled) return
    const novaLista = patchLista(lista, index, residuoDetalhesLimpo())
    const sync = syncResiduoPrincipalComLista({ ...detalhes, residuos_lista: novaLista })

    const itensRaw = detalhes.residuos_itens
    let itensPesagem: ReturnType<typeof linhaVaziaResiduoPesagem>[] | undefined
    if (Array.isArray(itensRaw) && itensRaw.length > 0) {
      const base = [...itensRaw]
      while (base.length < novaLista.length) base.push(linhaVaziaResiduoPesagem())
      itensPesagem = base.map((item, i) => (i === index ? linhaVaziaResiduoPesagem() : item))
    } else if (novaLista.length === 1 && index === 0) {
      itensPesagem = [linhaVaziaResiduoPesagem()]
    }

    onChange({
      ...detalhes,
      ...sync,
      ...(itensPesagem ? { residuos_itens: itensPesagem } : {}),
    })
  }

  async function limparDadosPreenchidos() {
    if (disabled) return
    const ok = await rgConfirm({
      title: 'Limpar resíduos da MTR',
      message: 'Limpar todos os campos dos resíduos nesta MTR?',
      details: [
        'Os dados trazidos do cadastro do cliente serão apagados; as linhas permanecem para preenchimento manual.',
      ],
      confirmLabel: 'Limpar campos',
      variant: 'warning',
    })
    if (!ok) return

    const vazios =
      lista.length > 0 ? lista.map(() => residuoDetalhesLimpo()) : [residuoDetalhesLimpo()]
    const sync = syncResiduoPrincipalComLista({ ...detalhes, residuos_lista: vazios })
    const itensPesagem =
      vazios.length > 1
        ? vazios.map(() => linhaVaziaResiduoPesagem())
        : [linhaVaziaResiduoPesagem()]

    onChange({
      ...detalhes,
      ...sync,
      residuos_itens: itensPesagem,
    })
  }

  return (
    <>
      <div className="field field-full">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ fontWeight: 800 }}>2. Descrição dos resíduos</div>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
              {catalogoValidos.length > 1
                ? `${catalogoValidos.length} resíduos no cadastro do cliente — cada linha gera um ticket na pesagem.`
                : catalogoValidos.length === 1
                  ? 'Um resíduo no cadastro do cliente.'
                  : lista.length > 1
                    ? `${lista.length} linhas de resíduo — cada uma pode gerar um ticket na pesagem.`
                    : 'Informe os resíduos ou vincule uma programação com cliente cadastrado.'}
            </p>
          </div>
          {lista.length > 0 ? (
            <button
              type="button"
              style={{
                ...btnLimpar,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
              }}
              disabled={disabled}
              title="Apagar todos os campos dos resíduos (inclui Industrial, SÓLIDO e dados do cadastro)"
              onClick={() => void limparDadosPreenchidos()}
            >
              Limpar todos os campos
            </button>
          ) : null}
        </div>
      </div>

      {lista.map((row, index) => (
        <div key={`mtr-residuo-desc-${index}`} style={card}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
              Resíduo {index + 1}
              {index === 0 ? (
                <span style={{ fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>
                  (principal no manifesto)
                </span>
              ) : null}
            </div>
            <button
              type="button"
              style={{
                ...btnLimpar,
                padding: '6px 12px',
                fontSize: '11px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
              }}
              disabled={disabled}
              title={`Zerar os campos do resíduo ${index + 1}`}
              onClick={() => limparResiduoNoIndex(index)}
            >
              Limpar
            </button>
          </div>
          <div style={grid2}>
            <div>
              <label style={label}>Fonte de origem</label>
              <input
                style={input}
                value={row.fonte_origem}
                disabled={disabled}
                onChange={(e) => patchRow(index, { fonte_origem: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Caracterização / tipo</label>
              <input
                style={input}
                value={row.caracterizacao}
                disabled={disabled}
                onChange={(e) => patchRow(index, { caracterizacao: e.target.value })}
              />
            </div>
          </div>
          <div style={{ ...grid3, marginTop: '10px' }}>
            <div>
              <label style={label}>Estado físico / classe</label>
              <input
                style={input}
                value={row.estado_fisico}
                disabled={disabled}
                onChange={(e) => patchRow(index, { estado_fisico: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Tipo de acondicionamento</label>
              <input
                style={input}
                value={row.acondicionamento}
                disabled={disabled}
                onChange={(e) => patchRow(index, { acondicionamento: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Qtde aproximada (kg)</label>
              <input
                style={input}
                value={row.quantidade_aproximada}
                disabled={disabled}
                onChange={(e) => patchRow(index, { quantidade_aproximada: e.target.value })}
              />
            </div>
          </div>
          <div style={{ marginTop: '10px', maxWidth: '200px' }}>
            <label style={label}>Nº ONU</label>
            <input
              style={input}
              value={row.onu}
              disabled={disabled}
              onChange={(e) => patchRow(index, { onu: e.target.value })}
            />
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        {faltamLinhasContrato > 0 ? (
          <button
            type="button"
            className="mini-btn"
            disabled={disabled}
            onClick={abrirLinhasFaltantesDoContrato}
          >
            Abrir {faltamLinhasContrato} resíduo(s) do cadastro do cliente
          </button>
        ) : null}
        {catalogoValidos.length === 0 && lista.length === 0 ? (
          <button
            type="button"
            className="mini-btn"
            disabled={disabled}
            onClick={() => aplicarLista([residuoDetalhesVazio()])}
          >
            Adicionar linha de resíduo
          </button>
        ) : null}
        {catalogoValidos.length === 0 && lista.length > 0 ? (
          <button
            type="button"
            className="mini-btn"
            disabled={disabled}
            onClick={() => aplicarLista([...lista, residuoDetalhesVazio()])}
          >
            Adicionar outra linha
          </button>
        ) : null}
      </div>
    </>
  )
}
