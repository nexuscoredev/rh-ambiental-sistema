import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { avisoSenhaDeveFicarOculto, registrarSenhaPessoalConfigurada } from '../../lib/bemVindoAvisoSenha'
import { abrirSolicitacaoAjusteSistema } from '../../lib/solicitacaoAjusteUi'
import { supabase } from '../../lib/supabase'
import { temAutoridadeMaximaSistema } from '../../lib/workflowPermissions'
import { useUsuarioAcesso } from '../../lib/useUsuarioAcesso'

type Props = {
  nome: string
  email?: string | null
}

function textoChamadoReset(nome: string, email?: string | null): string {
  const base = 'Olá! Solicito o reset da minha senha de acesso ao sistema.'
  const linhas = [base, '', `Nome: ${nome.trim() || '—'}`]
  const em = email?.trim()
  if (em) linhas.push(`E-mail de login: ${em}`)
  return linhas.join('\n')
}

function IconeUtilizador() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.5c.9-2.8 3.1-4.5 6.5-4.5s5.6 1.7 6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconeChamado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5h16M4 12h10M4 17.5h7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M17 11.5 20 14.5 17 17.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Aviso na boas-vindas — senha pessoal e chamado de reset. */
export function BemVindoAlertaSenhaPessoal({ nome, email }: Props) {
  const acesso = useUsuarioAcesso()
  const nomeLimpo = nome.trim() || 'Utilizador'
  const [userId, setUserId] = useState<string | null>(null)
  const [oculto, setOculto] = useState(true)
  const [feedbackChamado, setFeedbackChamado] = useState('')

  const ehAutoridadeMaxima = temAutoridadeMaximaSistema(acesso.cargo, acesso.nome, acesso.email)

  useEffect(() => {
    let ativo = true
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!ativo) return
      const id = user?.id ?? null
      setUserId(id)
      if (!id) {
        setOculto(false)
        return
      }
      const escondido = await avisoSenhaDeveFicarOculto(id)
      if (!ativo) return
      setOculto(escondido)
    })()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!feedbackChamado) return
    const t = window.setTimeout(() => setFeedbackChamado(''), 4000)
    return () => window.clearTimeout(t)
  }, [feedbackChamado])

  if (ehAutoridadeMaxima || oculto) return null

  function abrirChamadoReset() {
    abrirSolicitacaoAjusteSistema({ textoInicial: textoChamadoReset(nomeLimpo, email) })
    setFeedbackChamado('Formulário aberto no menu lateral (canto inferior esquerdo).')
  }

  async function dispensarAviso() {
    if (userId) await registrarSenhaPessoalConfigurada(userId)
    setOculto(true)
  }

  return (
    <aside
      className="welcome-nexus__senha-card"
      role="region"
      aria-labelledby="welcome-senha-card-titulo"
    >
      <div className="welcome-nexus__senha-card-bar" aria-hidden />

      <header className="welcome-nexus__senha-card-head">
        <div className="welcome-nexus__senha-card-head-row">
          <div className="welcome-nexus__senha-card-head-copy">
            <p id="welcome-senha-card-titulo" className="welcome-nexus__senha-card-greeting">
              Olá, <span className="welcome-nexus__senha-card-name">{nomeLimpo}</span>!
            </p>
            <p className="welcome-nexus__senha-card-lead">
              Configure sua senha de acesso ou peça reset pela equipe nos passos abaixo.
            </p>
          </div>
          <button
            type="button"
            className="welcome-nexus__senha-card-dismiss"
            onClick={() => void dispensarAviso()}
            title="Não mostrar este aviso novamente"
          >
            Já configurei
          </button>
        </div>
      </header>

      <ol className="welcome-nexus__senha-steps" aria-label="Passos para senha e suporte">
        <li className="welcome-nexus__senha-step">
          <div className="welcome-nexus__senha-step-top">
            <span className="welcome-nexus__senha-step-num" aria-hidden>
              1
            </span>
            <span className="welcome-nexus__senha-step-icon" aria-hidden>
              <IconeUtilizador />
            </span>
            <h3 className="welcome-nexus__senha-step-title">Definir senha</h3>
          </div>
          <p className="welcome-nexus__senha-step-desc">
            No canto superior direito, abra <strong>Minha conta</strong> e cadastre sua senha pessoal.
          </p>
          <Link to="/minha-conta" className="welcome-nexus__senha-step-cta welcome-nexus__senha-step-cta--primario">
            Ir para Minha conta
          </Link>
        </li>
        <li className="welcome-nexus__senha-step">
          <div className="welcome-nexus__senha-step-top">
            <span className="welcome-nexus__senha-step-num" aria-hidden>
              2
            </span>
            <span className="welcome-nexus__senha-step-icon welcome-nexus__senha-step-icon--muted" aria-hidden>
              <IconeChamado />
            </span>
            <h3 className="welcome-nexus__senha-step-title">Pedir reset</h3>
          </div>
          <p className="welcome-nexus__senha-step-desc">
            No canto inferior esquerdo, abra um chamado e solicite a redefinição da senha.
          </p>
          <button
            type="button"
            className="welcome-nexus__senha-step-cta"
            onClick={abrirChamadoReset}
          >
            Solicitar ajuste no sistema
          </button>
        </li>
      </ol>

      {feedbackChamado ? (
        <p className="welcome-nexus__senha-feedback" role="status">
          {feedbackChamado}
        </p>
      ) : null}
    </aside>
  )
}
