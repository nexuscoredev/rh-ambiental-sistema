import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import type { PostgrestError } from '@supabase/supabase-js'
import MainLayout from '../../layouts/MainLayout'
import { RgReportPdfIcon } from '../../components/ui/RgReportPdfIcon'
import { rgAlert, rgConfirm } from '../../lib/RgDialogProvider'
import {
  formatarCPFDigitacao,
  formatarCpfParaArmazenar,
  validarCPF,
} from '../../lib/brasilCadastro'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../lib/coletasQueryLimits'
import {
  exportarCsvRhColaboradores,
  gerarRelatorioRhColaboradoresPdf,
} from '../../lib/gerarRelatorioRhColaboradoresPdf'
import { RH_HUB_PATH } from '../../lib/rhModulos'
import {
  formatarDataRh,
  limparTextoRh,
  normalizarRhColaboradorRow,
  RH_COLABORADORES_SELECT,
  rhColaboradorParaRelatorio,
  type RhColaboradorRow,
  type RhColaboradorStatus,
} from '../../lib/rhColaboradores'
import { sanitizeIlikePattern } from '../../lib/sanitizeIlike'
import { supabase } from '../../lib/supabase'
import { limparSessionDraftKey, useCadastroFormDraft } from '../../lib/useCadastroFormDraft'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useSessionPersistedState } from '../../lib/usePageSessionPersistence'
import { RhModuloIcon } from './RhModuloIcon'

type MotoristaOpcao = { id: string; nome: string }

type FormColaborador = {
  nome: string
  cpf: string
  data_admissao: string
  cargo_funcao: string
  departamento: string
  status: RhColaboradorStatus
  email: string
  telefone: string
  observacoes: string
  motorista_id: string
}

const formInicial: FormColaborador = {
  nome: '',
  cpf: '',
  data_admissao: '',
  cargo_funcao: '',
  departamento: '',
  status: 'Ativo',
  email: '',
  telefone: '',
  observacoes: '',
  motorista_id: '',
}

const DRAFT_KEY = 'rg-rh-colaboradores-cadastro-draft'

const btnPrimary: CSSProperties = {
  padding: '10px 16px',
  borderRadius: '10px',
  border: '1px solid #0f766e',
  background: 'linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)',
  color: '#fff',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
}

const btnGhost: CSSProperties = {
  padding: '10px 16px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#475569',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
}

function dataIsoCampo(val?: string | null): string {
  if (!val) return ''
  return val.includes('T') ? val.split('T')[0] : val.slice(0, 10)
}

function mensagemErroSupabase(err: PostgrestError | null): string {
  if (!err) return 'Erro desconhecido.'
  const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase()
  if (msg.includes('rh_colaboradores') && (msg.includes('does not exist') || msg.includes('schema cache'))) {
    return 'Tabela rh_colaboradores ainda não existe no Supabase. Execute a migração 20260530140000_rh_colaboradores.sql (npm run db:apply:rh-colaboradores).'
  }
  if (msg.includes('idx_rh_colaboradores_cpf_unico') || msg.includes('duplicate')) {
    return 'Já existe um colaborador com este CPF.'
  }
  return err.message
}

export default function RhDepartamentoPessoal() {
  const [colaboradores, setColaboradores] = useState<RhColaboradorRow[]>([])
  const [motoristas, setMotoristas] = useState<MotoristaOpcao[]>([])
  const [loading, setLoading] = useState(true)
  const [erroLista, setErroLista] = useState('')
  const [busca, setBusca] = useSessionPersistedState('rh-dp-busca', '')
  const [filtroStatus, setFiltroStatus] = useSessionPersistedState<'todos' | RhColaboradorStatus>(
    'rh-dp-status',
    'todos'
  )
  const [page, setPage] = useSessionPersistedState('rh-dp-page', 1)
  const [pageSize, setPageSize] = useSessionPersistedState('rh-dp-page-size', DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const buscaDebounced = useDebouncedValue(busca, 400)

  const [mostrarCadastro, setMostrarCadastro] = useState(false)
  const [form, setForm] = useState<FormColaborador>(formInicial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)

  const cadastroDraftData = useMemo(() => ({ form, editingId }), [form, editingId])
  useCadastroFormDraft({
    storageKey: DRAFT_KEY,
    open: mostrarCadastro,
    data: cadastroDraftData,
    onRestore: (d) => {
      setForm(d.form)
      setEditingId(d.editingId)
      setMostrarCadastro(true)
    },
  })

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from('motoristas')
        .select('id, nome')
        .order('nome', { ascending: true })
        .limit(2000)
      if (error) {
        console.warn('[rh-dp] motoristas:', error.message)
        return
      }
      setMotoristas(
        (data ?? [])
          .map((r) => ({ id: String(r.id), nome: String(r.nome ?? '').trim() }))
          .filter((r) => r.nome)
      )
    })()
  }, [])

  const fetchColaboradores = useCallback(async () => {
    setLoading(true)
    setErroLista('')

    const term = buscaDebounced.trim()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let countQ = supabase.from('rh_colaboradores').select('id', { count: 'exact', head: true })
    let dataQ = supabase
      .from('rh_colaboradores')
      .select(RH_COLABORADORES_SELECT)
      .order('nome', { ascending: true })

    if (term) {
      const s = sanitizeIlikePattern(term)
      const orFilter = `nome.ilike.%${s}%,cpf.ilike.%${s}%,cargo_funcao.ilike.%${s}%,departamento.ilike.%${s}%,email.ilike.%${s}%`
      countQ = countQ.or(orFilter)
      dataQ = dataQ.or(orFilter)
    }

    if (filtroStatus !== 'todos') {
      countQ = countQ.eq('status', filtroStatus)
      dataQ = dataQ.eq('status', filtroStatus)
    }

    const [{ count, error: errCount }, { data, error }] = await Promise.all([
      countQ,
      dataQ.range(from, to),
    ])

    if (errCount) {
      setErroLista(mensagemErroSupabase(errCount))
      setTotalCount(0)
    } else {
      setTotalCount(typeof count === 'number' ? count : 0)
    }

    if (error) {
      setErroLista(mensagemErroSupabase(error))
      setColaboradores([])
    } else {
      setColaboradores(((data as Record<string, unknown>[]) ?? []).map(normalizarRhColaboradorRow))
    }

    setLoading(false)
  }, [page, pageSize, buscaDebounced, filtroStatus])

  const fetchParaRelatorio = useCallback(async (): Promise<RhColaboradorRow[]> => {
    const PAGE = 1000
    const term = buscaDebounced.trim()
    let dataQ = supabase
      .from('rh_colaboradores')
      .select(RH_COLABORADORES_SELECT)
      .order('nome', { ascending: true })

    if (term) {
      const s = sanitizeIlikePattern(term)
      dataQ = dataQ.or(
        `nome.ilike.%${s}%,cpf.ilike.%${s}%,cargo_funcao.ilike.%${s}%,departamento.ilike.%${s}%,email.ilike.%${s}%`
      )
    }
    if (filtroStatus !== 'todos') {
      dataQ = dataQ.eq('status', filtroStatus)
    }

    const out: RhColaboradorRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await dataQ.range(from, from + PAGE - 1)
      if (error) throw new Error(mensagemErroSupabase(error))
      const chunk = ((data as Record<string, unknown>[]) ?? []).map(normalizarRhColaboradorRow)
      out.push(...chunk)
      if (chunk.length < PAGE) break
    }
    return out
  }, [buscaDebounced, filtroStatus])

  useEffect(() => {
    void fetchColaboradores()
  }, [fetchColaboradores])

  useEffect(() => {
    const id = window.setTimeout(() => setPage(1), 0)
    return () => window.clearTimeout(id)
  }, [buscaDebounced, filtroStatus, pageSize, setPage])

  const totalPaginas =
    totalCount != null && totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1

  useEffect(() => {
    if (page <= totalPaginas) return
    const id = window.setTimeout(() => setPage(totalPaginas), 0)
    return () => window.clearTimeout(id)
  }, [page, totalPaginas, setPage])

  function limparFormulario() {
    limparSessionDraftKey(DRAFT_KEY)
    setForm(formInicial)
    setEditingId(null)
  }

  function abrirNovo() {
    limparFormulario()
    setMostrarCadastro(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function abrirEdicao(c: RhColaboradorRow) {
    setForm({
      nome: c.nome ?? '',
      cpf: c.cpf ?? '',
      data_admissao: dataIsoCampo(c.data_admissao),
      cargo_funcao: c.cargo_funcao ?? '',
      departamento: c.departamento ?? '',
      status: c.status ?? 'Ativo',
      email: c.email ?? '',
      telefone: c.telefone ?? '',
      observacoes: c.observacoes ?? '',
      motorista_id: c.motorista_id ?? '',
    })
    setEditingId(c.id)
    setMostrarCadastro(true)
    setSucesso('')
  }

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    if (name === 'cpf') {
      setForm((prev) => ({ ...prev, cpf: formatarCPFDigitacao(value) }))
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) {
      void rgAlert({ title: 'Colaborador', message: 'Preencha o nome.', variant: 'warning' })
      return
    }

    const cpfDigitos = form.cpf.replace(/\D/g, '')
    let cpf: string | null = null
    if (cpfDigitos.length > 0) {
      const cpfFmt = formatarCpfParaArmazenar(form.cpf)
      if (!cpfFmt || !validarCPF(cpfFmt)) {
        void rgAlert({
          title: 'Colaborador',
          message: 'CPF inválido. Verifique os dígitos ou deixe em branco.',
          variant: 'warning',
        })
        return
      }
      cpf = cpfFmt
    }

    setSalvando(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const payload = {
      nome: form.nome.trim(),
      cpf,
      data_admissao: limparTextoRh(form.data_admissao),
      cargo_funcao: limparTextoRh(form.cargo_funcao),
      departamento: limparTextoRh(form.departamento),
      status: form.status,
      email: limparTextoRh(form.email),
      telefone: limparTextoRh(form.telefone),
      observacoes: limparTextoRh(form.observacoes),
      motorista_id: form.motorista_id.trim() || null,
      ...(editingId ? {} : { created_by: user?.id ?? null }),
    }

    let error: PostgrestError | null = null
    if (editingId) {
      const res = await supabase.from('rh_colaboradores').update(payload).eq('id', editingId)
      error = res.error
    } else {
      const res = await supabase.from('rh_colaboradores').insert([payload])
      error = res.error
    }

    setSalvando(false)

    if (error) {
      void rgAlert({
        title: 'Colaborador',
        message: mensagemErroSupabase(error),
        variant: 'danger',
      })
      return
    }

    setSucesso(editingId ? 'Colaborador atualizado.' : 'Colaborador cadastrado.')
    limparFormulario()
    setMostrarCadastro(false)
    await fetchColaboradores()
    window.setTimeout(() => setSucesso(''), 3000)
  }

  async function handleExcluir(id: string) {
    const ok = await rgConfirm({
      title: 'Excluir colaborador',
      message: 'Deseja excluir este registo? Esta acção não pode ser desfeita.',
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    const { error } = await supabase.from('rh_colaboradores').delete().eq('id', id)
    if (error) {
      void rgAlert({
        title: 'Colaborador',
        message: mensagemErroSupabase(error),
        variant: 'danger',
      })
      return
    }
    if (editingId === id) limparFormulario()
    await fetchColaboradores()
  }

  async function handleRelatorioPdf() {
    setGerandoRelatorio(true)
    try {
      const rows = await fetchParaRelatorio()
      if (rows.length === 0) {
        void rgAlert({
          title: 'Relatório',
          message: 'Nenhum colaborador encontrado com os filtros actuais.',
          variant: 'warning',
        })
        return
      }
      gerarRelatorioRhColaboradoresPdf({
        linhas: rows.map(rhColaboradorParaRelatorio),
        filtroBusca: buscaDebounced,
        filtroStatus: filtroStatus === 'todos' ? 'Todos' : filtroStatus,
      })
    } catch (err) {
      void rgAlert({
        title: 'Relatório',
        message: err instanceof Error ? err.message : 'Não foi possível gerar o PDF.',
        variant: 'danger',
      })
    } finally {
      setGerandoRelatorio(false)
    }
  }

  async function handleRelatorioCsv() {
    setGerandoRelatorio(true)
    try {
      const rows = await fetchParaRelatorio()
      if (rows.length === 0) {
        void rgAlert({
          title: 'Relatório',
          message: 'Nenhum colaborador encontrado com os filtros actuais.',
          variant: 'warning',
        })
        return
      }
      exportarCsvRhColaboradores(rows.map(rhColaboradorParaRelatorio))
    } catch (err) {
      void rgAlert({
        title: 'Relatório',
        message: err instanceof Error ? err.message : 'Não foi possível exportar o CSV.',
        variant: 'danger',
      })
    } finally {
      setGerandoRelatorio(false)
    }
  }

  return (
    <MainLayout>
      <div className="page-shell rh-dp">
        <nav className="rh-modulo__breadcrumb" aria-label="Navegação">
          <Link to={RH_HUB_PATH}>RH</Link>
          <span className="rh-modulo__breadcrumb-sep" aria-hidden>
            /
          </span>
          <span>Departamento Pessoal</span>
        </nav>

        <header className="rh-dp__hero">
          <div className="rh-dp__hero-icon">
            <RhModuloIcon slug="departamento-pessoal" />
          </div>
          <div className="rh-dp__hero-copy">
            <h1 className="rh-dp__title">Departamento Pessoal</h1>
            <p className="rh-dp__lead">
              Cadastro de colaboradores. Motoristas e acessos ao sistema mantêm-se em módulos separados,
              com vínculo opcional.
            </p>
          </div>
          <div className="rh-dp__hero-links">
            <Link to="/motoristas" className="rh-dp__link-externo">
              Motoristas
            </Link>
            <Link to="/usuarios" className="rh-dp__link-externo">
              Utilizadores
            </Link>
          </div>
        </header>

        {sucesso ? <div className="rh-dp__sucesso">{sucesso}</div> : null}
        {erroLista ? <div className="rh-dp__erro">{erroLista}</div> : null}

        <section className="rh-dp__toolbar">
          <input
            type="search"
            className="rh-dp__busca"
            placeholder="Buscar por nome, CPF, cargo, departamento…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar colaboradores"
          />
          <select
            className="rh-dp__select"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as 'todos' | RhColaboradorStatus)}
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
          <button type="button" style={btnPrimary} onClick={abrirNovo}>
            + Novo colaborador
          </button>
          <button
            type="button"
            className="rh-dp__btn-relatorio"
            disabled={gerandoRelatorio}
            onClick={() => void handleRelatorioPdf()}
            title="Exportar PDF"
          >
            <RgReportPdfIcon />
            PDF
          </button>
          <button
            type="button"
            style={btnGhost}
            disabled={gerandoRelatorio}
            onClick={() => void handleRelatorioCsv()}
          >
            CSV
          </button>
        </section>

        {mostrarCadastro ? (
          <section className="rh-dp__form-card">
            <h2>{editingId ? 'Editar colaborador' : 'Novo colaborador'}</h2>
            <form className="rh-dp__form" onSubmit={(e) => void handleSalvar(e)}>
              <div className="rh-dp__form-grid">
                <label>
                  Nome *
                  <input name="nome" value={form.nome} onChange={handleInputChange} required />
                </label>
                <label>
                  CPF
                  <input name="cpf" value={form.cpf} onChange={handleInputChange} inputMode="numeric" />
                </label>
                <label>
                  Data admissão
                  <input
                    type="date"
                    name="data_admissao"
                    value={form.data_admissao}
                    onChange={handleInputChange}
                  />
                </label>
                <label>
                  Status
                  <select name="status" value={form.status} onChange={handleInputChange}>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </label>
                <label>
                  Cargo / função
                  <input name="cargo_funcao" value={form.cargo_funcao} onChange={handleInputChange} />
                </label>
                <label>
                  Departamento
                  <input name="departamento" value={form.departamento} onChange={handleInputChange} />
                </label>
                <label>
                  E-mail
                  <input type="email" name="email" value={form.email} onChange={handleInputChange} />
                </label>
                <label>
                  Telefone
                  <input name="telefone" value={form.telefone} onChange={handleInputChange} />
                </label>
                <label className="rh-dp__form-span2">
                  Motorista vinculado (opcional)
                  <select name="motorista_id" value={form.motorista_id} onChange={handleInputChange}>
                    <option value="">— Nenhum —</option>
                    {motoristas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rh-dp__form-span2">
                  Observações
                  <textarea
                    name="observacoes"
                    rows={3}
                    value={form.observacoes}
                    onChange={handleInputChange}
                  />
                </label>
              </div>
              <div className="rh-dp__form-actions">
                <button type="submit" style={btnPrimary} disabled={salvando}>
                  {salvando ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Cadastrar'}
                </button>
                <button
                  type="button"
                  style={btnGhost}
                  onClick={() => {
                    limparFormulario()
                    setMostrarCadastro(false)
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rh-dp__table-wrap">
          <p className="rh-dp__kpi">
            {loading
              ? 'A carregar…'
              : `${totalCount ?? colaboradores.length} colaborador(es) · página ${page} de ${totalPaginas}`}
          </p>
          <div className="rh-dp__table-scroll">
            <table className="rh-dp__table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Admissão</th>
                  <th>Cargo</th>
                  <th>Departamento</th>
                  <th>Status</th>
                  <th>Motorista</th>
                  <th aria-label="Acções" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="rh-dp__empty">
                      A carregar colaboradores…
                    </td>
                  </tr>
                ) : colaboradores.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="rh-dp__empty">
                      Nenhum colaborador encontrado. Clique em «Novo colaborador» para começar.
                    </td>
                  </tr>
                ) : (
                  colaboradores.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.nome}</strong>
                        {c.email ? (
                          <span className="rh-dp__sub">{c.email}</span>
                        ) : null}
                      </td>
                      <td>{c.cpf ?? '—'}</td>
                      <td>{formatarDataRh(c.data_admissao)}</td>
                      <td>{c.cargo_funcao?.trim() || '—'}</td>
                      <td>{c.departamento?.trim() || '—'}</td>
                      <td>
                        <span
                          className={
                            c.status === 'Ativo' ? 'rh-dp__badge rh-dp__badge--on' : 'rh-dp__badge'
                          }
                        >
                          {c.status}
                        </span>
                      </td>
                      <td>{c.motoristas?.nome?.trim() || '—'}</td>
                      <td className="rh-dp__acoes">
                        <button type="button" onClick={() => abrirEdicao(c)}>
                          Editar
                        </button>
                        <button type="button" className="rh-dp__btn-del" onClick={() => void handleExcluir(c.id)}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rh-dp__paginacao">
            <label>
              Por página
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </button>
            <span>
              {page} / {totalPaginas}
            </span>
            <button
              type="button"
              disabled={page >= totalPaginas}
              onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
            >
              Seguinte
            </button>
          </div>
        </section>

        <Link to={RH_HUB_PATH} className="rh-modulo__back">
          ← Voltar ao RH
        </Link>
      </div>
    </MainLayout>
  )
}
