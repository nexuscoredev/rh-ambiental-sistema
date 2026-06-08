import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FrotaAssinaturaBloco } from '../../components/frota/FrotaAssinaturaBloco'
import { FrotaDiarioResumoModal } from '../../components/frota/FrotaDiarioResumoModal'
import { FrotaOrdemServicoPrint } from '../../components/frota/FrotaOrdemServicoPrint'
import { FrotaUploadFotos } from '../../components/frota/FrotaUploadFotos'
import { rgAlert, rgConfirm } from '../../lib/RgDialogProvider'
import {
  criarManutencaoFrota,
  excluirManutencaoFrota,
  fetchDiarioPorData,
  fetchDiariosFrota,
  fetchManutencoesFrota,
  salvarDiarioFrota,
} from '../../lib/frotaApi'
import { uploadFotosFrota } from '../../lib/frotaFotos'
import {
  FROTA_OS_CLASSIFICACOES,
  inferirTipoManutencaoOs,
  montarDadosImpressaoOs,
  type FrotaOrdemServicoPrintData,
} from '../../lib/frotaOrdemServico'
import { FROTA_HUB_LABEL, FROTA_HUB_PATH } from '../../lib/frotaModulos'
import type { FrotaDiarioChecklist, FrotaDiarioRow, FrotaManutencaoRow, FrotaOsClassificacao } from '../../lib/frotaTypes'
import { supabase } from '../../lib/supabase'
import { FrotaPermissaoAviso } from '../../components/frota/FrotaPermissaoAviso'
import { useFrotaPermissoes } from '../../hooks/useFrotaPermissoes'

type CaminhaoOpt = {
  id: string
  placa: string
  modelo: string | null
  km_ref?: number | null
}

const CHECKLIST_ITENS: { key: keyof FrotaDiarioChecklist; label: string }[] = [
  { key: 'oleo_nivel_ok', label: 'Nível de óleo OK' },
  { key: 'pneus_ok', label: 'Pneus / calibragem OK' },
  { key: 'freios_ok', label: 'Freios OK' },
  { key: 'luzes_ok', label: 'Luzes e sinalização OK' },
  { key: 'documentacao_ok', label: 'Documentação do veículo OK' },
  { key: 'limpeza_ok', label: 'Limpeza / higiene OK' },
]

const OS_CLASSIFICACAO_INICIAL: FrotaOsClassificacao = { frota: true }

export default function FrotaManutencao() {
  const { podeMutar, podeExcluir } = useFrotaPermissoes()
  const [caminhoes, setCaminhoes] = useState<CaminhaoOpt[]>([])
  const [veiculoId, setVeiculoId] = useState('')
  const [tab, setTab] = useState<'diario' | 'ordem_servico'>('diario')
  const [manutencoes, setManutencoes] = useState<FrotaManutencaoRow[]>([])
  const [diarios, setDiarios] = useState<FrotaDiarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [dataDiario, setDataDiario] = useState(() => new Date().toISOString().slice(0, 10))
  const [diarioId, setDiarioId] = useState<string | undefined>()
  const [kmOdometro, setKmOdometro] = useState('')
  const [oleoKm, setOleoKm] = useState('')
  const [oleoData, setOleoData] = useState('')
  const [checklist, setChecklist] = useState<FrotaDiarioChecklist>({})
  const [anomalias, setAnomalias] = useState('')
  const [obsDiario, setObsDiario] = useState('')
  const [fotosDiarioUrls, setFotosDiarioUrls] = useState<string[]>([])
  const [fotosDiarioFiles, setFotosDiarioFiles] = useState<File[]>([])

  const [osClassificacao, setOsClassificacao] = useState<FrotaOsClassificacao>(OS_CLASSIFICACAO_INICIAL)
  const [solicitanteOs, setSolicitanteOs] = useState('')
  const [ocorridoOs, setOcorridoOs] = useState('')
  const [compraSolucaoOs, setCompraSolucaoOs] = useState('')
  const [dataInicioOs, setDataInicioOs] = useState(() => new Date().toISOString().slice(0, 10))
  const [dataTerminoOs, setDataTerminoOs] = useState('')
  const [kmOs, setKmOs] = useState('')
  const [custoOs, setCustoOs] = useState('')
  const [fotosManUrls, setFotosManUrls] = useState<string[]>([])
  const [fotosManFiles, setFotosManFiles] = useState<File[]>([])
  const [assAutorizado, setAssAutorizado] = useState('')
  const [assExecucao, setAssExecucao] = useState('')
  const [assSolicitacao, setAssSolicitacao] = useState('')

  const [assNome, setAssNome] = useState('')
  const [assCargo, setAssCargo] = useState('')
  const [diarioResumo, setDiarioResumo] = useState<FrotaDiarioRow | null>(null)
  const [osImpressao, setOsImpressao] = useState<FrotaOrdemServicoPrintData | null>(null)
  const [excluindoOsId, setExcluindoOsId] = useState<string | null>(null)
  const diarioFormRef = useRef<HTMLFormElement>(null)

  const veiculo = caminhoes.find((c) => c.id === veiculoId)

  const carregarVeiculo = useCallback(async (id: string) => {
    if (!id) return
    const [man, dia] = await Promise.all([fetchManutencoesFrota(id), fetchDiariosFrota(id)])
    setManutencoes(man)
    setDiarios(dia)
    const ultimo = dia[0]
    if (ultimo?.km_odometro != null) {
      setKmOs(String(ultimo.km_odometro))
    }
  }, [])

  const aplicarDiarioNoFormulario = useCallback((row: FrotaDiarioRow | null) => {
    if (!row) {
      setDiarioId(undefined)
      setChecklist({})
      setAnomalias('')
      setObsDiario('')
      setFotosDiarioUrls([])
      return
    }
    setDiarioId(row.id)
    setKmOdometro(row.km_odometro != null ? String(row.km_odometro) : '')
    setOleoKm(row.ultima_troca_oleo_km != null ? String(row.ultima_troca_oleo_km) : '')
    setOleoData(row.ultima_troca_oleo_data ?? '')
    setChecklist(row.checklist ?? {})
    setAnomalias(row.checklist?.anomalias ?? '')
    setObsDiario(row.observacoes ?? '')
    setFotosDiarioUrls(row.fotos)
  }, [])

  const carregarDiarioDia = useCallback(
    async (id: string, data: string) => {
      const row = await fetchDiarioPorData(id, data)
      aplicarDiarioNoFormulario(row)
    },
    [aplicarDiarioNoFormulario]
  )

  const abrirResumoDiario = useCallback(
    async (d: FrotaDiarioRow) => {
      setDataDiario(d.data_diario)
      setDiarioResumo(d)
      if (!veiculoId) return
      const row = await fetchDiarioPorData(veiculoId, d.data_diario)
      if (row) {
        aplicarDiarioNoFormulario(row)
        setDiarioResumo(row)
      }
    },
    [veiculoId, aplicarDiarioNoFormulario]
  )

  function editarDiarioDoResumo() {
    setDiarioResumo(null)
    requestAnimationFrame(() => {
      diarioFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function imprimirOs(row: FrotaManutencaoRow) {
    if (!veiculo) return
    setOsImpressao(montarDadosImpressaoOs(row, veiculo.placa))
    requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 200)
    })
  }

  async function handleExcluirOs(row: FrotaManutencaoRow) {
    if (!podeExcluir) {
      await rgAlert({
        title: 'Permissão',
        message: 'O seu perfil não pode excluir ordens de serviço.',
      })
      return
    }
    const rotulo = `OS ${row.numero_os ?? '—'}/${row.ano_os ?? ''}`
    const ok = await rgConfirm({
      title: 'Excluir ordem de serviço',
      message: `Confirma a exclusão de ${rotulo}?\n\nEsta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    setExcluindoOsId(row.id)
    try {
      await excluirManutencaoFrota(row.id)
      if (veiculoId) await carregarVeiculo(veiculoId)
      await rgAlert({
        title: 'OS excluída',
        message: `${rotulo} foi removida do histórico.`,
        variant: 'success',
      })
    } catch (err) {
      await rgAlert({
        title: 'Erro',
        message: err instanceof Error ? err.message : 'Não foi possível excluir a OS.',
        variant: 'danger',
      })
    } finally {
      setExcluindoOsId(null)
    }
  }

  function limparFormularioOs() {
    setOsClassificacao({ ...OS_CLASSIFICACAO_INICIAL })
    setSolicitanteOs('')
    setOcorridoOs('')
    setCompraSolucaoOs('')
    setDataInicioOs(new Date().toISOString().slice(0, 10))
    setDataTerminoOs('')
    setCustoOs('')
    setFotosManFiles([])
    setFotosManUrls([])
    setAssAutorizado('')
    setAssSolicitacao('')
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          const { data: u } = await supabase.from('usuarios').select('nome, cargo').eq('id', user.id).maybeSingle()
          const nome = String(u?.nome ?? '').trim()
          const cargo = String(u?.cargo ?? '').trim()
          setAssNome(nome)
          setAssCargo(cargo)
          setAssExecucao(nome)
          setSolicitanteOs(nome)
          setAssSolicitacao(nome)
        }
        const { data, error } = await supabase.from('caminhoes').select('id, placa, modelo').order('placa')
        if (error) throw error
        setCaminhoes((data ?? []) as CaminhaoOpt[])
        if (data?.[0]) setVeiculoId(data[0].id)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!veiculoId) return
    void carregarVeiculo(veiculoId)
    void carregarDiarioDia(veiculoId, dataDiario)
  }, [veiculoId, dataDiario, carregarVeiculo, carregarDiarioDia])

  useEffect(() => {
    const onAfterPrint = () => setOsImpressao(null)
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])

  async function salvarDiario(e: React.FormEvent) {
    e.preventDefault()
    if (!podeMutar) {
      await rgAlert({ title: 'Permissão', message: 'O seu perfil não pode guardar o diário do veículo.' })
      return
    }
    if (!veiculoId || !assNome.trim()) {
      await rgAlert({ title: 'Dados em falta', message: 'Selecione o veículo e preencha a assinatura.' })
      return
    }
    setSalvando(true)
    try {
      let fotos = [...fotosDiarioUrls]
      if (fotosDiarioFiles.length) {
        fotos = [...fotos, ...(await uploadFotosFrota(fotosDiarioFiles, `diario/${veiculoId}`))]
      }
      const cl: FrotaDiarioChecklist = { ...checklist, anomalias: anomalias.trim() || undefined }
      await salvarDiarioFrota({
        id: diarioId,
        caminhao_id: veiculoId,
        data_diario: dataDiario,
        km_odometro: kmOdometro ? Number(kmOdometro.replace(',', '.')) : null,
        ultima_troca_oleo_km: oleoKm ? Number(oleoKm.replace(',', '.')) : null,
        ultima_troca_oleo_data: oleoData || null,
        checklist: cl,
        observacoes: obsDiario,
        fotos,
        assinatura: {
          responsavel_nome: assNome.trim(),
          responsavel_cargo: assCargo.trim(),
          assinatura_em: new Date().toISOString(),
        },
        created_by: userId,
      })
      setFotosDiarioFiles([])
      await carregarVeiculo(veiculoId)
      await carregarDiarioDia(veiculoId, dataDiario)
      await rgAlert({ title: 'Diário guardado', message: 'Registo diário atualizado.', variant: 'success' })
    } catch (err) {
      await rgAlert({
        title: 'Erro',
        message: err instanceof Error ? err.message : 'Falha ao guardar diário.',
        variant: 'danger',
      })
    } finally {
      setSalvando(false)
    }
  }

  async function salvarOrdemServico(e: React.FormEvent) {
    e.preventDefault()
    if (!podeMutar) {
      await rgAlert({ title: 'Permissão', message: 'O seu perfil não pode registar ordens de serviço.' })
      return
    }
    if (!veiculoId || !solicitanteOs.trim() || !ocorridoOs.trim()) {
      await rgAlert({
        title: 'Dados em falta',
        message: 'Veículo, solicitante e ocorrido/solicitação são obrigatórios.',
      })
      return
    }
    setSalvando(true)
    try {
      let fotos = [...fotosManUrls]
      if (fotosManFiles.length) {
        fotos = [...fotos, ...(await uploadFotosFrota(fotosManFiles, `manut/${veiculoId}`))]
      }
      const tipo = inferirTipoManutencaoOs(osClassificacao)
      const row = await criarManutencaoFrota({
        caminhao_id: veiculoId,
        tipo_manutencao: tipo,
        realizado_em: dataInicioOs,
        km_atual: kmOs ? Number(kmOs.replace(',', '.')) : null,
        custo: custoOs ? Number(custoOs.replace(',', '.')) : null,
        fotos,
        os_classificacao: osClassificacao,
        solicitante: solicitanteOs,
        ocorrido_solicitacao: ocorridoOs,
        compra_solucao: compraSolucaoOs,
        data_inicio: dataInicioOs,
        data_termino: dataTerminoOs || null,
        assinatura_autorizado_nome: assAutorizado,
        assinatura_execucao_nome: assExecucao || assNome,
        assinatura_solicitacao_nome: assSolicitacao || solicitanteOs,
        assinatura: {
          responsavel_nome: (assExecucao || assNome).trim(),
          responsavel_cargo: assCargo.trim(),
          assinatura_em: new Date().toISOString(),
        },
        created_by: userId,
      })
      limparFormularioOs()
      await carregarVeiculo(veiculoId)
      await rgAlert({
        title: 'OS registada',
        message: `Ordem de serviço nº ${row.numero_os ?? '—'}/${row.ano_os ?? ''} guardada.`,
        variant: 'success',
      })
      imprimirOs(row)
    } catch (err) {
      await rgAlert({
        title: 'Erro',
        message: err instanceof Error ? err.message : 'Falha ao guardar a ordem de serviço.',
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
          <Link to={FROTA_HUB_PATH}>{FROTA_HUB_LABEL}</Link>
          <span className="rh-modulo__breadcrumb-sep" aria-hidden>
            /
          </span>
          <span>Manutenção</span>
        </nav>

        <header className="frota-page__head">
          <div>
            <p className="frota-page__eyebrow">{FROTA_HUB_LABEL}</p>
            <h1>Manutenção e diário do veículo</h1>
            <p className="frota-page__lead">
              Diário diário do veículo e ordens de serviço (OS) com impressão no modelo RG — preventiva,
              corretiva, compras e assinaturas.
            </p>
          </div>
        </header>

        <FrotaPermissaoAviso somenteLeitura={!podeMutar} />

        <div className="frota-veiculo-bar">
          <label className="frota-veiculo-bar__select">
            <span>Veículo</span>
            <select
              className="frota-input"
              value={veiculoId}
              onChange={(e) => setVeiculoId(e.target.value)}
            >
              {caminhoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.placa} {c.modelo ? `· ${c.modelo}` : ''}
                </option>
              ))}
            </select>
          </label>
          {veiculo ? (
            <div className="frota-veiculo-chip">
              <strong>{veiculo.placa}</strong>
              <span>
                {diarios.length} diário(s) · {manutencoes.length} OS / manutenção(ões)
              </span>
            </div>
          ) : null}
        </div>

        <div className="frota-tabs" role="tablist">
          {(
            [
              ['diario', 'Diário do veículo'],
              ['ordem_servico', 'Ordem de serviço (OS)'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              className={tab === t ? 'frota-tabs__btn--on' : ''}
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="frota-loading">A carregar…</p>
        ) : tab === 'diario' ? (
          <div className="frota-layout-2 frota-layout-2--manutencao">
            <form
              ref={diarioFormRef}
              id="frota-diario-form"
              className="frota-card frota-card--form"
              onSubmit={salvarDiario}
            >
              <h2>Diário — {dataDiario}</h2>

              <section className="frota-form-section">
                <h3 className="frota-form-section__title">Dados do dia</h3>
                <div className="frota-form-grid">
                  <label>
                    <span>Data</span>
                    <input type="date" value={dataDiario} onChange={(e) => setDataDiario(e.target.value)} />
                  </label>
                  <label>
                    <span>Km odómetro</span>
                    <input
                      value={kmOdometro}
                      onChange={(e) => setKmOdometro(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </label>
                  <label>
                    <span>Última troca óleo (km)</span>
                    <input
                      value={oleoKm}
                      onChange={(e) => setOleoKm(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </label>
                  <label>
                    <span>Data última troca óleo</span>
                    <input type="date" value={oleoData} onChange={(e) => setOleoData(e.target.value)} />
                  </label>
                </div>
              </section>

              <section className="frota-form-section">
                <h3 className="frota-form-section__title">Checklist diário</h3>
                <div className="frota-checklist">
                  <div className="frota-checklist__grid">
                    {CHECKLIST_ITENS.map(({ key, label }) => (
                      <label key={key} className="frota-check">
                        <input
                          type="checkbox"
                          checked={Boolean(checklist[key])}
                          onChange={(e) => setChecklist((c) => ({ ...c, [key]: e.target.checked }))}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="frota-form-grid frota-form-grid--stack">
                  <label className="frota-span2">
                    <span>Anomalias / ocorrências</span>
                    <textarea
                      value={anomalias}
                      onChange={(e) => setAnomalias(e.target.value)}
                      rows={3}
                      placeholder="Descreva falhas, avisos do painel ou ocorrências no turno…"
                    />
                  </label>
                  <label className="frota-span2">
                    <span>Observações</span>
                    <textarea
                      value={obsDiario}
                      onChange={(e) => setObsDiario(e.target.value)}
                      rows={3}
                      placeholder="Notas gerais sobre o veículo neste dia…"
                    />
                  </label>
                </div>
              </section>

              <section className="frota-form-section">
                <FrotaUploadFotos
                  urls={fotosDiarioUrls}
                  onUrlsChange={setFotosDiarioUrls}
                  onFilesSelect={(f) => setFotosDiarioFiles((p) => [...p, ...f])}
                  disabled={!podeMutar || salvando}
                />
                <FrotaAssinaturaBloco
                  nome={assNome}
                  cargo={assCargo}
                  onNome={setAssNome}
                  onCargo={setAssCargo}
                  disabled={!podeMutar || salvando}
                />
              </section>

              <div className="frota-form-actions">
                <button type="submit" className="frota-btn frota-btn--primary" disabled={!podeMutar || salvando}>
                  {salvando ? 'A guardar…' : 'Guardar diário'}
                </button>
              </div>
            </form>

            <aside className="frota-card frota-card--historico">
              <div className="frota-card__head-row">
                <h2>Histórico diário</h2>
                <span className="frota-kpi">{diarios.length}</span>
              </div>
              {diarios.length === 0 ? (
                <div className="frota-empty-state">
                  <p>Nenhum diário guardado para este veículo.</p>
                  <p className="frota-muted">Após guardar, toque num registo para ver o resumo do dia.</p>
                </div>
              ) : (
                <ul className="frota-timeline frota-timeline--cards">
                  {diarios.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className="frota-timeline__card frota-timeline__card--btn"
                        onClick={() => void abrirResumoDiario(d)}
                      >
                        <div className="frota-timeline__card-head">
                          <strong>{d.data_diario}</strong>
                          <span className="frota-timeline__when">
                            {d.km_odometro != null ? `${d.km_odometro.toLocaleString('pt-BR')} km` : '— km'}
                          </span>
                        </div>
                        {d.assinatura_responsavel_nome ? (
                          <p className="frota-timeline__ass">
                            ✓ {d.assinatura_responsavel_nome}
                            {d.assinatura_responsavel_cargo ? ` · ${d.assinatura_responsavel_cargo}` : ''}
                          </p>
                        ) : null}
                        <span className="frota-timeline__hint">Toque para ver o resumo</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
            {diarioResumo && veiculo ? (
              <FrotaDiarioResumoModal
                row={diarioResumo}
                veiculoLabel={`${veiculo.placa}${veiculo.modelo ? ` · ${veiculo.modelo}` : ''}`}
                onFechar={() => setDiarioResumo(null)}
                onEditar={editarDiarioDoResumo}
              />
            ) : null}
          </div>
        ) : (
          <div className="frota-layout-2 frota-layout-2--manutencao">
            <form className="frota-card frota-card--form" onSubmit={salvarOrdemServico}>
              <h2>Ordem de serviço — {veiculo?.placa ?? 'veículo'}</h2>
              <p className="frota-os-form__hint">
                Preencha conforme o formulário RG. Ao guardar, a OS recebe número automático e pode ser impressa.
              </p>

              <section className="frota-form-section">
                <h3 className="frota-form-section__title">Classificação</h3>
                <div className="frota-os-class-grid">
                  {FROTA_OS_CLASSIFICACOES.map(({ key, label }) => (
                    <label key={key} className="frota-check">
                      <input
                        type="checkbox"
                        checked={Boolean(osClassificacao[key])}
                        onChange={(e) =>
                          setOsClassificacao((c) => ({ ...c, [key]: e.target.checked || undefined }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="frota-form-section">
                <div className="frota-form-grid">
                  <label className="frota-span2">
                    <span>Solicitante</span>
                    <input
                      value={solicitanteOs}
                      onChange={(e) => setSolicitanteOs(e.target.value)}
                      placeholder="Nome de quem solicita o serviço"
                    />
                  </label>
                  <label>
                    <span>Data de início</span>
                    <input type="date" value={dataInicioOs} onChange={(e) => setDataInicioOs(e.target.value)} />
                  </label>
                  <label>
                    <span>Data término</span>
                    <input type="date" value={dataTerminoOs} onChange={(e) => setDataTerminoOs(e.target.value)} />
                  </label>
                  <label>
                    <span>Km (referência)</span>
                    <input value={kmOs} onChange={(e) => setKmOs(e.target.value)} inputMode="decimal" />
                  </label>
                  <label>
                    <span>Custo compra (R$)</span>
                    <input value={custoOs} onChange={(e) => setCustoOs(e.target.value)} inputMode="decimal" />
                  </label>
                  <label className="frota-span2">
                    <span>Ocorrido / solicitação</span>
                    <textarea
                      value={ocorridoOs}
                      onChange={(e) => setOcorridoOs(e.target.value)}
                      rows={5}
                      placeholder="Descreva o problema, pedido ou ocorrência…"
                      required
                    />
                  </label>
                  <label className="frota-span2">
                    <span>Compra / solução</span>
                    <textarea
                      value={compraSolucaoOs}
                      onChange={(e) => setCompraSolucaoOs(e.target.value)}
                      rows={5}
                      placeholder="Peças compradas, serviço executado, fornecedor…"
                    />
                  </label>
                </div>
              </section>

              <section className="frota-form-section">
                <h3 className="frota-form-section__title">Assinaturas (impressão)</h3>
                <div className="frota-form-grid">
                  <label>
                    <span>Autorizado</span>
                    <input value={assAutorizado} onChange={(e) => setAssAutorizado(e.target.value)} />
                  </label>
                  <label>
                    <span>Responsável pela execução</span>
                    <input value={assExecucao} onChange={(e) => setAssExecucao(e.target.value)} />
                  </label>
                  <label className="frota-span2">
                    <span>Responsável pela solicitação</span>
                    <input value={assSolicitacao} onChange={(e) => setAssSolicitacao(e.target.value)} />
                  </label>
                </div>
                <FrotaAssinaturaBloco
                  nome={assNome}
                  cargo={assCargo}
                  onNome={(v) => {
                    setAssNome(v)
                    if (!assExecucao) setAssExecucao(v)
                  }}
                  onCargo={setAssCargo}
                  disabled={!podeMutar || salvando}
                />
              </section>

              <section className="frota-form-section">
                <FrotaUploadFotos
                  urls={fotosManUrls}
                  onUrlsChange={setFotosManUrls}
                  onFilesSelect={(f) => setFotosManFiles((p) => [...p, ...f])}
                  disabled={!podeMutar || salvando}
                />
              </section>

              <div className="frota-form-actions">
                <button type="submit" className="frota-btn frota-btn--primary" disabled={!podeMutar || salvando}>
                  {salvando ? 'A guardar…' : 'Guardar e imprimir OS'}
                </button>
              </div>
            </form>

            <aside className="frota-card frota-card--historico">
              <div className="frota-card__head-row">
                <h2>Histórico de OS</h2>
                <span className="frota-kpi">{manutencoes.length}</span>
              </div>
              {manutencoes.length === 0 ? (
                <div className="frota-empty-state">
                  <p>Nenhuma ordem de serviço registada.</p>
                  <p className="frota-muted">Use o formulário ao lado para criar a primeira OS.</p>
                </div>
              ) : (
                <ul className="frota-timeline frota-timeline--cards">
                  {manutencoes.map((m) => (
                    <li key={m.id} className="frota-timeline__card">
                      <div className="frota-timeline__card-head">
                        <strong>
                          OS {m.numero_os ?? '—'}/{m.ano_os ?? ''}
                        </strong>
                        <time className="frota-timeline__when" dateTime={m.data_inicio ?? m.realizado_em}>
                          {m.data_inicio ?? m.realizado_em}
                        </time>
                      </div>
                      <p className="frota-timeline__meta">
                        {m.solicitante ?? 'Sem solicitante'}
                        {m.km_atual != null ? ` · ${m.km_atual.toLocaleString('pt-BR')} km` : ''}
                      </p>
                      {m.ocorrido_solicitacao ? (
                        <p className="frota-timeline__snippet">
                          {m.ocorrido_solicitacao.length > 120
                            ? `${m.ocorrido_solicitacao.slice(0, 120)}…`
                            : m.ocorrido_solicitacao}
                        </p>
                      ) : null}
                      <div className="frota-timeline__card-actions">
                        <button
                          type="button"
                          className="frota-btn frota-btn--ghost frota-btn--sm"
                          onClick={() => imprimirOs(m)}
                        >
                          Imprimir OS
                        </button>
                        {podeExcluir ? (
                          <button
                            type="button"
                            className="frota-btn frota-btn--danger frota-btn--sm"
                            disabled={excluindoOsId === m.id}
                            onClick={() => void handleExcluirOs(m)}
                          >
                            {excluindoOsId === m.id ? 'A excluir…' : 'Excluir OS'}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </div>

      {osImpressao ? <FrotaOrdemServicoPrint dados={osImpressao} /> : null}
    </MainLayout>
  )
}
