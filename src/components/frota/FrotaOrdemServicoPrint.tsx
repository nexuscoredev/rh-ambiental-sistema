import { BRAND_LOGO_MARK } from '../../lib/brandLogo'
import { FROTA_OS_CLASSIFICACOES, type FrotaOrdemServicoPrintData } from '../../lib/frotaOrdemServico'

function CaixaClassificacao({
  label,
  marcado,
}: {
  label: string
  marcado: boolean
}) {
  return (
    <span className="frota-os-print__class-item">
      <span className={`frota-os-print__check${marcado ? ' frota-os-print__check--on' : ''}`} aria-hidden>
        {marcado ? '✓' : ''}
      </span>
      <span>{label}</span>
    </span>
  )
}

function FolhaOs({ dados }: { dados: FrotaOrdemServicoPrintData }) {
  return (
    <section className="frota-os-print__folha">
      <header className="frota-os-print__top">
        <div className="frota-os-print__brand">
          <img src={BRAND_LOGO_MARK} alt="RG Ambiental" className="frota-os-print__logo" />
        </div>
        <div className="frota-os-print__empresa-grid">
          <div>
            <p>
              <strong>Empresa:</strong> {dados.empresa}
            </p>
            <p>
              <strong>CNPJ:</strong> {dados.cnpj}
            </p>
            <p>
              <strong>Planilha:</strong> {dados.planilha}
            </p>
          </div>
          <div className="frota-os-print__os-meta">
            <p>
              <strong>ORDEM DE SERVIÇO:</strong> {dados.numeroOs}
            </p>
            <p>
              <strong>Ano:</strong> {dados.ano}
            </p>
            <p>
              <strong>Email:</strong> {dados.email}
            </p>
            <p>
              <strong>Resp:</strong> {dados.responsavelSetor}
            </p>
          </div>
        </div>
      </header>

      <div className="frota-os-print__class-row">
        {FROTA_OS_CLASSIFICACOES.map(({ key, label }) => (
          <CaixaClassificacao key={key} label={label} marcado={Boolean(dados.classificacao[key])} />
        ))}
        <span className="frota-os-print__placa">
          <strong>PLACA:</strong> {dados.placa || '—'}
        </span>
      </div>

      <p className="frota-os-print__linha">
        <strong>Solicitante:</strong> {dados.solicitante || ' '}
      </p>

      <div className="frota-os-print__caixa">
        <p className="frota-os-print__caixa-titulo">OCORRIDO / SOLICITAÇÃO</p>
        <div className="frota-os-print__caixa-corpo">{dados.ocorrido || '\u00A0'}</div>
      </div>

      <div className="frota-os-print__caixa">
        <p className="frota-os-print__caixa-titulo">COMPRA / SOLUÇÃO</p>
        <div className="frota-os-print__caixa-corpo">{dados.compraSolucao || '\u00A0'}</div>
      </div>

      <div className="frota-os-print__datas-row">
        <span>
          <strong>Data de inicio :</strong> {dados.dataInicio || '___/___/______'}
        </span>
        <span>
          <strong>Data Término:</strong> {dados.dataTermino || '___/___/______'}
        </span>
      </div>

      <footer className="frota-os-print__assinaturas">
        <div className="frota-os-print__ass-col">
          <div className="frota-os-print__ass-nome-area">{dados.autorizado || '\u00A0'}</div>
          <div className="frota-os-print__ass-linha" />
          <p className="frota-os-print__ass-label">AUTORIZADO</p>
        </div>
        <div className="frota-os-print__ass-col">
          <div className="frota-os-print__ass-nome-area">{dados.responsavelExecucao || '\u00A0'}</div>
          <div className="frota-os-print__ass-linha" />
          <p className="frota-os-print__ass-label">RESPONSAVEL PELA EXECUÇÃO</p>
        </div>
        <div className="frota-os-print__ass-col">
          <div className="frota-os-print__ass-nome-area">{dados.responsavelSolicitacao || '\u00A0'}</div>
          <div className="frota-os-print__ass-linha" />
          <p className="frota-os-print__ass-label">RESPONSAVEL PELA SOLICITAÇÃO</p>
        </div>
      </footer>
    </section>
  )
}

export function FrotaOrdemServicoPrint({ dados }: { dados: FrotaOrdemServicoPrintData }) {
  return (
    <div id="frota-os-print-root" className="frota-os-print-root">
      <FolhaOs dados={dados} />
    </div>
  )
}
