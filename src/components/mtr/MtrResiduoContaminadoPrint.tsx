import { BRAND_LOGO_MARK } from '../../lib/brandLogo'
import type { DeclaracaoResiduoContaminadoDados } from '../../lib/mtrResiduoContaminadoDeclaracao'
import './mtrResiduoContaminadoPrint.css'

type Props = {
  dados: DeclaracaoResiduoContaminadoDados
  /** Referência MTR só na pré-visualização (não no papel). */
  exibirReferenciaMtr?: boolean
}

function CheckEstado({ label, ativo }: { label: string; ativo: boolean }) {
  return (
    <span className="mtr-rc-decl__check">
      <span className={`mtr-rc-decl__box${ativo ? ' mtr-rc-decl__box--on' : ''}`} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

function CampoLinha({ label, valor }: { label: string; valor: string }) {
  const v = (valor || '').trim()
  return (
    <p className="mtr-rc-decl__field">
      <span className="mtr-rc-decl__label">{label}:</span>{' '}
      <span className="mtr-rc-decl__valor">{v || '\u00A0'}</span>
    </p>
  )
}

function BlocoRg({
  titulo,
  bloco,
  comTelefone = true,
}: {
  titulo: string
  bloco: DeclaracaoResiduoContaminadoDados['destino']
  comTelefone?: boolean
}) {
  return (
    <section className="mtr-rc-decl__sec">
      <h3 className="mtr-rc-decl__sec-title">{titulo}</h3>
      <CampoLinha label="Razão Social" valor={bloco.razao_social} />
      <CampoLinha label="CNPJ" valor={bloco.cnpj} />
      <CampoLinha label="Endereço" valor={bloco.endereco} />
      <CampoLinha label="Responsável" valor={bloco.responsavel} />
      <CampoLinha label="E-mail" valor={bloco.email} />
      {comTelefone ? <CampoLinha label="Telefone" valor={bloco.telefone} /> : null}
    </section>
  )
}

export function MtrResiduoContaminadoPrint({ dados, exibirReferenciaMtr = false }: Props) {
  const qtd = (dados.quantidadeKg || '').trim()
  const ef = dados.estadoFisico

  return (
    <article className="mtr-rc-decl" aria-label="Declaração de Remessa de Resíduos — Anexo 2">
      <header className="mtr-rc-decl__head">
        <div className="mtr-rc-decl__logo">
          <img src={BRAND_LOGO_MARK} alt="RG Ambiental" />
        </div>
        <h1 className="mtr-rc-decl__title">Declaração de Remessa de Resíduos</h1>
        <div className="mtr-rc-decl__head-spacer" aria-hidden />
      </header>

      <section className="mtr-rc-decl__sec">
        <h2 className="mtr-rc-decl__sec-title">1. Entidade Geradora:</h2>
        <CampoLinha label="Razão Social" valor={dados.gerador.razaoSocial} />
        <CampoLinha label="CNPJ" valor={dados.gerador.cnpj} />
        <CampoLinha label="Endereço" valor={dados.gerador.endereco} />

        <p className="mtr-rc-decl__paragrafo">
          Declaramos remeter a quantia de{' '}
          <span className="mtr-rc-decl__qtd-inline">{qtd || '\u00A0\u00A0\u00A0\u00A0\u00A0'}</span>
          Kg, contendo resíduo <strong>{dados.classeResiduo}</strong>, sob estado físico:
        </p>

        <div className="mtr-rc-decl__checks" role="group" aria-label="Estado físico">
          <CheckEstado label="Sólido" ativo={ef === 'solido'} />
          <CheckEstado label="Líquido" ativo={ef === 'liquido'} />
          <CheckEstado label="Pastoso" ativo={ef === 'pastoso'} />
          <CheckEstado label="Lodo" ativo={ef === 'lodo'} />
        </div>
      </section>

      <BlocoRg titulo="2. Entidade de Destinação:" bloco={dados.destino} comTelefone />
      <BlocoRg titulo="3. Transporte:" bloco={dados.transporte} comTelefone={false} />

      <p className="mtr-rc-decl__obs">
        <span className="mtr-rc-decl__obs-titulo">OBS:</span> Declaramos que o Material está
        adequadamente acondicionado para suportar os riscos normais das etapas necessárias de uma
        operação de transporte e que atenda a regulamentação vigente.
      </p>

      <div className="mtr-rc-decl__assinatura-bloco">
        <CampoLinha label="Responsável" valor={dados.assinatura.responsavel} />
        <CampoLinha label="Departamento" valor={dados.assinatura.departamento} />
        <CampoLinha label="E-mail" valor={dados.assinatura.email} />
        <CampoLinha label="Telefone" valor={dados.assinatura.telefone} />
      </div>

      <div className="mtr-rc-decl__assinatura-linha">
        <p className="mtr-rc-decl__assinatura-item">
          <span className="mtr-rc-decl__label">Assinatura:</span>
          <span className="mtr-rc-decl__linha-ass" aria-hidden />
        </p>
        <p className="mtr-rc-decl__data-ass">
          <span className="mtr-rc-decl__label">Data:</span>{' '}
          <span className="mtr-rc-decl__data-valor">
            {dados.assinatura.data || '___/___/______'}
          </span>
        </p>
      </div>

      <p className="mtr-rc-decl__rodape">
        Esta declaração deve estar acompanhada das vias da MTR (Manifesto de Transporte de Resíduo).
      </p>

      {exibirReferenciaMtr && dados.numeroMtr ? (
        <p className="mtr-rc-decl__mtr-ref">MTR de referência: {dados.numeroMtr}</p>
      ) : null}
    </article>
  )
}
