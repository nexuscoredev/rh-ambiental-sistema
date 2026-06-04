import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { RgReportPdfIcon } from '../components/ui/RgReportPdfIcon'
import MainLayout from '../layouts/MainLayout'
import { formatarCNPJDigitacao, formatarCPFDigitacao } from '../lib/brasilCadastro'
import {
  excluirOrdemServicoClinica,
  excluirUnidadeClinica,
  gerarOrdensServicoClinicasLote,
  listarOrdensServicoClinicas,
  listarRelatorioClinicas30d,
  listarUnidadesClinicas,
  obterGrupoClinicaPadrao,
  rotuloMeioCobranca,
  rotuloStatusOsClinica,
  salvarUnidadeClinica,
} from '../lib/clinicasApi'
import { consolidarRelatorioClinicas30d } from '../lib/clinicasRelatorio'
import type {
  ClinicaOrdemServicoDetalhe,
  ClinicaRelatorio30dRow,
  ClinicaUnidade,
  ClinicaUnidadeForm,
} from '../lib/clinicasTypes'
import { formatarMoedaClinica } from '../lib/clinicasFaturamento'
import { CLINICAS_GERAR_OS_HASH } from '../lib/clinicasRotas'
import { useRgDialog } from '../lib/RgDialogProvider'
import { useDebouncedValue } from '../lib/useDebouncedValue'

const formInicial: ClinicaUnidadeForm = {
  razao_social: '',
  cnpj: '',
  cpf: '',
  endereco_coleta: '',
  emite_nota: false,
  pagamento_pix: true,
  ativo: true,
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px 22px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
  marginBottom: '18px',
}

export default function Clinicas() {
  const { confirm, alert } = useRgDialog()
  const [grupoNome, setGrupoNome] = useState('CLINICA')
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [unidades, setUnidades] = useState<ClinicaUnidade[]>([])
  const [relatorio, setRelatorio] = useState<ClinicaRelatorio30dRow[]>([])
  const [ordens, setOrdens] = useState<ClinicaOrdemServicoDetalhe[]>([])
  const [filtroOs, setFiltroOs] = useState<'todas' | 'aguardando_faturamento' | 'emitida'>('todas')
  const [excluindoOsId, setExcluindoOsId] = useState<string | null>(null)
  const [excluindoUnidadeId, setExcluindoUnidadeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const buscaDeb = useDebouncedValue(busca, 300)
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set())
  const [dataServico, setDataServico] = useState(() => new Date().toISOString().slice(0, 10))
  const [gerandoOs, setGerandoOs] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ClinicaUnidadeForm>(formInicial)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const g = await obterGrupoClinicaPadrao()
      if (!g.ok) {
        setErro(g.message)
        return
      }
      setGrupoId(g.grupo.id)
      setGrupoNome(g.grupo.nome)

      const [u, rel, os] = await Promise.all([
        listarUnidadesClinicas(false),
        listarRelatorioClinicas30d(),
        listarOrdensServicoClinicas(),
      ])

      if (!u.ok) {
        setErro(u.message)
        return
      }
      setUnidades(u.unidades)

      if (rel.ok) {
        setRelatorio(consolidarRelatorioClinicas30d(rel.linhas))
      }
      if (os.ok) {
        setOrdens(os.ordens)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    if (loading || window.location.hash !== `#${CLINICAS_GERAR_OS_HASH}`) return
    const el = document.getElementById(CLINICAS_GERAR_OS_HASH)
    if (!el) return
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [loading])

  const filtradas = useMemo(() => {
    const t = buscaDeb.trim().toLowerCase()
    if (!t) return unidades
    return unidades.filter((u) => {
      const blob = [u.razao_social, u.cnpj, u.cpf, u.endereco_coleta].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(t)
    })
  }, [unidades, buscaDeb])

  const ordensFiltradas = useMemo(() => {
    if (filtroOs === 'todas') return ordens
    return ordens.filter((o) => o.status === filtroOs)
  }, [ordens, filtroOs])

  const rotuloFiltroOs =
    filtroOs === 'todas'
      ? 'Todas'
      : filtroOs === 'emitida'
        ? 'Emitidas'
        : 'Aguardando faturamento'

  const todosFiltradosSelecionados =
    filtradas.length > 0 && filtradas.every((u) => selecionados.has(u.id))

  async function exportarRelatorioPdf() {
    if (loading || gerandoPdf) return
    setGerandoPdf(true)
    try {
      const { gerarRelatorioClinicasGestaoPdf } = await import('../lib/gerarRelatorioClinicasPdf')
      gerarRelatorioClinicasGestaoPdf({
        grupoNome,
        unidades,
        ordens: ordensFiltradas,
        relatorio30d: relatorio,
        filtroOsRotulo: rotuloFiltroOs,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Nao foi possivel gerar o PDF.'
      await alert({ title: 'Relatorio PDF', message: msg, variant: 'danger' })
    } finally {
      setGerandoPdf(false)
    }
  }

  function toggleTodos() {
    if (todosFiltradosSelecionados) {
      setSelecionados((prev) => {
        const next = new Set(prev)
        for (const u of filtradas) next.delete(u.id)
        return next
      })
    } else {
      setSelecionados((prev) => {
        const next = new Set(prev)
        for (const u of filtradas) {
          if (u.ativo) next.add(u.id)
        }
        return next
      })
    }
  }

  function toggleUm(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function abrirNova() {
    setEditId(null)
    setForm(formInicial)
    setMostrarForm(true)
  }

  function abrirEditar(u: ClinicaUnidade) {
    setEditId(u.id)
    setForm({
      razao_social: u.razao_social,
      cnpj: u.cnpj ? formatarCNPJDigitacao(u.cnpj) : '',
      cpf: u.cpf ? formatarCPFDigitacao(u.cpf) : '',
      endereco_coleta: u.endereco_coleta ?? '',
      emite_nota: u.emite_nota,
      pagamento_pix: u.pagamento_pix,
      ativo: u.ativo,
    })
    setMostrarForm(true)
  }

  async function salvarForm(e: FormEvent) {
    e.preventDefault()
    if (!grupoId) return
    setSalvando(true)
    const res = await salvarUnidadeClinica(grupoId, form, editId)
    setSalvando(false)
    if (!res.ok) {
      await alert({ title: 'Cadastro', message: res.message, variant: 'danger' })
      return
    }
    setMostrarForm(false)
    await recarregar()
  }

  async function gerarOsLote() {
    const ids = [...selecionados].filter((id) => unidades.find((u) => u.id === id && u.ativo))
    if (ids.length === 0) {
      await alert({ title: 'O.S.', message: 'Marque pelo menos uma clínica ativa.', variant: 'warning' })
      return
    }
    const ok = await confirm({
      title: 'Gerar ordens de serviço',
      message: `Gerar ${ids.length} O.S. para ${dataServico}? Elas irão direto para a fila de faturamento (clínicas), sem pesagem nem ticket.`,
      confirmLabel: 'Gerar',
      variant: 'warning',
    })
    if (!ok) return

    setGerandoOs(true)
    const res = await gerarOrdensServicoClinicasLote(ids, dataServico)
    setGerandoOs(false)

    if (!res.ok) {
      await alert({ title: 'O.S.', message: res.message, variant: 'danger' })
      return
    }

    const nums = res.geradas.map((g) => g.numero_os).join(', ')
    setSelecionados(new Set())
    await alert({
      title: 'O.S. geradas',
      message: `${res.geradas.length} ordem(ns) criada(s): ${nums}\n\nAcesse Faturamento → Faturar clínicas para definir valores e emitir.`,
      variant: 'success',
    })
    await recarregar()
  }

  async function excluirUnidade(u: ClinicaUnidade) {
    const ok = await confirm({
      title: 'Excluir unidade',
      message: `Excluir permanentemente o cadastro "${u.razao_social}"?\n\nO.S. pendentes desta unidade serão removidas. Unidades com O.S. já faturadas não podem ser excluídas — use "Editar" e desmarque "Unidade ativa".`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    setExcluindoUnidadeId(u.id)
    const res = await excluirUnidadeClinica(u.id)
    setExcluindoUnidadeId(null)

    if (!res.ok) {
      await alert({ title: 'Exclusão', message: res.message, variant: 'danger' })
      return
    }

    setSelecionados((prev) => {
      const next = new Set(prev)
      next.delete(u.id)
      return next
    })
    await recarregar()
  }

  async function excluirOs(row: ClinicaOrdemServicoDetalhe) {
    if (row.status !== 'aguardando_faturamento') {
      await alert({
        title: 'Exclusão',
        message: 'Só é possível excluir O.S. que ainda não foram emitidas no faturamento.',
        variant: 'warning',
      })
      return
    }
    const ok = await confirm({
      title: 'Excluir ordem de serviço',
      message: `Excluir permanentemente ${row.numero_os} (${row.razao_social})?`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    setExcluindoOsId(row.id)
    const res = await excluirOrdemServicoClinica(row.id)
    setExcluindoOsId(null)

    if (!res.ok) {
      await alert({ title: 'Exclusão', message: res.message, variant: 'danger' })
      return
    }
    await recarregar()
  }

  return (
    <MainLayout>
      <div className="page-shell clinicas-page">
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>Clínicas</h1>
        <p className="page-header__lead" style={{ margin: '10px 0 0', maxWidth: 760, lineHeight: 1.65 }}>
          Cadastro mãe <strong>{grupoNome}</strong> e unidades de coleta. Gere ordens de serviço em lote — sem
          pesagem nem ticket — e fature em{' '}
          <Link to="/faturamento-clinicas" style={{ color: '#0d9488', fontWeight: 700 }}>
            Faturamento → Faturar clínicas
          </Link>
          .
        </p>

        {erro ? (
          <div
            style={{
              marginTop: '16px',
              padding: '14px',
              borderRadius: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '14px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {erro}
          </div>
        ) : null}

        <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button
            type="button"
            onClick={abrirNova}
            disabled={!grupoId || loading}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: '#0d9488',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Nova unidade
          </button>
          <button
            type="button"
            onClick={() => void recarregar()}
            disabled={loading}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Atualizar
          </button>
          <button
            type="button"
            className="rg-btn rg-btn--report"
            onClick={() => void exportarRelatorioPdf()}
            disabled={loading || gerandoPdf}
            title="PDF com unidades, O.S. (filtro atual) e consolidado 30 dias"
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid #0d9488',
              background: '#fff',
              color: '#0f766e',
              fontWeight: 700,
              cursor: loading || gerandoPdf ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RgReportPdfIcon className="rg-btn__icon" />
            {gerandoPdf ? 'Gerando PDF…' : 'Relatório PDF'}
          </button>
        </div>

        <div id={CLINICAS_GERAR_OS_HASH} style={{ ...cardStyle, scrollMarginTop: 88 }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Unidades — geração de O.S.</h2>
          <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <input
              type="search"
              className="chat-interno-input"
              placeholder="Filtrar por nome, CNPJ, CPF…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ minWidth: 220, flex: '1 1 200px' }}
            />
            <label style={{ fontSize: '13px', color: '#475569' }}>
              Data do serviço:{' '}
              <input
                type="date"
                value={dataServico}
                onChange={(e) => setDataServico(e.target.value)}
                style={{ marginLeft: '6px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </label>
            <button
              type="button"
              disabled={gerandoOs || selecionados.size === 0}
              onClick={() => void gerarOsLote()}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: selecionados.size === 0 ? '#94a3b8' : '#0369a1',
                color: '#fff',
                fontWeight: 800,
                cursor: selecionados.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {gerandoOs ? 'A gerar…' : `Gerar O.S. (${selecionados.size})`}
            </button>
          </div>

          {loading ? (
            <p style={{ marginTop: '16px', color: '#64748b' }}>A carregar…</p>
          ) : (
            <div className="rg-mobile-table-scroll" style={{ marginTop: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px', width: 40 }}>
                      <input
                        type="checkbox"
                        checked={todosFiltradosSelecionados}
                        onChange={toggleTodos}
                        aria-label="Selecionar todas"
                      />
                    </th>
                    <th style={{ padding: '8px' }}>Razão social</th>
                    <th style={{ padding: '8px' }}>CNPJ / CPF</th>
                    <th style={{ padding: '8px' }}>Endereço</th>
                    <th style={{ padding: '8px' }}>NF / PIX</th>
                    <th style={{ padding: '8px' }}>Ativo</th>
                    <th style={{ padding: '8px' }} />
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: u.ativo ? 1 : 0.65 }}>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="checkbox"
                          checked={selecionados.has(u.id)}
                          disabled={!u.ativo}
                          onChange={() => toggleUm(u.id)}
                          aria-label={`Selecionar ${u.razao_social}`}
                        />
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{u.razao_social}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {[u.cnpj, u.cpf].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td style={{ padding: '10px 8px', maxWidth: 280 }}>{u.endereco_coleta || '—'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {rotuloMeioCobranca(u.emite_nota, u.pagamento_pix)}
                      </td>
                      <td style={{ padding: '10px 8px' }}>{u.ativo ? 'Sim' : 'Não'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => abrirEditar(u)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={excluindoUnidadeId === u.id}
                            onClick={() => void excluirUnidade(u)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: excluindoUnidadeId === u.id ? 'wait' : 'pointer',
                            }}
                          >
                            {excluindoUnidadeId === u.id ? '…' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Ordens de serviço</h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b' }}>
            Exclua apenas O.S. que ainda aguardam faturamento. As emitidas permanecem no histórico e no financeiro.
            Histórico detalhado e PDF por período em{' '}
            <Link to="/faturamento-clinicas" style={{ color: '#0d9488', fontWeight: 700 }}>
              Faturar clínicas
            </Link>
            .
          </p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(
              [
                ['todas', 'Todas'],
                ['aguardando_faturamento', 'Aguardando'],
                ['emitida', 'Emitidas'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltroOs(id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: filtroOs === id ? '1px solid #0d9488' : '1px solid #cbd5e1',
                  background: filtroOs === id ? '#ecfdf5' : '#fff',
                  color: filtroOs === id ? '#0f766e' : '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {ordensFiltradas.length === 0 ? (
            <p style={{ marginTop: '12px', color: '#64748b' }}>
              {ordens.length === 0
                ? 'Nenhuma O.S. registada.'
                : `Nenhuma O.S. com o filtro «${rotuloFiltroOs}».`}
            </p>
          ) : (
            <div className="rg-mobile-table-scroll" style={{ marginTop: '14px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>O.S.</th>
                    <th style={{ padding: '8px' }}>Unidade</th>
                    <th style={{ padding: '8px' }}>Data serv.</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Valor</th>
                    <th style={{ padding: '8px' }} />
                  </tr>
                </thead>
                <tbody>
                  {ordensFiltradas.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{o.numero_os}</td>
                      <td style={{ padding: '10px 8px' }}>{o.razao_social}</td>
                      <td style={{ padding: '10px 8px' }}>{o.data_servico}</td>
                      <td style={{ padding: '10px 8px' }}>{rotuloStatusOsClinica(o.status)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {o.faturamento_valor != null && o.faturamento_valor > 0
                          ? formatarMoedaClinica(o.faturamento_valor)
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {o.status === 'aguardando_faturamento' ? (
                          <button
                            type="button"
                            disabled={excluindoOsId === o.id}
                            onClick={() => void excluirOs(o)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: excluindoOsId === o.id ? 'wait' : 'pointer',
                            }}
                          >
                            {excluindoOsId === o.id ? '…' : 'Excluir'}
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Relatório consolidado (últimos 30 dias)</h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b' }}>
            Várias O.S. da mesma unidade no período aparecem agregadas (quantidade e valores).
          </p>
          {relatorio.length === 0 ? (
            <p style={{ marginTop: '12px', color: '#64748b' }}>Sem movimentação no período.</p>
          ) : (
            <div className="rg-mobile-table-scroll" style={{ marginTop: '14px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Unidade</th>
                    <th style={{ padding: '8px' }}>Qtd O.S.</th>
                    <th style={{ padding: '8px' }}>Emitido</th>
                    <th style={{ padding: '8px' }}>Pendente</th>
                    <th style={{ padding: '8px' }}>Período</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio
                    .filter((r) => r.qtd_os > 0)
                    .map((r) => (
                      <tr key={r.unidade_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.razao_social}</td>
                        <td style={{ padding: '10px 8px' }}>{r.qtd_os}</td>
                        <td style={{ padding: '10px 8px' }}>{formatarMoedaClinica(r.valor_emitido_total)}</td>
                        <td style={{ padding: '10px 8px' }}>{formatarMoedaClinica(r.valor_pendente_total)}</td>
                        <td style={{ padding: '10px 8px', fontSize: '12px', color: '#64748b' }}>
                          {r.primeira_data ?? '—'} → {r.ultima_data ?? '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {mostrarForm ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '16px',
            }}
            onClick={() => setMostrarForm(false)}
          >
            <form
              onSubmit={(e) => void salvarForm(e)}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '24px',
                width: '100%',
                maxWidth: 520,
                maxHeight: '90vh',
                overflow: 'auto',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                {editId ? 'Editar unidade' : 'Nova unidade'}
              </h3>
              <p style={{ margin: '8px 0 16px', fontSize: '13px', color: '#64748b' }}>
                Grupo mãe: <strong>{grupoNome}</strong>
              </p>

              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px' }}>
                Razão social *
                <input
                  required
                  value={form.razao_social}
                  onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px' }}>
                CNPJ
                <input
                  value={form.cnpj}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cnpj: formatarCNPJDigitacao(e.target.value) }))
                  }
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px' }}>
                CPF
                <input
                  value={form.cpf}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cpf: formatarCPFDigitacao(e.target.value) }))
                  }
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px' }}>
                Endereço de coleta
                <textarea
                  value={form.endereco_coleta}
                  onChange={(e) => setForm((f) => ({ ...f, endereco_coleta: e.target.value }))}
                  rows={2}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={form.emite_nota}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      emite_nota: e.target.checked,
                      pagamento_pix: e.target.checked ? f.pagamento_pix : true,
                    }))
                  }
                />
                Emite nota fiscal?
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={form.pagamento_pix}
                  disabled={form.emite_nota}
                  onChange={(e) => setForm((f) => ({ ...f, pagamento_pix: e.target.checked }))}
                />
                Pagamento via PIX?
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                />
                Unidade ativa
              </label>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#0d9488',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: salvando ? 'wait' : 'pointer',
                  }}
                >
                  {salvando ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </MainLayout>
  )
}
