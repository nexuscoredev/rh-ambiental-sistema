import type { FrotaDiarioChecklist, FrotaDiarioRow } from '../../lib/frotaTypes'

const CHECKLIST_LABELS: { key: keyof FrotaDiarioChecklist; label: string }[] = [
  { key: 'oleo_nivel_ok', label: 'Nível de óleo OK' },
  { key: 'pneus_ok', label: 'Pneus / calibragem OK' },
  { key: 'freios_ok', label: 'Freios OK' },
  { key: 'luzes_ok', label: 'Luzes e sinalização OK' },
  { key: 'documentacao_ok', label: 'Documentação do veículo OK' },
  { key: 'limpeza_ok', label: 'Limpeza / higiene OK' },
]

type Props = {
  row: FrotaDiarioRow
  veiculoLabel: string
  onFechar: () => void
  onEditar: () => void
  podeExcluir?: boolean
  excluindo?: boolean
  onExcluir?: () => void
}

export function FrotaDiarioResumoModal({
  row,
  veiculoLabel,
  onFechar,
  onEditar,
  podeExcluir = false,
  excluindo = false,
  onExcluir,
}: Props) {
  const cl = row.checklist ?? {}
  const anomalias = cl.anomalias?.trim()

  return (
    <div
      className="frota-diario-resumo-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="frota-diario-resumo-titulo"
      onClick={onFechar}
    >
      <div className="frota-diario-resumo-modal__card" onClick={(e) => e.stopPropagation()}>
        <header className="frota-diario-resumo-modal__head">
          <h4 id="frota-diario-resumo-titulo" className="frota-diario-resumo-modal__title">
            Resumo do diário — {row.data_diario}
          </h4>
          <button type="button" className="frota-diario-resumo-modal__close" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </header>

        <dl className="frota-diario-resumo-modal__dl">
          <div>
            <dt>Veículo</dt>
            <dd>{veiculoLabel}</dd>
          </div>
          <div>
            <dt>Km odómetro</dt>
            <dd>{row.km_odometro != null ? `${row.km_odometro.toLocaleString('pt-BR')} km` : '—'}</dd>
          </div>
          <div>
            <dt>Última troca de óleo</dt>
            <dd>
              {row.ultima_troca_oleo_km != null
                ? `${row.ultima_troca_oleo_km.toLocaleString('pt-BR')} km`
                : '—'}
              {row.ultima_troca_oleo_data ? ` · ${row.ultima_troca_oleo_data}` : ''}
            </dd>
          </div>
          <div className="frota-diario-resumo-modal__sep" aria-hidden />
          <div>
            <dt>Checklist</dt>
            <dd>
              <ul className="frota-diario-resumo-modal__checklist">
                {CHECKLIST_LABELS.map(({ key, label }) => (
                  <li key={key} data-ok={cl[key] ? '1' : '0'}>
                    {cl[key] ? '✓' : '○'} {label}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          {anomalias ? (
            <div>
              <dt>Anomalias</dt>
              <dd className="frota-diario-resumo-modal__texto">{anomalias}</dd>
            </div>
          ) : null}
          {row.observacoes?.trim() ? (
            <div>
              <dt>Observações</dt>
              <dd className="frota-diario-resumo-modal__texto">{row.observacoes.trim()}</dd>
            </div>
          ) : null}
          {row.fotos.length > 0 ? (
            <div>
              <dt>Fotos ({row.fotos.length})</dt>
              <dd>
                <ul className="frota-diario-resumo-modal__fotos">
                  {row.fotos.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" loading="lazy" />
                      </a>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {row.assinatura_responsavel_nome ? (
            <>
              <div className="frota-diario-resumo-modal__sep" aria-hidden />
              <div>
                <dt>Responsável</dt>
                <dd>
                  {row.assinatura_responsavel_nome}
                  {row.assinatura_responsavel_cargo ? ` · ${row.assinatura_responsavel_cargo}` : ''}
                </dd>
              </div>
              {row.assinatura_em ? (
                <div>
                  <dt>Assinado em</dt>
                  <dd>{new Date(row.assinatura_em).toLocaleString('pt-BR')}</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>

        <footer className="frota-diario-resumo-modal__foot">
          <button type="button" className="frota-diario-resumo-modal__btn" onClick={onEditar}>
            Editar registo
          </button>
          {podeExcluir && onExcluir ? (
            <button
              type="button"
              className="frota-diario-resumo-modal__btn frota-diario-resumo-modal__btn--danger"
              disabled={excluindo}
              onClick={onExcluir}
            >
              {excluindo ? 'A excluir…' : 'Excluir'}
            </button>
          ) : null}
          <button
            type="button"
            className="frota-diario-resumo-modal__btn frota-diario-resumo-modal__btn--ghost"
            onClick={onFechar}
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}
