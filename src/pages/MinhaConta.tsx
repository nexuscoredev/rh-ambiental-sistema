import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChatAvatar } from '../components/chat/ChatAvatar'
import { TemaToggle } from '../components/layout/TemaToggle'
import { usePerfilUsuario } from '../contexts/PerfilUsuarioContext'
import { useTemaAplicacao } from '../lib/TemaAplicacaoProvider'
import MainLayout from '../layouts/MainLayout'
import { alterarSenhaPropria, SENHA_MINIMA_CARACTERES } from '../lib/alterarSenhaPropria'
import {
  EVENTO_FOTO_PERFIL_ATUALIZADA,
  uploadFotoPerfilUsuario,
  type FotoPerfilAtualizadaDetail,
} from '../lib/fotoPerfilUsuario'
import { supabase } from '../lib/supabase'

export default function MinhaConta() {
  const { usuario } = usePerfilUsuario()
  const { tema } = useTemaAplicacao()
  const [fotoUrl, setFotoUrl] = useState<string | null>(usuario?.foto_url ?? null)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [erroFoto, setErroFoto] = useState('')
  const [sucessoFoto, setSucessoFoto] = useState('')
  const inputFotoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFotoUrl(usuario?.foto_url ?? null)
  }, [usuario?.foto_url])

  useEffect(() => {
    const onAtualizada = (ev: Event) => {
      const url = (ev as CustomEvent<FotoPerfilAtualizadaDetail>).detail?.foto_url
      if (url) setFotoUrl(url)
    }
    window.addEventListener(EVENTO_FOTO_PERFIL_ATUALIZADA, onAtualizada)
    return () => window.removeEventListener(EVENTO_FOTO_PERFIL_ATUALIZADA, onAtualizada)
  }, [])

  async function handleEscolherFoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setErroFoto('')
    setSucessoFoto('')

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setEnviandoFoto(true)
    try {
      const resultado = await uploadFotoPerfilUsuario(supabase, file, user.id)
      if (!resultado.ok) {
        setErroFoto(resultado.mensagem)
        return
      }
      setFotoUrl(resultado.publicUrl)
      setSucessoFoto('Foto de perfil atualizada. Também aparece no canto superior direito.')
    } finally {
      setEnviandoFoto(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setCarregando(true)

    try {
      const resultado = await alterarSenhaPropria(supabase, {
        senhaAtual,
        senhaNova,
        confirmacao,
      })

      if (!resultado.ok) {
        setErro(resultado.mensagem)
        return
      }

      setSenhaAtual('')
      setSenhaNova('')
      setConfirmacao('')
      setSucesso('Senha alterada com sucesso. Use a nova senha no próximo login.')
    } finally {
      setCarregando(false)
    }
  }

  const nomeExibir = usuario?.nome?.trim() || usuario?.email || 'Utilizador'

  return (
    <MainLayout>
      <div className="minha-conta">
        <header className="minha-conta__header">
          <p className="page-header__eyebrow">Conta</p>
          <h2 className="page-header__title">Minha conta</h2>
          <p className="page-header__lead">
            Altere aqui a sua foto de perfil e a senha de acesso. Para nome, cargo e páginas
            permitidas, contacte um administrador.
          </p>
        </header>

        <div className="minha-conta__grid">
          <section
            className="minha-conta__card minha-conta__card--foto"
            aria-labelledby="minha-conta-foto"
          >
            <h3 id="minha-conta-foto" className="minha-conta__card-title">
              Foto de perfil
            </h3>
            <p className="minha-conta__card-lead">
              A mesma foto é usada no cabeçalho, no chat interno e nas listas de equipa. Formatos:
              JPEG, PNG, WebP ou GIF (máx. 5 MB).
            </p>

            <div className="minha-conta__foto-row">
              <ChatAvatar nome={nomeExibir} fotoUrl={fotoUrl} size={88} className="minha-conta__foto-avatar" />
              <div className="minha-conta__foto-acoes">
                <input
                  ref={inputFotoRef}
                  type="file"
                  className="minha-conta__foto-input"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => void handleEscolherFoto(e)}
                />
                <button
                  type="button"
                  className="minha-conta__submit minha-conta__submit--foto"
                  disabled={enviandoFoto}
                  onClick={() => inputFotoRef.current?.click()}
                >
                  {enviandoFoto ? 'A enviar…' : 'Escolher nova foto'}
                </button>
                <p className="minha-conta__foto-dica">
                  Também pode clicar na sua foto no canto superior direito do sistema.
                </p>
              </div>
            </div>

            {erroFoto ? (
              <p className="minha-conta__alert minha-conta__alert--erro" role="alert">
                {erroFoto}
              </p>
            ) : null}
            {sucessoFoto ? (
              <p className="minha-conta__alert minha-conta__alert--ok" role="status">
                {sucessoFoto}
              </p>
            ) : null}
          </section>

          <section className="minha-conta__card" aria-labelledby="minha-conta-alterar-senha">
            <h3 id="minha-conta-alterar-senha" className="minha-conta__card-title">
              Alterar senha
            </h3>
            <p className="minha-conta__card-lead">
              É necessário confirmar a senha atual. A nova senha deve ter pelo menos{' '}
              {SENHA_MINIMA_CARACTERES} caracteres.
            </p>

            <form className="minha-conta__form" onSubmit={handleSubmit}>
              <label className="minha-conta__field">
                <span className="minha-conta__label">Senha atual</span>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>

              <label className="minha-conta__field">
                <span className="minha-conta__label">Nova senha</span>
                <input
                  type="password"
                  value={senhaNova}
                  onChange={(e) => setSenhaNova(e.target.value)}
                  autoComplete="new-password"
                  minLength={SENHA_MINIMA_CARACTERES}
                  required
                />
              </label>

              <label className="minha-conta__field">
                <span className="minha-conta__label">Confirmar nova senha</span>
                <input
                  type="password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  autoComplete="new-password"
                  minLength={SENHA_MINIMA_CARACTERES}
                  required
                />
              </label>

              {erro ? (
                <p className="minha-conta__alert minha-conta__alert--erro" role="alert">
                  {erro}
                </p>
              ) : null}

              {sucesso ? (
                <p className="minha-conta__alert minha-conta__alert--ok" role="status">
                  {sucesso}
                </p>
              ) : null}

              <button type="submit" className="minha-conta__submit" disabled={carregando}>
                {carregando ? 'A guardar…' : 'Guardar nova senha'}
              </button>
            </form>
          </section>

          <aside className="minha-conta__info" aria-label="Esquecimento de senha">
            <h3 className="minha-conta__info-title">Esqueceu a senha?</h3>
            <p>
              Não existe recuperação automática por e-mail neste sistema. Peça ao{' '}
              <strong>Desenvolvedor</strong> do projeto para redefinir o seu acesso.
            </p>
            <p className="minha-conta__info-muted">
              Administradores e diretoria podem editar perfis em «Utilizadores», mas só o cargo
              Desenvolvedor pode definir uma senha nova por si.
            </p>
            <Link to="/bem-vindo" className="minha-conta__link-voltar">
              Voltar ao início
            </Link>
          </aside>

          <section className="minha-conta__card minha-conta__card--tema" aria-labelledby="minha-conta-tema">
            <h3 id="minha-conta-tema" className="minha-conta__card-title">
              Aparência
            </h3>
            <p className="minha-conta__card-lead">
              Escolha entre tema claro ou escuro. A preferência fica guardada neste navegador e também
              pode ser alterada pelo botão no cabeçalho.
            </p>
            <div className="minha-conta__tema-row">
              <TemaToggle />
              <span className="minha-conta__tema-atual">
                Atual: {tema === 'dark' ? 'Escuro' : 'Claro'}
              </span>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  )
}
