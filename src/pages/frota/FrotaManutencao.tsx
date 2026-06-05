import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FrotaAssinaturaBloco } from '../../components/frota/FrotaAssinaturaBloco'
import { FrotaDiarioResumoModal } from '../../components/frota/FrotaDiarioResumoModal'
import { FrotaUploadFotos } from '../../components/frota/FrotaUploadFotos'
import { rgAlert } from '../../lib/RgDialogProvider'
import {
  criarManutencaoFrota,
  fetchDiarioPorData,
  fetchDiariosFrota,
  fetchManutencoesFrota,
  salvarDiarioFrota,
} from '../../lib/frotaApi'
import { uploadFotosFrota } from '../../lib/frotaFotos'
import { FROTA_HUB_LABEL, FROTA_HUB_PATH } from '../../lib/frotaModulos'
import type { FrotaDiarioChecklist, FrotaDiarioRow, FrotaManutencaoRow, TipoManutencaoFrota } from '../../lib/frotaTypes'
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

export default function FrotaManutencao() {
  const { podeMutar } = useFrotaPermissoes()
  const [caminhoes, setCaminhoes] = useState<CaminhaoOpt[]>([])
  const [veiculoId, setVeiculoId] = useState('')
  const [tab, setTab] = useState<'diario' | 'preventiva' | 'corretiva'>('diario')
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

  const [tipoMan, setTipoMan] = useState<TipoManutencaoFrota>('preventiva')
  const [tituloMan, setTituloMan] = useState('')
  const [descMan, setDescMan] = useState('')
  const [kmMan, setKmMan] = useState('')
  const [oleoUltKm, setOleoUltKm] = useState('')
  const [oleoUltData, setOleoUltData] = useState('')
  const [oleoProxKm, setOleoProxKm] = useState('')
  const [custoMan, setCustoMan] = useState('')
  const [dataMan, setDataMan] = useState(() => new Date().toISOString().slice(0, 10))
  const [fotosManUrls, setFotosManUrls] = useState<string[]>([])
  const [fotosManFiles, setFotosManFiles] = useState<File[]>([])

  const [assNome, setAssNome] = useState('')
  const [assCargo, setAssCargo] = useState('')
  const [diarioResumo, setDiarioResumo] = useState<FrotaDiarioRow | null>(null)
  const diarioFormRef = useRef<HTMLFormElement>(null)

  const veiculo = caminhoes.find((c) => c.id === veiculoId)

  const carregarVeiculo = useCallback(async (id: string) => {
    if (!id) return
    const [man, dia] = await Promise.all([fetchManutencoesFrota(id), fetchDiariosFrota(id)])
    setManutencoes(man)
    setDiarios(dia)
    const ultimo = dia[0]
    if (ultimo?.km_odometro != null) {
      setKmMan(String(ultimo.km_odometro))
    }
    if (ultimo?.ultima_troca_oleo_km != null) {
      setOleoUltKm(String(ultimo.ultima_troca_oleo_km))
      setOleoKm(String(ultimo.ultima_troca_oleo_km))
    }
    if (ultimo?.ultima_troca_oleo_data) {
      setOleoUltData(ultimo.ultima_troca_oleo_data)
      setOleoData(ultimo.ultima_troca_oleo_data)
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

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          const { data: u } = await supabase.from('usuarios').select('nome, cargo').eq('id', user.id).maybeSingle()
          setAssNome(String(u?.nome ?? '').trim())
          setAssCargo(String(u?.cargo ?? '').trim())
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

  async function salvarManutencao(e: React.FormEvent) {
    e.preventDefault()
    if (!podeMutar) {
      await rgAlert({ title: 'Permissão', message: 'O seu perfil não pode registar manutenções.' })
      return
    }
    if (!veiculoId || !tituloMan.trim() || !assNome.trim()) {
      await rgAlert({ title: 'Dados em falta', message: 'Veículo, título e assinatura são obrigatórios.' })
      return
    }
    setSalvando(true)
    try {
      let fotos = [...fotosManUrls]
      if (fotosManFiles.length) {
        fotos = [...fotos, ...(await uploadFotosFrota(fotosManFiles, `manut/${veiculoId}`))]
      }
      await criarManutencaoFrota({
        caminhao_id: veiculoId,
        tipo_manutencao: tipoMan,
        titulo: tituloMan.trim(),
        descricao: descMan,
        km_atual: kmMan ? Number(kmMan.replace(',', '.')) : null,
        oleo_ultima_troca_km: oleoUltKm ? Number(oleoUltKm.replace(',', '.')) : null,
        oleo_ultima_troca_data: oleoUltData || null,
        oleo_proxima_troca_km: oleoProxKm ? Number(oleoProxKm.replace(',', '.')) : null,
        custo: custoMan ? Number(custoMan.replace(',', '.')) : null,
        realizado_em: dataMan,
        fotos,
        assinatura: {
          responsavel_nome: assNome.trim(),
          responsavel_cargo: assCargo.trim(),
          assinatura_em: new Date().toISOString(),
        },
        created_by: userId,
      })
      setTituloMan('')
      setDescMan('')
      setFotosManFiles([])
      setFotosManUrls([])
      await carregarVeiculo(veiculoId)
      await rgAlert({ title: 'Manutenção registada', message: 'Registo guardado com assinatura.', variant: 'success' })
    } catch (err) {
      await rgAlert({
        title: 'Erro',
        message: err instanceof Error ? err.message : 'Falha ao guardar.',
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
              Controlo preventivo, corretivo, quilometragem, troca de óleo, fotos e assinatura do responsável.
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
              <span>{diarios.length} diário(s) · {manutencoes.length} manutenção(ões)</span>
            </div>
          ) : null}
        </div>

        <div className="frota-tabs" role="tablist">
          {(['diario', 'preventiva', 'corretiva'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className={tab === t ? 'frota-tabs__btn--on' : ''}
              aria-selected={tab === t}
              onClick={() => {
                setTab(t)
                if (t === 'preventiva') setTipoMan('preventiva')
                if (t === 'corretiva') setTipoMan('corretiva')
              }}
            >
              {t === 'diario' ? 'Diário do veículo' : t === 'preventiva' ? 'Preventiva' : 'Corretiva'}
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
            <form className="frota-card frota-card--form" onSubmit={salvarManutencao}>
              <h2>Manutenção {tipoMan === 'preventiva' ? 'preventiva' : 'corretiva'}</h2>

              <section className="frota-form-section">
                <div className="frota-form-grid">
                  <label className="frota-span2">
                    <span>Título / serviço</span>
                    <input
                      value={tituloMan}
                      onChange={(e) => setTituloMan(e.target.value)}
                      placeholder="Ex.: Revisão 10.000 km"
                    />
                  </label>
                  <label>
                    <span>Data</span>
                    <input type="date" value={dataMan} onChange={(e) => setDataMan(e.target.value)} />
                  </label>
                  <label>
                    <span>Km atual</span>
                    <input
                      value={kmMan}
                      onChange={(e) => setKmMan(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </label>
                </div>
              </section>

              <section className="frota-form-section">
                <h3 className="frota-form-section__title">Óleo e custos</h3>
                <div className="frota-form-grid">
                  <label>
                    <span>Última troca óleo (km)</span>
                    <input value={oleoUltKm} onChange={(e) => setOleoUltKm(e.target.value)} inputMode="decimal" />
                  </label>
                  <label>
                    <span>Data troca óleo</span>
                    <input type="date" value={oleoUltData} onChange={(e) => setOleoUltData(e.target.value)} />
                  </label>
                  <label>
                    <span>Próxima troca (km)</span>
                    <input
                      value={oleoProxKm}
                      onChange={(e) => setOleoProxKm(e.target.value)}
                      placeholder="Ex.: km atual + 10 000"
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    <span>Custo (R$)</span>
                    <input value={custoMan} onChange={(e) => setCustoMan(e.target.value)} inputMode="decimal" />
                  </label>
                  <label className="frota-span2">
                    <span>Descrição</span>
                    <textarea
                      value={descMan}
                      onChange={(e) => setDescMan(e.target.value)}
                      rows={4}
                      placeholder="Serviços realizados, peças trocadas, fornecedor…"
                    />
                  </label>
                </div>
              </section>

              <section className="frota-form-section">
                <FrotaUploadFotos
                  urls={fotosManUrls}
                  onUrlsChange={setFotosManUrls}
                  onFilesSelect={(f) => setFotosManFiles((p) => [...p, ...f])}
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
                  {salvando ? 'A guardar…' : 'Registar manutenção'}
                </button>
              </div>
            </form>

            <aside className="frota-card frota-card--historico">
              <div className="frota-card__head-row">
                <h2>Histórico — {tipoMan === 'preventiva' ? 'preventiva' : 'corretiva'}</h2>
                <span className="frota-kpi">
                  {manutencoes.filter((m) => m.tipo_manutencao === tipoMan).length}
                </span>
              </div>
              {manutencoes.filter((m) => m.tipo_manutencao === tipoMan).length === 0 ? (
                <div className="frota-empty-state">
                  <p>Nenhuma manutenção {tipoMan} registada.</p>
                  <p className="frota-muted">Use o formulário ao lado para criar o primeiro registo.</p>
                </div>
              ) : (
                <ul className="frota-timeline frota-timeline--cards">
                  {manutencoes
                    .filter((m) => m.tipo_manutencao === tipoMan)
                    .map((m) => (
                      <li key={m.id} className="frota-timeline__card">
                        <div className="frota-timeline__card-head">
                          <strong>{m.titulo}</strong>
                          <time className="frota-timeline__when" dateTime={m.realizado_em}>
                            {m.realizado_em}
                          </time>
                        </div>
                        <p className="frota-timeline__meta">
                          {m.km_atual != null ? `${m.km_atual.toLocaleString('pt-BR')} km` : 'Km não informado'}
                          {m.custo != null ? ` · R$ ${m.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                        </p>
                        {m.assinatura_responsavel_nome ? (
                          <p className="frota-timeline__ass">✓ {m.assinatura_responsavel_nome}</p>
                        ) : null}
                      </li>
                    ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
