import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import { ClienteCadastroFormulario } from '../components/clientes/ClienteCadastroFormulario'
import { ClienteGerenciadorHistoricoMtr } from '../components/clientes/ClienteGerenciadorHistoricoMtr'
import {
  ClienteGerenciadorMtrTabela,
  linhaMtrGerenciadorVazia,
  type LinhaMtrGerenciador,
} from '../components/clientes/ClienteGerenciadorMtrTabela'
import { useClienteCadastroForm } from '../hooks/useClienteCadastroForm'
import { formClienteFromJson, nomeExibicaoGerenciador } from '../lib/clienteCadastroForm'
import { rgAlert, rgConfirm } from '../lib/RgDialogProvider'
import { supabase } from '../lib/supabase'
import { useUsuarioAcesso } from '../lib/useUsuarioAcesso'
import {
  usuarioPodeEditarCliente,
  usuarioPodeIncluirCliente,
} from '../lib/workflowPermissions'

type GerenciadorRow = {
  id: string
  nome_exibicao: string
  dados_cadastro: unknown
  created_at?: string
  updated_at?: string
}

type RepresentanteOpt = { id: string; nome: string }

const pageHeaderRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
}

const painelStyle: CSSProperties = {
  margin: 0,
  width: '100%',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
  overflow: 'hidden',
}

const registrosChipsWrap: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: '1px solid #f1f5f9',
}

function chipRegistroStyle(ativo: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: ativo ? '1px solid #86efac' : '1px solid #e2e8f0',
    background: ativo ? '#f0fdf4' : '#f8fafc',
    borderRadius: '999px',
    padding: '7px 12px 7px 14px',
    fontSize: '13px',
    fontWeight: ativo ? 800 : 600,
    color: '#0f172a',
    cursor: 'pointer',
    maxWidth: '100%',
  }
}

function linhasFromDb(
  rows: Array<{
    id: string
    mtr_baixada: string | null
    data: string | null
    gerador: string | null
    residuo: string | null
    quantidade: string | null
  }>
): LinhaMtrGerenciador[] {
  if (!rows.length) return [linhaMtrGerenciadorVazia()]
  return rows.map((r) => ({
    id: r.id,
    mtr_baixada: r.mtr_baixada ?? '',
    data: r.data ? String(r.data).slice(0, 10) : '',
    gerador: r.gerador ?? '',
    residuo: r.residuo ?? '',
    quantidade: r.quantidade ?? '',
  }))
}

function linhasParaPersistir(linhas: LinhaMtrGerenciador[]) {
  return linhas
    .map((l, ordem) => ({
      mtr_baixada: l.mtr_baixada.trim() || null,
      data: l.data.trim() || null,
      gerador: l.gerador.trim() || null,
      residuo: l.residuo.trim() || null,
      quantidade: l.quantidade.trim() || null,
      ordem,
    }))
    .filter(
      (l) => l.mtr_baixada || l.data || l.gerador || l.residuo || l.quantidade
    )
}

function scrollParaHistoricoMtr() {
  const el = document.getElementById('historico-mtr-baixadas')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

export default function ClientesGerenciador() {
  const [searchParams, setSearchParams] = useSearchParams()
  const acesso = useUsuarioAcesso()
  const podeIncluir = usuarioPodeIncluirCliente(acesso)
  const podeEditar = usuarioPodeEditarCliente(acesso)

  const cadastro = useClienteCadastroForm()
  const [lista, setLista] = useState<GerenciadorRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [linhasMtr, setLinhasMtr] = useState<LinhaMtrGerenciador[]>([linhaMtrGerenciadorVazia()])
  const [listaMtrRefreshKey, setListaMtrRefreshKey] = useState(0)
  const [representantesRg, setRepresentantesRg] = useState<RepresentanteOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erroTabela, setErroTabela] = useState<string | null>(null)

  const mostrarHistorico = searchParams.get('historico') === '1'
  const baixarMtrId = searchParams.get('baixarMtr')
  const baixarMtrNumero = searchParams.get('mtrNumero') ?? ''
  const historicoScrollFeito = useRef(false)

  useEffect(() => {
    if (!mostrarHistorico && !baixarMtrId) return
    if (historicoScrollFeito.current) return
    historicoScrollFeito.current = true
    const t = window.setTimeout(scrollParaHistoricoMtr, 120)
    return () => window.clearTimeout(t)
  }, [mostrarHistorico, baixarMtrId])

  function limparParamsBaixa() {
    const next = new URLSearchParams(searchParams)
    next.delete('baixarMtr')
    next.delete('mtrNumero')
    setSearchParams(next, { replace: true })
  }

  const carregarLista = useCallback(async () => {
    setLoading(true)
    setErroTabela(null)
    const { data, error } = await supabase
      .from('clientes_gerenciador')
      .select('id, nome_exibicao, dados_cadastro, created_at, updated_at')
      .order('nome_exibicao', { ascending: true })

    if (error) {
      if (
        error.message.includes('clientes_gerenciador') ||
        error.code === '42P01' ||
        error.code === 'PGRST205'
      ) {
        setErroTabela(
          'Tabela clientes_gerenciador ainda não existe no Supabase. Aplique a migration 20260525180000_clientes_gerenciador.sql.'
        )
      } else {
        setErroTabela(error.message)
      }
      setLista([])
      setLoading(false)
      return
    }
    setLista((data ?? []) as GerenciadorRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void carregarLista()
    void supabase
      .from('representantes_rg')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => {
        setRepresentantesRg(
          (data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome ?? r.id) }))
        )
      })
  }, [carregarLista])

  function novoCadastro() {
    if (!podeIncluir) {
      void rgAlert({
        title: 'Gerenciador',
        message: 'Seu perfil não pode incluir registros no Gerenciador.',
        variant: 'warning',
      })
      return
    }
    setEditingId(null)
    cadastro.resetForm()
    setLinhasMtr([linhaMtrGerenciadorVazia()])
  }

  async function abrirEdicao(row: GerenciadorRow) {
    if (!podeEditar) {
      void rgAlert({
        title: 'Gerenciador',
        message: 'Edição restrita à equipe Comercial ou Desenvolvedor.',
        variant: 'warning',
      })
      return
    }
    setEditingId(row.id)
    cadastro.loadForm(formClienteFromJson(row.dados_cadastro))

    const { data, error } = await supabase
      .from('clientes_gerenciador_mtr_linhas')
      .select('id, mtr_baixada, data, gerador, residuo, quantidade')
      .eq('gerenciador_id', row.id)
      .order('ordem', { ascending: true })

    if (error) {
      setLinhasMtr([linhaMtrGerenciadorVazia()])
      return
    }
    setLinhasMtr(linhasFromDb(data ?? []))
  }

  async function handleSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const podeSalvar = editingId ? podeEditar : podeIncluir
    if (!podeSalvar) {
      void rgAlert({ title: 'Gerenciador', message: 'Sem permissão para salvar.', variant: 'warning' })
      return
    }

    const nomeTrim = cadastro.form.nome.trim()
    const razaoTrim = cadastro.form.razao_social.trim()
    const cnpjTrim = cadastro.form.cnpj.trim()
    if (!nomeTrim && !razaoTrim && !cnpjTrim) {
      void rgAlert({
        title: 'Gerenciador',
        message:
          'Informe pelo menos um destes campos: Nome fantasia, Razão social ou CNPJ/CPF.',
        variant: 'warning',
      })
      return
    }

    setSalvando(true)
    const payload = {
      nome_exibicao: nomeExibicaoGerenciador(cadastro.form),
      dados_cadastro: cadastro.form,
      updated_at: new Date().toISOString(),
    }

    let gerenciadorId = editingId

    if (editingId) {
      const { error } = await supabase.from('clientes_gerenciador').update(payload).eq('id', editingId)
      if (error) {
        setSalvando(false)
        void rgAlert({ title: 'Erro ao salvar', message: error.message, variant: 'danger' })
        return
      }
    } else {
      const { data, error } = await supabase
        .from('clientes_gerenciador')
        .insert([payload])
        .select('id')
        .single()
      if (error || !data) {
        setSalvando(false)
        void rgAlert({
          title: 'Erro ao salvar',
          message: error?.message ?? 'Não foi possível criar o registro.',
          variant: 'danger',
        })
        return
      }
      gerenciadorId = String(data.id)
      setEditingId(gerenciadorId)
    }

    if (gerenciadorId) {
      await supabase.from('clientes_gerenciador_mtr_linhas').delete().eq('gerenciador_id', gerenciadorId)
      const linhas = linhasParaPersistir(linhasMtr)
      if (linhas.length > 0) {
        const { error: errLinhas } = await supabase.from('clientes_gerenciador_mtr_linhas').insert(
          linhas.map((l) => ({ ...l, gerenciador_id: gerenciadorId }))
        )
        if (errLinhas) {
          setSalvando(false)
          void rgAlert({ title: 'Erro nas linhas MTR', message: errLinhas.message, variant: 'danger' })
          return
        }
      }
    }

    setSalvando(false)
    void rgAlert({
      title: 'Gerenciador',
      message: editingId ? 'Registro atualizado.' : 'Registro criado.',
      variant: 'success',
    })
    await carregarLista()
  }

  async function handleExcluir(id: string) {
    if (!podeEditar) return
    if (
      !(await rgConfirm({
        title: 'Excluir Gerenciador',
        message: 'Remover este registro e todas as linhas de MTR vinculadas?',
        confirmLabel: 'Excluir',
        variant: 'danger',
      }))
    ) {
      return
    }
    const { error } = await supabase.from('clientes_gerenciador').delete().eq('id', id)
    if (error) {
      void rgAlert({ title: 'Erro', message: error.message, variant: 'danger' })
      return
    }
    if (editingId === id) {
      setEditingId(null)
      cadastro.resetForm()
      setLinhasMtr([linhaMtrGerenciadorVazia()])
    }
    await carregarLista()
  }

  const tituloFormulario = editingId ? 'Editar gerenciador' : 'Novo gerenciador'

  return (
    <MainLayout>
      <div
        className="rg-page"
        style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 0 }}
      >
        <div style={pageHeaderRow}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: '26px',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              Gerenciador
            </h1>
            <p className="page-header__lead" style={{ margin: '6px 0 0' }}>
              Cadastro com os mesmos campos de Clientes. Preencha os dados e registre as MTRs
              baixadas na tabela ao final do formulário.
            </p>
          </div>
          <div style={{ flexShrink: 0, alignSelf: 'flex-start' }}>
            <button type="button" className="rg-btn rg-btn--primary" onClick={novoCadastro}>
              Novo gerenciador
            </button>
          </div>
        </div>

        {erroTabela ? <div className="alert-box alert-warning">{erroTabela}</div> : null}

        {(mostrarHistorico || baixarMtrId) ? (
          <div className="panel" style={painelStyle}>
            <div className="panel-header">
              <h2 style={{ margin: 0, fontSize: '16px' }}>Histórico de MTRs baixadas</h2>
            </div>
            <div className="panel-body" style={{ padding: '16px 18px' }}>
              <ClienteGerenciadorHistoricoMtr
                baixarMtrId={baixarMtrId}
                baixarMtrNumero={baixarMtrNumero}
                onBaixaConcluida={() => {
                  setListaMtrRefreshKey((k) => k + 1)
                  limparParamsBaixa()
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="panel" style={painelStyle}>
          <div className="panel-header" style={{ padding: '16px 20px 14px' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{tituloFormulario}</h2>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                  Campos iguais ao cadastro de Clientes · MTRs baixadas no final do formulário
                </p>
              </div>
              {!loading && lista.length > 0 ? (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    flexShrink: 0,
                  }}
                >
                  {lista.length} {lista.length === 1 ? 'registro salvo' : 'registros salvos'}
                </span>
              ) : null}
            </div>

            {loading ? (
              <p style={{ ...registrosChipsWrap, marginTop: '12px', borderTop: 'none', paddingTop: 0, fontSize: '13px', color: '#64748b' }}>
                Carregando registros…
              </p>
            ) : lista.length > 0 ? (
              <div style={registrosChipsWrap}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>
                  Abrir:
                </span>
                {lista.map((g) => (
                  <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <button
                      type="button"
                      onClick={() => void abrirEdicao(g)}
                      style={chipRegistroStyle(editingId === g.id)}
                      title={g.nome_exibicao || 'Registro'}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 'min(320px, 42vw)',
                        }}
                      >
                        {g.nome_exibicao || '—'}
                      </span>
                    </button>
                    {podeEditar ? (
                      <button
                        type="button"
                        className="mini-btn mini-btn-danger"
                        onClick={() => void handleExcluir(g.id)}
                        title="Excluir"
                        style={{ marginLeft: '-4px' }}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : (
              <p
                style={{
                  margin: '12px 0 0',
                  fontSize: '13px',
                  color: '#64748b',
                  lineHeight: 1.45,
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                Nenhum registro salvo ainda — use <strong>Novo gerenciador</strong> e salve para listar aqui.
              </p>
            )}
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            <ClienteCadastroFormulario
              {...cadastro}
              gridFluido
              representantesRg={representantesRg}
                submitLabel={editingId ? 'Salvar alterações' : 'Salvar gerenciador'}
                salvando={salvando}
                onSubmit={(e) => void handleSalvar(e)}
                onCancelar={() => {
                  setEditingId(null)
                  cadastro.resetForm()
                  setLinhasMtr([linhaMtrGerenciadorVazia()])
                }}
                antesDosBotoes={
                  <div
                    style={{
                      padding: '8px 0 4px',
                      borderTop: '1px solid #e2e8f0',
                      marginTop: '4px',
                    }}
                  >
                    <ClienteGerenciadorMtrTabela
                      linhas={linhasMtr}
                      onChange={setLinhasMtr}
                      listaRefreshKey={listaMtrRefreshKey}
                    />
                  </div>
                }
            />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
