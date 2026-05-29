import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Suspense, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { NEXUS_CARGOS_POR_ROTA } from './lib/nexusCargosPorRota'
import { usuarioPodeAcessarRota, usuarioTemExcecaoCadastroCliente } from './lib/paginasSistema'
import { carregarPerfilUsuario } from './lib/carregarPerfilUsuario'
import { cargoTemAutoridadeMaximaSistema } from './lib/workflowPermissions'
import { ChatFloatProvider } from './contexts/ChatFloatContext'
import { PerfilUsuarioProvider, type UsuarioPerfilApp } from './contexts/PerfilUsuarioContext'
import { PresencaAoVivoProvider } from './contexts/PresencaAoVivoContext'
import { RgDialogProvider } from './lib/RgDialogProvider'
import { PwaPremiumShell } from './components/pwa/PwaPremiumShell'

import Login from './pages/Login'
import { lazyWithRetry } from './lib/lazyWithRetry'

const BemVindoNexus = lazyWithRetry(() => import('./pages/BemVindoNexus'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const Clientes = lazyWithRetry(() => import('./pages/Clientes'))
const ClientesGerenciador = lazyWithRetry(() => import('./pages/ClientesGerenciador'))
const PosVenda = lazyWithRetry(() => import('./pages/PosVenda'))
const Motoristas = lazyWithRetry(() => import('./pages/Motoristas'))
const RepresentantesRG = lazyWithRetry(() => import('./pages/RepresentantesRG'))
const Caminhoes = lazyWithRetry(() => import('./pages/Caminhoes'))
const Financeiro = lazyWithRetry(() => import('./pages/Financeiro'))
const FinanceiroContasReceber = lazyWithRetry(() => import('./pages/FinanceiroContasReceber'))
const FinanceiroContasPagar = lazyWithRetry(() => import('./pages/FinanceiroContasPagar'))
const EnvioNF = lazyWithRetry(() => import('./pages/EnvioNF'))
const Usuarios = lazyWithRetry(() => import('./pages/Usuarios'))
const ChecklistTransporte = lazyWithRetry(() => import('./pages/ChecklistTransporte'))
const ConferenciaTransporte = lazyWithRetry(() => import('./pages/ConferenciaTransporte'))
const TicketOperacional = lazyWithRetry(() => import('./pages/TicketOperacional'))
const FaturamentoOperacional = lazyWithRetry(() => import('./pages/FaturamentoOperacional'))
const FaturamentoClinicas = lazyWithRetry(() => import('./pages/FaturamentoClinicas'))
const Clinicas = lazyWithRetry(() => import('./pages/Clinicas'))

/** Etapa antiga «Aprovação Diretoria» — conferência do ticket passou para Faturamento. */
function RedirectAprovacaoParaFaturamento() {
  const { search } = useLocation()
  return <Navigate to={`/faturamento${search}`} replace />
}
const Programacao = lazyWithRetry(() => import('./pages/Programacao'))
const MTR = lazyWithRetry(() => import('./pages/MTR'))
const MtrGerenciador = lazyWithRetry(() => import('./pages/MtrGerenciador'))
const ControleMassa = lazyWithRetry(() => import('./pages/ControleMassa'))
const ComprovantesDescarte = lazyWithRetry(() => import('./pages/ComprovantesDescarte'))
const ComprovanteDescarteForm = lazyWithRetry(() => import('./pages/ComprovanteDescarteForm'))
const Chat = lazyWithRetry(() => import('./pages/Chat'))

const routeSuspenseFallback = (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f1f5f9',
      color: '#334155',
      fontSize: '18px',
      fontWeight: 600,
    }}
  >
    Carregando página...
  </div>
)

async function sairDoSistema() {
  await supabase.auth.signOut()
  window.location.href = '/'
}

function TelaErroAcesso({
  titulo,
  mensagem,
}: {
  titulo: string
  mensagem: string
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f1f5f9',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          background: '#fff',
          border: '1px solid #fecaca',
          borderRadius: 12,
          padding: 20,
          color: '#334155',
        }}
      >
        <p style={{ margin: '0 0 12px', fontWeight: 700, color: '#991b1b' }}>{titulo}</p>
        <p style={{ margin: '0 0 16px', fontSize: 15 }}>{mensagem}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#0f766e',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => void sairDoSistema()}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sair e voltar ao login
          </button>
        </div>
      </div>
    </div>
  )
}

type ProtectedRouteProps = {
  session: Session | null
  usuario: UsuarioPerfilApp | null
  carregandoUsuario: boolean
  erroPerfil: string
  allowedRoles: string[]
  /** Só sessão + perfil ativo; não valida cargo (página inicial Nexus para todos). */
  apenasAutenticado?: boolean
  children: React.ReactNode
}

function ProtectedRoute({
  session,
  usuario,
  carregandoUsuario,
  erroPerfil,
  allowedRoles,
  apenasAutenticado,
  children,
}: ProtectedRouteProps) {
  const location = useLocation()

  if (!session) {
    return <Navigate to="/" replace />
  }

  if (carregandoUsuario) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          color: '#334155',
          fontSize: '18px',
          fontWeight: 600,
        }}
      >
        Carregando permissões...
      </div>
    )
  }

  if (!usuario) {
    return (
      <TelaErroAcesso
        titulo="Não foi possível carregar as permissões"
        mensagem={
          erroPerfil.trim() ||
          'Sessão ativa, mas o perfil não foi lido. Verifique a ligação ao Supabase ou peça acesso em «usuarios».'
        }
      />
    )
  }

  if (usuario.status !== 'ativo') {
    return (
      <TelaErroAcesso
        titulo="Conta inativa"
        mensagem="O seu utilizador não está com status «ativo». Contacte um administrador do sistema."
      />
    )
  }

  if (
    !apenasAutenticado &&
    !allowedRoles.includes(usuario.cargo) &&
    !cargoTemAutoridadeMaximaSistema(usuario.cargo, usuario.nome, usuario.email) &&
    !usuarioTemExcecaoCadastroCliente(usuario, location.pathname)
  ) {
    return <Navigate to="/bem-vindo" replace />
  }

  if (!usuarioPodeAcessarRota(usuario, location.pathname)) {
    return <Navigate to="/bem-vindo" replace />
  }

  return <>{children}</>
}

/** Links antigos /coletas?… passam a abrir o hub operacional (Controle de Massa). */
function RedirectColetasParaControleMassa() {
  const { search, hash } = useLocation()
  return <Navigate to={`/controle-massa${search}${hash}`} replace />
}

/** A página «Conferência» operacional foi integrada ao fluxo via Controle de Massa / outras etapas. */
function RedirectConferenciaOperacionalParaControleMassa() {
  const { search } = useLocation()
  return <Navigate to={`/controle-massa${search}`} replace />
}

const PERFIL_CARGA_TIMEOUT_MS = 20_000

function withTimeout<T>(promise: Promise<T>, ms: number, rotulo: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Tempo esgotado ao ${rotulo} (${Math.round(ms / 1000)}s).`))
    }, ms)
    promise
      .then((v) => {
        window.clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        window.clearTimeout(timer)
        reject(e)
      })
  })
}

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [usuario, setUsuario] = useState<UsuarioPerfilApp | null>(null)
  const [carregandoUsuario, setCarregandoUsuario] = useState(true)
  const [erroPerfil, setErroPerfil] = useState('')
  const [avisoPerfil, setAvisoPerfil] = useState('')

  /** Perfil já exibido — evita overlay em refresh de token (não dispara nova carga). */
  const perfilJaExibidoParaUserIdRef = useRef<string | null>(null)

  const sessionUserId = session?.user?.id?.trim() || null

  useEffect(() => {
    let cancelado = false

    async function carregarSessao() {
      try {
        const sessaoAtual = await withTimeout(
          (async () => {
            const { data, error } = await supabase.auth.getSession()
            if (error) throw error
            return data.session
          })(),
          PERFIL_CARGA_TIMEOUT_MS,
          'iniciar sessão'
        )
        if (!cancelado) setSession(sessaoAtual)
      } catch (e) {
        console.error('Falha ao ler sessão:', e)
        if (!cancelado) setSession(null)
      }
    }

    void carregarSessao()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, sessionAtual) => {
      // Refresh de token não deve cancelar a carga do perfil nem remontar a UI.
      if (event === 'TOKEN_REFRESHED') return
      if (!cancelado) setSession(sessionAtual)
    })

    return () => {
      cancelado = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelado = false

    async function carregarUsuario() {
      if (!sessionUserId) {
        if (!cancelado) {
          perfilJaExibidoParaUserIdRef.current = null
          setErroPerfil('')
          setAvisoPerfil('')
          setUsuario(null)
          setCarregandoUsuario(false)
        }
        return
      }

      const atualizacaoSilenciosa = perfilJaExibidoParaUserIdRef.current === sessionUserId

      if (!cancelado && !atualizacaoSilenciosa) {
        setCarregandoUsuario(true)
        setErroPerfil('')
        setAvisoPerfil('')
      }

      try {
        const resultado = await carregarPerfilUsuario(supabase, sessionUserId, session)

        if (cancelado) return

        if (resultado.usuario) {
          setUsuario(resultado.usuario)
          perfilJaExibidoParaUserIdRef.current = sessionUserId
          setErroPerfil('')
          setAvisoPerfil(
            resultado.modo === 'sessao'
              ? 'Perfil carregado em modo reduzido (ligação lenta ao Supabase). Execute sql_editor_usuarios_perfil_login.sql no projeto se o menu estiver incompleto.'
              : ''
          )
        } else {
          perfilJaExibidoParaUserIdRef.current = null
          setUsuario(null)
          setAvisoPerfil('')
          setErroPerfil(resultado.erro || 'Não foi possível carregar o perfil.')
        }
      } catch (e) {
        if (cancelado) return
        const msg = e instanceof Error ? e.message : String(e)
        console.error('Falha ao carregar perfil:', msg)
        perfilJaExibidoParaUserIdRef.current = null
        setUsuario(null)
        setAvisoPerfil('')
        setErroPerfil(msg)
      } finally {
        if (!cancelado) {
          setCarregandoUsuario(false)
        }
      }
    }

    void carregarUsuario()

    return () => {
      cancelado = true
    }
    // session omitido de propósito: só reage a sessionUserId para não recarregar perfil a cada refresh do token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId])

  if (session === undefined) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          color: '#334155',
          fontSize: '18px',
          fontWeight: 600,
        }}
      >
        Carregando sistema...
      </div>
    )
  }

  return (
    <PerfilUsuarioProvider value={{ usuario, carregandoUsuario }}>
      <RgDialogProvider>
      <BrowserRouter>
        <PwaPremiumShell />
        {avisoPerfil.trim() ? (
          <div
            role="status"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: '#fef3c7',
              color: '#92400e',
              padding: '10px 16px',
              fontSize: 14,
              textAlign: 'center',
              borderBottom: '1px solid #fcd34d',
            }}
          >
            {avisoPerfil}
          </div>
        ) : null}
        <ChatFloatProvider>
          <PresencaAoVivoProvider>
            <Suspense fallback={routeSuspenseFallback}>
              <Routes>
        {!session ? (
          <>
            <Route path="/" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/bem-vindo" replace />} />

            <Route
              path="/bem-vindo"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[]}
                  apenasAutenticado
                >
                  <BemVindoNexus />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/dashboard']]}
                >
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/clientes"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/clientes']]}
                >
                  <Clientes />
                </ProtectedRoute>
              }
            />

            <Route
              path="/clientes/gerenciador"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/clientes/gerenciador']]}
                >
                  <ClientesGerenciador />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pos-venda"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/pos-venda']]}
                >
                  <PosVenda />
                </ProtectedRoute>
              }
            />

            <Route
              path="/motoristas"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/motoristas']]}
                >
                  <Motoristas />
                </ProtectedRoute>
              }
            />

            <Route
              path="/representantes-rg"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/representantes-rg']]}
                >
                  <RepresentantesRG />
                </ProtectedRoute>
              }
            />

            <Route
              path="/caminhoes"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/caminhoes']]}
                >
                  <Caminhoes />
                </ProtectedRoute>
              }
            />

            <Route
              path="/programacao"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/programacao']]}
                >
                  <Programacao />
                </ProtectedRoute>
              }
            />

            <Route
              path="/coletas"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/controle-massa']]}
                >
                  <RedirectColetasParaControleMassa />
                </ProtectedRoute>
              }
            />

            <Route
              path="/mtr/gerenciador"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/mtr/gerenciador']]}
                >
                  <MtrGerenciador />
                </ProtectedRoute>
              }
            />

            <Route
              path="/mtr"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/mtr']]}
                >
                  <MTR />
                </ProtectedRoute>
              }
            />

            <Route
              path="/mtr/:coletaId"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/mtr']]}
                >
                  <MTR />
                </ProtectedRoute>
              }
            />

            <Route
              path="/controle-massa"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/controle-massa']]}
                >
                  <ControleMassa />
                </ProtectedRoute>
              }
            />

            <Route
              path="/controle-massa/:coletaId"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/controle-massa']]}
                >
                  <ControleMassa />
                </ProtectedRoute>
              }
            />

            <Route
              path="/comprovantes-descarte"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/comprovantes-descarte']]}
                >
                  <ComprovantesDescarte />
                </ProtectedRoute>
              }
            />

            <Route
              path="/comprovantes-descarte/novo"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/comprovantes-descarte']]}
                >
                  <ComprovanteDescarteForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/comprovantes-descarte/:id/editar"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/comprovantes-descarte']]}
                >
                  <ComprovanteDescarteForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/comprovantes-descarte/:id"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/comprovantes-descarte']]}
                >
                  <ComprovanteDescarteForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/checklist-transporte"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/checklist-transporte']]}
                >
                  <ChecklistTransporte />
                </ProtectedRoute>
              }
            />

            <Route
              path="/conferencia-transporte"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/conferencia-transporte']]}
                >
                  <ConferenciaTransporte />
                </ProtectedRoute>
              }
            />

            <Route
              path="/conferencia-operacional"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/controle-massa']]}
                >
                  <RedirectConferenciaOperacionalParaControleMassa />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ticket-operacional"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/ticket-operacional']]}
                >
                  <TicketOperacional />
                </ProtectedRoute>
              }
            />

            <Route
              path="/aprovacao"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/faturamento']]}
                >
                  <RedirectAprovacaoParaFaturamento />
                </ProtectedRoute>
              }
            />

            <Route
              path="/clinicas"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/clinicas']]}
                >
                  <Clinicas />
                </ProtectedRoute>
              }
            />

            <Route
              path="/faturamento"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/faturamento']]}
                >
                  <FaturamentoOperacional />
                </ProtectedRoute>
              }
            />

            <Route
              path="/faturamento-clinicas"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/faturamento-clinicas']]}
                >
                  <FaturamentoClinicas />
                </ProtectedRoute>
              }
            />

            <Route
              path="/faturamento/regras-preco"
              element={<Navigate to="/faturamento" replace />}
            />

            <Route
              path="/financeiro"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/financeiro']]}
                >
                  <Financeiro />
                </ProtectedRoute>
              }
            />

            <Route
              path="/financeiro/contas-receber"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/financeiro/contas-receber']]}
                >
                  <FinanceiroContasReceber />
                </ProtectedRoute>
              }
            />

            <Route
              path="/financeiro/contas-pagar"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/financeiro/contas-pagar']]}
                >
                  <FinanceiroContasPagar />
                </ProtectedRoute>
              }
            />

            <Route
              path="/envio-nf"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/envio-nf']]}
                >
                  <EnvioNF />
                </ProtectedRoute>
              }
            />

            <Route
              path="/usuarios"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/usuarios']]}
                >
                  <Usuarios />
                </ProtectedRoute>
              }
            />

            <Route
              path="/chat"
              element={
                <ProtectedRoute
                  session={session}
                  usuario={usuario}
                  carregandoUsuario={carregandoUsuario}
                  erroPerfil={erroPerfil}
                  allowedRoles={[...NEXUS_CARGOS_POR_ROTA['/chat']]}
                >
                  <Chat />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/bem-vindo" replace />} />
          </>
        )}
              </Routes>
            </Suspense>
          </PresencaAoVivoProvider>
        </ChatFloatProvider>
    </BrowserRouter>
      </RgDialogProvider>
    </PerfilUsuarioProvider>
  )
}

export default App