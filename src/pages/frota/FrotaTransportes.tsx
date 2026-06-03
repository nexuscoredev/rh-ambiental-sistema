import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FrotaAssinaturaBloco } from '../../components/frota/FrotaAssinaturaBloco'
import { FrotaUploadFotos } from '../../components/frota/FrotaUploadFotos'
import { rgAlert } from '../../lib/RgDialogProvider'
import {
  criarMovimentacaoFrota,
  fetchCatalogoEquipamentosClientes,
  fetchMovimentacoesFrota,
} from '../../lib/frotaApi'
import { uploadFotosFrota } from '../../lib/frotaFotos'
import {
  gerarRelatorioFrotaMovimentacaoPdf,
  movimentacaoRowParaRelatorio,
  type FrotaMovimentacaoRelatorioLinha,
} from '../../lib/gerarRelatorioFrotaMovimentacaoPdf'
import { FROTA_HUB_PATH, FROTA_TIPOS_MOVIMENTACAO } from '../../lib/frotaModulos'
import type { EquipamentoClienteCatalogo, FrotaMovimentacaoRow, TipoMovimentacaoFrota } from '../../lib/frotaTypes'
import { supabase } from '../../lib/supabase'
import { RgReportPdfIcon } from '../../components/ui/RgReportPdfIcon'
import { FrotaPermissaoAviso } from '../../components/frota/FrotaPermissaoAviso'
import { useFrotaPermissoes } from '../../hooks/useFrotaPermissoes'

type CaminhaoOpt = { id: string; placa: string; modelo: string | null }

export default function FrotaTransportes() {
  const { podeMutar, podeRelatorio } = useFrotaPermissoes()
  const [tab, setTab] = useState<'equipamentos' | 'movimentacao'>('movimentacao')
  const [catalogo, setCatalogo] = useState<EquipamentoClienteCatalogo[]>([])
  const [movimentos, setMovimentos] = useState<FrotaMovimentacaoRow[]>([])
  const [caminhoes, setCaminhoes] = useState<CaminhaoOpt[]>([])
  const [buscaEq, setBuscaEq] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [tipo, setTipo] = useState<TipoMovimentacaoFrota>('instalacao')
  const [eqSel, setEqSel] = useState<EquipamentoClienteCatalogo | null>(null)
  const [caminhaoId, setCaminhaoId] = useState('')
  const [km, setKm] = useState('')
  const [obs, setObs] = useState('')
  const [fotosUrls, setFotosUrls] = useState<string[]>([])
  const [fotosFiles, setFotosFiles] = useState<File[]>([])
  const [assNome, setAssNome] = useState('')
  const [assCargo, setAssCargo] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const placaPorId = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of caminhoes) {
      map.set(c.id, c.placa)
    }
    return map
  }, [caminhoes])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [cat, mov, cam] = await Promise.all([
        fetchCatalogoEquipamentosClientes(),
        fetchMovimentacoesFrota(),
        supabase.from('caminhoes').select('id, placa, modelo').order('placa'),
      ])
      setCatalogo(cat)
      setMovimentos(mov)
      if (cam.error) throw cam.error
      setCaminhoes((cam.data ?? []) as CaminhaoOpt[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('usuarios').select('nome, cargo').eq('id', user.id).maybeSingle()
      const nome = String(data?.nome ?? user.email ?? '').trim()
      const cargo = String(data?.cargo ?? '').trim()
      setAssNome(nome)
      setAssCargo(cargo)
    })()
  }, [carregar])

  const catalogoFiltrado = useMemo(() => {
    const t = buscaEq.trim().toLowerCase()
    if (!t) return catalogo
    return catalogo.filter(
      (e) => e.cliente_nome.toLowerCase().includes(t) || e.descricao.toLowerCase().includes(t)
    )
  }, [catalogo, buscaEq])

  const labelTipo = useCallback(
    (id: string) => FROTA_TIPOS_MOVIMENTACAO.find((t) => t.id === id)?.label ?? id,
    []
  )

  function placaVeiculo(id: string | null): string | null {
    if (!id) return null
    return placaPorId.get(id) ?? null
  }

  function linhaFormularioRelatorio(): FrotaMovimentacaoRelatorioLinha | null {
    if (!eqSel) return null
    const kmNum = km ? Number(km.replace(',', '.')) : null
    return {
      tipoLabel: labelTipo(tipo),
      cliente: eqSel.cliente_nome,
      equipamento: eqSel.descricao,
      veiculoPlaca: placaVeiculo(caminhaoId || null),
      km: Number.isFinite(kmNum) ? kmNum : null,
      observacoes: obs.trim() || null,
      fotosCount: fotosUrls.length + fotosFiles.length,
      assinaturaNome: assNome.trim() || null,
      assinaturaCargo: assCargo.trim() || null,
      assinaturaEm: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
  }

  async function gerarRelatorioFormulario() {
    if (!podeRelatorio) {
      await rgAlert({
        title: 'Permissão',
        message: 'O seu perfil não pode gerar relatório para assinatura neste módulo.',
      })
      return
    }
    const linha = linhaFormularioRelatorio()
    if (!linha) {
      await rgAlert({ title: 'Equipamento', message: 'Selecione um equipamento antes de gerar o relatório.' })
      return
    }
    if (!assNome.trim()) {
      await rgAlert({ title: 'Assinatura', message: 'Informe o nome do responsável para o relatório.' })
      return
    }
    gerarRelatorioFrotaMovimentacaoPdf([linha])
  }

  function gerarRelatorioMovimento(m: FrotaMovimentacaoRow) {
    if (!podeRelatorio) return
    gerarRelatorioFrotaMovimentacaoPdf([
      movimentacaoRowParaRelatorio(m, labelTipo(m.tipo_movimentacao), placaVeiculo(m.caminhao_id)),
    ])
  }

  function gerarRelatorioRecentes() {
    if (!podeRelatorio) return
    if (!movimentos.length) {
      void rgAlert({ title: 'Histórico', message: 'Não há movimentações recentes para exportar.' })
      return
    }
    const linhas = movimentos.map((m) =>
      movimentacaoRowParaRelatorio(m, labelTipo(m.tipo_movimentacao), placaVeiculo(m.caminhao_id))
    )
    gerarRelatorioFrotaMovimentacaoPdf(linhas)
  }

  async function salvarMovimentacao(e: React.FormEvent) {
    e.preventDefault()
    if (!podeMutar) {
      await rgAlert({
        title: 'Permissão',
        message: 'O seu perfil não pode registar movimentações neste módulo.',
      })
      return
    }
    if (!eqSel) {
      await rgAlert({ title: 'Equipamento', message: 'Selecione um equipamento do catálogo do cliente.' })
      return
    }
    if (!assNome.trim()) {
      await rgAlert({ title: 'Assinatura', message: 'Informe o nome do responsável.' })
      return
    }
    setSalvando(true)
    try {
      let fotos = [...fotosUrls]
      if (fotosFiles.length) {
        const novas = await uploadFotosFrota(fotosFiles, `mov/${Date.now()}`)
        fotos = [...fotos, ...novas]
      }
      await criarMovimentacaoFrota({
        tipo_movimentacao: tipo,
        cliente_id: eqSel.cliente_id,
        cliente_nome: eqSel.cliente_nome,
        equipamento_descricao: eqSel.descricao,
        caminhao_id: caminhaoId || null,
        km: km ? Number(km.replace(',', '.')) : null,
        observacoes: obs,
        fotos,
        assinatura: {
          responsavel_nome: assNome.trim(),
          responsavel_cargo: assCargo.trim(),
          assinatura_em: new Date().toISOString(),
        },
        created_by: userId,
      })
      setFotosFiles([])
      setFotosUrls([])
      setObs('')
      setKm('')
      await carregar()
      await rgAlert({ title: 'Registado', message: 'Movimentação guardada com sucesso.', variant: 'success' })
    } catch (err) {
      await rgAlert({
        title: 'Erro',
        message: err instanceof Error ? err.message : 'Não foi possível guardar.',
        variant: 'danger',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <MainLayout>
      <div className="page-shell frota-page">
        <nav className="rh-modulo__breadcrumb" aria-label="Navegação">
          <Link to={FROTA_HUB_PATH}>Frota operacional</Link>
          <span className="rh-modulo__breadcrumb-sep" aria-hidden>
            /
          </span>
          <span>Transportes</span>
        </nav>

        <header className="frota-page__head">
          <div>
            <p className="frota-page__eyebrow">Operacional</p>
            <h1>Transportes</h1>
            <p className="frota-page__lead">Equipamentos do contrato do cliente e registo de movimentação.</p>
          </div>
        </header>

        <FrotaPermissaoAviso somenteLeitura={!podeMutar} />

        <div className="frota-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'equipamentos'}
            className={tab === 'equipamentos' ? 'frota-tabs__btn--on' : ''}
            onClick={() => setTab('equipamentos')}
          >
            Equipamentos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'movimentacao'}
            className={tab === 'movimentacao' ? 'frota-tabs__btn--on' : ''}
            onClick={() => setTab('movimentacao')}
          >
            Movimentação
          </button>
        </div>

        {loading ? (
          <p className="frota-loading">A carregar…</p>
        ) : tab === 'equipamentos' ? (
          <section className="frota-card">
            <input
              className="frota-input"
              placeholder="Buscar cliente ou equipamento…"
              value={buscaEq}
              onChange={(e) => setBuscaEq(e.target.value)}
            />
            <p className="frota-kpi">{catalogoFiltrado.length} equipamento(s) em contratos ativos</p>
            <div className="frota-table-wrap">
              <table className="frota-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Equipamento</th>
                    <th>Custo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {catalogoFiltrado.map((e) => (
                    <tr key={`${e.cliente_id}-${e.descricao}`}>
                      <td>{e.cliente_nome}</td>
                      <td>{e.descricao}</td>
                      <td>{e.com_custo ? 'Com custo' : 'Sem custo'}</td>
                      <td>
                        <button
                          type="button"
                          className="frota-btn frota-btn--ghost frota-btn--sm"
                          onClick={() => {
                            setEqSel(e)
                            setTab('movimentacao')
                          }}
                        >
                          Movimentar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <div className="frota-layout-2 frota-layout-2--transportes">
            <form className="frota-card frota-card--form" onSubmit={salvarMovimentacao}>
              <fieldset disabled={!podeMutar || salvando} className="frota-form-fieldset">
              <h2>Nova movimentação</h2>
              <div className="frota-form-grid">
                <label>
                  <span>Tipo</span>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentacaoFrota)}>
                    {FROTA_TIPOS_MOVIMENTACAO.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="frota-span2">
                  <span>Equipamento (contrato cliente)</span>
                  <select
                    value={eqSel ? `${eqSel.cliente_id}::${eqSel.descricao}` : ''}
                    onChange={(e) => {
                      const v = e.target.value
                      const found = catalogo.find((c) => `${c.cliente_id}::${c.descricao}` === v)
                      setEqSel(found ?? null)
                    }}
                  >
                    <option value="">Selecione…</option>
                    {catalogo.map((c) => (
                      <option key={`${c.cliente_id}-${c.descricao}`} value={`${c.cliente_id}::${c.descricao}`}>
                        {c.cliente_nome} — {c.descricao}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="frota-form-grid frota-form-grid--veiculo-km">
                <label>
                  <span>Veículo RG (opcional)</span>
                  <select value={caminhaoId} onChange={(e) => setCaminhaoId(e.target.value)}>
                    <option value="">—</option>
                    {caminhoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.placa} {c.modelo ? `· ${c.modelo}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Km</span>
                  <input value={km} onChange={(e) => setKm(e.target.value)} inputMode="decimal" placeholder="0" />
                </label>
              </div>
              <div className="frota-form-grid">
                <label className="frota-span2">
                  <span>Observações</span>
                  <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Detalhes da movimentação…" />
                </label>
              </div>
              <FrotaUploadFotos
                urls={fotosUrls}
                onUrlsChange={setFotosUrls}
                onFilesSelect={(f) => setFotosFiles((prev) => [...prev, ...f])}
                disabled={!podeMutar || salvando}
              />
              <FrotaAssinaturaBloco
                nome={assNome}
                cargo={assCargo}
                onNome={setAssNome}
                onCargo={setAssCargo}
                disabled={!podeMutar || salvando}
              />
              </fieldset>
              <div className="frota-form-actions">
                <button
                  type="submit"
                  className="frota-btn frota-btn--primary"
                  disabled={!podeMutar || salvando}
                >
                  {salvando ? 'A guardar…' : 'Registar movimentação'}
                </button>
                <button
                  type="button"
                  className="frota-btn frota-btn--ghost"
                  disabled={!podeRelatorio || salvando}
                  onClick={() => void gerarRelatorioFormulario()}
                >
                  <RgReportPdfIcon className="frota-btn__icon" />
                  Gerar relatório para assinatura
                </button>
              </div>
            </form>

            <aside className="frota-card frota-card--historico">
              <div className="frota-card__head-row">
                <h2>Histórico recente</h2>
                {movimentos.length > 0 ? (
                  <button
                    type="button"
                    className="frota-btn frota-btn--ghost frota-btn--sm"
                    disabled={!podeRelatorio}
                    onClick={gerarRelatorioRecentes}
                    title="Exportar todas as movimentações listadas"
                  >
                    <RgReportPdfIcon className="frota-btn__icon" />
                    Relatório (todos)
                  </button>
                ) : null}
              </div>
              {movimentos.length === 0 ? (
                <div className="frota-empty-state">
                  <p>Nenhuma movimentação registada ainda.</p>
                  <p className="frota-muted">Os registos guardados aparecem aqui com opção de relatório para assinatura.</p>
                </div>
              ) : (
                <ul className="frota-timeline frota-timeline--cards">
                  {movimentos.map((m) => {
                    const placa = placaVeiculo(m.caminhao_id)
                    return (
                      <li key={m.id} className="frota-timeline__card">
                        <div className="frota-timeline__card-head">
                          <span className="frota-timeline__badge">{labelTipo(m.tipo_movimentacao)}</span>
                          <time className="frota-timeline__when" dateTime={m.created_at}>
                            {new Date(m.created_at).toLocaleString('pt-BR')}
                          </time>
                        </div>
                        <p className="frota-timeline__equip">{m.equipamento_descricao}</p>
                        <p className="frota-muted">{m.cliente_nome}</p>
                        {placa || m.km != null ? (
                          <p className="frota-timeline__meta">
                            {placa ? `Veículo ${placa}` : null}
                            {placa && m.km != null ? ' · ' : null}
                            {m.km != null ? `${m.km.toLocaleString('pt-BR')} km` : null}
                          </p>
                        ) : null}
                        {m.assinatura_responsavel_nome ? (
                          <p className="frota-timeline__ass">
                            ✓ {m.assinatura_responsavel_nome}
                            {m.assinatura_responsavel_cargo ? ` · ${m.assinatura_responsavel_cargo}` : ''}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className="frota-btn frota-btn--ghost frota-btn--sm frota-timeline__report"
                          disabled={!podeRelatorio}
                          onClick={() => gerarRelatorioMovimento(m)}
                        >
                          <RgReportPdfIcon className="frota-btn__icon" />
                          PDF para assinatura
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </aside>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
