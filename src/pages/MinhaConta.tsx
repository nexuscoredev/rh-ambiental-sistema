import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import { alterarSenhaPropria, SENHA_MINIMA_CARACTERES } from '../lib/alterarSenhaPropria'
import { supabase } from '../lib/supabase'

export default function MinhaConta() {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

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

  return (
    <MainLayout>
      <div className="minha-conta">
        <header className="minha-conta__header">
          <p className="page-header__eyebrow">Conta</p>
          <h2 className="page-header__title">Minha conta</h2>
          <p className="page-header__lead">
            Altere aqui a sua senha de acesso. Para outros dados (nome, cargo, páginas), contacte um
            administrador.
          </p>
        </header>

        <div className="minha-conta__grid">
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
        </div>
      </div>
    </MainLayout>
  )
}
