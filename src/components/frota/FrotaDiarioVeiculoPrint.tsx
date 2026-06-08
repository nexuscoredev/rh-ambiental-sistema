import { BRAND_LOGO_MARK } from '../../lib/brandLogo'
import {
  FROTA_DIARIO_CHECKLIST_IMPRESSAO,
  type FrotaDiarioPrintData,
} from '../../lib/frotaDiarioImpressao'

function FolhaDiario({ dados }: { dados: FrotaDiarioPrintData }) {
  return (
    <section className="frota-diario-print__folha">
      <header className="frota-diario-print__top">
        <div className="frota-diario-print__top-main">
          <img src={BRAND_LOGO_MARK} alt="RG Ambiental" className="frota-diario-print__logo" />
          <div className="frota-diario-print__empresa-col">
            <p>
              <strong>Empresa:</strong> {dados.empresa}
            </p>
            <p>
              <strong>CNPJ:</strong> {dados.cnpj}
            </p>
            <p>
              <strong>Email:</strong> {dados.email}
            </p>
          </div>
          <div className="frota-diario-print__titulo-box">
            <p className="frota-diario-print__titulo">DIÁRIO DO VEÍCULO</p>
            <p className="frota-diario-print__data">{dados.dataDiarioBr}</p>
          </div>
        </div>
      </header>

      <div className="frota-diario-print__grid-dados">
        <p>
          <strong>Veículo:</strong> {dados.veiculoLabel}
        </p>
        <p>
          <strong>Placa:</strong> {dados.placa}
        </p>
        <p>
          <strong>Km odómetro:</strong> {dados.kmOdometro}
        </p>
        <p>
          <strong>Última troca óleo:</strong> {dados.oleoKm}
          {dados.oleoData !== '—' ? ` · ${dados.oleoData}` : ''}
        </p>
      </div>

      <div className="frota-diario-print__checklist-box">
        <p className="frota-diario-print__sec-titulo">Checklist diário</p>
        <ul className="frota-diario-print__checklist">
          {FROTA_DIARIO_CHECKLIST_IMPRESSAO.map(({ key, label }) => (
            <li key={key}>
              <span
                className={`frota-diario-print__check${dados.checklist[key] ? ' frota-diario-print__check--on' : ''}`}
                aria-hidden
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="frota-diario-print__caixa">
        <p className="frota-diario-print__caixa-titulo">Anomalias / ocorrências</p>
        <div className="frota-diario-print__caixa-corpo">{dados.anomalias || '\u00A0'}</div>
      </div>

      <div className="frota-diario-print__caixa">
        <p className="frota-diario-print__caixa-titulo">Observações</p>
        <div className="frota-diario-print__caixa-corpo">{dados.observacoes || '\u00A0'}</div>
      </div>

      <footer className="frota-diario-print__assinaturas">
        <div className="frota-diario-print__ass-col">
          <p className="frota-diario-print__ass-titulo">Responsável pelo registo</p>
          <div className="frota-diario-print__ass-nome">{dados.responsavelNome || '\u00A0'}</div>
          <div className="frota-diario-print__ass-linha" />
          <p className="frota-diario-print__ass-label">NOME E ASSINATURA</p>
          {dados.responsavelCargo ? (
            <p className="frota-diario-print__ass-cargo">{dados.responsavelCargo}</p>
          ) : null}
        </div>
        <div className="frota-diario-print__ass-col">
          <p className="frota-diario-print__ass-titulo">Visto / conferência</p>
          <div className="frota-diario-print__ass-nome">{'\u00A0'}</div>
          <div className="frota-diario-print__ass-linha" />
          <p className="frota-diario-print__ass-label">ASSINATURA FÍSICA</p>
          <p className="frota-diario-print__ass-data">Data: ___/___/______</p>
        </div>
      </footer>
    </section>
  )
}

export function FrotaDiarioVeiculoPrint({ dados }: { dados: FrotaDiarioPrintData }) {
  return (
    <div id="frota-diario-print-root" className="frota-diario-print-root">
      <FolhaDiario dados={dados} />
      <div className="frota-diario-print__corte" aria-hidden="true" />
      <FolhaDiario dados={dados} />
    </div>
  )
}
