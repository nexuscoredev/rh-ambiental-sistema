import { BRAND_LOGO_MARK } from '../../lib/brandLogo'
import { FROTA_TIPOS_MOVIMENTACAO } from '../../lib/frotaModulos'
import { RG_AMBIENTAL_DADOS_CORPORATIVOS } from '../../lib/rgAmbientalDadosCorporativos'
import type { FrotaDiarioRow, FrotaManutencaoRow, FrotaMovimentacaoRow } from '../../lib/frotaTypes'

export type FrotaRelatorioPrintDocumentProps = {
  periodoLabel: string
  geradoEm: string
  movimentacoes: FrotaMovimentacaoRow[]
  manutencoes: FrotaManutencaoRow[]
  diarios: FrotaDiarioRow[]
  assinado: boolean
  assNome: string
  assCargo: string
  assinaturaEm: string
}

function labelTipoMovimentacao(id: string) {
  return FROTA_TIPOS_MOVIMENTACAO.find((t) => t.id === id)?.label ?? id
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function FrotaRelatorioPrintDocument({
  periodoLabel,
  geradoEm,
  movimentacoes,
  manutencoes,
  diarios,
  assinado,
  assNome,
  assCargo,
  assinaturaEm,
}: FrotaRelatorioPrintDocumentProps) {
  return (
    <div className="frota-relatorio-print-root">
      <header className="frota-relatorio-print-root__header">
        <img
          className="frota-relatorio-print-root__logo"
          src={BRAND_LOGO_MARK}
          alt="RG Ambiental"
          decoding="async"
        />
        <h1 className="frota-relatorio-print-root__title">Relatório operacional — Frota RG Ambiental</h1>
        <p className="frota-relatorio-print-root__meta">
          {RG_AMBIENTAL_DADOS_CORPORATIVOS.razao_social} · CNPJ {RG_AMBIENTAL_DADOS_CORPORATIVOS.cnpj}
          <br />
          Período: {periodoLabel}
          <br />
          Movimentações: {movimentacoes.length} · Manutenções: {manutencoes.length} · Diários:{' '}
          {diarios.length}
          <br />
          Emitido em {geradoEm}
        </p>
      </header>

      <h2 className="frota-relatorio-print-root__section">Movimentação de equipamentos</h2>
      {movimentacoes.length === 0 ? (
        <p className="frota-relatorio-print-root__empty">Nenhum registo no período.</p>
      ) : (
        <table className="frota-relatorio-print-root__table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Equipamento</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map((m) => (
              <tr key={m.id}>
                <td>{fmtData(m.created_at)}</td>
                <td>{labelTipoMovimentacao(m.tipo_movimentacao)}</td>
                <td>{m.cliente_nome ?? '—'}</td>
                <td>{m.equipamento_descricao}</td>
                <td>{m.assinatura_responsavel_nome ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="frota-relatorio-print-root__section">Manutenção</h2>
      {manutencoes.length === 0 ? (
        <p className="frota-relatorio-print-root__empty">Nenhum registo no período.</p>
      ) : (
        <table className="frota-relatorio-print-root__table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Veículo</th>
              <th>Tipo</th>
              <th>Serviço</th>
              <th>Km</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {manutencoes.map((m) => (
              <tr key={m.id}>
                <td>{m.realizado_em}</td>
                <td>{m.caminhao_placa ?? '—'}</td>
                <td>{m.tipo_manutencao}</td>
                <td>{m.titulo}</td>
                <td>{m.km_atual?.toLocaleString('pt-BR') ?? '—'}</td>
                <td>{m.assinatura_responsavel_nome ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="frota-relatorio-print-root__section">Diário dos veículos</h2>
      {diarios.length === 0 ? (
        <p className="frota-relatorio-print-root__empty">Nenhum diário no período.</p>
      ) : (
        <table className="frota-relatorio-print-root__table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Placa</th>
              <th>Km</th>
              <th>Óleo (km)</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {diarios.map((d) => (
              <tr key={d.id}>
                <td>{d.data_diario}</td>
                <td>{d.caminhao_placa ?? '—'}</td>
                <td>{d.km_odometro?.toLocaleString('pt-BR') ?? '—'}</td>
                <td>{d.ultima_troca_oleo_km?.toLocaleString('pt-BR') ?? '—'}</td>
                <td>{d.assinatura_responsavel_nome ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="frota-relatorio-print-root__sign">
        <h2 className="frota-relatorio-print-root__section">Assinatura</h2>
        {assinado ? (
          <>
            <p className="frota-relatorio-print-root__sign-meta">
              <strong>Responsável RG:</strong> {assNome}
              {assCargo ? ` — ${assCargo}` : ''}
              <br />
              <strong>Confirmado em:</strong> {assinaturaEm}
            </p>
            <div className="frota-relatorio-print-root__sign-nome">{assNome || '\u00A0'}</div>
            <div className="frota-relatorio-print-root__sign-line" />
            <p className="frota-relatorio-print-root__sign-label">NOME E ASSINATURA FÍSICA</p>
          </>
        ) : (
          <p className="frota-relatorio-print-root__empty">Assinatura pendente (confirme no sistema antes de imprimir).</p>
        )}
      </footer>

      <p className="frota-relatorio-print-root__footer">
        Documento gerado pelo sistema RG Ambiental — use &quot;Salvar como PDF&quot; na impressão do navegador,
        se desejar.
      </p>
    </div>
  )
}
