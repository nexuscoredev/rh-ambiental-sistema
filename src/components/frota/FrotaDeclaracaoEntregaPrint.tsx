import { BRAND_WELCOME_LOGO } from '../../lib/brandLogo'
import {
  formatarDataDocumentoExtenso,
  formatarDataEntrega,
  localDocumentoRg,
  type FrotaDeclaracaoEntregaDados,
} from '../../lib/frotaDeclaracaoEntrega'
import './frotaDeclaracaoEntregaPrint.css'

type Props = {
  dados: FrotaDeclaracaoEntregaDados
}

function Campo({ label, valor }: { label: string; valor: string }) {
  const v = valor.trim()
  return (
    <p className="frota-decl-entrega__field">
      <span className="frota-decl-entrega__label">{label}:</span>{' '}
      <span className="frota-decl-entrega__valor">{v || '\u00A0'}</span>
    </p>
  )
}

export function FrotaDeclaracaoEntregaPrint({ dados }: Props) {
  const razao = dados.razaoSocial.trim()
  const localData = `${localDocumentoRg()}, ${formatarDataDocumentoExtenso(dados.dataDocumento)}.`

  return (
    <div id="frota-decl-entrega-print-root" className="frota-decl-entrega-print-root">
      <article className="frota-decl-entrega" aria-label="Declaração de entrega de equipamento">
        <div className="frota-decl-entrega__stripes" aria-hidden>
          <svg viewBox="0 0 90 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="#6ec4b8"
              d="M0,0 L55,0 C35,120 75,200 45,400 C15,600 70,680 50,800 L0,800 Z"
            />
            <path
              fill="#d4ea6e"
              d="M0,0 L42,0 C25,100 55,180 35,400 C15,620 48,700 38,800 L0,800 Z"
            />
            <path
              fill="#e8f8f0"
              d="M0,0 L28,0 C18,90 38,200 22,400 C6,580 32,700 24,800 L0,800 Z"
            />
            <rect x="0" y="0" width="6" height="800" fill="#6ec4b8" />
          </svg>
        </div>

        <div className="frota-decl-entrega__body">
          <header className="frota-decl-entrega__head">
            <img
              src={BRAND_WELCOME_LOGO}
              alt="RG Ambiental"
              className="frota-decl-entrega__logo"
            />
            <p className="frota-decl-entrega__local-data">{localData}</p>
          </header>

          <h1 className="frota-decl-entrega__title">Declaração de entrega de equipamento</h1>

          <Campo label="Razão Social" valor={razao} />
          <Campo label="Endereço" valor={dados.endereco} />
          <Campo label="Telefone" valor={dados.telefone} />

          <p className="frota-decl-entrega__saudacao">Prezados:</p>

          <p className="frota-decl-entrega__texto">
            Declaramos a entrega do equipamento mencionado abaixo nas dependências da{' '}
            <strong>{razao || '—'}</strong>. Estando os acondicionamentos em plenas condições de uso e
            sendo o cliente responsável pela devolução do equipamento nas mesmas condições da instalação.
          </p>

          <Campo label="Equipamento" valor={dados.equipamento} />
          <Campo label="Data da entrega" valor={formatarDataEntrega(dados.dataEntrega)} />

          <footer className="frota-decl-entrega__assinatura">
            <div className="frota-decl-entrega__assinatura-linha" />
            <p className="frota-decl-entrega__assinatura-empresa">
              <strong>{razao || '—'}</strong>
            </p>
            <p className="frota-decl-entrega__assinatura-label">Empresa responsável pelo recebimento</p>
          </footer>
        </div>
      </article>
    </div>
  )
}
