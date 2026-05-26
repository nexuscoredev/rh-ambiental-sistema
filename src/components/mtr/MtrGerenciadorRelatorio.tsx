import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { rgAlert, rgConfirm } from '../../lib/RgDialogProvider'
import { enviarMtrColetasParaFilaFaturamentoAjuste } from '../../lib/mtrGerenciadorFilaFaturamento'
import {
  carregarRelatorioMtrGerenciadorCompleto,
  formatarQuantidadeGerenciadorRelatorio,
  normalizarNumeroMtrRelatorio,
  salvarLinhaRelatorioMtrGerenciador,
  type MtrGerenciadorRelatorioLinha,
} from '../../lib/mtrGerenciadorRelatorio'
import { resolverVinculoMtrGerenciador } from '../../lib/mtrGerenciadorVinculoColeta'
import { MtrVincularColetaModal } from './MtrVincularColetaModal'

type FiltroRelatorio = 'todas' | 'fila_faturar' | 'pendente' | 'emitido'

type DraftLinha = {
  gerador: string
  residuo: string
  quantidade: string
  clienteMtr: string
  baixaJustificativa: string
  pesoLiquido: string
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  color: '#0f172a',
  fontWeight: 800,
  fontSize: '11px',
  borderBottom: '2px solid #e2e8f0',
  whiteSpace: 'nowrap',
  verticalAlign: 'bottom',
}

const tdStyle: CSSProperties = {
  padding: '8px',
  verticalAlign: 'top',
  borderBottom: '1px solid #e2e8f0',
  fontSize: '12px',
  lineHeight: 1.4,
  maxWidth: '200px',
}

const inputCell: CSSProperties = {
  width: '100%',
  minWidth: '72px',
  maxWidth: '180px',
  padding: '5px 7px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '12px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
}

const btnLink: CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 8px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#1d4ed8',
  textDecoration: 'none',
  marginRight: '4px',
  marginBottom: '4px',
}

const btnAcao: CSSProperties = {
  ...btnLink,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnAcaoPrimario: CSSProperties = {
  ...btnAcao,
  borderColor: '#0d9488',
  background: '#f0fdfa',
  color: '#0f766e',
  fontWeight: 800,
}

const btnAcaoDisabled: CSSProperties = {
  ...btnAcao,
  opacity: 0.55,
  cursor: 'not-allowed',
  color: '#64748b',
  background: '#f8fafc',
}

const btnSalvar: CSSProperties = {
  ...btnAcao,
  borderColor: '#6366f1',
  background: '#eef2ff',
  color: '#4338ca',
  fontSize: '10px',
  padding: '3px 6px',
  marginTop: '4px',
}

function badgeFila(naFila: boolean): CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    background: naFila ? '#dcfce7' : '#f1f5f9',
    color: naFila ? '#166534' : '#64748b',
  }
}

function textoCampo(v: string): string {
  return v === '—' ? '' : v
}

function linhaParaDraft(l: MtrGerenciadorRelatorioLinha): DraftLinha {
  const qtdFmt =
    formatarQuantidadeGerenciadorRelatorio(l.quantidadeNum, l.unidade) ||
    textoCampo(l.quantidade)
  return {
    gerador: textoCampo(l.gerador),
    residuo: textoCampo(l.residuo),
    quantidade: qtdFmt,
    clienteMtr: textoCampo(l.clienteMtr),
    baixaJustificativa: textoCampo(l.baixaJustificativa),
    pesoLiquido:
      l.pesoLiquidoNum != null
        ? String(l.pesoLiquidoNum)
        : textoCampo(l.pesoLiquidoKg).replace(/\s*kg\s*$/i, ''),
  }
}

function draftIgualLinha(draft: DraftLinha, l: MtrGerenciadorRelatorioLinha): boolean {
  return JSON.stringify(draft) === JSON.stringify(linhaParaDraft(l))
}

function filtrarLinhas(
  linhas: MtrGerenciadorRelatorioLinha[],
  filtro: FiltroRelatorio,
  busca: string
): MtrGerenciadorRelatorioLinha[] {
  const q = busca.trim().toLowerCase()
  return linhas.filter((l) => {
    if (filtro === 'fila_faturar' && !l.naFilaFaturar) return false
    if (filtro === 'pendente' && l.naFilaFaturar) return false
    if (filtro === 'emitido' && l.registroFaturamento !== 'Emitido') return false
    if (!q) return true
    const blob = [
      l.mtrNumero,
      l.clienteNome,
      l.clienteMtr,
      l.gerador,
      l.residuo,
      l.numeroColeta,
      l.pendencias,
      l.gerenciadorNome ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
}

function LinhaRelatorio({
  linha,
  enviandoMtrId,
  salvandoChave,
  onDraftChange,
  draft,
  onSalvar,
  onEnviarFila,
  onVincular,
  onVincularEEnviar,
  destacar,
}: {
  linha: MtrGerenciadorRelatorioLinha
  enviandoMtrId: string | null
  salvandoChave: string | null
  draft: DraftLinha
  onDraftChange: Dispatch<SetStateAction<DraftLinha>>
  onSalvar: (linha: MtrGerenciadorRelatorioLinha, draft: DraftLinha) => Promise<void>
  onEnviarFila: (linha: MtrGerenciadorRelatorioLinha) => void
  onVincular: () => void
  onVincularEEnviar: () => void
  destacar?: boolean
}) {
  const dirty = !draftIgualLinha(draft, linha)
  const salvando = salvandoChave === linha.chave
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const agendarSalvarBlur = useCallback(() => {
    if (!dirty || salvando) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void onSalvar(linha, draft)
    }, 600)
  }, [dirty, salvando, onSalvar, linha, draft])

  const podeClicarEnviar =
    !enviandoMtrId &&
    (linha.coletaId ? linha.podeEnviarParaFilaFaturamento : true)

  const estiloEnviar =
    podeClicarEnviar && enviandoMtrId !== linha.mtrId ? btnAcaoPrimario : btnAcaoDisabled

  return (
    <tr
      data-mtr-relatorio-id={linha.mtrId || linha.chave}
      style={
        destacar
          ? { background: '#eff6ff', boxShadow: 'inset 0 0 0 2px #6366f1' }
          : linha.naFilaFaturar
            ? { background: '#f0fdf4' }
            : undefined
      }
    >
      <td style={tdStyle}>
        <strong>{linha.mtrNumero}</strong>
        {linha.origem === 'cadastro_manual' ? (
          <div style={{ fontSize: '10px', color: '#4338ca', marginTop: '2px', fontWeight: 700 }}>
            Cadastro gerenciador
            {linha.gerenciadorNome ? ` · ${linha.gerenciadorNome}` : ''}
          </div>
        ) : null}
        {linha.cenarioComplexo ? (
          <div style={{ fontSize: '10px', color: '#b45309', marginTop: '2px' }}>Rateio</div>
        ) : null}
        {dirty ? (
          <div style={{ fontSize: '10px', color: '#6366f1', marginTop: '2px' }}>Alterações não salvas</div>
        ) : null}
      </td>
      <td style={tdStyle}>{linha.baixadaEm}</td>
      <td style={tdStyle}>
        <input
          type="text"
          value={draft.gerador}
          onChange={(e) => onDraftChange((d) => ({ ...d, gerador: e.target.value }))}
          onBlur={agendarSalvarBlur}
          style={inputCell}
          aria-label="Gerador"
        />
      </td>
      <td style={tdStyle}>
        <input
          type="text"
          value={draft.residuo}
          onChange={(e) => onDraftChange((d) => ({ ...d, residuo: e.target.value }))}
          onBlur={agendarSalvarBlur}
          style={inputCell}
          aria-label="Resíduo"
        />
      </td>
      <td style={tdStyle}>
        <input
          type="text"
          value={draft.quantidade}
          onChange={(e) => onDraftChange((d) => ({ ...d, quantidade: e.target.value }))}
          onBlur={agendarSalvarBlur}
          style={{ ...inputCell, maxWidth: '100px' }}
          placeholder="ex.: 1000 kg"
          aria-label="Quantidade"
        />
      </td>
      <td style={tdStyle}>
        <input
          type="text"
          value={draft.clienteMtr}
          onChange={(e) => onDraftChange((d) => ({ ...d, clienteMtr: e.target.value }))}
          onBlur={agendarSalvarBlur}
          style={inputCell}
          aria-label="Cliente na MTR"
        />
      </td>
      <td style={tdStyle}>{linha.numeroColeta}</td>
      <td style={tdStyle}>{linha.clienteNome}</td>
      <td style={tdStyle}>
        {linha.coletaId || linha.origem === 'cadastro_manual' ? (
          <input
            type="text"
            value={draft.pesoLiquido}
            onChange={(e) => onDraftChange((d) => ({ ...d, pesoLiquido: e.target.value }))}
            onBlur={agendarSalvarBlur}
            style={{ ...inputCell, maxWidth: '90px' }}
            placeholder="kg"
            aria-label={
              linha.origem === 'cadastro_manual'
                ? 'Peso (kg) no cadastro Gerenciador'
                : 'Peso líquido da coleta'
            }
          />
        ) : (
          '—'
        )}
      </td>
      <td style={tdStyle}>{linha.statusConferencia}</td>
      <td style={tdStyle}>{linha.passoEsteira}</td>
      <td style={tdStyle}>
        <span style={badgeFila(linha.naFilaFaturar)}>{linha.naFilaFaturar ? 'Sim' : 'Não'}</span>
      </td>
      <td style={tdStyle}>{linha.registroFaturamento}</td>
      <td style={{ ...tdStyle, minWidth: '160px', maxWidth: '280px' }}>
        <div style={{ marginBottom: '4px' }}>{linha.pendencias}</div>
        {linha.origem === 'cadastro_manual' ? (
          <span style={{ fontSize: '11px', color: '#64748b' }}>—</span>
        ) : (
          <input
            type="text"
            value={draft.baixaJustificativa}
            onChange={(e) =>
              onDraftChange((d) => ({ ...d, baixaJustificativa: e.target.value }))
            }
            onBlur={agendarSalvarBlur}
            style={{ ...inputCell, maxWidth: '100%' }}
            placeholder="Justificativa da baixa"
            aria-label="Justificativa da baixa"
          />
        )}
        {linha.bloqueios.map((b, i) => (
          <div key={i} style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>
            • {b}
          </div>
        ))}
      </td>
      <td style={{ ...tdStyle, minWidth: '168px', maxWidth: 'none' }}>
        <button
          type="button"
          style={{
            ...estiloEnviar,
            display: 'block',
            width: '100%',
            maxWidth: '240px',
            textAlign: 'center',
            marginBottom: '6px',
            padding: '7px 10px',
          }}
          disabled={!podeClicarEnviar || enviandoMtrId === linha.mtrId}
          title={
            linha.coletaId
              ? linha.tooltipEnviarFilaFaturamento
              : 'Vincule ou resolva a coleta e envie à esteira (passo 2)'
          }
          onClick={() => onEnviarFila(linha)}
        >
          {enviandoMtrId === linha.mtrId
            ? 'A enviar…'
            : 'Enviar para fila do faturamento'}
        </button>
        {linha.bloqueioEnviarFila && linha.coletaId ? (
          <div
            style={{
              fontSize: '11px',
              color: '#b45309',
              marginBottom: '6px',
              lineHeight: 1.35,
              maxWidth: '240px',
            }}
            role="status"
          >
            {linha.bloqueioEnviarFila}
          </div>
        ) : null}

        <button
          type="button"
          style={dirty && !salvando ? btnSalvar : { ...btnSalvar, opacity: 0.5 }}
          disabled={!dirty || salvando}
          onClick={() => void onSalvar(linha, draft)}
        >
          {salvando ? 'A guardar…' : 'Salvar linha'}
        </button>

        {!linha.coletaId && linha.mtrId ? (
          <>
            <button
              type="button"
              style={{
                ...btnAcao,
                marginTop: '6px',
                display: 'block',
              }}
              disabled={enviandoMtrId === linha.mtrId}
              title="Escolher coleta ou vincular pela programação"
              onClick={onVincular}
            >
              Vincular coleta
            </button>
            <button
              type="button"
              style={{
                ...btnAcao,
                marginTop: '4px',
                display: 'block',
                borderColor: '#0d9488',
                background: '#f0fdfa',
                color: '#0f766e',
              }}
              disabled={enviandoMtrId === linha.mtrId}
              title="Vincular (automático se houver programação) e enviar à esteira"
              onClick={onVincularEEnviar}
            >
              Vincular e enviar fila
            </button>
          </>
        ) : null}

        {!linha.coletaId && linha.urlMtr ? (
          <Link
            to={linha.urlMtr}
            style={{ ...btnLink, marginTop: '4px', fontSize: '10px' }}
          >
            Abrir na página MTR
          </Link>
        ) : null}
        {linha.urlFaturamento ? (
          <Link to={linha.urlFaturamento} style={btnLink}>
            Faturamento
          </Link>
        ) : null}
        {linha.urlMalaDiretaMedicao ? (
          <Link to={linha.urlMalaDiretaMedicao} style={btnLink}>
            Mala direta (medição)
          </Link>
        ) : null}
        {linha.urlMalaDiretaNf ? (
          <Link to={linha.urlMalaDiretaNf} style={btnLink}>
            Mala direta (NF)
          </Link>
        ) : null}
        {linha.urlControleMassa ? (
          <Link to={linha.urlControleMassa} style={btnLink}>
            Pesagem
          </Link>
        ) : null}
        {linha.urlMtr ? (
          <Link to={linha.urlMtr} style={btnLink}>
            MTR
          </Link>
        ) : null}
      </td>
    </tr>
  )
}

export function MtrGerenciadorRelatorio({
  onRecarregar,
  focusMtrId,
  focusMtrNumeros = [],
}: {
  onRecarregar?: () => void
  /** Destaca e faz scroll até a primeira linha desta MTR no relatório. */
  focusMtrId?: string | null
  /** Números de MTR (ex.: vindos do cadastro Gerenciador) para destacar linhas manuais. */
  focusMtrNumeros?: string[]
}) {
  const navigate = useNavigate()
  const [linhas, setLinhas] = useState<MtrGerenciadorRelatorioLinha[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroRelatorio>('todas')
  const [busca, setBusca] = useState('')
  const [enviandoMtrId, setEnviandoMtrId] = useState<string | null>(null)
  const [salvandoChave, setSalvandoChave] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftLinha>>({})
  const [modalVinculo, setModalVinculo] = useState<{
    mtrId: string
    mtrNumero: string
    depoisEnviarFila: boolean
  } | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await carregarRelatorioMtrGerenciadorCompleto()
    setLinhas(res.linhas)
    setDrafts((prev) => {
      const next: Record<string, DraftLinha> = {}
      for (const l of res.linhas) {
        const existente = prev[l.chave]
        next[l.chave] =
          existente && !draftIgualLinha(existente, l) ? existente : linhaParaDraft(l)
      }
      return next
    })
    setErro(res.erro)
    setLoading(false)
    onRecarregar?.()
  }, [onRecarregar])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const focusScrollFeito = useRef(false)
  const numerosFocus = useMemo(
    () =>
      focusMtrNumeros
        .map((n) => normalizarNumeroMtrRelatorio(n))
        .filter(Boolean),
    [focusMtrNumeros]
  )

  useEffect(() => {
    if (loading || focusScrollFeito.current) return
    if (!focusMtrId && numerosFocus.length === 0) return

    const alvo = linhas.find((l) => {
      if (focusMtrId && l.mtrId === focusMtrId) return true
      if (numerosFocus.length === 0) return false
      const norm = normalizarNumeroMtrRelatorio(l.mtrNumero)
      return norm && numerosFocus.includes(norm)
    })
    if (!alvo) return

    focusScrollFeito.current = true
    if (filtro !== 'todas') setFiltro('todas')
    const scrollId = alvo.mtrId || alvo.chave
    const t = window.setTimeout(() => {
      document
        .querySelector(`[data-mtr-relatorio-id="${scrollId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [focusMtrId, numerosFocus, linhas, loading, filtro])

  const visiveis = useMemo(() => filtrarLinhas(linhas, filtro, busca), [linhas, filtro, busca])

  const contadores = useMemo(
    () => ({
      todas: linhas.length,
      fila: linhas.filter((l) => l.naFilaFaturar).length,
      emitido: linhas.filter((l) => l.registroFaturamento === 'Emitido').length,
    }),
    [linhas]
  )

  const handleSalvarLinha = useCallback(
    async (linha: MtrGerenciadorRelatorioLinha, draft: DraftLinha) => {
      if (salvandoChave) return
      if (draftIgualLinha(draft, linha)) return

      setSalvandoChave(linha.chave)
      const res = await salvarLinhaRelatorioMtrGerenciador({
        origem: linha.origem,
        linhaCadastroId: linha.linhaCadastroId,
        mtrNumero: linha.mtrNumero,
        mtrId: linha.mtrId,
        coletaId: linha.coletaId,
        gerador: draft.gerador,
        tipoResiduo: draft.residuo,
        quantidadeTexto: draft.quantidade,
        clienteMtr: draft.clienteMtr,
        baixaJustificativa: draft.baixaJustificativa,
        pesoLiquidoTexto: draft.pesoLiquido,
      })
      setSalvandoChave(null)

      if (!res.ok) {
        await rgAlert({
          title: 'Salvar linha',
          message: res.message,
          variant: 'warning',
        })
        return
      }

      await carregar()
    },
    [carregar, salvandoChave]
  )

  const executarEnviarFila = useCallback(
    async (mtrId: string, mtrNumero: string, opts?: { skipConfirm?: boolean }) => {
      if (enviandoMtrId) return

      if (!opts?.skipConfirm) {
        const ok = await rgConfirm({
          title: 'Enviar para fila do faturamento',
          message:
            `Encaminhar a MTR ${mtrNumero} para o passo 2 da esteira (Ajuste de valores)?\n\n` +
            'Todas as coletas elegíveis vinculadas a esta MTR serão atualizadas. ' +
            'Tickets ainda não aprovados serão marcados como aprovados automaticamente.',
          confirmLabel: 'Enviar',
          cancelLabel: 'Cancelar',
          variant: 'default',
        })
        if (!ok) return
      }

      setEnviandoMtrId(mtrId)
      const res = await enviarMtrColetasParaFilaFaturamentoAjuste(mtrId)
      setEnviandoMtrId(null)

      if (!res.ok) {
        await rgAlert({
          title: 'Fila do faturamento',
          message: res.message,
          variant: 'warning',
        })
        return
      }

      await rgAlert({
        title: 'Fila do faturamento',
        message:
          res.coletaIds.length === 1
            ? '1 coleta enviada para Ajuste de valores (passo 2). Continue em Faturamento operacional.'
            : `${res.coletaIds.length} coletas enviadas para Ajuste de valores (passo 2). Continue em Faturamento operacional.`,
        variant: 'success',
      })

      await carregar()

      if (res.urlFaturamento) {
        const abrir = await rgConfirm({
          title: 'Abrir faturamento',
          message: 'Deseja abrir a tela de Faturamento para esta coleta agora?',
          confirmLabel: 'Abrir',
          cancelLabel: 'Ficar aqui',
        })
        if (abrir) navigate(res.urlFaturamento)
      }
    },
    [carregar, enviandoMtrId, navigate]
  )

  const tentarResolverColetaAntesFila = useCallback(
    async (linha: MtrGerenciadorRelatorioLinha): Promise<boolean> => {
      if (linha.coletaId) return true

      const resolv = await resolverVinculoMtrGerenciador(linha.mtrId)
      if (resolv.coletaIds.length > 0) {
        await carregar()
        return true
      }

      const abrirModal = await rgConfirm({
        title: 'Sem coleta vinculada',
        message:
          (resolv.message ?? 'Não há coleta ligada a esta MTR.') +
          '\n\nDeseja escolher ou vincular uma coleta agora?',
        confirmLabel: 'Vincular coleta',
        cancelLabel: 'Cancelar',
        variant: 'default',
      })
      if (!abrirModal) return false

      setModalVinculo({
        mtrId: linha.mtrId,
        mtrNumero: linha.mtrNumero,
        depoisEnviarFila: true,
      })
      return false
    },
    [carregar]
  )

  const handleEnviarFilaFaturamento = useCallback(
    async (linha: MtrGerenciadorRelatorioLinha) => {
      if (enviandoMtrId) return

      let linhaAtual = linha
      const draft = drafts[linha.chave] ?? linhaParaDraft(linha)
      if (!draftIgualLinha(draft, linha)) {
        setSalvandoChave(linha.chave)
        const res = await salvarLinhaRelatorioMtrGerenciador({
          origem: linha.origem,
          linhaCadastroId: linha.linhaCadastroId,
          mtrId: linha.mtrId,
          coletaId: linha.coletaId,
          gerador: draft.gerador,
          tipoResiduo: draft.residuo,
          quantidadeTexto: draft.quantidade,
          clienteMtr: draft.clienteMtr,
          baixaJustificativa: draft.baixaJustificativa,
          pesoLiquidoTexto: draft.pesoLiquido,
        })
        setSalvandoChave(null)
        if (!res.ok) {
          await rgAlert({
            title: 'Salvar linha',
            message: res.message,
            variant: 'warning',
          })
          return
        }
        const recarregado = await carregarRelatorioMtrGerenciadorCompleto()
        linhaAtual = recarregado.linhas.find((x) => x.chave === linha.chave) ?? linha
        setLinhas(recarregado.linhas)
        setDrafts((prev) => {
          const next: Record<string, DraftLinha> = {}
          for (const l of recarregado.linhas) {
            next[l.chave] = l.chave === linha.chave ? linhaParaDraft(l) : prev[l.chave] ?? linhaParaDraft(l)
          }
          return next
        })
      }

      if (linhaAtual.coletaId && !linhaAtual.podeEnviarParaFilaFaturamento) return

      if (!linhaAtual.coletaId) {
        const ok = await tentarResolverColetaAntesFila(linhaAtual)
        if (!ok) return
      }

      await executarEnviarFila(linhaAtual.mtrId, linhaAtual.mtrNumero)
    },
    [drafts, enviandoMtrId, executarEnviarFila, tentarResolverColetaAntesFila]
  )

  const handleVincularEEnviarFila = useCallback(
    async (linha: MtrGerenciadorRelatorioLinha) => {
      if (enviandoMtrId) return
      if (!linha.coletaId) {
        const resolv = await resolverVinculoMtrGerenciador(linha.mtrId)
        if (!resolv.coletaIds.length) {
          setModalVinculo({
            mtrId: linha.mtrId,
            mtrNumero: linha.mtrNumero,
            depoisEnviarFila: true,
          })
          return
        }
        await carregar()
      }
      await executarEnviarFila(linha.mtrId, linha.mtrNumero)
    },
    [carregar, enviandoMtrId, executarEnviarFila]
  )

  const setDraftLinha = useCallback((chave: string, updater: SetStateAction<DraftLinha>) => {
    setDrafts((prev) => {
      const atual = prev[chave] ?? { gerador: '', residuo: '', quantidade: '', clienteMtr: '', baixaJustificativa: '', pesoLiquido: '' }
      const next = typeof updater === 'function' ? updater(atual) : updater
      return { ...prev, [chave]: next }
    })
  }, [])

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.45, flex: '1 1 280px' }}>
          MTRs <strong>Baixada</strong> no sistema e linhas salvas no{' '}
          <strong>Cadastro Gerenciador</strong> (rótulo «Cadastro gerenciador»). Edite na tabela;
          com coleta vinculada, ajuste o peso da coleta; nas linhas só do cadastro, o peso grava no
          Gerenciador. Salve e envie à fila do faturamento (passo 2) quando elegível.
        </p>
        <button
          type="button"
          className="rg-btn rg-btn--outline"
          disabled={loading}
          onClick={() => void carregar()}
        >
          {loading ? 'A atualizar…' : 'Atualizar lista'}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px',
          alignItems: 'center',
        }}
      >
        {(
          [
            ['todas', `Todas (${contadores.todas})`],
            ['fila_faturar', `Na fila faturar (${contadores.fila})`],
            ['pendente', 'Pendentes'],
            ['emitido', `Emitidas (${contadores.emitido})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filtro === id ? 'rg-btn rg-btn--primary' : 'rg-btn rg-btn--outline'}
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => setFiltro(id)}
          >
            {label}
          </button>
        ))}
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar MTR, cliente, resíduo…"
          style={{
            marginLeft: 'auto',
            minWidth: '200px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
          }}
        />
      </div>

      {erro ? <div className="alert-box alert-warning">{erro}</div> : null}

      {loading ? (
        <p style={{ fontSize: '13px', color: '#64748b' }}>Carregando relatório…</p>
      ) : visiveis.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Nenhuma linha para o filtro atual. Confirme baixas na MTR, salve linhas no Cadastro
          Gerenciador ou vincule coletas.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>MTR</th>
                <th style={thStyle}>Baixada em</th>
                <th style={thStyle}>Gerador</th>
                <th style={thStyle}>Resíduo</th>
                <th style={thStyle}>Qtd.</th>
                <th style={thStyle}>Cliente (MTR)</th>
                <th style={thStyle}>Coleta</th>
                <th style={thStyle}>Cliente coleta</th>
                <th style={thStyle}>Peso (coleta)</th>
                <th style={thStyle}>Conferência</th>
                <th style={thStyle}>Passo esteira</th>
                <th style={thStyle}>Fila faturar</th>
                <th style={thStyle}>Registo</th>
                <th style={thStyle}>Pendências / justificativa</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <LinhaRelatorio
                  key={l.chave}
                  linha={l}
                  destacar={
                    (!!focusMtrId && l.mtrId === focusMtrId) ||
                    numerosFocus.includes(normalizarNumeroMtrRelatorio(l.mtrNumero))
                  }
                  draft={drafts[l.chave] ?? linhaParaDraft(l)}
                  onDraftChange={(up) => setDraftLinha(l.chave, up)}
                  enviandoMtrId={enviandoMtrId}
                  salvandoChave={salvandoChave}
                  onSalvar={handleSalvarLinha}
                  onEnviarFila={(linha) => void handleEnviarFilaFaturamento(linha)}
                  onVincular={() =>
                    setModalVinculo({
                      mtrId: l.mtrId,
                      mtrNumero: l.mtrNumero,
                      depoisEnviarFila: false,
                    })
                  }
                  onVincularEEnviar={() => void handleVincularEEnviarFila(l)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalVinculo ? (
        <MtrVincularColetaModal
          open
          mtrId={modalVinculo.mtrId}
          mtrNumero={modalVinculo.mtrNumero}
          onClose={() => setModalVinculo(null)}
          onVinculado={async () => {
            const { mtrId, mtrNumero, depoisEnviarFila } = modalVinculo
            await carregar()
            setModalVinculo(null)
            if (depoisEnviarFila) {
              await executarEnviarFila(mtrId, mtrNumero)
            }
          }}
        />
      ) : null}
    </div>
  )
}
