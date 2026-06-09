import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NovidadesSistemaModal } from '../components/bemVindo/NovidadesSistemaModal'
import MainLayout from '../layouts/MainLayout'
import { supabase } from '../lib/supabase'
import { primeiraRotaOperacionalPermitida, type UsuarioComPaginas } from '../lib/paginasSistema'
import { BRAND_WELCOME_LOGO } from '../lib/brandLogo'
import { useVersaoRgExibir } from '../lib/appDisplayVersion'

type PerfilBemVindo = UsuarioComPaginas & { nome?: string | null }

export default function BemVindoNexus() {
  const [perfil, setPerfil] = useState<PerfilBemVindo | null>(null)
  const [logoSrc, setLogoSrc] = useState(BRAND_WELCOME_LOGO)
  const [novidadesAbertas, setNovidadesAbertas] = useState(false)
  const versaoExibir = useVersaoRgExibir()

  useEffect(() => {
    let cancel = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancel) return
      const { data } = await supabase
        .from('usuarios')
        .select('nome, email, paginas_permitidas')
        .eq('id', user.id)
        .maybeSingle()
      if (!cancel) setPerfil((data as PerfilBemVindo) || { email: user.email })
    })()
    return () => {
      cancel = true
    }
  }, [])

  const proximaRota = useMemo(() => {
    if (!perfil) return null
    const p = primeiraRotaOperacionalPermitida(perfil)
    if (!p || p === '/dashboard') return null
    return p
  }, [perfil])

  const nomeExibir = (perfil?.nome || perfil?.email?.split('@')[0] || 'Utilizador').trim() || 'Utilizador'

  return (
    <MainLayout>
      <div className="welcome-nexus">
        <div className="welcome-nexus__stripes" aria-hidden>
          <svg viewBox="0 0 90 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <g>
              <path
                fill="#6ec4b8"
                d="M90,0 L35,0 C55,120 15,200 45,400 C75,600 20,680 40,800 L90,800 Z"
              />
              <path
                fill="#d4ea6e"
                d="M90,0 L48,0 C65,100 35,180 55,400 C75,620 42,700 52,800 L90,800 Z"
              />
              <path
                fill="#e8f8f0"
                d="M90,0 L62,0 C72,90 52,200 68,400 C84,580 58,700 66,800 L90,800 Z"
              />
            </g>
          </svg>
        </div>
        <div className="welcome-nexus__glow" aria-hidden />
        <div className="welcome-nexus__grid" aria-hidden />

        <div className="welcome-nexus__inner">
          <div className="welcome-nexus__hero">
            <div className="welcome-nexus__logo-stack">
              <img
                className="welcome-nexus__logo-rg welcome-nexus__logo-rg--hero"
                src={logoSrc}
                alt="RG Ambiental"
                width={1024}
                height={152}
                decoding="async"
                fetchPriority="high"
                onError={() => setLogoSrc(BRAND_WELCOME_LOGO)}
              />
            </div>
          </div>

          <h1 className="welcome-nexus__title">
            <span className="welcome-nexus__title-welcome">Bem-vindo</span>,{' '}
            <span className="welcome-nexus__title-name">{nomeExibir}</span>
          </h1>
          <p className="welcome-nexus__lead">
            Centralização de dados, padronização do fluxo e automação de processos.
          </p>

          <div className="welcome-nexus__rule" aria-hidden />

          <div className="welcome-nexus__actions welcome-nexus__actions--center">
            <button
              type="button"
              className="welcome-nexus__btn welcome-nexus__btn--primary"
              onClick={() => setNovidadesAbertas(true)}
            >
              Confira as novidades!
            </button>
            {proximaRota ? (
              <Link className="welcome-nexus__btn welcome-nexus__btn--secondary" to={proximaRota}>
                Ir às minhas áreas
              </Link>
            ) : null}
            {!proximaRota ? (
              <span className="welcome-nexus__hint">
                Utilize o menu lateral para navegar nas áreas disponíveis para o seu perfil.
              </span>
            ) : null}
          </div>

          <NovidadesSistemaModal
            open={novidadesAbertas}
            onClose={() => setNovidadesAbertas(false)}
          />

          <p className="welcome-nexus__version" role="status">
            Versão do sistema: <strong>{versaoExibir}</strong>
          </p>

          <div className="welcome-nexus__nexus-footer">
            <div className="welcome-nexus__by-nexus">
              <span className="welcome-nexus__by-tiny">BY</span>
              <span className="welcome-nexus__nexus-name">NEXUS</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
