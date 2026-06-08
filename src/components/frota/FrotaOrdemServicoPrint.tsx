import { BRAND_LOGO_MARK } from '../../lib/brandLogo'
import type { FrotaOrdemServicoPrintData } from '../../lib/frotaOrdemServico'
import type { FrotaOsClassificacao } from '../../lib/frotaTypes'

const GRID_CLASSIFICACAO: { key: keyof FrotaOsClassificacao; label: string }[][] = [
  [
    { key: 'preventiva', label: 'PREVENTIVA' },
    { key: 'corretiva', label: 'CORRETIVA' },
    { key: 'frota', label: 'FROTA' },
  ],
  [
    { key: 'planejada', label: 'PLANEJADA' },
    { key: 'urgencia', label: 'URGÊNCIA' },
    { key: 'geral', label: 'GERAL' },
  ],
]

function CaixaClassificacao({
  label,
  marcado,
}: {
  label: string
  marcado: boolean
}) {
  return (
    <span className="frota-os-print__class-item">
      <span className={`frota-os-print__check${marcado ? ' frota-os-print__check--on' : ''}`} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

function FolhaOs({ dados }: { dados: FrotaOrdemServicoPrintData }) {
  return (
    <section className="frota-os-print__folha">
      <header className="frota-os-print__top">
        <div className="frota-os-print__top-main">
          <img src={BRAND_LOGO_MARK} alt="RG Ambiental" className="frota-os-print__logo" />
          <div className="frota-os-print__empresa-col">
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
          <div className="frota-os-print__os-titulo">
            <p className="frota-os-print__os-titulo-linha">ORDEM DE SERVIÇO</p>
            <p className="frota-os-print__os-numero">{dados.numeroOs}</p>
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

      <div className="frota-os-print__class-box">
        <div className="frota-os-print__class-grid">
          {GRID_CLASSIFICACAO.map((linha, i) => (
            <div key={i} className="frota-os-print__class-linha">
              {linha.map(({ key, label }) => (
                <CaixaClassificacao key={key} label={label} marcado={Boolean(dados.classificacao[key])} />
              ))}
            </div>
          ))}
        </div>
        <div className="frota-os-print__placa-box">
          <strong>PLACA:</strong> {dados.placa || '—'}
        </div>
      </div>

      <div className="frota-os-print__solicitante-box">
        <strong>Solicitante:</strong>
        <span className="frota-os-print__solicitante-valor">{dados.solicitante || '\u00A0'}</span>
      </div>

      <div className="frota-os-print__caixa">
        <p className="frota-os-print__caixa-titulo">OCORRIDO/ SOLICITAÇÃO</p>
        <div className="frota-os-print__caixa-corpo">{dados.ocorrido || '\u00A0'}</div>
      </div>

      <div className="frota-os-print__caixa">
        <p className="frota-os-print__caixa-titulo">COMPRA / SOLUÇÃO</p>
        <div className="frota-os-print__caixa-corpo">{dados.compraSolucao || '\u00A0'}</div>
      </div>

      <div className="frota-os-print__datas-row">
        <span>
          <strong>Data de Inicio:</strong> {dados.dataInicio || '___/___/______'}
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
      <div className="frota-os-print__corte" aria-hidden="true" />
      <FolhaOs dados={dados} />
    </div>
  )
}
